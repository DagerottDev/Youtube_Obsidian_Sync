import { App, Notice, PluginSettingTab, Setting, type SettingDefinitionItem } from 'obsidian';
import type YouTubePlaylistSyncPlugin from './main';

const PLAYLIST_URL_REGEX = /(?:[?&]list=|youtube\.com\/playlist\/)([a-zA-Z0-9_-]+)/;

export class YouTubePlaylistSyncSettingTab extends PluginSettingTab {
  plugin: YouTubePlaylistSyncPlugin;

  constructor(app: App, plugin: YouTubePlaylistSyncPlugin) {
    super(app, plugin);
    this.plugin = plugin;
  }

  // Obsidian 1.13+ renders these definitions and indexes them for settings search.
  // display() below remains as the compatibility path for older Obsidian versions.
  getSettingDefinitions(): SettingDefinitionItem[] {
    return [
      {
        type: 'group',
        heading: 'Playlists',
        items: [
          {
            name: 'Configured playlists',
            desc: 'Public YouTube playlist URLs to sync. Only new videos are turned into notes; existing notes are never modified.',
            render: (setting) => this.renderPlaylistList(setting),
          },
          {
            name: 'Add playlist',
            desc: 'Paste a YouTube playlist URL, e.g. https://www.youtube.com/playlist?list=PL...',
            render: (setting) => {
              let inputEl: HTMLInputElement;
              new Setting(setting.controlEl)
                .addText((text) => {
                  inputEl = text.inputEl;
                  text.setPlaceholder('https://www.youtube.com/playlist?list=...');
                })
                .addButton((button) =>
                  button.setButtonText('Add').setCta().onClick(async () => {
                    if (await this.addPlaylist(inputEl.value)) {
                      inputEl.value = '';
                      this.update();
                    }
                  }),
                );
            },
          },
        ],
      },
      {
        type: 'group',
        heading: 'Sync',
        items: [
          {
            name: 'Sync when the app opens',
            desc: 'Automatically sync all playlists shortly after the app starts.',
            control: { type: 'toggle', key: 'syncOnStartup' },
          },
          {
            name: 'Sync interval (minutes)',
            desc: 'Re-sync every N minutes while the app is open. Set to 0 to disable the timer.',
            control: { type: 'number', key: 'syncIntervalMinutes', min: 0, step: 1 },
          },
          {
            name: 'Sync now',
            action: () => {
              void this.plugin.syncAll();
            },
          },
        ],
      },
      {
        type: 'group',
        heading: 'Note output',
        items: [
          {
            name: 'Base folder',
            desc: 'Folder inside the vault where playlists are written (one subfolder per playlist).',
            control: { type: 'text', key: 'baseFolder', placeholder: 'YouTube' },
          },
          {
            name: 'Create index notes',
            desc: 'Maintain an index note per playlist (table of videos) plus a root index.',
            control: { type: 'toggle', key: 'createIndexNote' },
          },
          {
            name: 'Transcript format',
            control: {
              type: 'dropdown',
              key: 'transcriptMode',
              options: { readable: 'Readable paragraphs', timestamped: 'Timestamped lines' },
            },
          },
          {
            name: 'Preferred caption language',
            desc: 'Language code such as "en". Leave empty to use the first available transcript.',
            control: { type: 'text', key: 'preferredLanguage', placeholder: 'en' },
          },
          {
            name: 'Media embed',
            control: {
              type: 'dropdown',
              key: 'mediaEmbed',
              options: { video: 'YouTube video embed', thumbnail: 'Thumbnail image', off: 'None' },
            },
          },
          {
            name: 'Tags',
            desc: 'Extra tags added to every generated note (space or comma separated).',
            control: { type: 'text', key: 'extraTags' },
          },
        ],
      },
    ];
  }

  private renderPlaylistList(setting: Setting): void {
    const listEl = setting.controlEl.createDiv();
    if (!this.plugin.settings.playlists.length) {
      listEl.createEl('p', { text: 'No playlists configured yet.', cls: 'setting-item-description' });
    }
    this.plugin.settings.playlists.forEach((playlist, index) => {
      new Setting(listEl)
        .setName(playlist.url)
        .addButton((button) =>
          button.setButtonText('Remove').onClick(async () => {
            await this.removePlaylist(index);
            this.update();
          }),
        );
    });
  }

  private async addPlaylist(url: string): Promise<boolean> {
    const normalized = url.trim();
    if (!normalized) return false;
    if (!PLAYLIST_URL_REGEX.test(normalized)) {
      new Notice('That does not look like a YouTube playlist URL.');
      return false;
    }
    if (this.plugin.settings.playlists.some((playlist) => playlist.url === normalized)) {
      new Notice('That playlist is already configured.');
      return false;
    }
    this.plugin.settings.playlists.push({ url: normalized });
    await this.plugin.saveSettings();
    return true;
  }

  private async removePlaylist(index: number): Promise<void> {
    this.plugin.settings.playlists.splice(index, 1);
    await this.plugin.saveSettings();
  }

  display(): void {
    const { containerEl } = this;
    containerEl.empty();

    new Setting(containerEl).setName('Playlists').setHeading()
      .setDesc('Public YouTube playlist URLs to sync. Only new videos are turned into notes; existing notes are never modified.');

    const listEl = containerEl.createDiv();
    const renderList = () => {
      listEl.empty();
      const { playlists } = this.plugin.settings;
      if (!playlists.length) {
        listEl.createEl('p', { text: 'No playlists configured yet.', cls: 'setting-item-description' });
      }
      playlists.forEach((playlist, index) => {
        new Setting(listEl)
          .setName(playlist.url)
          .addButton((button) =>
            button.setButtonText('Remove').onClick(async () => {
              await this.removePlaylist(index);
              renderList();
            }),
          );
      });
    };
    renderList();

    const addSetting = new Setting(containerEl);
    let inputEl: HTMLInputElement;
    addSetting
      .setName('Add playlist')
      .setDesc('Paste a YouTube playlist URL, e.g. https://www.youtube.com/playlist?list=PL...')
      .addText((text) => {
        inputEl = text.inputEl;
        text.setPlaceholder('https://www.youtube.com/playlist?list=...');
      })
      .addButton((button) =>
        button.setButtonText('Add').setCta().onClick(async () => {
          const url = inputEl.value.trim();
          if (!url) return;
          if (await this.addPlaylist(url)) {
            inputEl.value = '';
            renderList();
          }
        }),
      );

    new Setting(containerEl).setName('Sync').setHeading();

    new Setting(containerEl)
      .setName('Sync when Obsidian opens')
      .setDesc('Automatically sync all playlists shortly after Obsidian starts.')
      .addToggle((toggle) =>
        toggle.setValue(this.plugin.settings.syncOnStartup).onChange(async (value) => {
          this.plugin.settings.syncOnStartup = value;
          await this.plugin.saveSettings();
        }),
      );

    new Setting(containerEl)
      .setName('Sync interval (minutes)')
      .setDesc('Re-sync every N minutes while Obsidian is open. Set to 0 to disable the timer.')
      .addText((text) =>
        text
          .setValue(String(this.plugin.settings.syncIntervalMinutes))
          .onChange(async (value) => {
            const parsed = Number.parseInt(value, 10);
            this.plugin.settings.syncIntervalMinutes = Number.isFinite(parsed) && parsed >= 0 ? parsed : 0;
            await this.plugin.saveSettings();
          }),
      );

    new Setting(containerEl).addButton((button) =>
      button.setButtonText('Sync now').setCta().onClick(() => {
        void this.plugin.syncAll();
      }),
    );

    new Setting(containerEl).setName('Note output').setHeading();

    new Setting(containerEl)
      .setName('Base folder')
      .setDesc('Folder inside the vault where playlists are written (one subfolder per playlist).')
      .addText((text) =>
        text.setValue(this.plugin.settings.baseFolder).onChange(async (value) => {
          this.plugin.settings.baseFolder = value.trim().replace(/^\/+|\/+$/g, '') || 'YouTube';
          await this.plugin.saveSettings();
        }),
      );

    new Setting(containerEl)
      .setName('Create index notes')
      .setDesc('Maintain an index note per playlist (table of videos) plus a root index.')
      .addToggle((toggle) =>
        toggle.setValue(this.plugin.settings.createIndexNote).onChange(async (value) => {
          this.plugin.settings.createIndexNote = value;
          await this.plugin.saveSettings();
        }),
      );

    new Setting(containerEl)
      .setName('Transcript format')
      .addDropdown((dropdown) =>
        dropdown
          .addOption('readable', 'Readable paragraphs')
          .addOption('timestamped', 'Timestamped lines')
          .setValue(this.plugin.settings.transcriptMode)
          .onChange(async (value) => {
            this.plugin.settings.transcriptMode = value as 'readable' | 'timestamped';
            await this.plugin.saveSettings();
          }),
      );

    new Setting(containerEl)
      .setName('Preferred caption language')
      .setDesc('Language code such as "en". Leave empty to use the first available transcript.')
      .addText((text) =>
        text.setValue(this.plugin.settings.preferredLanguage).onChange(async (value) => {
          this.plugin.settings.preferredLanguage = value.trim();
          await this.plugin.saveSettings();
        }),
      );

    new Setting(containerEl)
      .setName('Media embed')
      .addDropdown((dropdown) =>
        dropdown
          .addOption('video', 'YouTube video embed')
          .addOption('thumbnail', 'Thumbnail image')
          .addOption('off', 'None')
          .setValue(this.plugin.settings.mediaEmbed)
          .onChange(async (value) => {
            this.plugin.settings.mediaEmbed = value as 'video' | 'thumbnail' | 'off';
            await this.plugin.saveSettings();
          }),
      );

    new Setting(containerEl)
      .setName('Tags')
      .setDesc('Extra tags added to every generated note (space or comma separated).')
      .addText((text) =>
        text.setValue(this.plugin.settings.extraTags).onChange(async (value) => {
          this.plugin.settings.extraTags = value;
          await this.plugin.saveSettings();
        }),
      );
  }
}
