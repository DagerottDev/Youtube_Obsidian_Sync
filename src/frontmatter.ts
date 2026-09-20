import { DEFAULT_VIDEO_FRONTMATTER_TEMPLATE } from './types';

export const VIDEO_METADATA_MARKER_PREFIX = '<!-- youtube-playlist-sync:metadata ';
export const VIDEO_METADATA_SCHEMA_VERSION = 1;

export type VideoTemplateValue = string | number | boolean | string[] | undefined;

export interface VideoTemplateValues {
  title: string;
  aliases: string[];
  source: 'youtube';
  channel?: string;
  channelUrl?: string;
  channelId?: string;
  videoUrl: string;
  videoId: string;
  playlistUrl?: string;
  playlistId?: string;
  thumbnailUrl?: string;
  videoDescription?: string;
  uploadDate?: string;
  videoCategory?: string;
  durationSeconds?: number;
  keywords?: string[];
  generated: string;
  tags?: string[];
  aiSummary?: boolean;
  aiProvider?: string;
  aiModel?: string;
  aiGenerated?: string;
}

export interface VideoMetadataRecord {
  schemaVersion: 1;
  values: VideoTemplateValues;
  managedKeys: string[];
  template?: string;
}

export interface ParsedVideoTemplate {
  yaml: string;
  properties: Record<string, unknown>;
  managedKeys: string[];
}

export type ParseYaml = (yaml: string) => unknown;

const PLACEHOLDER_REGEX = /\{\{([a-zA-Z][a-zA-Z0-9]*)\}\}/g;
const MARKER_REGEX = /<!-- youtube-playlist-sync:metadata ([A-Za-z0-9_-]+) -->/;
const ALLOWED_PLACEHOLDERS = new Set<keyof VideoTemplateValues>([
  'title', 'aliases', 'source', 'channel', 'channelUrl', 'channelId', 'videoUrl', 'videoId',
  'playlistUrl', 'playlistId', 'thumbnailUrl', 'videoDescription', 'uploadDate', 'videoCategory',
  'durationSeconds', 'keywords', 'generated', 'tags', 'aiSummary', 'aiProvider', 'aiModel',
  'aiGenerated',
]);

const TEMPLATE_SAMPLE_VALUES: VideoTemplateValues = {
  title: 'Example video',
  aliases: ['Example video'],
  source: 'youtube',
  channel: 'Example channel',
  channelUrl: 'https://www.youtube.com/channel/example',
  channelId: 'UC-example',
  videoUrl: 'https://www.youtube.com/watch?v=example1234',
  videoId: 'example1234',
  playlistUrl: 'https://www.youtube.com/playlist?list=PL-example',
  playlistId: 'PL-example',
  thumbnailUrl: 'https://i.ytimg.com/vi/example1234/hqdefault.jpg',
  videoDescription: 'Example description',
  uploadDate: '2026-01-02',
  videoCategory: 'Education',
  durationSeconds: 123,
  keywords: ['example', 'test'],
  generated: '2026-01-02T03:04:05.000Z',
  tags: ['youtube'],
  aiSummary: true,
  aiProvider: 'openai',
  aiModel: 'example-model',
  aiGenerated: '2026-01-02T03:05:06.000Z',
};

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function isUnavailable(value: VideoTemplateValue): boolean {
  return value === undefined || value === '' || (Array.isArray(value) && value.length === 0);
}

function yamlValue(value: Exclude<VideoTemplateValue, undefined>): string {
  if (typeof value === 'number' || typeof value === 'boolean') return String(value);
  return JSON.stringify(value);
}

function topLevelKeys(yaml: string): string[] {
  const keys: string[] = [];
  for (const line of yaml.split(/\r?\n/)) {
    if (!line.trim() || /^\s/.test(line) || line.replace(/^\s+/, '').startsWith('#')) continue;
    const match = line.match(/^(?:"((?:\\.|[^"])*)"|'([^']*)'|([^:#][^:]*?))\s*:/);
    const raw = match?.[1] ?? match?.[2] ?? match?.[3];
    if (raw) keys.push(raw.replace(/\\"/g, '"').trim());
  }
  return keys;
}

function encodeBase64Url(value: string): string {
  const bytes = new TextEncoder().encode(value);
  let binary = '';
  for (const byte of bytes) binary += String.fromCharCode(byte);
  return btoa(binary).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/g, '');
}

function decodeBase64Url(value: string): string {
  const padded = value.replace(/-/g, '+').replace(/_/g, '/') + '='.repeat((4 - value.length % 4) % 4);
  const binary = atob(padded);
  const bytes = Uint8Array.from(binary, (char) => char.charCodeAt(0));
  return new TextDecoder().decode(bytes);
}

export function renderVideoTemplate(template: string, values: VideoTemplateValues): string {
  if (template.split(/\r?\n/).some((line) => /^\s*---\s*$/.test(line))) {
    throw new Error('Do not include YAML document delimiters (---) in the frontmatter template.');
  }

  const output: string[] = [];
  for (const line of template.split(/\r?\n/)) {
    const placeholderNames: string[] = [];
    const matcher = new RegExp(PLACEHOLDER_REGEX.source, 'g');
    let placeholderMatch: RegExpExecArray | null;
    while ((placeholderMatch = matcher.exec(line)) !== null) placeholderNames.push(placeholderMatch[1]);
    for (const name of placeholderNames) {
      if (!ALLOWED_PLACEHOLDERS.has(name as keyof VideoTemplateValues)) {
        throw new Error(`Unknown frontmatter placeholder: {{${name}}}.`);
      }
    }
    if (placeholderNames.some((name) => isUnavailable(values[name as keyof VideoTemplateValues]))) {
      continue;
    }
    output.push(line.replace(PLACEHOLDER_REGEX, (_whole, name: keyof VideoTemplateValues) => {
      const value = values[name];
      if (value === undefined) return '';
      return yamlValue(value);
    }));
  }
  return output.join('\n').trim();
}

export function parseVideoTemplate(
  template: string,
  values: VideoTemplateValues,
  parseYaml: ParseYaml,
): ParsedVideoTemplate {
  const sampleYaml = renderVideoTemplate(template, TEMPLATE_SAMPLE_VALUES);
  const sampleKeys = topLevelKeys(sampleYaml);
  const duplicate = sampleKeys.find((key, index) => sampleKeys.indexOf(key) !== index);
  if (duplicate) throw new Error(`Duplicate top-level frontmatter property: ${duplicate}.`);

  let sample: unknown;
  try {
    sample = parseYaml(sampleYaml);
  } catch (error) {
    throw new Error(`Invalid frontmatter YAML: ${String(error)}`);
  }
  if (!isRecord(sample)) throw new Error('The frontmatter template must render a YAML object.');
  if (sample.source !== 'youtube') throw new Error('The template must render top-level `source: youtube`.');
  if (typeof sample.videoId !== 'string' || !sample.videoId.trim()) {
    throw new Error('The template must render a non-empty top-level `videoId`.');
  }

  const yaml = renderVideoTemplate(template, values);
  let properties: unknown;
  try {
    properties = parseYaml(yaml);
  } catch (error) {
    throw new Error(`Invalid rendered frontmatter YAML: ${String(error)}`);
  }
  if (!isRecord(properties)) throw new Error('The frontmatter template must render a YAML object.');
  if (properties.source !== 'youtube') throw new Error('Rendered frontmatter is missing `source: youtube`.');
  if (typeof properties.videoId !== 'string' || !properties.videoId.trim()) {
    throw new Error('Rendered frontmatter is missing a non-empty `videoId`.');
  }
  return { yaml, properties, managedKeys: sampleKeys };
}

export function validateVideoTemplate(template: string, parseYaml: ParseYaml): void {
  parseVideoTemplate(template, TEMPLATE_SAMPLE_VALUES, parseYaml);
}

export function previewVideoTemplate(template: string, parseYaml: ParseYaml): string {
  return parseVideoTemplate(template, TEMPLATE_SAMPLE_VALUES, parseYaml).yaml;
}

export function parseDefaultVideoTemplate(values: VideoTemplateValues, parseYaml: ParseYaml): ParsedVideoTemplate {
  return parseVideoTemplate(DEFAULT_VIDEO_FRONTMATTER_TEMPLATE, values, parseYaml);
}

export function mergeFrontmatterProperties(
  existing: Record<string, unknown>,
  previousManagedKeys: string[],
  rendered: ParsedVideoTemplate,
): Record<string, unknown> {
  const previous = new Set(previousManagedKeys);
  const nextManaged = new Set(rendered.managedKeys);
  const merged: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(rendered.properties)) merged[key] = value;
  for (const [key, value] of Object.entries(existing)) {
    if (!previous.has(key) && !nextManaged.has(key)) merged[key] = value;
  }
  return merged;
}

export function createVideoMetadataRecord(
  values: VideoTemplateValues,
  managedKeys: string[],
  template?: string,
): VideoMetadataRecord {
  return {
    schemaVersion: VIDEO_METADATA_SCHEMA_VERSION,
    values,
    managedKeys: [...managedKeys],
    ...(template ? { template } : {}),
  };
}

export function renderVideoMetadataMarker(record: VideoMetadataRecord): string {
  return `${VIDEO_METADATA_MARKER_PREFIX}${encodeBase64Url(JSON.stringify(record))} -->`;
}

export function extractVideoMetadataRecord(content: string): VideoMetadataRecord | null {
  const match = content.match(MARKER_REGEX);
  if (!match) return null;
  try {
    const value: unknown = JSON.parse(decodeBase64Url(match[1]));
    if (!isRecord(value) || value.schemaVersion !== VIDEO_METADATA_SCHEMA_VERSION) return null;
    if (!isRecord(value.values) || value.values.source !== 'youtube') return null;
    if (typeof value.values.videoId !== 'string' || !value.values.videoId) return null;
    if (!Array.isArray(value.managedKeys) || value.managedKeys.some((key) => typeof key !== 'string')) return null;
    if (value.template !== undefined && typeof value.template !== 'string') return null;
    return value as unknown as VideoMetadataRecord;
  } catch {
    return null;
  }
}

export function upsertVideoMetadataMarker(
  content: string,
  record: VideoMetadataRecord,
  frontmatterContentStart: number,
): string {
  const marker = renderVideoMetadataMarker(record);
  if (MARKER_REGEX.test(content)) return content.replace(MARKER_REGEX, marker);
  return `${content.slice(0, frontmatterContentStart).replace(/\s*$/, '')}\n${marker}\n\n${content.slice(frontmatterContentStart).replace(/^\s*/, '')}`;
}

export const LEGACY_VIDEO_MANAGED_KEYS = [
  'title', 'aliases', 'source', 'channel', 'channelUrl', 'channelId', 'videoUrl', 'videoId',
  'playlistUrl', 'playlistId', 'thumbnailUrl', 'videoDescription', 'uploadDate', 'videoCategory',
  'durationSeconds', 'keywords', 'generated', 'tags', 'aiSummary', 'aiProvider', 'aiModel',
  'aiGenerated',
];

function optionalString(value: unknown): string | undefined {
  return typeof value === 'string' && value.trim() ? value : undefined;
}

function optionalStringArray(value: unknown): string[] | undefined {
  if (Array.isArray(value)) {
    const strings = value.filter((item): item is string => typeof item === 'string' && item.trim().length > 0);
    return strings.length ? strings : undefined;
  }
  if (typeof value === 'string' && value.trim()) return [value.trim()];
  return undefined;
}

export function videoTemplateValuesFromLegacy(
  frontmatter: Record<string, unknown>,
  fallbackTitle: string,
  hasSummary: boolean,
): VideoTemplateValues | null {
  const videoId = optionalString(frontmatter.videoId);
  const source = optionalString(frontmatter.source);
  if (!videoId || source !== 'youtube') return null;
  const title = optionalString(frontmatter.title) ?? fallbackTitle;
  const duration = typeof frontmatter.durationSeconds === 'number' && Number.isFinite(frontmatter.durationSeconds)
    ? frontmatter.durationSeconds
    : undefined;
  return {
    title,
    aliases: optionalStringArray(frontmatter.aliases) ?? [title],
    source: 'youtube',
    channel: optionalString(frontmatter.channel),
    channelUrl: optionalString(frontmatter.channelUrl),
    channelId: optionalString(frontmatter.channelId),
    videoUrl: optionalString(frontmatter.videoUrl) ?? `https://www.youtube.com/watch?v=${videoId}`,
    videoId,
    playlistUrl: optionalString(frontmatter.playlistUrl),
    playlistId: optionalString(frontmatter.playlistId),
    thumbnailUrl: optionalString(frontmatter.thumbnailUrl),
    videoDescription: optionalString(frontmatter.videoDescription),
    uploadDate: optionalString(frontmatter.uploadDate),
    videoCategory: optionalString(frontmatter.videoCategory),
    durationSeconds: duration,
    keywords: optionalStringArray(frontmatter.keywords),
    generated: optionalString(frontmatter.generated) ?? new Date().toISOString(),
    tags: optionalStringArray(frontmatter.tags),
    aiSummary: hasSummary || frontmatter.aiSummary === true ? true : undefined,
    aiProvider: optionalString(frontmatter.aiProvider),
    aiModel: optionalString(frontmatter.aiModel),
    aiGenerated: optionalString(frontmatter.aiGenerated),
  };
}
