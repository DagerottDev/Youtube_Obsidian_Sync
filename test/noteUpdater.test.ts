import { describe, expect, it } from 'vitest';
import { extractTranscriptFromNote, normalizeTranscriptForAI } from '../src/ai/noteUpdater';

describe('normalizeTranscriptForAI', () => {
  it('removes plugin-generated timestamp links without losing caption text', () => {
    const transcript = [
      '- [00:01](https://youtu.be/abc_DEF-12?t=1) First sentence.',
      '- [1:02:03](https://youtu.be/abc_DEF-12?t=3723) Second sentence!',
    ].join('\n');
    expect(normalizeTranscriptForAI(transcript)).toBe('First sentence.\nSecond sentence!');
  });

  it('preserves readable paragraphs and malformed timestamp-like lines', () => {
    const transcript = 'Paragraph one.\n\n- [00:02](https://example.com/video?t=2) Keep this line.';
    expect(normalizeTranscriptForAI(transcript)).toBe(transcript);
  });

  it('normalizes mixed content and returns null for empty content', () => {
    expect(normalizeTranscriptForAI('- [00:01](https://youtu.be/abc12345678?t=1) Caption\nPlain line'))
      .toBe('Caption\nPlain line');
    expect(normalizeTranscriptForAI(' \n ')).toBeNull();
  });
});

describe('extractTranscriptFromNote', () => {
  it('stops at the next H2 and normalizes timestamped rows', () => {
    const note = '# Video\n\n## Transcript\n\n- [00:01](https://youtu.be/abc12345678?t=1) Caption\n\n## Source\n\nSource';
    expect(extractTranscriptFromNote(note)).toBe('Caption');
  });
});
