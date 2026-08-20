import { requestUrl, type RequestUrlResponse } from 'obsidian';
import type { AIProvider, AISummary, AISummaryInput } from './types';

const OPENAI_RESPONSES_ENDPOINT = 'https://api.openai.com/v1/responses';
const OPENAI_MODELS_ENDPOINT = 'https://api.openai.com/v1/models';
const DIRECT_TRANSCRIPT_CHAR_LIMIT = 240_000;
const CHUNK_CHAR_LIMIT = 80_000;

const SUMMARY_SCHEMA = {
  type: 'object',
  additionalProperties: false,
  properties: {
    summary: { type: 'string' },
    keyTakeaways: { type: 'array', items: { type: 'string' } },
    importantConcepts: { type: 'array', items: { type: 'string' } },
    actionItems: { type: 'array', items: { type: 'string' } },
    questionsToExplore: { type: 'array', items: { type: 'string' } },
  },
  required: ['summary', 'keyTakeaways', 'importantConcepts', 'actionItems', 'questionsToExplore'],
} as const;

interface OpenAIResponseEnvelope {
  output?: Array<{
    type?: string;
    content?: Array<{
      type?: string;
      text?: string;
      refusal?: string;
    }>;
  }>;
  error?: { message?: string; code?: string };
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null;
}

function stringArray(value: unknown): string[] | null {
  if (!Array.isArray(value) || value.some((item) => typeof item !== 'string')) return null;
  return value.map((item) => item.trim()).filter(Boolean);
}

function parseSummary(text: string): AISummary {
  let value: unknown;
  try {
    value = JSON.parse(text);
  } catch (error) {
    throw new Error(`OpenAI returned invalid JSON: ${String(error)}`);
  }
  if (!isRecord(value) || typeof value.summary !== 'string') {
    throw new Error('OpenAI returned an invalid summary payload.');
  }
  const keyTakeaways = stringArray(value.keyTakeaways);
  const importantConcepts = stringArray(value.importantConcepts);
  const actionItems = stringArray(value.actionItems);
  const questionsToExplore = stringArray(value.questionsToExplore);
  if (!keyTakeaways || !importantConcepts || !actionItems || !questionsToExplore) {
    throw new Error('OpenAI returned an invalid summary payload.');
  }
  return {
    summary: value.summary.trim(),
    keyTakeaways,
    importantConcepts,
    actionItems,
    questionsToExplore,
  };
}

function extractOutputText(envelope: OpenAIResponseEnvelope): string {
  if (envelope.error?.message) throw new Error(envelope.error.message);
  for (const item of envelope.output ?? []) {
    if (item.type !== 'message') continue;
    for (const content of item.content ?? []) {
      if (content.type === 'refusal' && content.refusal) {
        throw new Error(`OpenAI refused the summary request: ${content.refusal}`);
      }
      if (content.type === 'output_text' && content.text) return content.text;
    }
  }
  throw new Error('OpenAI response did not contain summary text.');
}

function responseError(response: RequestUrlResponse): Error {
  let parsed: unknown = null;
  try {
    parsed = response.json;
  } catch {
    // Some upstream errors can return non-JSON bodies.
  }
  const message = isRecord(parsed)
    && isRecord(parsed.error)
    && typeof parsed.error.message === 'string'
    ? parsed.error.message
    : response.text || `HTTP ${response.status}`;

  if (response.status === 401) return new Error('Invalid OpenAI API key.');
  if (response.status === 429) return new Error(`OpenAI rate limit or quota reached. ${message}`);
  return new Error(`OpenAI request failed (${response.status}): ${message}`);
}

function splitTranscript(text: string, chunkSize = CHUNK_CHAR_LIMIT): string[] {
  if (text.length <= chunkSize) return [text];
  const chunks: string[] = [];
  let start = 0;
  while (start < text.length) {
    let end = Math.min(start + chunkSize, text.length);
    if (end < text.length) {
      const paragraphBreak = text.lastIndexOf('\n\n', end);
      const sentenceBreak = text.lastIndexOf('. ', end);
      const preferred = Math.max(paragraphBreak, sentenceBreak);
      if (preferred > start + Math.floor(chunkSize * 0.6)) end = preferred + (preferred === sentenceBreak ? 2 : 0);
    }
    chunks.push(text.slice(start, end).trim());
    start = end;
  }
  return chunks.filter(Boolean);
}

export class OpenAIProvider implements AIProvider {
  readonly id = 'openai' as const;

  constructor(
    private readonly apiKey: string,
    readonly model: string,
  ) {}

  async validateCredentials(): Promise<void> {
    if (!this.apiKey.trim()) throw new Error('OpenAI API key is not configured.');
    if (!this.model.trim()) throw new Error('OpenAI model is not configured.');
    const response = await requestUrl({
      url: `${OPENAI_MODELS_ENDPOINT}/${encodeURIComponent(this.model)}`,
      method: 'GET',
      headers: { Authorization: `Bearer ${this.apiKey}` },
      throw: false,
    });
    if (response.status < 200 || response.status >= 300) throw responseError(response);
  }

  async summarize(input: AISummaryInput): Promise<AISummary> {
    const transcript = input.transcript.trim();
    if (!transcript) throw new Error('This note does not contain a transcript to summarize.');

    if (transcript.length <= DIRECT_TRANSCRIPT_CHAR_LIMIT) {
      return this.createSummary(input);
    }

    const chunks = splitTranscript(transcript);
    const partials: AISummary[] = [];
    for (let index = 0; index < chunks.length; index += 1) {
      partials.push(await this.createSummary({
        title: `${input.title} — transcript part ${index + 1} of ${chunks.length}`,
        channel: input.channel,
        transcript: chunks[index],
      }));
    }

    return this.createSummary({
      title: input.title,
      channel: input.channel,
      transcript: [
        'The original transcript was too long for one request. Produce one final coherent summary from these partial summaries.',
        JSON.stringify(partials),
      ].join('\n\n'),
    });
  }

  private async createSummary(input: AISummaryInput): Promise<AISummary> {
    const response = await requestUrl({
      url: OPENAI_RESPONSES_ENDPOINT,
      method: 'POST',
      headers: {
        Authorization: `Bearer ${this.apiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: this.model,
        store: false,
        input: [
          {
            role: 'developer',
            content: [
              'Summarize a YouTube transcript for a personal knowledge note.',
              'Be concise but preserve important facts, reasoning, caveats, and practical implications.',
              'Do not invent facts that are not supported by the transcript.',
              'Action items may be empty when the video has no actionable recommendations.',
              'Questions to explore should identify useful follow-up questions, not trivia.',
            ].join(' '),
          },
          {
            role: 'user',
            content: `Title: ${input.title}\nChannel: ${input.channel ?? 'Unknown'}\n\nTranscript:\n${input.transcript}`,
          },
        ],
        text: {
          format: {
            type: 'json_schema',
            name: 'youtube_video_summary',
            strict: true,
            schema: SUMMARY_SCHEMA,
          },
        },
      }),
      throw: false,
    });

    if (response.status < 200 || response.status >= 300) throw responseError(response);
    const envelope = response.json as OpenAIResponseEnvelope;
    return parseSummary(extractOutputText(envelope));
  }
}

export const __test = { parseSummary, splitTranscript };
