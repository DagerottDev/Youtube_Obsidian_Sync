import type { AIProviderPreset, AIProtocol } from '../types';

export interface AISummary {
  summary: string;
  keyTakeaways: string[];
  importantConcepts: string[];
  actionItems: string[];
  questionsToExplore: string[];
}

export interface AISummaryInput {
  title: string;
  channel?: string;
  transcript: string;
}

export type AIAuth =
  | { type: 'api-key'; token: string }
  | { type: 'oauth'; token: string };

export interface AIProvider {
  readonly id: AIProviderPreset;
  readonly displayName: string;
  readonly model: string;
  readonly protocol: AIProtocol;
  validateCredentials(): Promise<void>;
  summarize(input: AISummaryInput): Promise<AISummary>;
}
