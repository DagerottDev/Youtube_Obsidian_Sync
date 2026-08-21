import { requestUrl, type RequestUrlResponse } from 'obsidian';
import type { AIProviderPreset, AIProtocol } from '../types';
import { providerDisplayName } from '../types';
import type { AIAuth, AIProvider, AISummary, AISummaryInput } from './types';

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

interface ResponsesEnvelope {
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

interface ChatCompletionsEnvelope {
  choices?: Array<{
    message?: {
      content?: string | null;
      refusal?: string | null;
    };
  }>;
  error?: { message?: string; code?: string };
}

export interface OpenAICompatibleProviderOptions {
  id: AIProviderPreset;
  baseUrl: string;
  model: string;
  protocol: AIProtocol;
  auth?: AIAuth;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null;
}

function stringArray(value: unknown): string[] | null {
  if (!Array.isArray(value) || value.some((item) => typeof item !== 'string')) return null;
  return value.map((item) => item.trim()).filter(Boolean);
}

function stripCodeFence(text: string): string {
  const trimmed = text.trim();
  const match = trimmed.match(/^```(?:json)?\s*([\s\S]*?)\s*```$/i);
  return match?.[1]?.trim() ?? trimmed;
}

function parseSummary(text: string): AISummary {
  let value: unknown;
  try {
    value = JSON.parse(stripCodeFence(text));
  } catch (error) {
    throw new Error(`AI endpoint returned invalid JSON: ${String(error)}`);
  }
  if (!isRecord(value) || typeof value.summary !== 'string') {
    throw new Error('AI endpoint returned an invalid summary payload.');
  }
  const keyTakeaways = stringArray(value.keyTakeaways);
  const importantConcepts = stringArray(value.importantConcepts);
  const actionItems = stringArray(value.actionItems);
  const questionsToExplore = stringArray(value.questionsToExplore);
  if (!keyTakeaways || !importantConcepts || !actionItems || !questionsToExplore) {
    throw new Error('AI endpoint returned an invalid summary payload.');
  }
  return {
    summary: value.summary.trim(),
    keyTakeaways,
    importantConcepts,
    actionItems,
    questionsToExplore,
  };
}

function extractResponsesText(envelope: ResponsesEnvelope): string {
  if (envelope.error?.message) throw new Error(envelope.error.message);
  for (const item of envelope.output ?? []) {
    if (item.type !== 'message') continue;
    for (const content of item.content ?? []) {
      if (content.type === 'refusal' && content.refusal) {
        throw new Error(`AI endpoint refused the summary request: ${content.refusal}`);
      }
      if (content.type === 'output_text' && content.text) return content.text;
    }
  }
  throw new Error('AI endpoint response did not contain summary text.');
}

function extractChatText(envelope: ChatCompletionsEnvelope): string {
  if (envelope.error?.message) throw new Error(envelope.error.message);
  const message = envelope.choices?.[0]?.message;
  if (message?.refusal) throw new Error(`AI endpoint refused the summary request: ${message.refusal}`);
  if (typeof message?.content === 'string' && message.content.trim()) return message.content;
  throw new Error('AI endpoint response did not contain summary text.');
}

function errorMessage(response: RequestUrlResponse): string {
  let parsed: unknown = null;
  try {
    parsed = response.json;
  } catch {
    // Upstream proxies can return plain text or HTML.
  }
  return isRecord(parsed)
    && isRecord(parsed.error)
    && typeof parsed.error.message === 'string'
    ? parsed.error.message
    : response.text || `HTTP ${response.status}`;
}

function responseError(response: RequestUrlResponse, displayName: string): Error {
  const message = errorMessage(response);
  if (response.status === 401 || response.status === 403) {
    return new Error(`${displayName} rejected the configured API key or access token.`);
  }
  if (response.status === 429) {
    return new Error(`${displayName} rate limit or quota reached. ${message}`);
  }
  return new Error(`${displayName} request failed (${response.status}): ${message}`);
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
      if (preferred > start + Math.floor(chunkSize * 0.6)) {
        end = preferred + (preferred === sentenceBreak ? 2 : 0);
      }
    }
    chunks.push(text.slice(start, end).trim());
    start = end;
  }
  return chunks.filter(Boolean);
}

function normalizeBaseUrl(value: string): string {
  return value
    .trim()
    .replace(/\/+$/, '')
    .replace(/\/(?:responses|chat\/completions|models)(?:\/[^/]*)?$/i, '');
}

function authHeaders(auth: AIAuth | undefined): Record<string, string> {
  if (!auth?.token.trim()) return {};
  return { Authorization: `Bearer ${auth.token}` };
}

function summaryInstruction(): string {
  return [
    'Summarize a YouTube transcript for a personal knowledge note.',
    'Be concise but preserve important facts, reasoning, caveats, and practical implications.',
    'Do not invent facts that are not supported by the transcript.',
    'Action items may be empty when the video has no actionable recommendations.',
    'Questions to explore should identify useful follow-up questions, not trivia.',
    'Return only valid JSON with exactly these keys:',
    'summary (string), keyTakeaways (string array), importantConcepts (string array), actionItems (string array), questionsToExplore (string array).',
  ].join(' ');
}

export class OpenAICompatibleProvider implements AIProvider {
  readonly id: AIProviderPreset;
  readonly displayName: string;
  readonly model: string;
  readonly protocol: AIProtocol;
  private readonly baseUrl: string;
  private readonly auth?: AIAuth;

  constructor(options: OpenAICompatibleProviderOptions) {
    this.id = options.id;
    this.displayName = providerDisplayName(options.id);
    this.baseUrl = normalizeBaseUrl(options.baseUrl);
    this.model = options.model.trim();
    this.protocol = options.protocol;
    this.auth = options.auth;
  }

  async validateCredentials(): Promise<void> {
    if (!this.baseUrl) throw new Error('AI endpoint is not configured.');
    if (!this.model) throw new Error('AI model is not configured.');
    if (this.id !== 'custom' && !this.auth?.token.trim()) {
      throw new Error(`${this.displayName} API key is not configured.`);
    }

    const response = await requestUrl({
      url: `${this.baseUrl}/models`,
      method: 'GET',
      headers: authHeaders(this.auth),
      throw: false,
    });
    if (response.status < 200 || response.status >= 300) {
      throw responseError(response, this.displayName);
    }
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
    return this.protocol === 'responses'
      ? this.createResponsesSummary(input)
      : this.createChatSummary(input);
  }

  private async createResponsesSummary(input: AISummaryInput): Promise<AISummary> {
    const response = await requestUrl({
      url: `${this.baseUrl}/responses`,
      method: 'POST',
      headers: {
        ...authHeaders(this.auth),
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: this.model,
        store: false,
        input: [
          { role: 'developer', content: summaryInstruction() },
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

    if (response.status < 200 || response.status >= 300) {
      throw responseError(response, this.displayName);
    }
    return parseSummary(extractResponsesText(response.json as ResponsesEnvelope));
  }

  private async createChatSummary(input: AISummaryInput): Promise<AISummary> {
    const response = await requestUrl({
      url: `${this.baseUrl}/chat/completions`,
      method: 'POST',
      headers: {
        ...authHeaders(this.auth),
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: this.model,
        messages: [
          { role: 'system', content: summaryInstruction() },
          {
            role: 'user',
            content: `Title: ${input.title}\nChannel: ${input.channel ?? 'Unknown'}\n\nTranscript:\n${input.transcript}`,
          },
        ],
        stream: false,
      }),
      throw: false,
    });

    if (response.status < 200 || response.status >= 300) {
      throw responseError(response, this.displayName);
    }
    return parseSummary(extractChatText(response.json as ChatCompletionsEnvelope));
  }
}

export const __test = { normalizeBaseUrl, parseSummary, splitTranscript, stripCodeFence };
