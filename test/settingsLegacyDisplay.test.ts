import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const capture = vi.hoisted(() => ({
  templateValues: [] as string[],
  templateChanges: [] as ((value: string) => void)[],
  names: [] as string[],
  descriptions: [] as string[],
  buttons: [] as { name: string; text: string; click?: () => unknown; disabled: boolean }[],
  toggles: [] as { name: string; change?: (enabled: boolean) => void }[],
  inputs: [] as { value: string; readOnly: boolean; focus: () => void; select: () => void; setCssStyles: () => void }[],
  modals: [] as { title: string; closed: boolean }[],
}));

vi.mock('obsidian', () => {
  class FakeSetting {
    private name = '';
    controlEl = { createSpan() { return { setCssStyles() {} }; } };
    settingEl = {
      empty() {},
      createDiv() { return { empty() {}, setCssStyles() {} }; },
    };
    constructor(..._args: unknown[]) {}
    setName(name: string) { this.name = name; capture.names.push(name); return this; }
    setDesc(desc: string) { capture.descriptions.push(desc); return this; }
    setHeading() { return this; }
    addButton(callback: (button: Record<string, (...args: never[]) => unknown>) => void) {
      const action: typeof capture.buttons[number] = { name: this.name, text: '', disabled: false };
      capture.buttons.push(action);
      const button = {
        buttonEl: { dataset: {} },
        setButtonText(text: string) { action.text = text; return button; },
        setCta() { return button; },
        setDisabled(disabled: boolean) { action.disabled = disabled; return button; },
        onClick(click: () => unknown) { action.click = click; return button; },
      };
      callback(button);
      return this;
    }
    addText(callback: (text: Record<string, unknown>) => void) {
      const text = {
        inputEl: { value: '' },
        setPlaceholder() { return text; },
        setValue() { return text; },
        onChange() { return text; },
      };
      callback(text);
      return this;
    }
    addTextArea(callback: (text: Record<string, unknown>) => void) {
      const text = {
        inputEl: { rows: 0, setCssStyles() {} },
        setValue(value: string) {
          capture.templateValues.push(value);
          return text;
        },
        onChange(handler: (value: string) => void) {
          capture.templateChanges.push(handler);
          return text;
        },
      };
      callback(text);
      return this;
    }
    addToggle(callback: (toggle: Record<string, unknown>) => void) {
      const action: typeof capture.toggles[number] = { name: this.name };
      capture.toggles.push(action);
      const toggle = { toggleEl: { dataset: {}, setAttribute() {}, querySelector() { return null; } }, setValue() { return toggle; }, onChange(change: (enabled: boolean) => void) { action.change = change; return toggle; } };
      callback(toggle);
      return this;
    }
    addDropdown(callback: (dropdown: Record<string, unknown>) => void) {
      const dropdown = {
        addOption() { return dropdown; },
        setValue() { return dropdown; },
        onChange() { return dropdown; },
      };
      callback(dropdown);
      return this;
    }
    addComponent(callback: (element: object) => void) {
      callback({});
      return this;
    }
  }

  class FakePluginSettingTab {}
  class FakeModal {
    title = '';
    closed = false;
    contentEl = {
      createEl() {
        const input = { value: '', readOnly: false, focus: vi.fn(), select: vi.fn(), setCssStyles() {} };
        capture.inputs.push(input);
        return input;
      },
    };
    setTitle(title: string) { this.title = title; }
    open() {
      capture.modals.push(this);
      (this as unknown as { onOpen(): void }).onOpen();
    }
    close() { this.closed = true; }
  }
  class FakeNotice {}
  class FakeSecretComponent {
    constructor(..._args: unknown[]) {}
    setValue() { return this; }
    onChange() { return this; }
  }

  return {
    App: class {},
    Modal: FakeModal,
    Notice: FakeNotice,
    parseYaml: (value: string) => value,
    PluginSettingTab: FakePluginSettingTab,
    SecretComponent: FakeSecretComponent,
    Setting: FakeSetting,
  };
});

import type YouTubePlaylistSyncPlugin from '../src/main';
import { YouTubePlaylistSyncSettingTab } from '../src/settings';
import { DEFAULT_SETTINGS } from '../src/types';
import { normalizeSettings } from '../src/settingsModel';

const totals = { videoNotes: 5, notesWithTranscripts: 4, notesWithSummaries: 3, skippedFiles: 1, scannedAt: '2026-10-06T00:00:00.000Z' };

function makeTab() {
  const plugin = {
    settings: normalizeSettings(undefined), manifest: { version: '0.3.3' },
    saveSettings: vi.fn().mockResolvedValue(undefined),
    scanUsageCollection: vi.fn().mockResolvedValue(totals),
    persistUsageStats: vi.fn().mockResolvedValue(undefined),
    resetUsageStats: vi.fn().mockResolvedValue(undefined),
  } as unknown as YouTubePlaylistSyncPlugin;
  const tab = new YouTubePlaylistSyncSettingTab({} as never, plugin);
  Object.assign(tab, { app: {}, containerEl: { empty() {}, createDiv() { return { empty() {}, createEl() {} }; } } });
  return tab;
}

function click(text: string) {
  return capture.buttons.filter((button) => button.text === text).pop()!.click!();
}

afterEach(() => vi.unstubAllGlobals());

describe('legacy settings display', () => {
  beforeEach(() => {
    capture.templateValues.length = 0;
    capture.templateChanges.length = 0;
    capture.names.length = 0;
    capture.descriptions.length = 0;
    capture.buttons.length = 0;
    capture.toggles.length = 0;
    capture.inputs.length = 0;
    capture.modals.length = 0;
  });

  it('keeps an unsaved template edit when display redraws the settings', () => {
    const tab = makeTab();
    Object.assign(tab, {
      plugin: {
        settings: { ...DEFAULT_SETTINGS, playlists: [] },
        saveSettings: vi.fn().mockResolvedValue(undefined),
        scanUsageCollection: vi.fn().mockResolvedValue(totals),
      } as unknown as YouTubePlaylistSyncPlugin,
      app: {},
      containerEl: {
        empty() {},
        createDiv() { return { empty() {}, createEl() {} }; },
      },
    });

    tab.display();
    capture.templateChanges[0]('title: {{title}}\ncustom: draft');
    tab.display();

    expect(capture.templateValues).toEqual([
      DEFAULT_SETTINGS.videoFrontmatterTemplate,
      'title: {{title}}\ncustom: draft',
    ]);
  });

  it('renders the same statistics panel through legacy and declarative settings and caches redraws', async () => {
    const tab = makeTab();
    tab.display();
    await Promise.resolve();
    expect(capture.names).toContain('Your statistics');
    expect(capture.names).toContain('Notes with AI summaries');
    expect(capture.descriptions.some((desc) => desc.includes('Partial totals: 1 file skipped'))).toBe(true);
    const group = tab.getSettingDefinitions().find((item) => 'heading' in item && item.heading === 'Your statistics');
    expect(group).toBeDefined();
    const definition = (group as unknown as { items: { render(setting: unknown): void }[] }).items[0];
    definition.render({ setName() { return this; }, setDesc() { return this; }, settingEl: {
      empty() {}, createDiv() { return { empty() {}, setCssStyles() {} }; },
    } });
    expect(tab.plugin.scanUsageCollection).toHaveBeenCalledTimes(1);
    await click('Refresh totals');
    await Promise.resolve();
    expect(tab.plugin.scanUsageCollection).toHaveBeenCalledTimes(2);
    tab.hide();
    tab.display();
    await Promise.resolve();
    expect(tab.plugin.scanUsageCollection).toHaveBeenCalledTimes(3);
  });

  it('shows paused recording, requires reset confirmation, and previews a fresh selectable report', async () => {
    const tab = makeTab();
    tab.display();
    await Promise.resolve();
    capture.toggles.filter((toggle) => toggle.name === 'Record local statistics').pop()!.change!(false);
    expect(tab.plugin.settings.usageStats.enabled).toBe(false);
    expect(capture.descriptions.some((desc) => desc.includes('Recording paused.'))).toBe(true);
    click('Reset counters');
    expect(tab.plugin.resetUsageStats).not.toHaveBeenCalled();
    expect(capture.modals.at(-1)?.title).toBe('Reset local statistics?');
    await click('Reset counters');
    expect(tab.plugin.resetUsageStats).toHaveBeenCalledOnce();
    await click('Preview report');
    expect(tab.plugin.scanUsageCollection).toHaveBeenCalledTimes(2);
    const input = capture.inputs.at(-1)!;
    expect(input.readOnly).toBe(true);
    expect(JSON.parse(input.value).currentCollection.videoNotes).toBe(5);
    const writeText = vi.fn().mockRejectedValue(new Error('denied'));
    vi.stubGlobal('navigator', { clipboard: { writeText } });
    await click('Copy report');
    expect(input.focus).toHaveBeenCalledOnce();
    expect(input.select).toHaveBeenCalledOnce();
    writeText.mockResolvedValueOnce(undefined);
    await click('Copy report');
    expect(writeText).toHaveBeenLastCalledWith(input.value);
  });

  it('preserves focus within statistics without stealing it from other settings', async () => {
    const tab = makeTab();
    tab.display();
    await Promise.resolve();
    const focus = vi.fn();
    const container = {
      empty() {}, ownerDocument: { activeElement: { dataset: { statsControl: 'recording' } } },
      contains: vi.fn().mockReturnValue(true), querySelector: vi.fn().mockReturnValue({ focus }),
    };
    Object.assign(tab, { statisticsEl: container });
    tab.refreshStatistics();
    expect(container.querySelector).toHaveBeenCalledWith('[data-stats-control="recording"]');
    expect(focus).toHaveBeenCalledOnce();
    container.contains.mockReturnValue(false);
    tab.refreshStatistics();
    expect(focus).toHaveBeenCalledOnce();
  });

  it('ignores a scan from the previous base folder and retries a failed scan', async () => {
    const tab = makeTab();
    let finish!: (value: typeof totals) => void;
    vi.mocked(tab.plugin.scanUsageCollection).mockImplementationOnce(() => new Promise((resolve) => { finish = resolve; }));
    tab.display();
    tab.plugin.settings.baseFolder = 'New folder';
    tab.refreshStatistics();
    await Promise.resolve();
    finish({ ...totals, skippedFiles: 99 });
    await Promise.resolve();
    expect(capture.descriptions.filter((desc) => desc.startsWith('Counts in')).at(-1)).toContain('Partial totals: 1 file skipped');
    vi.mocked(tab.plugin.scanUsageCollection).mockRejectedValueOnce(new Error('unavailable'));
    await click('Refresh totals');
    await Promise.resolve();
    expect(capture.descriptions.some((desc) => desc.includes('Scan unavailable'))).toBe(true);
    await click('Refresh totals');
    await Promise.resolve();
    expect(capture.descriptions.filter((desc) => desc.startsWith('Counts in')).at(-1)).not.toContain('Scan unavailable');
  });

  it('does not open a report after the settings panel is hidden', async () => {
    const tab = makeTab();
    tab.display();
    await Promise.resolve();
    let finish!: (value: typeof totals) => void;
    vi.mocked(tab.plugin.scanUsageCollection).mockImplementationOnce(() => new Promise((resolve) => { finish = resolve; }));
    const preview = click('Preview report');
    tab.hide();
    finish(totals);
    await preview;
    expect(capture.modals).toHaveLength(0);
  });
});
