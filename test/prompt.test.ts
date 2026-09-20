import { describe, expect, it } from 'vitest';
import {
  buildSummaryInstruction,
  DEFAULT_SUMMARY_GUIDANCE,
  SUMMARY_RESPONSE_CONTRACT,
} from '../src/ai/prompt';

describe('buildSummaryInstruction', () => {
  it('uses the default guidance and immutable response contract', () => {
    expect(buildSummaryInstruction('default', 'ignored')).toBe(`${DEFAULT_SUMMARY_GUIDANCE} ${SUMMARY_RESPONSE_CONTRACT}`);
  });

  it('appends custom guidance when requested', () => {
    const result = buildSummaryInstruction('append', 'Focus on implementation details.');
    expect(result).toContain(DEFAULT_SUMMARY_GUIDANCE);
    expect(result).toContain('Focus on implementation details.');
    expect(result).toContain(SUMMARY_RESPONSE_CONTRACT);
  });

  it('replaces guidance but retains the response contract', () => {
    const result = buildSummaryInstruction('replace', 'Write for beginners.');
    expect(result).not.toContain(DEFAULT_SUMMARY_GUIDANCE);
    expect(result).toBe(`Write for beginners. ${SUMMARY_RESPONSE_CONTRACT}`);
  });

  it('rejects an empty replacement and treats an empty append as default', () => {
    expect(() => buildSummaryInstruction('replace', '  ')).toThrow('Enter custom AI instructions');
    expect(buildSummaryInstruction('append', '  ')).toBe(`${DEFAULT_SUMMARY_GUIDANCE} ${SUMMARY_RESPONSE_CONTRACT}`);
  });
});
