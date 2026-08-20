import type { AISummary } from './types';

export const AI_SUMMARY_START = '<!-- youtube-playlist-sync:ai-summary:start -->';
export const AI_SUMMARY_END = '<!-- youtube-playlist-sync:ai-summary:end -->';

const FRONTMATTER_END_REGEX = /^---\s*$/m;
const TRANSCRIPT_HEADING_REGEX = /^## Transcript\s*$/m;
const NEXT_H2_REGEX = /^##\s+/m;

function markdownList(items: string[]): string {
  return items.length ? items.map((item) => `- ${item}`).join('\n') : '- None';
}

export function renderAISummary(summary: AISummary): string {
  return [
    AI_SUMMARY_START,
    '## AI Summary',
    '',
    '### Summary',
    '',
    summary.summary,
    '',
    '### Key Takeaways',
    '',
    markdownList(summary.keyTakeaways),
    '',
    '### Important Concepts',
    '',
    markdownList(summary.importantConcepts),
    '',
    '### Action Items',
    '',
    markdownList(summary.actionItems),
    '',
    '### Questions / Things to Explore',
    '',
    markdownList(summary.questionsToExplore),
    AI_SUMMARY_END,
  ].join('\n');
}

export function hasAISummary(content: string): boolean {
  return content.includes(AI_SUMMARY_START) && content.includes(AI_SUMMARY_END);
}

export function extractTranscriptFromNote(content: string): string | null {
  const heading = TRANSCRIPT_HEADING_REGEX.exec(content);
  if (!heading) return null;
  const afterHeading = heading.index + heading[0].length;
  const rest = content.slice(afterHeading).replace(/^\s+/, '');
  const next = NEXT_H2_REGEX.exec(rest);
  const transcript = (next ? rest.slice(0, next.index) : rest).trim();
  return transcript || null;
}

export function extractTitleFromNote(content: string): string | null {
  const titleMatch = content.match(/^title:\s*"((?:\\.|[^"])*)"\s*$/m);
  if (titleMatch) return titleMatch[1].replace(/\\"/g, '"').replace(/\\\\/g, '\\');
  return content.match(/^#\s+(.+)$/m)?.[1]?.trim() ?? null;
}

export function extractChannelFromNote(content: string): string | undefined {
  const match = content.match(/^channel:\s*"((?:\\.|[^"])*)"\s*$/m);
  return match?.[1]?.replace(/\\"/g, '"').replace(/\\\\/g, '\\');
}

function upsertFrontmatterScalar(content: string, key: string, value: string): string {
  if (!content.startsWith('---\n')) return content;
  const endMatch = FRONTMATTER_END_REGEX.exec(content.slice(4));
  if (!endMatch) return content;
  const closingIndex = endMatch.index + 4;
  const head = content.slice(0, closingIndex);
  const tail = content.slice(closingIndex);
  const line = `${key}: ${value}`;
  const pattern = new RegExp(`^${key}:.*$`, 'm');
  if (pattern.test(head)) return head.replace(pattern, line) + tail;
  return `${head}${line}\n${tail}`;
}

export function applyAISummaryToNote(
  content: string,
  summary: AISummary,
  provider: string,
  model: string,
  generatedAt = new Date().toISOString(),
): string {
  const block = renderAISummary(summary);
  let updated = content;

  const start = updated.indexOf(AI_SUMMARY_START);
  const end = updated.indexOf(AI_SUMMARY_END);
  if (start >= 0 && end >= start) {
    updated = `${updated.slice(0, start)}${block}${updated.slice(end + AI_SUMMARY_END.length)}`;
  } else {
    const transcriptHeading = TRANSCRIPT_HEADING_REGEX.exec(updated);
    if (transcriptHeading) {
      updated = `${updated.slice(0, transcriptHeading.index).replace(/\s+$/, '')}\n\n${block}\n\n${updated.slice(transcriptHeading.index)}`;
    } else {
      const sourceHeading = /^## Source\s*$/m.exec(updated);
      if (sourceHeading) {
        updated = `${updated.slice(0, sourceHeading.index).replace(/\s+$/, '')}\n\n${block}\n\n${updated.slice(sourceHeading.index)}`;
      } else {
        updated = `${updated.replace(/\s+$/, '')}\n\n${block}\n`;
      }
    }
  }

  updated = upsertFrontmatterScalar(updated, 'aiSummary', 'true');
  updated = upsertFrontmatterScalar(updated, 'aiProvider', `"${provider.replace(/"/g, '\\"')}"`);
  updated = upsertFrontmatterScalar(updated, 'aiModel', `"${model.replace(/"/g, '\\"')}"`);
  updated = upsertFrontmatterScalar(updated, 'aiGenerated', generatedAt);
  return updated;
}

export const __test = { upsertFrontmatterScalar };
