import {
  createVideoMetadataRecord,
  extractVideoMetadataRecord,
  LEGACY_VIDEO_MANAGED_KEYS,
  mergeFrontmatterProperties,
  parseVideoTemplate,
  renderVideoMetadataMarker,
  videoTemplateValuesFromLegacy,
  type ParseYaml,
  type VideoMetadataRecord,
} from './frontmatter';

export type StringifyYaml = (value: Record<string, unknown>) => string;

export interface FrontmatterSection {
  yaml: string;
  blockEnd: number;
}

export interface RewrittenVideoNote {
  content: string;
  beforeYaml: string;
  afterYaml: string;
  record: VideoMetadataRecord;
  changed: boolean;
}

const FRONTMATTER_REGEX = /^---\r?\n([\s\S]*?)\r?\n---(?=\r?\n|$)/;
const MARKER_REGEX = /<!-- youtube-playlist-sync:metadata [A-Za-z0-9_-]+ -->/;

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

export function extractFrontmatterSection(content: string): FrontmatterSection | null {
  const match = content.match(FRONTMATTER_REGEX);
  if (!match) return null;
  return { yaml: match[1], blockEnd: match[0].length };
}

export function recordForVideoNote(
  content: string,
  fallbackTitle: string,
  hasSummary: boolean,
  parseYaml: ParseYaml,
): VideoMetadataRecord | null {
  const existing = extractVideoMetadataRecord(content);
  if (existing) return existing;
  const section = extractFrontmatterSection(content);
  if (!section) return null;
  let frontmatter: unknown;
  try {
    frontmatter = parseYaml(section.yaml);
  } catch {
    return null;
  }
  if (!isRecord(frontmatter)) return null;
  const values = videoTemplateValuesFromLegacy(frontmatter, fallbackTitle, hasSummary);
  return values ? createVideoMetadataRecord(values, LEGACY_VIDEO_MANAGED_KEYS) : null;
}

export function rewriteVideoNoteFrontmatter(
  content: string,
  record: VideoMetadataRecord,
  template: string,
  parseYaml: ParseYaml,
  stringifyYaml: StringifyYaml,
): RewrittenVideoNote {
  const section = extractFrontmatterSection(content);
  if (!section) throw new Error('The note does not contain valid YAML frontmatter.');
  let existing: unknown;
  try {
    existing = parseYaml(section.yaml);
  } catch (error) {
    throw new Error(`Could not parse existing frontmatter: ${String(error)}`);
  }
  if (!isRecord(existing)) throw new Error('Existing frontmatter is not a YAML object.');

  const rendered = parseVideoTemplate(template, record.values, parseYaml);
  const merged = mergeFrontmatterProperties(existing, record.managedKeys, rendered);
  const afterYaml = stringifyYaml(merged).replace(/\s+$/, '');
  const nextRecord = createVideoMetadataRecord(record.values, rendered.managedKeys, template);
  const marker = renderVideoMetadataMarker(nextRecord);
  const replacement = `---\n${afterYaml}\n---`;
  let next = `${replacement}${content.slice(section.blockEnd)}`;
  if (MARKER_REGEX.test(next)) {
    next = next.replace(MARKER_REGEX, marker);
  } else {
    const insertAt = replacement.length;
    const suffix = next.slice(insertAt);
    const separator = suffix.startsWith('\r\n') ? '\r\n' : '\n';
    next = `${next.slice(0, insertAt)}${separator}${marker}${suffix}`;
  }

  return {
    content: next,
    beforeYaml: section.yaml,
    afterYaml,
    record: nextRecord,
    changed: next !== content,
  };
}
