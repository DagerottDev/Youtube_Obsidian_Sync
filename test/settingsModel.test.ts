import { describe, expect, it } from 'vitest';
import { normalizeSettings } from '../src/settingsModel';
import { DEFAULT_SETTINGS } from '../src/types';

describe('normalizeSettings', () => {
  it('adds safe defaults to legacy settings', () => {
    const settings = normalizeSettings({ playlists: [{ url: 'https://www.youtube.com/playlist?list=PL-test' }] });
    expect(settings.aiPromptMode).toBe('default');
    expect(settings.aiCustomPrompt).toBe('');
    expect(settings.videoFrontmatterTemplate).toBe(DEFAULT_SETTINGS.videoFrontmatterTemplate);
  });

  it('preserves valid new settings', () => {
    const settings = normalizeSettings({
      aiPromptMode: 'append',
      aiCustomPrompt: 'Focus on examples.',
      videoFrontmatterTemplate: 'source: youtube\nvideoId: {{videoId}}',
    });
    expect(settings.aiPromptMode).toBe('append');
    expect(settings.aiCustomPrompt).toBe('Focus on examples.');
    expect(settings.videoFrontmatterTemplate).toContain('videoId');
  });

  it('falls back from an empty replacement prompt', () => {
    expect(normalizeSettings({ aiPromptMode: 'replace', aiCustomPrompt: ' ' }).aiPromptMode).toBe('default');
  });
});
