import { parse } from 'yaml';
import { describe, expect, it } from 'vitest';
import { buildUsageReport, incrementUsage, normalizeUsageStats, scanCollection } from '../src/statistics';
import { normalizeSettings } from '../src/settingsModel';
import { buildVideoNote } from '../src/noteRenderer';
import { applyAISummaryToNote } from '../src/ai/noteUpdater';

const summary = { summary: 'Example', keyTakeaways: [], importantConcepts: [], actionItems: [], questionsToExplore: [] };

describe('local statistics', () => {
  it('initializes legacy settings independently and sanitizes persisted counters', () => {
    const first = normalizeSettings(undefined);
    const second = normalizeSettings(undefined);
    incrementUsage(first.usageStats, 'playlistsAdded');
    expect(second.usageStats.counters.playlistsAdded).toBe(0);
    expect(first.usageStats.enabled).toBe(true);
    expect(Number.isFinite(Date.parse(first.usageStats.startedAt))).toBe(true);
    const stats = normalizeUsageStats({ enabled: false, startedAt: 'invalid', counters: {
      playlistsAdded: -1, videoNotesCreated: 2.9, transcriptsSaved: Infinity,
      summariesGenerated: '4', syncsCompleted: NaN, syncsWithErrors: Number.MAX_VALUE,
    } }, '2026-10-06T00:00:00.000Z');
    expect(stats).toEqual({ enabled: false, startedAt: '2026-10-06T00:00:00.000Z', counters: {
      playlistsAdded: 0, videoNotesCreated: 2, transcriptsSaved: 0,
      summariesGenerated: 0, syncsCompleted: 0, syncsWithErrors: Number.MAX_SAFE_INTEGER,
    } });
    expect(normalizeUsageStats(null).counters.playlistsAdded).toBe(0);
  });

  it('pauses and resumes without replacing counters, and survives JSON reload', () => {
    const stats = normalizeUsageStats();
    incrementUsage(stats, 'summariesGenerated');
    stats.enabled = false;
    incrementUsage(stats, 'summariesGenerated');
    stats.enabled = true;
    incrementUsage(stats, 'summariesGenerated');
    expect(normalizeSettings(JSON.parse(JSON.stringify({ usageStats: stats }))).usageStats).toEqual(stats);
    expect(stats.counters.summariesGenerated).toBe(2);
  });

  it('recognizes modern and legacy notes, excludes indexes/unrelated files, and reports partial totals', async () => {
    const modern = buildVideoNote({
      videoId: 'abc12345678', url: 'https://youtu.be/abc12345678', title: 'Private title', author: 'Channel',
      channelUrl: '', thumbnailUrl: '',
    }, { name: 'Playlist', id: 'PL-test', url: 'https://youtube.com/playlist?list=PL-test' },
    [{ text: 'Private transcript', offset: 0 }], normalizeSettings(undefined), parse);
    const legacy = '---\nsource: youtube\nvideoId: legacy12345\n---\n# Legacy\n';
    const files = [
      { basename: 'Modern', content: modern },
      { basename: 'Legacy', content: applyAISummaryToNote(legacy, summary, 'provider', 'model') },
      { basename: 'Unrelated', content: '# A personal note\n## Transcript\nText' },
      { basename: '_Index', content: modern },
      { basename: 'Broken', content: `${legacy}\n<!-- youtube-playlist-sync:metadata broken -->` },
      { basename: 'Unreadable', content: '' },
    ];
    const totals = await scanCollection(files, async (file) => {
      if (file.basename === 'Unreadable') throw new Error('private/path');
      return file.content;
    }, parse);
    expect(totals).toMatchObject({ videoNotes: 2, notesWithTranscripts: 1, notesWithSummaries: 1, skippedFiles: 2 });
    expect(await scanCollection([], async () => '', parse)).toMatchObject({ videoNotes: 0, skippedFiles: 0 });
    expect(JSON.stringify(totals)).not.toMatch(/private|Playlist|Modern/i);
  });

  it('allowlists report fields and canonicalizes dates instead of leaking injected properties', () => {
    const stats = normalizeUsageStats();
    Object.assign(stats, { secret: 'SECRET', url: 'SECRET' });
    Object.assign(stats.counters, { token: 'SECRET' });
    const totals = { videoNotes: 1, notesWithTranscripts: 1, notesWithSummaries: 0, skippedFiles: 0,
      scannedAt: '2026-10-06T00:00:00.000Z', path: 'SECRET', content: 'SECRET' };
    const text = buildUsageReport('0.3.3', stats, 2, totals);
    expect(text).not.toContain('SECRET');
    expect(JSON.parse(text)).toEqual({ pluginVersion: '0.3.3', recording: normalizeUsageStats(stats), currentCollection: {
      configuredPlaylists: 2, videoNotes: 1, notesWithTranscripts: 1, notesWithSummaries: 0,
      skippedFiles: 0, scannedAt: totals.scannedAt,
    } });
    expect(buildUsageReport('0.3.3', stats, 2, { ...totals, scannedAt: 'SECRET' })).not.toContain('SECRET');
  });
});
