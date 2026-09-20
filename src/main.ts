import { App, Modal, Notice, Platform, Plugin, Setting, TFile, TFolder, normalizePath, parseYaml, stringifyYaml } from 'obsidian';
import {
  DEFAULT_SETTINGS,
  DEFAULT_VIDEO_FRONTMATTER_TEMPLATE,
  providerDisplayName,
  resolvedAIEndpoint,
  resolvedAIModel,
  type PlaylistSyncResult,
  type TranscriptLine,
  type VideoMetadata,
  type YouTubePlaylistSyncSettings,
} from './types';
import {
  fetchPlaylist,
  fetchTranscriptLines,
  fetchVideoMetadata,
  selectCaptionTrack,
} from './youtube';
import {
  buildPlaylistIndexNote,
  buildRootIndex,
  buildVideoNote,
  sanitizeNoteFileName,
} from './noteRenderer';
import { YouTubePlaylistSyncSettingTab } from './settings';
import { OpenAICompatibleProvider } from './ai/openai';
import type { AIProvider } from './ai/types';
import {
  applyAISummaryBlockToNote,
  applyAISummaryToNote,
  extractChannelFromNote,
  extractTitleFromNote,
  extractTranscriptFromNote,
  hasAISummary,
} from './ai/noteUpdater';
import {
  createVideoMetadataRecord,
  extractVideoMetadataRecord,
  validateVideoTemplate,
  VIDEO_METADATA_MARKER_PREFIX,
} from './frontmatter';
import {
  recordForVideoNote,
  rewriteVideoNoteFrontmatter,
  type RewrittenVideoNote,
} from './noteFrontmatter';
import { normalizeSettings } from './settingsModel';

const PLAYLIST_ID_REGEX = /(?:[?&]list=|youtube\.com\/playlist\/)([a-zA-Z0-9_-]+)/;
const VIDEO_ID_FRONTMATTER_REGEX = /^videoId:\s*["']?([^"'\s]+)["']?\s*$/m;
const SOURCE_FRONTMATTER_REGEX = /^source:\s*["']?youtube["']?\s*$/m;
interface MigrationCandidate {
  file: TFile;
  preview: RewrittenVideoNote;
}

class MigrationPreviewModal extends Modal {
  private settled = false;

  constructor(
    app: App,
    private readonly matched: number,
    private readonly skipped: number,
    private readonly preview: RewrittenVideoNote,
    private readonly resolveChoice: (confirmed: boolean) => void,
  ) {
    super(app);
  }

  onOpen(): void {
    this.setTitle('Apply video frontmatter template');
    this.contentEl.createEl('p', {
      text: `${this.matched} video note${this.matched === 1 ? '' : 's'} matched; ${this.skipped} skipped.`,
    });
    this.contentEl.createEl('p', {
      text: 'Only frontmatter and the hidden plugin metadata marker will change. YAML formatting and comments may be normalized.',
      cls: 'setting-item-description',
    });
    this.contentEl.createEl('h3', { text: 'Before (first matched note)' });
    this.contentEl.createEl('pre', { text: this.preview.beforeYaml });
    this.contentEl.createEl('h3', { text: 'After' });
    this.contentEl.createEl('pre', { text: this.preview.afterYaml });
    new Setting(this.contentEl)
      .addButton((button) => button.setButtonText('Cancel').onClick(() => this.finish(false)))
      .addButton((button) => button.setButtonText('Apply migration').setCta().onClick(() => this.finish(true)));
  }

  onClose(): void {
    if (!this.settled) this.finish(false);
  }

  private finish(confirmed: boolean): void {
    if (this.settled) return;
    this.settled = true;
    this.resolveChoice(confirmed);
    this.close();
  }
}

export default class YouTubePlaylistSyncPlugin extends Plugin {
  settings: YouTubePlaylistSyncSettings = DEFAULT_SETTINGS;
  private isSyncing = false;
  private isAISummarizing = false;
  private lastSyncAt = 0;
  private statusBarEl?: HTMLElement;
  private warnedAboutInvalidTemplate = false;

  async onload(): Promise<void> {
    await this.loadSettings();
    this.lastSyncAt = Date.now();

    if (Platform.isDesktopApp) {
      this.statusBarEl = this.addStatusBarItem();
      this.updateStatusBar('idle');
    }

    this.addSettingTab(new YouTubePlaylistSyncSettingTab(this.app, this));

    this.addRibbonIcon('refresh-cw', 'Sync YouTube playlists now', () => {
      void this.syncAll();
    });

    this.addCommand({
      id: 'sync-now',
      name: 'Sync YouTube playlists now',
      callback: () => {
        void this.syncAll();
      },
    });

    this.addCommand({
      id: 'generate-ai-summary-current-note',
      name: 'Generate AI summary for current YouTube note',
      callback: () => {
        void this.generateSummaryForCurrentNote();
      },
    });

    this.addCommand({
      id: 'generate-missing-ai-summaries',
      name: 'Generate missing AI summaries',
      callback: () => {
        void this.generateMissingSummaries();
      },
    });

    this.addCommand({
      id: 'apply-video-frontmatter-template',
      name: 'Apply frontmatter template to existing YouTube notes',
      callback: () => {
        void this.previewAndApplyFrontmatterMigration();
      },
    });

    this.app.workspace.onLayoutReady(() => {
      if (this.settings.syncOnStartup) {
        window.setTimeout(() => {
          void this.syncAll();
        }, 3000);
      }
    });

    // Timers only run while Obsidian is active. This is also the intended mobile behavior.
    this.registerInterval(
      window.setInterval(() => {
        void this.syncIfIntervalElapsed();
      }, 60_000),
    );

    // Mobile apps can suspend timers. Re-check the interval when the app becomes visible again.
    this.registerDomEvent(document, 'visibilitychange', () => {
      if (document.visibilityState === 'visible') void this.syncIfIntervalElapsed();
    });
  }

  async loadSettings(): Promise<void> {
    const stored: unknown = await this.loadData();
    this.settings = normalizeSettings(stored);
  }

  async saveSettings(): Promise<void> {
    await this.saveData(this.settings);
  }

  private updateStatusBar(text: string): void {
    this.statusBarEl?.setText(`🔄 YT Sync: ${text}`);
  }

  private async syncIfIntervalElapsed(): Promise<void> {
    const intervalMs = this.settings.syncIntervalMinutes * 60_000;
    if (intervalMs > 0 && Date.now() - this.lastSyncAt >= intervalMs) {
      await this.syncAll();
    }
  }

  private getPlaylistId(url: string): string | null {
    const match = url.match(PLAYLIST_ID_REGEX);
    return match?.[1] ?? null;
  }

  /** Run a sync for every configured playlist. Safe to call concurrently. */
  async syncAll(): Promise<void> {
    if (this.isSyncing) {
      new Notice('YouTube Sync is already running.');
      return;
    }
    if (!this.settings.playlists.length) {
      new Notice('YouTube Sync: add a playlist in Settings first.');
      return;
    }
    this.isSyncing = true;
    this.updateStatusBar('syncing…');
    try {
      const results: PlaylistSyncResult[] = [];
      for (const playlist of this.settings.playlists) {
        try {
          results.push(await this.syncPlaylist(playlist.url));
        } catch (error) {
          console.error('YouTube Sync: playlist failed', playlist.url, error);
          results.push({
            name: playlist.url,
            playlistId: this.getPlaylistId(playlist.url) ?? '',
            total: 0,
            created: 0,
            skipped: 0,
            failed: 0,
            folder: '',
            error: String(error),
          });
        }
      }
      await this.writeRootIndex(results);
      this.lastSyncAt = Date.now();

      const created = results.reduce((sum, r) => sum + r.created, 0);
      const failed = results.reduce((sum, r) => sum + r.failed, 0);
      const errors = results.filter((r) => r.error);
      const message = errors.length
        ? `YouTube Sync: ${created} new notes, ${failed} failed (${errors.length} playlist error${errors.length > 1 ? 's' : ''})`
        : `YouTube Sync: ${created} new notes${failed ? `, ${failed} failed` : ''}`;
      new Notice(message);
      this.updateStatusBar(new Date().toLocaleTimeString());
    } finally {
      this.isSyncing = false;
    }
  }

  private async syncPlaylist(url: string): Promise<PlaylistSyncResult> {
    const playlistId = this.getPlaylistId(url);
    if (!playlistId) throw new Error(`Could not parse playlist ID from: ${url}`);

    const { entries, title } = await fetchPlaylist(playlistId);
    const name = title ?? `Playlist ${playlistId}`;

    const folder = normalizePath(`${this.settings.baseFolder}/${sanitizeNoteFileName(name) || playlistId}`);
    await this.ensureFolder(folder);

    const synced = await this.scanSyncedVideoIds(folder);

    let created = 0;
    let skipped = 0;
    let failed = 0;
    let autoAIProvider: AIProvider | null = null;
    const videoTemplate = this.videoTemplateForSync();

    if (this.settings.aiEnabled && this.settings.aiAutoGenerate) {
      try {
        autoAIProvider = this.createAIProvider();
      } catch (error) {
        console.warn('YouTube Sync: automatic AI summaries are unavailable for this sync', error);
      }
    }

    for (const entry of entries) {
      if (synced.has(entry.videoId)) {
        skipped += 1;
        continue;
      }
      try {
        const meta = await fetchVideoMetadata(entry.videoId);
        const transcript = await this.fetchTranscript(meta);
        const content = buildVideoNote(
          meta,
          { name, url, id: playlistId },
          transcript,
          this.settings,
          parseYaml,
          videoTemplate,
        );
        const path = await this.uniqueNotePath(folder, meta.title || entry.title);
        const file = await this.app.vault.create(path, content);
        synced.add(entry.videoId);
        created += 1;

        // AI is deliberately best-effort: a failed AI request never turns a successful YouTube sync into a failure.
        if (autoAIProvider && transcript?.length) {
          try {
            await this.generateAISummaryForFile(file, {
              title: meta.title,
              channel: meta.author,
              transcript: transcript.map((line) => line.text).join(' '),
            }, autoAIProvider);
          } catch (error) {
            console.warn(`YouTube Sync: AI summary failed for "${meta.title}"`, error);
            if (this.isFatalAIError(error)) autoAIProvider = null;
          }
        }
      } catch (error) {
        failed += 1;
        console.error(`YouTube Sync: failed for "${entry.title}"`, error);
      }
      await new Promise((resolve) => window.setTimeout(resolve, 150));
    }

    if (this.settings.createIndexNote) {
      const index = buildPlaylistIndexNote({ name, url, id: playlistId }, entries, folder);
      await this.overwriteFile(`${folder}/_Index.md`, index);
    }

    return { name, playlistId, total: entries.length, created, skipped, failed, folder };
  }

  private async fetchTranscript(meta: VideoMetadata): Promise<TranscriptLine[] | null> {
    if (!meta.captionTracks?.length) return null;
    try {
      const track = selectCaptionTrack(meta.captionTracks, this.settings.preferredLanguage);
      if (!track) return null;
      const lines = await fetchTranscriptLines(track.baseUrl);
      return lines.length ? lines : null;
    } catch (error) {
      console.warn(`YouTube Sync: no transcript for ${meta.videoId}`, error);
      return null;
    }
  }

  async testAIConnection(): Promise<void> {
    try {
      const provider = this.createAIProvider();
      await provider.validateCredentials();
      new Notice(`${provider.displayName} connection succeeded (${provider.model}).`);
    } catch (error) {
      new Notice(`AI connection failed: ${this.userFacingError(error)}`);
    }
  }

  async generateSummaryForCurrentNote(): Promise<void> {
    const file = this.app.workspace.getActiveFile();
    if (!file) {
      new Notice('Open a YouTube note first.');
      return;
    }
    try {
      await this.generateAISummaryForFile(file);
      new Notice('AI summary generated.');
    } catch (error) {
      new Notice(`AI summary failed: ${this.userFacingError(error)}`);
    }
  }

  async generateMissingSummaries(): Promise<void> {
    if (this.isAISummarizing) {
      new Notice('AI summary generation is already running.');
      return;
    }
    if (!this.settings.aiEnabled) {
      new Notice('Enable AI summaries in plugin settings first.');
      return;
    }

    let provider: AIProvider;
    try {
      provider = this.createAIProvider();
    } catch (error) {
      new Notice(`AI summary setup error: ${this.userFacingError(error)}`);
      return;
    }

    const base = normalizePath(this.settings.baseFolder);
    const prefix = base.endsWith('/') ? base : `${base}/`;
    const candidates: TFile[] = [];
    for (const file of this.app.vault.getMarkdownFiles()) {
      if (!(file.path === `${base}/Index.md` || file.path.startsWith(prefix))) continue;
      const content = await this.app.vault.cachedRead(file);
      if (!SOURCE_FRONTMATTER_REGEX.test(content.slice(0, 4000))) continue;
      if (!extractTranscriptFromNote(content) || hasAISummary(content)) continue;
      candidates.push(file);
    }

    if (!candidates.length) {
      new Notice('No YouTube notes are missing AI summaries.');
      return;
    }

    this.isAISummarizing = true;
    let succeeded = 0;
    let failed = 0;
    try {
      for (const file of candidates) {
        try {
          await this.generateAISummaryForFile(file, undefined, provider);
          succeeded += 1;
        } catch (error) {
          failed += 1;
          console.warn(`YouTube Sync: AI summary failed for ${file.path}`, error);
          if (this.isFatalAIError(error)) {
            failed += candidates.length - succeeded - failed;
            break;
          }
        }
      }
    } finally {
      this.isAISummarizing = false;
    }
    new Notice(`AI summaries: ${succeeded} generated${failed ? `, ${failed} failed` : ''}.`);
  }

  async previewAndApplyFrontmatterMigration(): Promise<void> {
    try {
      validateVideoTemplate(this.settings.videoFrontmatterTemplate, parseYaml);
    } catch (error) {
      new Notice(`Frontmatter migration unavailable: ${this.userFacingError(error)}`);
      return;
    }

    const base = normalizePath(this.settings.baseFolder);
    const prefix = base.endsWith('/') ? base : `${base}/`;
    const candidates: MigrationCandidate[] = [];
    let skipped = 0;

    for (const file of this.app.vault.getMarkdownFiles()) {
      if (!file.path.startsWith(prefix)) continue;
      let content: string;
      try {
        content = await this.app.vault.read(file);
      } catch (error) {
        skipped += 1;
        console.warn(`YouTube Sync: could not read ${file.path} for frontmatter migration`, error);
        continue;
      }
      const head = content.slice(0, 4000);
      const looksLikeVideoNote = content.includes(VIDEO_METADATA_MARKER_PREFIX)
        || (SOURCE_FRONTMATTER_REGEX.test(head) && VIDEO_ID_FRONTMATTER_REGEX.test(head));
      if (!looksLikeVideoNote) continue;
      if (content.includes(VIDEO_METADATA_MARKER_PREFIX) && !extractVideoMetadataRecord(content)) {
        skipped += 1;
        console.warn(`YouTube Sync: skipped ${file.path} because its metadata marker is invalid.`);
        continue;
      }
      try {
        const record = recordForVideoNote(
          content,
          extractTitleFromNote(content) ?? file.basename,
          hasAISummary(content),
          parseYaml,
        );
        if (!record) {
          skipped += 1;
          continue;
        }
        candidates.push({
          file,
          preview: rewriteVideoNoteFrontmatter(
            content,
            record,
            this.settings.videoFrontmatterTemplate,
            parseYaml,
            stringifyYaml,
          ),
        });
      } catch (error) {
        skipped += 1;
        console.warn(`YouTube Sync: skipped ${file.path} during migration preview`, error);
      }
    }

    if (!candidates.length) {
      new Notice(`No generated video notes are available to migrate${skipped ? ` (${skipped} skipped)` : ''}.`);
      return;
    }

    const confirmed = await new Promise<boolean>((resolve) => {
      new MigrationPreviewModal(this.app, candidates.length, skipped, candidates[0].preview, resolve).open();
    });
    if (!confirmed) return;

    let changed = 0;
    let unchanged = 0;
    let failed = 0;
    for (const candidate of candidates) {
      let fileChanged = false;
      try {
        await this.app.vault.process(candidate.file, (current) => {
          const record = recordForVideoNote(
            current,
            extractTitleFromNote(current) ?? candidate.file.basename,
            hasAISummary(current),
            parseYaml,
          );
          if (!record) throw new Error('The note is no longer a valid generated YouTube video note.');
          const rewritten = rewriteVideoNoteFrontmatter(
            current,
            record,
            this.settings.videoFrontmatterTemplate,
            parseYaml,
            stringifyYaml,
          );
          fileChanged = rewritten.changed;
          return rewritten.content;
        });
        if (fileChanged) changed += 1;
        else unchanged += 1;
      } catch (error) {
        failed += 1;
        console.warn(`YouTube Sync: frontmatter migration failed for ${candidate.file.path}`, error);
      }
    }

    new Notice(`Frontmatter migration: ${changed} changed, ${unchanged} unchanged${skipped ? `, ${skipped} skipped` : ''}${failed ? `, ${failed} failed` : ''}.`);
  }

  private createAIProvider(): AIProvider {
    if (!this.settings.aiEnabled) throw new Error('AI summaries are disabled.');

    const endpoint = resolvedAIEndpoint(this.settings);
    if (!endpoint) throw new Error('AI endpoint is not configured.');
    const model = resolvedAIModel(this.settings);
    if (!model) throw new Error('AI model is not configured.');
    if (this.settings.aiPromptMode === 'replace' && !this.settings.aiCustomPrompt.trim()) {
      throw new Error('Enter custom AI instructions or switch prompt mode.');
    }

    const displayName = providerDisplayName(this.settings.aiProvider);
    const secretName = this.settings.aiApiKeySecret.trim();
    if (this.settings.aiProvider !== 'custom' && !secretName) {
      throw new Error(`Choose a ${displayName} API key secret in Settings.`);
    }

    const token = secretName ? this.app.secretStorage.getSecret(secretName) : null;
    if (secretName && !token) {
      throw new Error(`The selected AI secret "${secretName}" is empty or unavailable.`);
    }

    return new OpenAICompatibleProvider({
      id: this.settings.aiProvider,
      baseUrl: endpoint,
      model,
      protocol: this.settings.aiProtocol,
      promptMode: this.settings.aiPromptMode,
      customPrompt: this.settings.aiCustomPrompt,
      ...(token ? { auth: { type: 'api-key' as const, token } } : {}),
    });
  }

  private async generateAISummaryForFile(
    file: TFile,
    provided?: { title: string; channel?: string; transcript: string },
    existingProvider?: AIProvider,
  ): Promise<void> {
    const content = await this.app.vault.cachedRead(file);
    if (!SOURCE_FRONTMATTER_REGEX.test(content.slice(0, 4000))) {
      throw new Error('The current file is not a YouTube note generated by this plugin.');
    }

    const storedMetadata = extractVideoMetadataRecord(content);
    const input = provided ?? {
      title: storedMetadata?.values.title ?? extractTitleFromNote(content) ?? file.basename,
      channel: storedMetadata?.values.channel ?? extractChannelFromNote(content),
      transcript: extractTranscriptFromNote(content) ?? '',
    };
    if (!input.transcript.trim()) throw new Error('This note does not contain a transcript to summarize.');

    const provider = existingProvider ?? this.createAIProvider();
    const summary = await provider.summarize(input);
    const latestContent = await this.app.vault.read(file);
    const metadata = extractVideoMetadataRecord(latestContent);
    let updated: string;
    if (metadata) {
      const generatedAt = new Date().toISOString();
      const withSummary = applyAISummaryBlockToNote(latestContent, summary);
      const nextMetadata = createVideoMetadataRecord({
        ...metadata.values,
        aiSummary: true,
        aiProvider: provider.id,
        aiModel: provider.model,
        aiGenerated: generatedAt,
      }, metadata.managedKeys, metadata.template);
      const noteTemplate = metadata.template ?? this.videoTemplateForSync();
      updated = rewriteVideoNoteFrontmatter(
        withSummary,
        nextMetadata,
        noteTemplate,
        parseYaml,
        stringifyYaml,
      ).content;
    } else {
      updated = applyAISummaryToNote(latestContent, summary, provider.id, provider.model);
    }
    await this.app.vault.modify(file, updated);
  }

  private isFatalAIError(error: unknown): boolean {
    const message = this.userFacingError(error).toLowerCase();
    return message.includes('rejected the configured api key')
      || message.includes('api key is not configured')
      || message.includes('rate limit or quota reached')
      || message.includes('selected ai secret')
      || message.includes('model is not configured')
      || message.includes('endpoint is not configured');
  }

  private userFacingError(error: unknown): string {
    return error instanceof Error ? error.message : String(error);
  }

  private videoTemplateForSync(): string {
    try {
      validateVideoTemplate(this.settings.videoFrontmatterTemplate, parseYaml);
      return this.settings.videoFrontmatterTemplate;
    } catch (error) {
      if (!this.warnedAboutInvalidTemplate) {
        this.warnedAboutInvalidTemplate = true;
        console.warn('YouTube Sync: invalid frontmatter template; using the default template', error);
        new Notice(`Invalid video frontmatter template; using the default. ${this.userFacingError(error)}`);
      }
      return DEFAULT_VIDEO_FRONTMATTER_TEMPLATE;
    }
  }

  private async scanSyncedVideoIds(folder: string): Promise<Set<string>> {
    const synced = new Set<string>();
    const folderFile = this.app.vault.getAbstractFileByPath(folder);
    if (!(folderFile instanceof TFolder)) return synced;

    for (const child of folderFile.children) {
      if (!(child instanceof TFile) || child.extension !== 'md') continue;
      try {
        const content = await this.app.vault.cachedRead(child);
        const head = content.slice(0, 4000);
        const idMatch = head.match(VIDEO_ID_FRONTMATTER_REGEX);
        if (idMatch && SOURCE_FRONTMATTER_REGEX.test(head)) {
          synced.add(idMatch[1]);
        }
      } catch {
        // Ignore unreadable files.
      }
    }
    return synced;
  }

  private async ensureFolder(folder: string): Promise<void> {
    const parts = folder.split('/').filter(Boolean);
    let current = '';
    for (const part of parts) {
      current = current ? `${current}/${part}` : part;
      if (!(await this.app.vault.adapter.exists(current))) {
        await this.app.vault.adapter.mkdir(current);
      }
    }
  }

  private async uniqueNotePath(folder: string, baseName: string): Promise<string> {
    const clean = sanitizeNoteFileName(baseName) || 'video';
    let candidate = normalizePath(`${folder}/${clean}.md`);
    let suffix = 2;
    while (this.app.vault.getAbstractFileByPath(candidate)) {
      candidate = normalizePath(`${folder}/${clean} ${suffix}.md`);
      suffix += 1;
    }
    return candidate;
  }

  private async overwriteFile(path: string, content: string): Promise<void> {
    const existing = this.app.vault.getAbstractFileByPath(path);
    if (existing instanceof TFile) {
      await this.app.vault.modify(existing, content);
    } else {
      await this.app.vault.create(path, content);
    }
  }

  private async writeRootIndex(results: PlaylistSyncResult[]): Promise<void> {
    if (!this.settings.createIndexNote) return;
    const root = normalizePath(`${this.settings.baseFolder}/Index.md`);
    await this.ensureFolder(this.settings.baseFolder);
    const summary = results
      .filter((r) => r.total > 0)
      .map((r) => ({ name: r.name, url: `https://www.youtube.com/playlist?list=${r.playlistId}`, id: r.playlistId, count: r.total }));
    await this.overwriteFile(root, buildRootIndex(summary));
  }
}
