import { Notice, Plugin, TFile, normalizePath } from 'obsidian';
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
    this.settings = Object.assign({}, DEFAULT_SETTINGS, await this.loadData());
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
      this.writeRootIndex(results);
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

    console.log(`YouTube Sync: fetching playlist ${url}`);
    const { entries, title } = await fetchPlaylist(playlistId);
    const name = title ?? `Playlist ${playlistId}`;
    console.log(`YouTube Sync: "${name}" has ${entries.length} videos`);

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
      await new Promise((resolve) => setTimeout(resolve, 150));
    }

    if (this.settings.createIndexNote) {
      const index = buildPlaylistIndexNote({ name, url, id: playlistId }, entries, folder);
      await this.overwriteFile(`${folder}/_Index.md`, index);
    }

    console.log(`YouTube Sync: "${name}" → ${created} created, ${skipped} existing, ${failed} failed`);
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
    const files = this.app.vault.getFiles().filter(
      (file) => file.path.startsWith(`${folder}/`) && file.extension === 'md',
    );
    for (const file of files) {
      try {
        const content = await this.app.vault.cachedRead(file);
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
