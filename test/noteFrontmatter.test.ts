import { parse, stringify } from 'yaml';
import { describe, expect, it } from 'vitest';
import { hasAISummary } from '../src/ai/noteUpdater';
import { extractVideoMetadataRecord } from '../src/frontmatter';
import { recordForVideoNote, rewriteVideoNoteFrontmatter } from '../src/noteFrontmatter';
import { DEFAULT_VIDEO_FRONTMATTER_TEMPLATE } from '../src/types';

const legacyNote = `---
title: "Example"
aliases:
 - "Example"
source: youtube
channel: "Channel"
videoUrl: "https://www.youtube.com/watch?v=abc12345678"
videoId: "abc12345678"
playlistUrl: "https://www.youtube.com/playlist?list=PL-test"
playlistId: "PL-test"
generated: 2026-09-20T00:00:00.000Z
tags:
 - youtube
personalRating: 5
---

# Example

<!-- youtube-playlist-sync:ai-summary:start -->
## AI Summary

Existing summary.
<!-- youtube-playlist-sync:ai-summary:end -->

## Transcript

Transcript body.

## Source

Source body.
`;

describe('video-note frontmatter migration', () => {
  it('preserves body and unknown properties while adding reusable metadata', () => {
    const record = recordForVideoNote(legacyNote, 'Example', hasAISummary(legacyNote), parse);
    expect(record).not.toBeNull();
    const rewritten = rewriteVideoNoteFrontmatter(
      legacyNote,
      record!,
      DEFAULT_VIDEO_FRONTMATTER_TEMPLATE,
      parse,
      (value) => stringify(value),
    );
    const frontmatter = parse(rewritten.afterYaml);
    expect(frontmatter.personalRating).toBe(5);
    expect(frontmatter.source).toBe('youtube');
    expect(frontmatter.videoId).toBe('abc12345678');
    expect(rewritten.content).toContain('## Transcript\n\nTranscript body.');
    expect(rewritten.content).toContain('Existing summary.');
    expect(extractVideoMetadataRecord(rewritten.content)).not.toBeNull();
  });

  it('lets template-managed values win and is idempotent on repeated runs', () => {
    const template = `${DEFAULT_VIDEO_FRONTMATTER_TEMPLATE}\npersonalRating: 10`;
    const firstRecord = recordForVideoNote(legacyNote, 'Example', false, parse)!;
    const first = rewriteVideoNoteFrontmatter(legacyNote, firstRecord, template, parse, (value) => stringify(value));
    expect(parse(first.afterYaml).personalRating).toBe(10);

    const secondRecord = recordForVideoNote(first.content, 'Example', false, parse)!;
    const second = rewriteVideoNoteFrontmatter(first.content, secondRecord, template, parse, (value) => stringify(value));
    expect(second.changed).toBe(false);
    expect(second.content).toBe(first.content);
  });

  it('renders optional AI properties after metadata is updated', () => {
    const record = recordForVideoNote(legacyNote, 'Example', false, parse)!;
    record.values.aiSummary = true;
    record.values.aiProvider = 'openai';
    record.values.aiModel = 'model';
    record.values.aiGenerated = '2026-09-20T01:00:00.000Z';
    const rewritten = rewriteVideoNoteFrontmatter(
      legacyNote,
      record,
      DEFAULT_VIDEO_FRONTMATTER_TEMPLATE,
      parse,
      (value) => stringify(value),
    );
    const frontmatter = parse(rewritten.afterYaml);
    expect(frontmatter.aiSummary).toBe(true);
    expect(frontmatter.aiProvider).toBe('openai');
    expect(frontmatter.aiModel).toBe('model');
  });
});
