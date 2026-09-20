import { parse } from 'yaml';
import { describe, expect, it } from 'vitest';
import {
  createVideoMetadataRecord,
  extractVideoMetadataRecord,
  parseVideoTemplate,
  renderVideoMetadataMarker,
  renderVideoTemplate,
  validateVideoTemplate,
  type VideoTemplateValues,
} from '../src/frontmatter';
import { DEFAULT_VIDEO_FRONTMATTER_TEMPLATE } from '../src/types';

const values: VideoTemplateValues = {
  title: 'A "quoted" title',
  aliases: ['A "quoted" title'],
  source: 'youtube',
  channel: 'Channel',
  videoUrl: 'https://www.youtube.com/watch?v=abc12345678',
  videoId: 'abc12345678',
  playlistUrl: 'https://www.youtube.com/playlist?list=PL-test',
  playlistId: 'PL-test',
  videoDescription: 'Line one\nLine two',
  durationSeconds: 42,
  keywords: ['one', 'two'],
  generated: '2026-09-20T00:00:00.000Z',
  tags: ['youtube', 'research'],
};

describe('video frontmatter templates', () => {
  it('validates and safely renders the default template', () => {
    validateVideoTemplate(DEFAULT_VIDEO_FRONTMATTER_TEMPLATE, parse);
    const rendered = parseVideoTemplate(DEFAULT_VIDEO_FRONTMATTER_TEMPLATE, values, parse);
    expect(rendered.properties.title).toBe(values.title);
    expect(rendered.properties.videoDescription).toBe(values.videoDescription);
    expect(rendered.properties.durationSeconds).toBe(42);
    expect(rendered.properties.tags).toEqual(['youtube', 'research']);
    expect(rendered.yaml).not.toContain('aiProvider:');
  });

  it('omits a line whose optional placeholder is unavailable', () => {
    expect(renderVideoTemplate('source: youtube\nvideoId: {{videoId}}\nchannelId: {{channelId}}', values))
      .toBe('source: youtube\nvideoId: "abc12345678"');
  });

  it('rejects unknown placeholders, delimiters, duplicates, and missing identity fields', () => {
    expect(() => validateVideoTemplate('source: youtube\nvideoId: {{videoId}}\nfoo: {{unknown}}', parse)).toThrow('Unknown');
    expect(() => validateVideoTemplate('---\nsource: youtube\nvideoId: {{videoId}}', parse)).toThrow('delimiters');
    expect(() => validateVideoTemplate('source: youtube\nvideoId: {{videoId}}\nvideoId: again', parse)).toThrow('Duplicate');
    expect(() => validateVideoTemplate('title: {{title}}\nvideoId: {{videoId}}', parse)).toThrow('source');
    expect(() => validateVideoTemplate('source: youtube\ntitle: {{title}}', parse)).toThrow('videoId');
  });
});

describe('video metadata marker', () => {
  it('round-trips Unicode metadata and managed keys', () => {
    const record = createVideoMetadataRecord({ ...values, title: '日本語 🎬' }, ['title', 'source', 'videoId']);
    const marker = renderVideoMetadataMarker(record);
    expect(extractVideoMetadataRecord(`${marker}\n# Note`)).toEqual(record);
  });

  it('rejects malformed and unsupported markers', () => {
    expect(extractVideoMetadataRecord('<!-- youtube-playlist-sync:metadata invalid -->')).toBeNull();
  });
});
