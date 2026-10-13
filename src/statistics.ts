import { extractTranscriptFromNote, hasAISummary } from './ai/noteUpdater';
import { extractVideoMetadataRecord, VIDEO_METADATA_MARKER_PREFIX, type ParseYaml } from './frontmatter';
import { recordForVideoNote } from './noteFrontmatter';

export const USAGE_COUNTER_LABELS = {
  playlistsAdded: 'Playlists added',
  videoNotesCreated: 'Video notes created',
  transcriptsSaved: 'Transcripts saved',
  summariesGenerated: 'AI summaries generated',
  syncsCompleted: 'Sync runs completed successfully',
  syncsWithErrors: 'Sync runs with errors',
} as const;

export type UsageCounter = keyof typeof USAGE_COUNTER_LABELS;
export interface UsageStats {
  enabled: boolean;
  startedAt: string;
  counters: Record<UsageCounter, number>;
}

export interface CollectionStats {
  videoNotes: number;
  notesWithTranscripts: number;
  notesWithSummaries: number;
  skippedFiles: number;
  scannedAt: string;
}

function record(value: unknown): Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
    ? value as Record<string, unknown> : {};
}

function count(value: unknown): number {
  return typeof value === 'number' && Number.isFinite(value) && value >= 0
    ? Math.min(Math.floor(value), Number.MAX_SAFE_INTEGER) : 0;
}

export function normalizeUsageStats(value?: unknown, now = new Date().toISOString()): UsageStats {
  const stored = record(value);
  const counters = record(stored.counters);
  const normalized = {} as Record<UsageCounter, number>;
  for (const key of Object.keys(USAGE_COUNTER_LABELS) as UsageCounter[]) normalized[key] = count(counters[key]);
  return {
    enabled: typeof stored.enabled === 'boolean' ? stored.enabled : true,
    startedAt: typeof stored.startedAt === 'string' && Number.isFinite(Date.parse(stored.startedAt))
      ? new Date(stored.startedAt).toISOString() : now,
    counters: normalized,
  };
}

export function incrementUsage(stats: UsageStats, key: UsageCounter): void {
  if (stats.enabled) stats.counters[key] = Math.min(stats.counters[key] + 1, Number.MAX_SAFE_INTEGER);
}

/** Read-only scan; retain only aggregate counts, never file names or content. */
export async function scanCollection<T extends { basename: string }>(
  files: readonly T[],
  read: (file: T) => Promise<string>,
  parseYaml: ParseYaml,
): Promise<CollectionStats> {
  const totals: CollectionStats = {
    videoNotes: 0, notesWithTranscripts: 0, notesWithSummaries: 0,
    skippedFiles: 0, scannedAt: '',
  };
  for (const file of files) {
    if (file.basename === '_Index') continue;
    try {
      const content = await read(file);
      if (content.includes(VIDEO_METADATA_MARKER_PREFIX) && !extractVideoMetadataRecord(content)) {
        totals.skippedFiles += 1;
        continue;
      }
      const summary = hasAISummary(content);
      if (!recordForVideoNote(content, file.basename, summary, parseYaml)) continue;
      totals.videoNotes += 1;
      if (extractTranscriptFromNote(content)) totals.notesWithTranscripts += 1;
      if (summary) totals.notesWithSummaries += 1;
    } catch {
      totals.skippedFiles += 1;
    }
  }
  totals.scannedAt = new Date().toISOString();
  return totals;
}

export function buildUsageReport(version: string, stats: UsageStats, playlists: number, totals: CollectionStats): string {
  // Explicit allowlist: never serialize plugin settings or scanned metadata.
  const safeStats = normalizeUsageStats(stats);
  return JSON.stringify({
    pluginVersion: version,
    recording: safeStats,
    currentCollection: {
      configuredPlaylists: count(playlists),
      videoNotes: count(totals.videoNotes),
      notesWithTranscripts: count(totals.notesWithTranscripts),
      notesWithSummaries: count(totals.notesWithSummaries),
      skippedFiles: count(totals.skippedFiles),
      scannedAt: Number.isFinite(Date.parse(totals.scannedAt)) ? new Date(totals.scannedAt).toISOString() : null,
    },
  }, null, 2);
}
