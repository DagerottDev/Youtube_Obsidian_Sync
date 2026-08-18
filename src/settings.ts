import { App, Notice, PluginSettingTab, Setting } from 'obsidian';
import type YouTubePlaylistSyncPlugin from './main';

export class YouTubePlaylistSyncSettingTab extends PluginSettingTab {
  plugin: YouTubePlaylistSyncPlugin;

  constructor(app: App, plugin: YouTubePlaylistSyncPlugin) {
    super(app, plugin);
    this.plugin = plugin;
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
            button.setButtonText('Remove').setWarning().onClick(async () => {
              this.plugin.settings.playlists.splice(index, 1);
              await this.plugin.saveSettings();
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
          if (!/(?:[?&]list=|youtube\.com\/playlist\/)([a-zA-Z0-9_-]+)/.test(url)) {
            new Notice('That does not look like a YouTube playlist URL.');
            return;
          }
          if (this.plugin.settings.playlists.some((p) => p.url === url)) {
            new Notice('That playlist is already configured.');
            return;
          }
          this.plugin.settings.playlists.push({ url });
          await this.plugin.saveSettings();
          inputEl.value = '';
          renderList();
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
