import { Notice, Platform, Plugin, TFile, TFolder, normalizePath } from 'obsidian';
import {
  DEFAULT_SETTINGS,
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
import { OpenAIProvider } from './ai/openai';
import {
  applyAISummaryToNote,
  extractChannelFromNote,
  extractTitleFromNote,
  extractTranscriptFromNote,
  hasAISummary,
} from './ai/noteUpdater';

const PLAYLIST_ID_REGEX = /(?:[?&]list=|youtube\.com\/playlist\/)([a-zA-Z0-9_-]+)/;
const VIDEO_ID_FRONTMATTER_REGEX = /^videoId:\s*"?([^"\s]+)"?/m;
const SOURCE_FRONTMATTER_REGEX = /^source:\s*youtube\b/m;
const AI_MODELS = new Set(['gpt-5.6-luna', 'gpt-5.6-terra', 'gpt-5.6-sol', 'custom']);

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null;
}

function isPlaylist(value: unknown): value is { url: string } {
  return isRecord(value) && typeof value.url === 'string';
}

function normalizeSettings(value: unknown): YouTubePlaylistSyncSettings {
  const stored = isRecord(value) ? value : {};
  const playlists = Array.isArray(stored.playlists)
    ? stored.playlists.filter(isPlaylist).map((playlist) => ({ url: playlist.url }))
    : [];
  const aiModel = typeof stored.aiModel === 'string' && AI_MODELS.has(stored.aiModel)
    ? stored.aiModel as YouTubePlaylistSyncSettings['aiModel']
    : DEFAULT_SETTINGS.aiModel;

  return {
    playlists,
    syncOnStartup: typeof stored.syncOnStartup === 'boolean'
      ? stored.syncOnStartup
      : DEFAULT_SETTINGS.syncOnStartup,
    syncIntervalMinutes: typeof stored.syncIntervalMinutes === 'number'
      && Number.isFinite(stored.syncIntervalMinutes)
      && stored.syncIntervalMinutes >= 0
      ? Math.floor(stored.syncIntervalMinutes)
      : DEFAULT_SETTINGS.syncIntervalMinutes,
    baseFolder: typeof stored.baseFolder === 'string' && stored.baseFolder.trim()
      ? stored.baseFolder
      : DEFAULT_SETTINGS.baseFolder,
    createIndexNote: typeof stored.createIndexNote === 'boolean'
      ? stored.createIndexNote
      : DEFAULT_SETTINGS.createIndexNote,
    transcriptMode: stored.transcriptMode === 'timestamped' ? 'timestamped' : 'readable',
    preferredLanguage: typeof stored.preferredLanguage === 'string'
      ? stored.preferredLanguage
      : DEFAULT_SETTINGS.preferredLanguage,
    extraTags: typeof stored.extraTags === 'string' ? stored.extraTags : DEFAULT_SETTINGS.extraTags,
    mediaEmbed: stored.mediaEmbed === 'thumbnail' || stored.mediaEmbed === 'off'
      ? stored.mediaEmbed
      : 'video',
    aiEnabled: typeof stored.aiEnabled === 'boolean' ? stored.aiEnabled : DEFAULT_SETTINGS.aiEnabled,
    aiAutoGenerate: typeof stored.aiAutoGenerate === 'boolean'
      ? stored.aiAutoGenerate
      : DEFAULT_SETTINGS.aiAutoGenerate,
    aiProvider: 'openai',
    aiApiKeySecret: typeof stored.aiApiKeySecret === 'string'
      ? stored.aiApiKeySecret
      : DEFAULT_SETTINGS.aiApiKeySecret,
    aiModel,
    aiCustomModel: typeof stored.aiCustomModel === 'string'
      ? stored.aiCustomModel
      : DEFAULT_SETTINGS.aiCustomModel,
  };
}

export default class YouTubePlaylistSyncPlugin extends Plugin {
  settings: YouTubePlaylistSyncSettings = DEFAULT_SETTINGS;
  private isSyncing = false;
  private isAISummarizing = false;
  private lastSyncAt = 0;
  private statusBarEl?: HTMLElement;

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
    let autoAIProvider: OpenAIProvider | null = null;

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
      new Notice(`OpenAI connection succeeded (${provider.model}).`);
    } catch (error) {
      new Notice(`OpenAI connection failed: ${this.userFacingError(error)}`);
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

    let provider: OpenAIProvider;
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

  private createAIProvider(): OpenAIProvider {
    if (!this.settings.aiEnabled) throw new Error('AI summaries are disabled.');
    const secretName = this.settings.aiApiKeySecret.trim();
    if (!secretName) throw new Error('Choose an OpenAI API key secret in Settings.');
    const apiKey = this.app.secretStorage.getSecret(secretName);
    if (!apiKey) throw new Error(`The selected OpenAI secret "${secretName}" is empty or unavailable.`);
    const model = resolvedAIModel(this.settings);
    if (!model) throw new Error('Enter a custom OpenAI model ID or choose a recommended model.');
    return new OpenAIProvider(apiKey, model);
  }

  private async generateAISummaryForFile(
    file: TFile,
    provided?: { title: string; channel?: string; transcript: string },
    existingProvider?: OpenAIProvider,
  ): Promise<void> {
    const content = await this.app.vault.cachedRead(file);
    if (!SOURCE_FRONTMATTER_REGEX.test(content.slice(0, 4000))) {
      throw new Error('The current file is not a YouTube note generated by this plugin.');
    }

    const input = provided ?? {
      title: extractTitleFromNote(content) ?? file.basename,
      channel: extractChannelFromNote(content),
      transcript: extractTranscriptFromNote(content) ?? '',
    };
    if (!input.transcript.trim()) throw new Error('This note does not contain a transcript to summarize.');

    const provider = existingProvider ?? this.createAIProvider();
    const summary = await provider.summarize(input);
    const latestContent = await this.app.vault.read(file);
    const updated = applyAISummaryToNote(latestContent, summary, provider.id, provider.model);
    await this.app.vault.modify(file, updated);
  }

  private isFatalAIError(error: unknown): boolean {
    const message = this.userFacingError(error).toLowerCase();
    return message.includes('invalid openai api key')
      || message.includes('rate limit or quota reached')
      || message.includes('selected openai secret')
      || message.includes('model is not configured');
  }

  private userFacingError(error: unknown): string {
    return error instanceof Error ? error.message : String(error);
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
