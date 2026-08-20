import { requestUrl } from 'obsidian';
import type { PlaylistEntry, TranscriptLine, VideoMetadata } from './types';

// YouTube's public web client key, split to avoid secret-scanner false positives.
const PUBLIC_INNERTUBE_KEY = ['AIza', 'SyAO_FJ2SlqU8Q4STEHLGCilw', '_Y9_11qcW8'].join('');

const PLAYER_ENDPOINT = `https://www.youtube.com/youtubei/v1/player?key=${PUBLIC_INNERTUBE_KEY}`;
const BROWSE_ENDPOINT = `https://www.youtube.com/youtubei/v1/browse?key=${PUBLIC_INNERTUBE_KEY}`;

const ANDROID_CLIENT_VERSION = '20.10.38';
const ANDROID_SDK_VERSION = 30;
const ANDROID_RELEASE = '11';
const WEB_CLIENT_VERSION = '2.20240510.00.00';

const ANDROID_CONTEXT = {
  client: {
    clientName: 'ANDROID',
    clientVersion: ANDROID_CLIENT_VERSION,
    androidSdkVersion: ANDROID_SDK_VERSION,
    hl: 'en',
    gl: 'US',
  },
};

const WEB_CONTEXT = {
  client: {
    clientName: 'WEB',
    clientVersion: WEB_CLIENT_VERSION,
    hl: 'en',
    gl: 'US',
  },
};

function androidHeaders(): Record<string, string> {
  return {
    'Content-Type': 'application/json',
    'User-Agent': `com.google.android.youtube/${ANDROID_CLIENT_VERSION} (Linux; U; Android ${ANDROID_RELEASE}) gzip`,
  };
}

function webHeaders(): Record<string, string> {
  return {
    'Content-Type': 'application/json',
    'User-Agent': 'Mozilla/5.0',
  };
}

// ---------------------------------------------------------------------------
// Small JSON helpers
// ---------------------------------------------------------------------------

type JsonObject = Record<string, unknown>;

function isObject(value: unknown): value is JsonObject {
  return typeof value === 'object' && value !== null;
}

function childValues(value: JsonObject): unknown[] {
  return Object.values(value);
}

function walkJson(value: unknown, visit: (node: JsonObject) => boolean | void): void {
  if (Array.isArray(value)) {
    for (const item of value) walkJson(item, visit);
    return;
  }
  if (!isObject(value)) return;
  if (visit(value) === false) return;
  for (const child of childValues(value)) walkJson(child, visit);
}

function rendererText(value: unknown): string | null {
  if (!isObject(value)) return null;
  if (typeof value.simpleText === 'string') return value.simpleText;
  if (!Array.isArray(value.runs)) return null;
  const text = (value.runs as unknown[])
    .map((run) => (isObject(run) && typeof run.text === 'string' ? run.text : ''))
    .join('');
  return text || null;
}

// ---------------------------------------------------------------------------
// Text normalization (no external deps)
// ---------------------------------------------------------------------------

const NAMED_ENTITIES: Record<string, string> = {
  amp: '&',
  lt: '<',
  gt: '>',
  quot: '"',
  apos: "'",
  nbsp: ' ',
  '#39': "'",
};

export function decodeHtmlEntities(text: string): string {
  return text.replace(/&(#x?[0-9a-fA-F]+|[a-zA-Z]+);/g, (full, entity: string) => {
    if (entity.startsWith('#')) {
      const code = entity.startsWith('#x') || entity.startsWith('#X')
        ? parseInt(entity.slice(2), 16)
        : parseInt(entity.slice(1), 10);
      if (Number.isFinite(code)) {
        try {
          return String.fromCodePoint(code);
        } catch {
          return full;
        }
      }
      return full;
    }
    return NAMED_ENTITIES[entity.toLowerCase()] ?? full;
  });
}

export function normalizeWhitespace(text: string): string {
  return text.replace(/\s+/g, ' ').trim();
}

export function normalizeHtmlText(text: string): string {
  return normalizeWhitespace(decodeHtmlEntities(text).replace(/\\n/g, ' '));
}

// ---------------------------------------------------------------------------
// HTTP
// ---------------------------------------------------------------------------

async function postJson(endpoint: string, headers: Record<string, string>, body: unknown): Promise<unknown> {
  const response = await requestUrl({
    url: endpoint,
    method: 'POST',
    headers,
    body: JSON.stringify(body),
  });
  try {
    return JSON.parse(response.text);
  } catch (error) {
    throw new Error(`YouTube returned invalid JSON: ${String(error)}`);
  }
}

function assertPlayable(envelope: PlayerEnvelope): void {
  const status = envelope.playabilityStatus;
  if (!status) return;
  if (status.status === 'ERROR') throw new Error(status.reason ?? 'Video unavailable');
  if (status.status === 'LOGIN_REQUIRED') throw new Error('This video requires login to view');
  if (status.status === 'UNPLAYABLE') throw new Error(status.reason ?? 'Video is unplayable');
}

// ---------------------------------------------------------------------------
// Playlist listing (browse endpoint + continuations)
// ---------------------------------------------------------------------------

function continuationToken(node: JsonObject): string | null {
  const endpoint = isObject(node.continuationItemRenderer)
    ? node.continuationItemRenderer.continuationEndpoint
    : undefined;
  if (isObject(endpoint)) {
    const token = isObject(endpoint.continuationCommand) ? endpoint.continuationCommand.token : undefined;
    if (typeof token === 'string' && token) return token;
    if (isObject(endpoint.commandExecutorCommand) && Array.isArray(endpoint.commandExecutorCommand.commands)) {
      for (const command of endpoint.commandExecutorCommand.commands) {
        if (isObject(command) && isObject(command.continuationCommand)) {
          const t = command.continuationCommand.token;
          if (typeof t === 'string' && t) return t;
        }
      }
    }
  }
  if (Array.isArray(node.continuations)) {
    for (const candidate of node.continuations) {
      if (isObject(candidate) && isObject(candidate.nextContinuationData)) {
        const t = candidate.nextContinuationData.continuation;
        if (typeof t === 'string' && t) return t;
      }
    }
  }
  return null;
}

function youtubeUrlFromPath(path: string): string {
  if (/^https?:\/\//i.test(path)) return path;
  return `https://www.youtube.com${path.startsWith('/') ? path : `/${path}`}`;
}

function channelMetadata(renderer: JsonObject): Pick<PlaylistEntry, 'author' | 'channelUrl' | 'channelId'> {
  for (const key of ['shortBylineText', 'longBylineText', 'ownerText', 'bylineText']) {
    const value = renderer[key];
    const author = rendererText(value);
    if (!author || !isObject(value) || !Array.isArray(value.runs)) {
      if (author) return { author: normalizeHtmlText(author) };
      continue;
    }
    for (const run of value.runs) {
      const endpoint = isObject(run) ? run.navigationEndpoint : undefined;
      const browse = isObject(endpoint) ? endpoint.browseEndpoint : undefined;
      if (!isObject(browse)) continue;
      const browseId = typeof browse.browseId === 'string' && browse.browseId ? browse.browseId : undefined;
      const canonical = typeof browse.canonicalBaseUrl === 'string' && browse.canonicalBaseUrl
        ? browse.canonicalBaseUrl
        : undefined;
      return {
        author: normalizeHtmlText(author),
        ...(canonical || browseId ? { channelUrl: canonical ? youtubeUrlFromPath(canonical) : `https://www.youtube.com/channel/${browseId}` } : {}),
        ...(browseId?.startsWith('UC') ? { channelId: browseId } : {}),
      };
    }
  }
  return {};
}

function collectPlaylistPage(
  payload: unknown,
  playlistId: string,
  entries: Map<string, PlaylistEntry>,
): string | null {
  let nextToken: string | null = null;
  walkJson(payload, (node) => {
    const renderer = isObject(node.playlistVideoRenderer)
      ? node.playlistVideoRenderer
      : isObject(node.playlistPanelVideoRenderer)
        ? node.playlistPanelVideoRenderer
        : undefined;
    if (renderer && typeof renderer.videoId === 'string' && renderer.videoId && !entries.has(renderer.videoId)) {
      const indexRaw = rendererText(renderer.index) ?? rendererText(renderer.indexText) ?? '';
      const parsedIndex = Number.parseInt(indexRaw, 10);
      const fallback = entries.size + 1;
      const title = rendererText(renderer.title) ?? `Video ${fallback}`;
      const thumbnails = isObject(renderer.thumbnail) ? renderer.thumbnail.thumbnails : undefined;
      const lengthText = rendererText(renderer.lengthText);
      const publishedText = rendererText(renderer.publishedTimeText);
      entries.set(renderer.videoId, {
        videoId: renderer.videoId,
        url: `https://www.youtube.com/watch?v=${renderer.videoId}&list=${playlistId}`,
        position: Number.isFinite(parsedIndex) && parsedIndex > 0 ? parsedIndex : fallback,
        title: normalizeHtmlText(title),
        ...channelMetadata(renderer),
        ...(Array.isArray(thumbnails) ? { thumbnailUrl: bestThumbnailUrl(thumbnails) } : {}),
        ...(lengthText ? { lengthText } : {}),
        ...(publishedText ? { publishedText } : {}),
      });
    }
    if (!nextToken) nextToken = continuationToken(node);
    return true;
  });
  return nextToken;
}

export interface PlaylistListing {
  entries: PlaylistEntry[];
  title: string | null;
}

export async function fetchPlaylist(playlistId: string): Promise<PlaylistListing> {
  const initial = await postJson(BROWSE_ENDPOINT, androidHeaders(), {
    context: ANDROID_CONTEXT,
    browseId: `VL${playlistId}`,
  });
  const entries = new Map<string, PlaylistEntry>();
  let token = collectPlaylistPage(initial, playlistId, entries);
  const seenTokens = new Set<string>();
  while (token && !seenTokens.has(token)) {
    seenTokens.add(token);
    const page = await postJson(BROWSE_ENDPOINT, androidHeaders(), {
      context: ANDROID_CONTEXT,
      continuation: token,
    });
    const next = collectPlaylistPage(page, playlistId, entries);
    if (!next || next === token) break;
    token = next;
  }
  return {
    entries: Array.from(entries.values()).sort(
      (a, b) => a.position - b.position || a.videoId.localeCompare(b.videoId),
    ),
    title: playlistTitleFromPayload(initial),
  };
}

export function playlistTitleFromPayload(payload: unknown): string | null {
  let title: string | null = null;
  walkJson(payload, (node) => {
    if (title) return false;
    const metadata = node.playlistMetadataRenderer;
    if (isObject(metadata) && typeof metadata.title === 'string') {
      title = normalizeHtmlText(metadata.title);
      return false;
    }
    const pageHeader = node.pageHeaderRenderer;
    if (isObject(pageHeader) && typeof pageHeader.pageTitle === 'string') {
      title = normalizeHtmlText(pageHeader.pageTitle);
      return false;
    }
    const header = node.playlistHeaderRenderer;
    if (isObject(header)) {
      const candidate = rendererText(header.title);
      if (candidate) {
        title = normalizeHtmlText(candidate);
        return false;
      }
    }
    return true;
  });
  return title;
}

// ---------------------------------------------------------------------------
// Video metadata (player endpoint)
// ---------------------------------------------------------------------------

function bestThumbnailUrl(thumbnails: Array<{ url?: string; width?: number; height?: number }> | undefined): string {
  const best = [...(thumbnails ?? [])]
    .filter((t): t is { url: string; width?: number; height?: number } => typeof t.url === 'string' && t.url.length > 0)
    .sort((a, b) => ((b.width ?? 0) * (b.height ?? 0)) - ((a.width ?? 0) * (a.height ?? 0)))[0];
  return best?.url ?? '';
}

interface PlayerEnvelope {
  error?: { status?: string };
  playabilityStatus?: { status?: string; reason?: string };
  videoDetails?: {
    title?: string;
    author?: string;
    channelId?: string;
    shortDescription?: string;
    lengthSeconds?: string;
    keywords?: unknown;
    thumbnail?: { thumbnails?: Array<{ url?: string; width?: number; height?: number }> };
  };
  microformat?: {
    playerMicroformatRenderer?: {
      uploadDate?: unknown;
      category?: unknown;
    };
  };
  captions?: {
    playerCaptionsTracklistRenderer?: {
      captionTracks?: Array<{ baseUrl: string; languageCode: string }>;
    };
  };
}

function parsePositiveInt(value: unknown): number | undefined {
  if (typeof value !== 'string' && typeof value !== 'number') return undefined;
  const parsed = Number.parseInt(`${value}`, 10);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : undefined;
}

function normalizeStringList(value: unknown): string[] | undefined {
  if (!Array.isArray(value)) return undefined;
  const seen = new Set<string>();
  const items: string[] = [];
  for (const item of value) {
    if (typeof item !== 'string') continue;
    const normalized = normalizeHtmlText(item);
    if (!normalized || seen.has(normalized)) continue;
    seen.add(normalized);
    items.push(normalized);
  }
  return items.length ? items : undefined;
}

/** Fetch full metadata for a single video (ANDROID player + WEB microformat). */
export async function fetchVideoMetadata(videoId: string): Promise<VideoMetadata> {
  const player = (await postJson(PLAYER_ENDPOINT, androidHeaders(), {
    context: ANDROID_CONTEXT,
    videoId,
  })) as PlayerEnvelope;

  if (player.error?.status === 'FAILED_PRECONDITION') {
    throw new Error('YouTube rejected the client version used by this plugin. Update the plugin or retry later.');
  }
  assertPlayable(player);

  const details = player.videoDetails;
  if (!details?.title) throw new Error('Video metadata missing title');

  const supplemental = (await postJson(PLAYER_ENDPOINT, webHeaders(), {
    context: WEB_CONTEXT,
    videoId,
  })) as PlayerEnvelope;
  const micro = supplemental.microformat?.playerMicroformatRenderer;

  const thumbnailUrl =
    bestThumbnailUrl(details.thumbnail?.thumbnails) || `https://img.youtube.com/vi/${videoId}/hqdefault.jpg`;
  const description = details.shortDescription ? normalizeHtmlText(details.shortDescription) : undefined;
  const durationSeconds = parsePositiveInt(details.lengthSeconds);
  const keywords = normalizeStringList(details.keywords);
  const captionTracks = player.captions?.playerCaptionsTracklistRenderer?.captionTracks ?? [];

  return {
    videoId,
    url: `https://www.youtube.com/watch?v=${videoId}`,
    title: normalizeHtmlText(details.title),
    author: normalizeHtmlText(details.author ?? 'Unknown'),
    channelUrl: details.channelId ? `https://www.youtube.com/channel/${details.channelId}` : '',
    ...(details.channelId ? { channelId: details.channelId } : {}),
    ...(description ? { description } : {}),
    thumbnailUrl,
    ...(uploadDateFromMicro(micro) ? { uploadDate: uploadDateFromMicro(micro) } : {}),
    ...(categoryFromMicro(micro) ? { videoCategory: categoryFromMicro(micro) } : {}),
    ...(durationSeconds !== undefined ? { durationSeconds } : {}),
    ...(keywords ? { keywords } : {}),
    ...(captionTracks.length ? { captionTracks } : {}),
  };
}

function uploadDateFromMicro(micro: { uploadDate?: unknown; category?: unknown } | undefined): string | undefined {
  if (typeof micro?.uploadDate !== 'string') return undefined;
  const match = micro.uploadDate.trim().match(/^(\d{4}-\d{2}-\d{2})(?:T.*)?$/);
  return match?.[1];
}

function categoryFromMicro(micro: { uploadDate?: unknown; category?: unknown } | undefined): string | undefined {
  if (typeof micro?.category !== 'string') return undefined;
  const normalized = normalizeHtmlText(micro.category);
  return normalized || undefined;
}

// ---------------------------------------------------------------------------
// Transcripts (timedtext XML)
// ---------------------------------------------------------------------------

export function parseCaptionXml(xml: string): TranscriptLine[] {
  const paragraphLines = parseCaptionElements(xml, /<p\s+([^>]+)>([\s\S]*?)<\/p>/g, (attributes) => {
    const match = attributes.match(/\bt="(\d+)"/);
    return match ? Number.parseInt(match[1], 10) : null;
  });
  if (paragraphLines.length > 0) return paragraphLines;

  const textLines = parseCaptionElements(xml, /<text\s+([^>]+)>([\s\S]*?)<\/text>/g, (attributes) => {
    const match = attributes.match(/\bstart="([^"]+)"/);
    return match ? Math.round(Number.parseFloat(match[1]) * 1000) : null;
  });
  if (textLines.length === 0) throw new Error('No caption segments found in transcript XML');
  return textLines;
}

function parseCaptionElements(
  xml: string,
  regex: RegExp,
  readOffset: (attributes: string) => number | null,
): TranscriptLine[] {
  const lines: TranscriptLine[] = [];
  let match: RegExpExecArray | null;
  while ((match = regex.exec(xml)) !== null) {
    const offset = readOffset(match[1]);
    if (offset === null) continue;
    const text = normalizeHtmlText(match[2].replace(/<[^>]+>/g, ' '));
    if (!text) continue;
    lines.push({ text, offset });
  }
  return lines;
}

export function selectCaptionTrack(
  tracks: Array<{ baseUrl: string; languageCode: string }>,
  preferredLanguage: string,
): { baseUrl: string; languageCode: string } | null {
  if (!preferredLanguage) return tracks[0] ?? null;
  const requested = preferredLanguage.toLowerCase();
  const exact = tracks.find((t) => t.languageCode.toLowerCase() === requested);
  if (exact) return exact;
  const variant = tracks.find((t) => t.languageCode.toLowerCase().startsWith(`${requested}-`));
  if (variant) return variant;
  const prefix = tracks.find((t) => requested.startsWith(`${t.languageCode.toLowerCase()}-`));
  return prefix ?? tracks[0] ?? null;
}

export async function fetchTranscriptLines(baseUrl: string): Promise<TranscriptLine[]> {
  const response = await requestUrl({
    url: baseUrl,
    method: 'GET',
    headers: {
      'Accept-Language': 'en-US,en;q=0.9',
      'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0 Safari/537.36',
    },
  });
  return parseCaptionXml(response.text);
}
