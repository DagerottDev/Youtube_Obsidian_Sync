/** Settings persisted via plugin data. */
export interface YouTubePlaylistSyncSettings {
  /** List of playlist URLs to sync. */
  playlists: { url: string }[];
  /** Run a sync when Obsidian finishes loading. */
  syncOnStartup: boolean;
  /** Sync every N minutes while Obsidian is open. 0 disables the timer. */
  syncIntervalMinutes: number;
  /** Base folder inside the vault where playlists are written. */
  baseFolder: string;
  /** Also maintain an index note per playlist (and a root index). */
  createIndexNote: boolean;
  /** 'readable' = paragraphs, 'timestamped' = timestamped lines. */
  transcriptMode: 'readable' | 'timestamped';
  /** Preferred caption language code (e.g. 'en'); empty = first available. */
  preferredLanguage: string;
  /** Extra tags added to every generated note. */
  extraTags: string;
  /** Media embed in generated notes. */
  mediaEmbed: 'video' | 'thumbnail' | 'off';
  /** Enables AI summary commands and settings. */
  aiEnabled: boolean;
  /** Automatically generate an AI summary after a new YouTube note is created. */
  aiAutoGenerate: boolean;
  /** AI provider. Kept extensible for future providers. */
  aiProvider: 'openai';
  /** Name of the API key secret stored in Obsidian SecretStorage. */
  aiApiKeySecret: string;
  /** Curated model choice, or 'custom'. */
  aiModel: 'gpt-5.6-luna' | 'gpt-5.6-terra' | 'gpt-5.6-sol' | 'custom';
  /** Model ID used when aiModel is 'custom'. */
  aiCustomModel: string;
}

export const DEFAULT_SETTINGS: YouTubePlaylistSyncSettings = {
  playlists: [],
  syncOnStartup: true,
  syncIntervalMinutes: 30,
  baseFolder: 'YouTube',
  createIndexNote: true,
  transcriptMode: 'readable',
  preferredLanguage: '',
  extraTags: 'youtube',
  mediaEmbed: 'video',
  aiEnabled: false,
  aiAutoGenerate: true,
  aiProvider: 'openai',
  aiApiKeySecret: '',
  aiModel: 'gpt-5.6-luna',
  aiCustomModel: '',
};

export function resolvedAIModel(settings: YouTubePlaylistSyncSettings): string {
  if (settings.aiModel === 'custom') return settings.aiCustomModel.trim();
  return settings.aiModel;
}

/** A single video row from a playlist listing (cheap, from the browse endpoint). */
export interface PlaylistEntry {
  videoId: string;
  url: string;
  position: number;
  title: string;
  author?: string;
  channelUrl?: string;
  channelId?: string;
  thumbnailUrl?: string;
  /** Human-readable duration from the playlist listing (e.g. "3:45"). */
  lengthText?: string;
  /** Human-readable publish text from the listing (e.g. "2 years ago"). */
  publishedText?: string;
}

/** Full metadata for one video (player + microformat merged). */
export interface VideoMetadata {
  videoId: string;
  url: string;
  title: string;
  author: string;
  channelUrl: string;
  channelId?: string;
  description?: string;
  thumbnailUrl: string;
  uploadDate?: string;
  videoCategory?: string;
  durationSeconds?: number;
  keywords?: string[];
  /** Caption tracks available for this video (for transcript fetching). */
  captionTracks?: { baseUrl: string; languageCode: string }[];
}

/** One line of a transcript, offset in milliseconds. */
export interface TranscriptLine {
  text: string;
  offset: number;
}

/** Result of syncing one playlist. */
export interface PlaylistSyncResult {
  name: string;
  playlistId: string;
  total: number;
  created: number;
  skipped: number;
  failed: number;
  folder: string;
  /** Set when the whole playlist failed to fetch. */
  error?: string;
}
