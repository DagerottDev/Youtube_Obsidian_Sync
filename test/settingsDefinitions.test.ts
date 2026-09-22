import { describe, expect, it, vi } from 'vitest';
import type YouTubePlaylistSyncPlugin from '../src/main';
import { YouTubePlaylistSyncSettingTab } from '../src/settings';
import { DEFAULT_SETTINGS, type YouTubePlaylistSyncSettings } from '../src/types';

interface TestDefinition {
  name?: string;
  heading?: string;
  type?: string;
  control?: { key: string };
  items?: TestDefinition[];
  visible?: boolean | (() => boolean);
  render?: (setting: unknown, group?: unknown) => void;
}

function makeTab(settings: YouTubePlaylistSyncSettings = { ...DEFAULT_SETTINGS, playlists: [] }): YouTubePlaylistSyncSettingTab {
  const plugin = {
    settings,
    saveSettings: vi.fn().mockResolvedValue(undefined),
  } as unknown as YouTubePlaylistSyncPlugin;
  const tab = Object.create(YouTubePlaylistSyncSettingTab.prototype) as YouTubePlaylistSyncSettingTab;
  Object.assign(tab, { plugin, app: {} });
  return tab;
}

function allDefinitions(items: TestDefinition[]): TestDefinition[] {
  return items.flatMap((item) => [item, ...(item.items ? allDefinitions(item.items) : [])]);
}

describe('declarative plugin settings', () => {
  it('exposes settings and actions in searchable groups', () => {
    const tab = makeTab();
    const groups = tab.getSettingDefinitions() as unknown as TestDefinition[];
    const definitions = allDefinitions(groups);
    const names = definitions.map((definition) => definition.name).filter((name): name is string => Boolean(name));

    expect(groups.map((group) => group.heading)).toEqual([
      'Playlists',
      'Sync',
      'Note output',
      'Video frontmatter template',
      'AI summaries',
    ]);
    expect(names).toEqual(expect.arrayContaining([
      'Add playlist',
      'Sync when Obsidian opens',
      'Sync interval (minutes)',
      'Base folder',
      'Create index notes',
      'Transcript format',
      'Preferred caption language',
      'Media embed',
      'Tags',
      'Template',
      'Validate and save',
      'Preview migration',
      'Enable AI summaries',
      'AI provider',
      'Authentication',
      'API base URL',
      'API protocol',
      'Model ID',
      'AI prompt mode',
      'Custom AI instructions',
      'Reset defaults',
      'Generate summaries automatically',
      'Test connection',
      'Generate missing',
    ]));
  });

  it('normalizes values using the existing setting semantics before saving', async () => {
    const tab = makeTab();

    await tab.setControlValue('baseFolder', ' /Courses/ ');
    await tab.setControlValue('syncIntervalMinutes', -4);
    await tab.setControlValue('preferredLanguage', ' en ');

    expect(tab.plugin.settings.baseFolder).toBe('Courses');
    expect(tab.plugin.settings.syncIntervalMinutes).toBe(0);
    expect(tab.plugin.settings.preferredLanguage).toBe('en');
    expect(tab.plugin.saveSettings).toHaveBeenCalledTimes(3);
  });

  it('applies provider presets and clears the prior secret when the provider changes', async () => {
    const tab = makeTab({ ...DEFAULT_SETTINGS, playlists: [], aiApiKeySecret: 'existing-secret' });

    await tab.setControlValue('aiProvider', 'nvidia-nim');

    expect(tab.plugin.settings.aiProvider).toBe('nvidia-nim');
    expect(tab.plugin.settings.aiEndpoint).toBe('https://integrate.api.nvidia.com/v1');
    expect(tab.plugin.settings.aiProtocol).toBe('chat-completions');
    expect(tab.plugin.settings.aiModel).toBe('openai/gpt-oss-20b');
    expect(tab.plugin.settings.aiApiKeySecret).toBe('');
    expect(tab.plugin.saveSettings).toHaveBeenCalledTimes(1);
  });

  it('shows custom instructions only outside default prompt mode', () => {
    const tab = makeTab();
    const definitions = allDefinitions(tab.getSettingDefinitions() as unknown as TestDefinition[]);
    const customInstructions = definitions.find((definition) => definition.name === 'Custom AI instructions');

    expect(customInstructions).toBeDefined();
    expect(typeof customInstructions?.visible).toBe('function');
    expect((customInstructions?.visible as () => boolean)()).toBe(false);
    tab.plugin.settings.aiPromptMode = 'append';
    expect((customInstructions?.visible as () => boolean)()).toBe(true);
  });

  it('refreshes declarative settings when the runtime provides an updater', () => {
    const tab = makeTab();
    const update = vi.fn();
    const display = vi.fn();
    Object.defineProperty(tab, 'update', { value: update });
    Object.defineProperty(tab, 'display', { value: display });

    (tab as unknown as { refreshSettingsTab(): void }).refreshSettingsTab();

    expect(update).toHaveBeenCalledOnce();
    expect(display).not.toHaveBeenCalled();
  });

  it('falls back to the legacy display when the runtime has no declarative updater', () => {
    const tab = makeTab();
    const display = vi.fn();
    Object.defineProperty(tab, 'update', { value: undefined });
    Object.defineProperty(tab, 'display', { value: display });

    (tab as unknown as { refreshSettingsTab(): void }).refreshSettingsTab();

    expect(display).toHaveBeenCalledOnce();
  });

  it('preserves an unsaved template draft when the settings definitions refresh', () => {
    const tab = makeTab();
    let onChange: ((value: string) => void) | undefined;
    let displayedValue = '';
    const textArea = {
      inputEl: { rows: 0, setCssStyles: vi.fn() },
      setValue(value: string) {
        displayedValue = value;
        return this;
      },
      onChange(callback: (value: string) => void) {
        onChange = callback;
        return this;
      },
    };
    const setting = {
      setName() { return this; },
      setDesc() { return this; },
      addTextArea(callback: (text: typeof textArea) => void) {
        callback(textArea);
        return this;
      },
    };
    const template = allDefinitions(tab.getSettingDefinitions() as unknown as TestDefinition[])
      .find((definition) => definition.name === 'Template');

    template?.render?.(setting);
    onChange?.('title: {{title}}\ncustom: draft');

    const refreshedTemplate = allDefinitions(tab.getSettingDefinitions() as unknown as TestDefinition[])
      .find((definition) => definition.name === 'Template');
    refreshedTemplate?.render?.(setting);

    expect(displayedValue).toBe('title: {{title}}\ncustom: draft');
  });
});
