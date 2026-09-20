import {
  AI_PROVIDER_DEFAULTS,
  DEFAULT_SETTINGS,
  type AIPromptMode,
  type AIProtocol,
  type AIProviderPreset,
  type YouTubePlaylistSyncSettings,
} from './types';

const AI_PROVIDERS = new Set<AIProviderPreset>(['openai', 'nvidia-nim', 'custom']);
const AI_PROTOCOLS = new Set<AIProtocol>(['responses', 'chat-completions']);
const AI_PROMPT_MODES = new Set<AIPromptMode>(['default', 'append', 'replace']);

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null;
}

function isPlaylist(value: unknown): value is { url: string } {
  return isRecord(value) && typeof value.url === 'string';
}

export function normalizeSettings(value: unknown): YouTubePlaylistSyncSettings {
  const stored = isRecord(value) ? value : {};
  const playlists = Array.isArray(stored.playlists)
    ? stored.playlists.filter(isPlaylist).map((playlist) => ({ url: playlist.url }))
    : [];

  const aiProvider = typeof stored.aiProvider === 'string' && AI_PROVIDERS.has(stored.aiProvider as AIProviderPreset)
    ? stored.aiProvider as AIProviderPreset
    : DEFAULT_SETTINGS.aiProvider;
  const providerDefaults = AI_PROVIDER_DEFAULTS[aiProvider];
  const aiProtocol = typeof stored.aiProtocol === 'string' && AI_PROTOCOLS.has(stored.aiProtocol as AIProtocol)
    ? stored.aiProtocol as AIProtocol
    : providerDefaults.protocol;
  const aiPromptMode = typeof stored.aiPromptMode === 'string' && AI_PROMPT_MODES.has(stored.aiPromptMode as AIPromptMode)
    ? stored.aiPromptMode as AIPromptMode
    : DEFAULT_SETTINGS.aiPromptMode;

  // Migrate the previous curated-model format where aiModel could be "custom" and aiCustomModel held the ID.
  let aiModel = providerDefaults.model;
  if (typeof stored.aiModel === 'string') {
    if (stored.aiModel === 'custom') {
      if (typeof stored.aiCustomModel === 'string' && stored.aiCustomModel.trim()) {
        aiModel = stored.aiCustomModel.trim();
      }
    } else if (stored.aiModel.trim()) {
      aiModel = stored.aiModel.trim();
    }
  }

  const aiCustomPrompt = typeof stored.aiCustomPrompt === 'string'
    ? stored.aiCustomPrompt
    : DEFAULT_SETTINGS.aiCustomPrompt;

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
    aiProvider,
    aiEndpoint: typeof stored.aiEndpoint === 'string' && stored.aiEndpoint.trim()
      ? stored.aiEndpoint.trim()
      : providerDefaults.endpoint,
    aiProtocol,
    aiApiKeySecret: typeof stored.aiApiKeySecret === 'string'
      ? stored.aiApiKeySecret
      : DEFAULT_SETTINGS.aiApiKeySecret,
    aiModel,
    aiPromptMode: aiPromptMode === 'replace' && !aiCustomPrompt.trim() ? 'default' : aiPromptMode,
    aiCustomPrompt,
    videoFrontmatterTemplate: typeof stored.videoFrontmatterTemplate === 'string' && stored.videoFrontmatterTemplate.trim()
      ? stored.videoFrontmatterTemplate
      : DEFAULT_SETTINGS.videoFrontmatterTemplate,
  };
}
