import { parse } from 'yaml';
import { describe, expect, it } from 'vitest';
import { extractVideoMetadataRecord } from '../src/frontmatter';
import { buildVideoNote } from '../src/noteRenderer';
import { DEFAULT_SETTINGS, type VideoMetadata } from '../src/types';

describe('buildVideoNote', () => {
  it('uses the configured template and adds portable metadata without AI fields', () => {
    const meta: VideoMetadata = {
      videoId: 'abc12345678',
      url: 'https://www.youtube.com/watch?v=abc12345678',
      title: 'Example',
      author: 'Channel',
      channelUrl: 'https://www.youtube.com/channel/example',
      thumbnailUrl: 'https://example.com/thumb.jpg',
      durationSeconds: 60,
    };
    const note = buildVideoNote(
      meta,
      { name: 'Playlist', url: 'https://www.youtube.com/playlist?list=PL-test', id: 'PL-test' },
      [{ offset: 1000, text: 'Caption' }],
      { ...DEFAULT_SETTINGS, transcriptMode: 'timestamped' },
      parse,
    );
    expect(note).toContain('source: youtube');
    expect(note).toContain('- [0:01](https://youtu.be/abc12345678?t=1) Caption');
    expect(note).not.toContain('aiProvider:');
    const record = extractVideoMetadataRecord(note);
    expect(record?.values.videoId).toBe('abc12345678');
    expect(record?.template).toBe(DEFAULT_SETTINGS.videoFrontmatterTemplate);
  });
});
