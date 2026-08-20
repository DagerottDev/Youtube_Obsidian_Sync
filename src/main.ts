import { Notice, Plugin, TFile, TFolder, normalizePath } from 'obsidian';
import {
  DEFAULT_SETTINGS,
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

const PLAYLIST_ID_REGEX = /(?:[?&]list=|youtube\.com\/playlist\/)([a-zA-Z0-9_-]+)/;
const VIDEO_ID_FRONTMATTER_REGEX = /^videoId:\s*"?([^"\s]+)"?/m;
const SOURCE_FRONTMATTER_REGEX = /^source:\s*youtube\b/m;

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
  };
}

export default class YouTubePlaylistSyncPlugin extends Plugin {
  settings: YouTubePlaylistSyncSettings = DEFAULT_SETTINGS;
  private isSyncing = false;
  private lastSyncAt = 0;
  private statusBarEl!: HTMLElement;

  async onload(): Promise<void> {
    await this.loadSettings();

    this.statusBarEl = this.addStatusBarItem();
    this.updateStatusBar('idle');

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

    this.app.workspace.onLayoutReady(() => {
      if (this.settings.syncOnStartup) {
        window.setTimeout(() => {
          void this.syncAll();
        }, 3000);
      }
    });

    // Lightweight interval that only syncs when the configured window has elapsed.
    this.registerInterval(
      window.setInterval(() => {
        const intervalMs = this.settings.syncIntervalMinutes * 60_000;
        if (intervalMs > 0 && Date.now() - this.lastSyncAt >= intervalMs) {
          void this.syncAll();
        }
      }, 60_000),
    );
  }

  async loadSettings(): Promise<void> {
    const stored: unknown = await this.loadData();
    this.settings = normalizeSettings(stored);
  }

  async saveSettings(): Promise<void> {
    await this.saveData(this.settings);
  }

  private updateStatusBar(text: string): void {
    this.statusBarEl.setText(`🔄 YT Sync: ${text}`);
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

    // Find videos already synced by scanning existing notes in this folder.
    const synced = await this.scanSyncedVideoIds(folder);

    let created = 0;
    let skipped = 0;
    let failed = 0;

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
        await this.app.vault.create(path, content);
        synced.add(entry.videoId);
        created += 1;
      } catch (error) {
        failed += 1;
        console.error(`YouTube Sync: failed for "${entry.title}"`, error);
      }
      // Be gentle with YouTube between per-video requests.
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
