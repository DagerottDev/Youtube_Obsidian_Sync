import { App, Notice, PluginSettingTab, SecretComponent, Setting } from 'obsidian';
import type YouTubePlaylistSyncPlugin from './main';
import { AI_PROVIDER_DEFAULTS, providerDisplayName, type AIProtocol, type AIProviderPreset } from './types';

const PLAYLIST_URL_REGEX = /(?:[?&]list=|youtube\.com\/playlist\/)([a-zA-Z0-9_-]+)/;

export class YouTubePlaylistSyncSettingTab extends PluginSettingTab {
  plugin: YouTubePlaylistSyncPlugin;

  constructor(app: App, plugin: YouTubePlaylistSyncPlugin) {
    super(app, plugin);
    this.plugin = plugin;
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

  private async selectAIProvider(provider: AIProviderPreset, clearSecret: boolean): Promise<void> {
    const defaults = AI_PROVIDER_DEFAULTS[provider];
    this.plugin.settings.aiProvider = provider;
    this.plugin.settings.aiEndpoint = defaults.endpoint;
    this.plugin.settings.aiProtocol = defaults.protocol;
    this.plugin.settings.aiModel = defaults.model;
    if (clearSecret) this.plugin.settings.aiApiKeySecret = '';
    await this.plugin.saveSettings();
    this.display();
  }

  display(): void {
    const { containerEl } = this;
    containerEl.empty();

    new Setting(containerEl).setName('Playlists').setHeading()
      .setDesc('Public YouTube playlist URLs to sync. Only new videos are turned into notes; existing notes are preserved.');

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
            button.setButtonText('Remove').onClick(() => {
              void this.removePlaylist(index).then(renderList);
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
        button.setButtonText('Add').setCta().onClick(() => {
          void this.addPlaylist(inputEl.value).then((added) => {
            if (added) {
              inputEl.value = '';
              renderList();
            }
          });
        }),
      );

    new Setting(containerEl).setName('Sync').setHeading();

    new Setting(containerEl)
      .setName('Sync when Obsidian opens')
      .setDesc('Automatically sync all playlists shortly after Obsidian starts.')
      .addToggle((toggle) =>
        toggle.setValue(this.plugin.settings.syncOnStartup).onChange((value) => {
          this.plugin.settings.syncOnStartup = value;
          void this.plugin.saveSettings();
        }),
      );

    new Setting(containerEl)
      .setName('Sync interval (minutes)')
      .setDesc('Re-sync every N minutes while Obsidian is active. Set to 0 to disable. Mobile checks again when the app resumes.')
      .addText((text) =>
        text
          .setValue(String(this.plugin.settings.syncIntervalMinutes))
          .onChange((value) => {
            const parsed = Number.parseInt(value, 10);
            this.plugin.settings.syncIntervalMinutes = Number.isFinite(parsed) && parsed >= 0 ? parsed : 0;
            void this.plugin.saveSettings();
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
        text.setValue(this.plugin.settings.baseFolder).onChange((value) => {
          this.plugin.settings.baseFolder = value.trim().replace(/^\/+|\/+$/g, '') || 'YouTube';
          void this.plugin.saveSettings();
        }),
      );

    new Setting(containerEl)
      .setName('Create index notes')
      .setDesc('Maintain an index note per playlist (table of videos) plus a root index.')
      .addToggle((toggle) =>
        toggle.setValue(this.plugin.settings.createIndexNote).onChange((value) => {
          this.plugin.settings.createIndexNote = value;
          void this.plugin.saveSettings();
        }),
      );

    new Setting(containerEl)
      .setName('Transcript format')
      .addDropdown((dropdown) =>
        dropdown
          .addOption('readable', 'Readable paragraphs')
          .addOption('timestamped', 'Timestamped lines')
          .setValue(this.plugin.settings.transcriptMode)
          .onChange((value) => {
            this.plugin.settings.transcriptMode = value as 'readable' | 'timestamped';
            void this.plugin.saveSettings();
          }),
      );

    new Setting(containerEl)
      .setName('Preferred caption language')
      .setDesc('Language code such as "en". Leave empty to use the first available transcript.')
      .addText((text) =>
        text.setValue(this.plugin.settings.preferredLanguage).onChange((value) => {
          this.plugin.settings.preferredLanguage = value.trim();
          void this.plugin.saveSettings();
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
          .onChange((value) => {
            this.plugin.settings.mediaEmbed = value as 'video' | 'thumbnail' | 'off';
            void this.plugin.saveSettings();
          }),
      );

    new Setting(containerEl)
      .setName('Tags')
      .setDesc('Extra tags added to every generated note (space or comma separated).')
      .addText((text) =>
        text.setValue(this.plugin.settings.extraTags).onChange((value) => {
          this.plugin.settings.extraTags = value;
          void this.plugin.saveSettings();
        }),
      );

    new Setting(containerEl).setName('AI summaries').setHeading()
      .setDesc('Optional. Use OpenAI, NVIDIA NIM, or another OpenAI-compatible endpoint. Only the video title, channel, and transcript are sent.');

    new Setting(containerEl)
      .setName('Enable AI summaries')
      .setDesc('Enable AI summary commands and optional automatic summaries.')
      .addToggle((toggle) =>
        toggle.setValue(this.plugin.settings.aiEnabled).onChange((value) => {
          this.plugin.settings.aiEnabled = value;
          void this.plugin.saveSettings();
        }),
      );

    new Setting(containerEl)
      .setName('AI provider')
      .setDesc('Presets fill in a recommended base URL, protocol, and starter model. Custom accepts any OpenAI-compatible endpoint.')
      .addDropdown((dropdown) =>
        dropdown
          .addOption('openai', 'OpenAI')
          .addOption('nvidia-nim', 'NVIDIA NIM')
          .addOption('custom', 'Custom OpenAI-compatible endpoint')
          .setValue(this.plugin.settings.aiProvider)
          .onChange((value) => {
            void this.selectAIProvider(value as AIProviderPreset, true);
          }),
      );

    new Setting(containerEl)
      .setName('Authentication')
      .setDesc(
        this.plugin.settings.aiProvider === 'custom'
          ? 'API-key authentication is supported; the key may be left unset for a trusted local endpoint that requires no authentication. OpenAI OAuth is not currently available for third-party API usage.'
          : 'API key via Obsidian SecretStorage. OpenAI OAuth / ChatGPT-plan authorization is not currently available for third-party API usage; the internal auth type is ready to add OAuth if a supported flow becomes available.',
      );

    new Setting(containerEl)
      .setName(`${providerDisplayName(this.plugin.settings.aiProvider)} API key`)
      .setDesc(
        this.plugin.settings.aiProvider === 'custom'
          ? 'Optional for local or otherwise unauthenticated endpoints. When selected, the key is stored in Obsidian SecretStorage.'
          : 'Required. Select or create a secret; the key is stored in Obsidian SecretStorage, not this plugin\'s data.json.',
      )
      .addComponent((el) =>
        new SecretComponent(this.app, el)
          .setValue(this.plugin.settings.aiApiKeySecret)
          .onChange((value) => {
            this.plugin.settings.aiApiKeySecret = value;
            void this.plugin.saveSettings();
          }),
      );

    new Setting(containerEl)
      .setName('API base URL')
      .setDesc('Base URL for an OpenAI-compatible API, normally ending in /v1. The selected API key is sent to this host, so only use endpoints you trust.')
      .addText((text) =>
        text
          .setPlaceholder('https://provider.example.com/v1')
          .setValue(this.plugin.settings.aiEndpoint)
          .onChange((value) => {
            this.plugin.settings.aiEndpoint = value.trim();
            void this.plugin.saveSettings();
          }),
      );

    new Setting(containerEl)
      .setName('API protocol')
      .setDesc('Responses API is preferred for OpenAI. Chat Completions is supported by a wider range of OpenAI-compatible providers.')
      .addDropdown((dropdown) =>
        dropdown
          .addOption('responses', 'Responses API (/responses)')
          .addOption('chat-completions', 'Chat Completions (/chat/completions)')
          .setValue(this.plugin.settings.aiProtocol)
          .onChange((value) => {
            this.plugin.settings.aiProtocol = value as AIProtocol;
            void this.plugin.saveSettings();
          }),
      );

    new Setting(containerEl)
      .setName('Model ID')
      .setDesc('Enter any model ID available at the selected endpoint. The provider preset only supplies a starting value.')
      .addText((text) =>
        text
          .setPlaceholder('model-id')
          .setValue(this.plugin.settings.aiModel)
          .onChange((value) => {
            this.plugin.settings.aiModel = value.trim();
            void this.plugin.saveSettings();
          }),
      );

    new Setting(containerEl)
      .setName('Reset provider defaults')
      .setDesc('Restore the selected provider\'s default endpoint, protocol, and starter model without changing your saved secret.')
      .addButton((button) =>
        button.setButtonText('Reset defaults').onClick(() => {
          void this.selectAIProvider(this.plugin.settings.aiProvider, false);
        }),
      );

    new Setting(containerEl)
      .setName('Generate summaries automatically')
      .setDesc('After a new YouTube note is safely created, generate and insert its AI summary. AI failure never fails the YouTube sync.')
      .addToggle((toggle) =>
        toggle.setValue(this.plugin.settings.aiAutoGenerate).onChange((value) => {
          this.plugin.settings.aiAutoGenerate = value;
          void this.plugin.saveSettings();
        }),
      );

    new Setting(containerEl)
      .setName('Test AI connection')
      .setDesc('Validate the configured endpoint and authentication using its /models endpoint without sending a transcript.')
      .addButton((button) =>
        button.setButtonText('Test connection').onClick(() => {
          void this.plugin.testAIConnection();
        }),
      );

    new Setting(containerEl)
      .setName('Generate missing summaries')
      .setDesc('Scan generated YouTube notes in the base folder and summarize notes that contain a transcript but no AI summary.')
      .addButton((button) =>
        button.setButtonText('Generate missing').setCta().onClick(() => {
          void this.plugin.generateMissingSummaries();
        }),
      );
  }
}
