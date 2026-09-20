import { beforeEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({ requestUrl: vi.fn() }));

vi.mock('obsidian', () => ({ requestUrl: mocks.requestUrl }));

import { OpenAICompatibleProvider } from '../src/ai/openai';

const summary = {
  summary: 'Summary',
  keyTakeaways: ['Takeaway'],
  importantConcepts: ['Concept'],
  actionItems: [],
  questionsToExplore: ['Question'],
};

function responsesResult() {
  return {
    status: 200,
    json: { output: [{ type: 'message', content: [{ type: 'output_text', text: JSON.stringify(summary) }] }] },
    text: '',
  };
}

function chatResult() {
  return {
    status: 200,
    json: { choices: [{ message: { content: JSON.stringify(summary) } }] },
    text: '',
  };
}

describe('OpenAICompatibleProvider prompt modes', () => {
  beforeEach(() => mocks.requestUrl.mockReset());

  it('sends appended guidance through the Responses API', async () => {
    mocks.requestUrl.mockResolvedValue(responsesResult());
    const provider = new OpenAICompatibleProvider({
      id: 'openai',
      baseUrl: 'https://api.example.com/v1',
      model: 'model',
      protocol: 'responses',
      auth: { type: 'api-key', token: 'secret' },
      promptMode: 'append',
      customPrompt: 'Focus on implementation details.',
    });
    await provider.summarize({ title: 'Title', transcript: 'Transcript' });
    const request = mocks.requestUrl.mock.calls[0][0];
    const body = JSON.parse(request.body);
    expect(body.input[0].content).toContain('Focus on implementation details.');
    expect(body.text.format.type).toBe('json_schema');
  });

  it('sends replacement guidance through Chat Completions while retaining the JSON contract', async () => {
    mocks.requestUrl.mockResolvedValue(chatResult());
    const provider = new OpenAICompatibleProvider({
      id: 'custom',
      baseUrl: 'https://api.example.com/v1',
      model: 'model',
      protocol: 'chat-completions',
      promptMode: 'replace',
      customPrompt: 'Write for beginners.',
    });
    await provider.summarize({ title: 'Title', transcript: 'Transcript' });
    const body = JSON.parse(mocks.requestUrl.mock.calls[0][0].body);
    expect(body.messages[0].content).toContain('Write for beginners.');
    expect(body.messages[0].content).toContain('Return only valid JSON');
  });

  it('applies custom guidance to every long-transcript chunk and the final synthesis', async () => {
    mocks.requestUrl.mockResolvedValue(responsesResult());
    const provider = new OpenAICompatibleProvider({
      id: 'openai',
      baseUrl: 'https://api.example.com/v1',
      model: 'model',
      protocol: 'responses',
      auth: { type: 'api-key', token: 'secret' },
      promptMode: 'append',
      customPrompt: 'Prioritize code examples.',
    });
    await provider.summarize({ title: 'Long video', transcript: 'a'.repeat(240_001) });
    expect(mocks.requestUrl.mock.calls.length).toBeGreaterThan(1);
    for (const [request] of mocks.requestUrl.mock.calls) {
      const body = JSON.parse(request.body);
      expect(body.input[0].content).toContain('Prioritize code examples.');
    }
  });
});
