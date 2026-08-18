import type { PlaylistEntry, TranscriptLine, VideoMetadata, YouTubePlaylistSyncSettings } from './types';
import { normalizeWhitespace } from './youtube';

// ---------------------------------------------------------------------------
// Filename helpers (same rules YT Knowledge Notes uses)
// ---------------------------------------------------------------------------

const INVALID_NOTE_NAME_CHARS = new Set(['\\', '/', ':', '*', '?', '"', '<', '>', '|']);
const TRAILING_CHARS_REGEX = /[. ]+$/;
const WINDOWS_RESERVED_NAMES = new Set([
  'CON', 'PRN', 'AUX', 'NUL',
  'COM1', 'COM2', 'COM3', 'COM4', 'COM5', 'COM6', 'COM7', 'COM8', 'COM9',
  'LPT1', 'LPT2', 'LPT3', 'LPT4', 'LPT5', 'LPT6', 'LPT7', 'LPT8', 'LPT9',
]);

export function sanitizeNoteFileName(title: string): string {
  const cleaned = normalizeWhitespace(
    Array.from(title, (char) =>
      INVALID_NOTE_NAME_CHARS.has(char) || char.charCodeAt(0) <= 31 ? ' ' : char,
    ).join(''),
  )
    .replace(TRAILING_CHARS_REGEX, '')
    .trim();
  if (!cleaned) return '';
  if (WINDOWS_RESERVED_NAMES.has(cleaned.toUpperCase())) return `${cleaned} note`;
  return cleaned;
}

// ---------------------------------------------------------------------------
// YAML helpers (matching ytkn's frontmatter format)
// ---------------------------------------------------------------------------

function escapeYamlString(value: string): string {
  return value.replace(/\\/g, '\\\\').replace(/"/g, '\\"');
}

function quoteYaml(value: string): string {
  return `"${escapeYamlString(value)}"`;
}

// ---------------------------------------------------------------------------
// Formatting
// ---------------------------------------------------------------------------

export function formatDuration(seconds: number | undefined): string {
  if (seconds === undefined || !Number.isFinite(seconds)) return '—';
  const s = Math.floor(seconds);
  const h = Math.floor(s / 3600);
  const m = Math.floor((s % 3600) / 60);
  const rest = s % 60;
  if (h) return `${h}:${String(m).padStart(2, '0')}:${String(rest).padStart(2, '0')}`;
  return `${m}:${String(rest).padStart(2, '0')}`;
}

function timestamp(offsetMs: number): string {
  const total = Math.floor(offsetMs / 1000);
  const h = Math.floor(total / 3600);
  const m = Math.floor((total % 3600) / 60);
  const s = total % 60;
  if (h) return `${h}:${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
  return `${m}:${String(s).padStart(2, '0')}`;
}

// ---------------------------------------------------------------------------
// Frontmatter (same property set YT Knowledge Notes emits)
// ---------------------------------------------------------------------------

export function buildVideoFrontmatter(
  meta: VideoMetadata,
  playlist: { name: string; url: string; id: string },
  extraTags: string,
): string {
  const lines: string[] = ['---'];
  lines.push(`title: ${quoteYaml(meta.title)}`);
  lines.push('aliases:');
  lines.push(` - ${quoteYaml(meta.title)}`);
  lines.push('source: youtube');
  if (meta.author) lines.push(`channel: ${quoteYaml(meta.author)}`);
  if (meta.channelUrl) lines.push(`channelUrl: ${quoteYaml(meta.channelUrl)}`);
  if (meta.channelId) lines.push(`channelId: ${quoteYaml(meta.channelId)}`);
  lines.push(`videoUrl: ${quoteYaml(meta.url)}`);
  lines.push(`videoId: ${quoteYaml(meta.videoId)}`);
  lines.push(`playlistUrl: ${quoteYaml(playlist.url)}`);
  lines.push(`playlistId: ${quoteYaml(playlist.id)}`);
  if (meta.thumbnailUrl) lines.push(`thumbnailUrl: ${quoteYaml(meta.thumbnailUrl)}`);
  if (meta.description) lines.push(`videoDescription: ${quoteYaml(meta.description)}`);
  if (meta.uploadDate) lines.push(`uploadDate: ${meta.uploadDate}`);
  if (meta.videoCategory) lines.push(`videoCategory: ${quoteYaml(meta.videoCategory)}`);
  if (meta.durationSeconds !== undefined) lines.push(`durationSeconds: ${meta.durationSeconds}`);
  if (meta.keywords && meta.keywords.length) {
    lines.push('keywords:');
    for (const keyword of meta.keywords) lines.push(` - ${quoteYaml(keyword)}`);
  }
  lines.push(`generated: ${new Date().toISOString()}`);
  const tags = extraTags
    .split(/[\s,]+/)
    .map((tag) => tag.trim().replace(/^#+/, ''))
    .filter((tag) => tag.length > 0);
  if (tags.length) {
    lines.push('tags:');
    for (const tag of tags) lines.push(` - ${tag}`);
  }
  lines.push('---');
  return lines.join('\n');
}

// ---------------------------------------------------------------------------
// Transcript rendering
// ---------------------------------------------------------------------------

function renderTranscript(lines: TranscriptLine[], mode: 'readable' | 'timestamped', videoId: string): string {
  if (!lines.length) return '';
  if (mode === 'timestamped') {
    const rows = lines.map((line) => {
      const t = timestamp(line.offset);
      return `- [${t}](https://youtu.be/${videoId}?t=${Math.floor(line.offset / 1000)}) ${line.text}`;
    });
    return rows.join('\n');
  }
  // Readable: group lines into paragraphs on pauses (> 1.6s gap) or long lines.
  const paragraphs: string[] = [];
  let current: string[] = [];
  let lastOffset = lines[0].offset;
  for (const line of lines) {
    if (line.offset - lastOffset > 1600 && current.length) {
      paragraphs.push(current.join(' '));
      current = [];
    }
    current.push(line.text);
    lastOffset = line.offset;
  }
  if (current.length) paragraphs.push(current.join(' '));
  return paragraphs.join('\n\n');
}

// ---------------------------------------------------------------------------
// Video note body
// ---------------------------------------------------------------------------

export function buildVideoNote(
  meta: VideoMetadata,
  playlist: { name: string; url: string; id: string },
  transcript: TranscriptLine[] | null,
  settings: YouTubePlaylistSyncSettings,
): string {
  const parts: string[] = [];
  parts.push(buildVideoFrontmatter(meta, playlist, settings.extraTags));
  parts.push('');
  parts.push(`# ${meta.title}`);
  parts.push('');

  if (settings.mediaEmbed === 'video') {
    parts.push(`![${meta.title.replace(/[\[\]]/g, '')}](${meta.url})`);
    parts.push('');
  } else if (settings.mediaEmbed === 'thumbnail' && meta.thumbnailUrl) {
    parts.push(`![${meta.title.replace(/[\[\]]/g, '')}](${meta.thumbnailUrl})`);
    parts.push('');
  }

  if (transcript && transcript.length) {
    parts.push('## Transcript');
    parts.push('');
    parts.push(renderTranscript(transcript, settings.transcriptMode, meta.videoId));
    parts.push('');
  }

  parts.push('## Source');
  parts.push('');
  if (meta.author) {
    parts.push(meta.channelUrl
      ? `- **Channel:** [${meta.author}](${meta.channelUrl})`
      : `- **Channel:** ${meta.author}`);
  }
  parts.push(`- **Duration:** ${formatDuration(meta.durationSeconds)}`);
  if (meta.uploadDate) parts.push(`- **Uploaded:** ${meta.uploadDate}`);
  parts.push(`- **Playlist:** [${playlist.name}](${playlist.url})`);
  if (meta.keywords && meta.keywords.length) {
    parts.push(`- **Keywords:** ${meta.keywords.join(', ')}`);
  }
  parts.push('');

  return parts.join('\n');
}

// ---------------------------------------------------------------------------
// Index notes
// ---------------------------------------------------------------------------

export function buildPlaylistIndexNote(
  playlist: { name: string; url: string; id: string },
  entries: PlaylistEntry[],
  folder: string,
): string {
  const lines: string[] = [];
  lines.push('---');
  lines.push('source: youtube-playlist');
  lines.push(`playlistUrl: ${quoteYaml(playlist.url)}`);
  lines.push(`playlistId: ${quoteYaml(playlist.id)}`);
  lines.push(`videoCount: ${entries.length}`);
  lines.push(`generated: ${new Date().toISOString()}`);
  lines.push('---');
  lines.push('');
  lines.push(`# 🎬 ${playlist.name}`);
  lines.push('');
  lines.push(`> [Open playlist on YouTube](${playlist.url}) · **${entries.length} videos**`);
  lines.push('');
  lines.push('| # | Video | Channel | Duration | Published |');
  lines.push('| --- | --- | --- | --- | --- |');
  for (const entry of entries) {
    const name = sanitizeNoteFileName(entry.title) || entry.videoId;
    const link = `[[${folder}/${name}]]`;
    const channel = entry.author || '—';
    const duration = entry.lengthText || '—';
    const published = entry.publishedText || '—';
    lines.push(`| ${entry.position} | ${link} | ${channel.replace(/\|/g, '\\|')} | ${duration.replace(/\|/g, '\\|')} | ${published.replace(/\|/g, '\\|')} |`);
  }
  lines.push('');
  lines.push('---');
  lines.push('');
  lines.push('_Automatically generated by YouTube Playlist Sync._');
  return lines.join('\n');
}

export function buildRootIndex(
  playlists: Array<{ name: string; url: string; id: string; count: number }>,
): string {
  const lines: string[] = [];
  lines.push('---');
  lines.push('source: youtube');
  lines.push(`generated: ${new Date().toISOString()}`);
  lines.push('---');
  lines.push('');
  lines.push('# 📺 YouTube Playlists');
  lines.push('');
  if (!playlists.length) {
    lines.push('_No playlists configured yet. Add one in the plugin settings._');
    return lines.join('\n');
  }
  lines.push('| Playlist | Videos |');
  lines.push('| --- | --- |');
  for (const playlist of playlists) {
    lines.push(`| [${playlist.name.replace(/\|/g, '\\|')}](${playlist.url}) | ${playlist.count} |`);
  }
  lines.push('');
  lines.push('---');
  lines.push('');
  lines.push('_Automatically generated by YouTube Playlist Sync._');
  return lines.join('\n');
}
