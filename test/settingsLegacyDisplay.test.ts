import { beforeEach, describe, expect, it, vi } from 'vitest';

const capture = vi.hoisted(() => ({
  templateValues: [] as string[],
  templateChanges: [] as ((value: string) => void)[],
}));

vi.mock('obsidian', () => {
  class FakeSetting {
    constructor(..._args: unknown[]) {}
    setName() { return this; }
    setDesc() { return this; }
    setHeading() { return this; }
    addButton(callback: (button: Record<string, (...args: never[]) => unknown>) => void) {
      const button = {
        setButtonText() { return button; },
        setCta() { return button; },
        onClick() { return button; },
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
      const toggle = { setValue() { return toggle; }, onChange() { return toggle; } };
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
  class FakeModal {}
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

describe('legacy settings display', () => {
  beforeEach(() => {
    capture.templateValues.length = 0;
    capture.templateChanges.length = 0;
  });

  it('keeps an unsaved template edit when display redraws the settings', () => {
    const tab = Object.create(YouTubePlaylistSyncSettingTab.prototype) as YouTubePlaylistSyncSettingTab;
    Object.assign(tab, {
      plugin: {
        settings: { ...DEFAULT_SETTINGS, playlists: [] },
        saveSettings: vi.fn().mockResolvedValue(undefined),
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
});
