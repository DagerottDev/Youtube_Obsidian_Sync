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

export interface AIProvider {
  readonly id: 'openai';
  readonly model: string;
  validateCredentials(): Promise<void>;
  summarize(input: AISummaryInput): Promise<AISummary>;
}
