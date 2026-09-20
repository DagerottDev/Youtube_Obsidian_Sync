import type { AIPromptMode } from '../types';

export const DEFAULT_SUMMARY_GUIDANCE = [
  'Summarize a YouTube transcript for a personal knowledge note.',
  'Be concise but preserve important facts, reasoning, caveats, and practical implications.',
  'Do not invent facts that are not supported by the transcript.',
  'Action items may be empty when the video has no actionable recommendations.',
  'Questions to explore should identify useful follow-up questions, not trivia.',
].join(' ');

export const SUMMARY_RESPONSE_CONTRACT = [
  'Return only valid JSON with exactly these keys:',
  'summary (string), keyTakeaways (string array), importantConcepts (string array), actionItems (string array), questionsToExplore (string array).',
].join(' ');

export function buildSummaryInstruction(mode: AIPromptMode, customPrompt: string): string {
  const custom = customPrompt.trim();
  if (mode === 'replace' && !custom) {
    throw new Error('Enter custom AI instructions or switch prompt mode.');
  }
  const guidance = mode === 'replace'
    ? custom
    : mode === 'append' && custom
      ? `${DEFAULT_SUMMARY_GUIDANCE} ${custom}`
      : DEFAULT_SUMMARY_GUIDANCE;
  return `${guidance} ${SUMMARY_RESPONSE_CONTRACT}`;
}
