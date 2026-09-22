import {
  App,
  Modal,
  Notice,
  parseYaml,
  PluginSettingTab,
  SecretComponent,
  Setting,
  type SettingDefinitionControl,
  type SettingDefinitionGroup,
  type SettingDefinitionItem,
  type SettingDefinitionRender,
} from 'obsidian';
import type YouTubePlaylistSyncPlugin from './main';
import {
  AI_PROVIDER_DEFAULTS,
  DEFAULT_VIDEO_FRONTMATTER_TEMPLATE,
  providerDisplayName,
  type AIPromptMode,
  type AIProtocol,
  type AIProviderPreset,
} from './types';
import { previewVideoTemplate, validateVideoTemplate } from './frontmatter';

const PLAYLIST_URL_REGEX = /(?:[?&]list=|youtube\.com\/playlist\/)([a-zA-Z0-9_-]+)/;

function textInputRows(input: HTMLTextAreaElement, rows: number): void {
  input.rows = rows;
  input.setCssStyles({
    width: '100%',
    fontFamily: 'var(--font-monospace)',
  });
}

class TextPreviewModal extends Modal {
  constructor(app: App, private readonly title: string, private readonly text: string) {
    super(app);
  }

  onOpen(): void {
    this.setTitle(this.title);
    this.contentEl.createEl('pre', { text: this.text });
    new Setting(this.contentEl).addButton((button) => button.setButtonText('Close').onClick(() => this.close()));
  }
}

export class YouTubePlaylistSyncSettingTab extends PluginSettingTab {
  plugin: YouTubePlaylistSyncPlugin;
  private templateDraft?: string;

  constructor(app: App, plugin: YouTubePlaylistSyncPlugin) {
    super(app, plugin);
    this.plugin = plugin;
  }

  getSettingDefinitions(): SettingDefinitionItem[] {
    const row = (
      name: string,
      desc: string,
      render: (setting: Setting) => void,
      visible?: () => boolean,
    ): SettingDefinitionRender => ({
      name,
      desc,
      ...(visible ? { visible } : {}),
      render: (setting) => {
        setting.setName(name).setDesc(desc);
        render(setting);
      },
    });
    const group = (
      heading: string,
      items: (SettingDefinitionControl | SettingDefinitionRender)[],
    ): SettingDefinitionGroup => ({ type: 'group', heading, items });
    const control = (
      name: string,
      desc: string,
      definition: SettingDefinitionControl['control'],
    ): SettingDefinitionControl => ({ name, desc, control: definition });

    let templateDraft = this.templateDraft ?? this.plugin.settings.videoFrontmatterTemplate;
    const provider = this.plugin.settings.aiProvider;
    const customEndpoint = provider === 'custom';

    return [
      group('Playlists', [
        row(
          'Configured playlists',
          'Public YouTube playlist URLs to sync. Only new videos are turned into notes; existing notes are preserved.',
          (setting) => {
            const listEl = setting.controlEl.createDiv();
            const renderList = () => {
              listEl.empty();
              const { playlists } = this.plugin.settings;
              if (!playlists.length) {
                listEl.createEl('p', { text: 'No playlists configured yet.', cls: 'setting-item-description' });
              }
              playlists.forEach((playlist, index) => {
                new Setting(listEl)
                  .setName(playlist.url)
                  .addButton((button) => button.setButtonText('Remove').onClick(() => {
                    void this.removePlaylist(index).then(() => this.refreshSettingsTab());
                  }));
              });
            };
            renderList();
          },
        ),
        row(
          'Add playlist',
          'Paste a YouTube playlist URL, e.g. https://www.youtube.com/playlist?list=PL...',
          (setting) => {
            let inputEl: HTMLInputElement;
            setting.addText((text) => {
              inputEl = text.inputEl;
              text.setPlaceholder('https://www.youtube.com/playlist?list=...');
            });
            setting.addButton((button) => button.setButtonText('Add').setCta().onClick(() => {
              void this.addPlaylist(inputEl.value).then((added) => {
                if (added) this.refreshSettingsTab();
              });
            }));
          },
        ),
      ]),
      group('Sync', [
        control('Sync when Obsidian opens', 'Automatically sync all playlists shortly after Obsidian starts.', {
          type: 'toggle', key: 'syncOnStartup',
        }),
        control('Sync interval (minutes)', 'Re-sync every N minutes while Obsidian is active. Set to 0 to disable. Mobile checks again when the app resumes.', {
          type: 'number', key: 'syncIntervalMinutes', min: 0, step: 1,
        }),
        row('Sync now', '', (setting) => {
          setting.addButton((button) => button.setButtonText('Sync now').setCta().onClick(() => {
            void this.plugin.syncAll();
          }));
        }),
      ]),
      group('Note output', [
        control('Base folder', 'Folder inside the vault where playlists are written (one subfolder per playlist).', {
          type: 'text', key: 'baseFolder', placeholder: 'YouTube',
        }),
        control('Create index notes', 'Maintain an index note per playlist (table of videos) plus a root index.', {
          type: 'toggle', key: 'createIndexNote',
        }),
        control('Transcript format', '', {
          type: 'dropdown', key: 'transcriptMode', options: {
            readable: 'Readable paragraphs',
            timestamped: 'Timestamped lines',
          },
        }),
        control('Preferred caption language', 'Language code such as "en". Leave empty to use the first available transcript.', {
          type: 'text', key: 'preferredLanguage', placeholder: 'en',
        }),
        control('Media embed', '', {
          type: 'dropdown', key: 'mediaEmbed', options: {
            video: 'YouTube video embed',
            thumbnail: 'Thumbnail image',
            off: 'None',
          },
        }),
        control('Tags', 'Extra tags added to every generated note (space or comma separated).', {
          type: 'text', key: 'extraTags',
        }),
      ]),
      group('Video frontmatter template', [
        row(
          'Template',
          'Available placeholders: title, aliases, source, channel, channelUrl, channelId, videoUrl, videoId, playlistUrl, playlistId, thumbnailUrl, videoDescription, uploadDate, videoCategory, durationSeconds, keywords, generated, tags, aiSummary, aiProvider, aiModel, aiGenerated. Missing optional values remove their line.',
          (setting) => setting.addTextArea((text) => {
            textInputRows(text.inputEl, 18);
            text.setValue(templateDraft).onChange((value) => {
              templateDraft = value;
              this.templateDraft = value;
            });
          }),
        ),
        row(
          'Validate and save',
          'Validate the YAML template and save it for newly generated notes.',
          (setting) => setting.addButton((button) => button.setButtonText('Validate and save').setCta().onClick(() => {
            try {
              validateVideoTemplate(templateDraft, parseYaml);
              this.plugin.settings.videoFrontmatterTemplate = templateDraft;
              void this.plugin.saveSettings().then(() => {
                this.templateDraft = undefined;
                new Notice('Video frontmatter template saved.');
              });
            } catch (error) {
              new Notice(`Frontmatter template error: ${error instanceof Error ? error.message : String(error)}`);
            }
          })),
        ),
        row(
          'Preview',
          'Preview with sample metadata; no notes are modified.',
          (setting) => setting.addButton((button) => button.setButtonText('Preview').onClick(() => {
            try {
              new TextPreviewModal(this.app, 'Frontmatter template preview', previewVideoTemplate(templateDraft, parseYaml)).open();
            } catch (error) {
              new Notice(`Frontmatter template error: ${error instanceof Error ? error.message : String(error)}`);
            }
          })),
        ),
        row(
          'Reset default',
          'Restore the built-in video frontmatter template.',
          (setting) => setting.addButton((button) => button.setButtonText('Reset default').onClick(() => {
            templateDraft = DEFAULT_VIDEO_FRONTMATTER_TEMPLATE;
            this.templateDraft = templateDraft;
            this.plugin.settings.videoFrontmatterTemplate = templateDraft;
            void this.plugin.saveSettings().then(() => {
              this.templateDraft = undefined;
              new Notice('Default frontmatter template restored.');
              this.refreshSettingsTab();
            });
          })),
        ),
        row(
          'Preview migration',
          'Preview and migrate generated video notes in the base folder. Note bodies and unknown frontmatter properties are preserved.',
          (setting) => setting.addButton((button) => button.setButtonText('Preview migration').onClick(() => {
            void this.plugin.previewAndApplyFrontmatterMigration();
          })),
        ),
      ]),
      group('AI summaries', [
        control('Enable AI summaries', 'Enable AI summary commands and optional automatic summaries.', {
          type: 'toggle', key: 'aiEnabled',
        }),
        control('AI provider', 'Presets fill in a recommended base URL, protocol, and starter model. Custom accepts any OpenAI-compatible endpoint.', {
          type: 'dropdown', key: 'aiProvider', options: {
            openai: 'OpenAI',
            'nvidia-nim': 'NVIDIA NIM',
            custom: 'Custom OpenAI-compatible endpoint',
          },
        }),
        row(
          'Authentication',
          customEndpoint
            ? 'API-key authentication is supported; the key may be left unset for a trusted local endpoint that requires no authentication. OpenAI OAuth is not currently available for third-party API usage.'
            : 'API key via Obsidian SecretStorage. OpenAI OAuth / ChatGPT-plan authorization is not currently available for third-party API usage; the internal auth type is ready to add OAuth if a supported flow becomes available.',
          () => {},
        ),
        row(
          `${providerDisplayName(provider)} API key`,
          customEndpoint
            ? 'Optional for local or otherwise unauthenticated endpoints. When selected, the key is stored in Obsidian SecretStorage.'
            : 'Required. Select or create a secret; the key is stored in Obsidian SecretStorage, not this plugin\'s data.json.',
          (setting) => setting.addComponent((el) => new SecretComponent(this.app, el)
            .setValue(this.plugin.settings.aiApiKeySecret)
            .onChange((value) => {
              this.plugin.settings.aiApiKeySecret = value;
              void this.plugin.saveSettings();
            })),
        ),
        control('API base URL', 'Base URL for an OpenAI-compatible API, normally ending in /v1. The selected API key is sent to this host, so only use endpoints you trust.', {
          type: 'text', key: 'aiEndpoint', placeholder: 'https://provider.example.com/v1',
        }),
        control('API protocol', 'Responses API is preferred for OpenAI. Chat Completions is supported by a wider range of OpenAI-compatible providers.', {
          type: 'dropdown', key: 'aiProtocol', options: {
            responses: 'Responses API (/responses)',
            'chat-completions': 'Chat Completions (/chat/completions)',
          },
        }),
        control('Model ID', 'Enter any model ID available at the selected endpoint. The provider preset only supplies a starting value.', {
          type: 'text', key: 'aiModel', placeholder: 'model-id',
        }),
        control('AI prompt mode', 'Default uses the built-in guidance. Append adds your instructions. Replace is an advanced mode that replaces the guidance while retaining the required JSON response contract.', {
          type: 'dropdown', key: 'aiPromptMode', options: {
            default: 'Default guidance',
            append: 'Append custom instructions',
            replace: 'Replace guidance (advanced)',
          },
        }),
        row(
          'Custom AI instructions',
          'Control focus, tone, and level of detail. The title, channel, and transcript are supplied separately, and the summary output sections remain fixed.',
          (setting) => {
            setting.addTextArea((text) => {
              textInputRows(text.inputEl, 8);
              text.setValue(this.plugin.settings.aiCustomPrompt).onChange((value) => {
                this.plugin.settings.aiCustomPrompt = value;
                void this.plugin.saveSettings();
              });
            });
            setting.addButton((button) => button.setButtonText('Clear').onClick(() => {
              this.plugin.settings.aiCustomPrompt = '';
              void this.plugin.saveSettings().then(() => this.refreshSettingsTab());
            }));
          },
          () => this.plugin.settings.aiPromptMode !== 'default',
        ),
        row(
          'Reset defaults',
          'Restore the selected provider\'s default endpoint, protocol, and starter model without changing your saved secret.',
          (setting) => setting.addButton((button) => button.setButtonText('Reset defaults').onClick(() => {
            void this.selectAIProvider(this.plugin.settings.aiProvider, false);
          })),
        ),
        control('Generate summaries automatically', 'After a new YouTube note is safely created, generate and insert its AI summary. AI failure never fails the YouTube sync.', {
          type: 'toggle', key: 'aiAutoGenerate',
        }),
        row(
          'Test connection',
          'Validate the configured endpoint and authentication using its /models endpoint without sending a transcript.',
          (setting) => setting.addButton((button) => button.setButtonText('Test connection').onClick(() => {
            void this.plugin.testAIConnection();
          })),
        ),
        row(
          'Generate missing',
          'Scan generated YouTube notes in the base folder and summarize notes that contain a transcript but no AI summary.',
          (setting) => setting.addButton((button) => button.setButtonText('Generate missing').setCta().onClick(() => {
            void this.plugin.generateMissingSummaries();
          })),
        ),
      ]),
    ];
  }

  getControlValue(key: string): unknown {
    return (this.plugin.settings as unknown as Record<string, unknown>)[key];
  }

  async setControlValue(key: string, value: unknown): Promise<void> {
    if (key === 'aiProvider') {
      if (value !== 'openai' && value !== 'nvidia-nim' && value !== 'custom') return;
      await this.selectAIProvider(value, true);
      return;
    }

    const settings = this.plugin.settings as unknown as Record<string, unknown>;
    if (!(key in settings)) return;

    let normalizedValue = value;
    if (key === 'baseFolder') {
      normalizedValue = typeof value === 'string'
        ? value.trim().replace(/^\/+|\/+$/g, '') || 'YouTube'
        : 'YouTube';
    } else if (key === 'syncIntervalMinutes') {
      const interval = typeof value === 'number' ? value : Number.parseInt(String(value), 10);
      normalizedValue = Number.isFinite(interval) && interval >= 0 ? Math.trunc(interval) : 0;
    } else if (key === 'preferredLanguage') {
      normalizedValue = typeof value === 'string' ? value.trim() : '';
    } else if (key === 'aiEndpoint' || key === 'aiModel') {
      normalizedValue = typeof value === 'string' ? value.trim() : '';
    }

    settings[key] = normalizedValue;
    await this.plugin.saveSettings();
    if (key === 'aiPromptMode') this.refreshSettingsTab();
  }

  private refreshSettingsTab(): void {
    if (typeof this.update === 'function') this.update();
    else this.display();
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
    this.refreshSettingsTab();
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

    new Setting(containerEl).setName('Video frontmatter template').setHeading()
      .setDesc('Customize YAML properties for newly generated video notes. Do not include --- delimiters. Existing notes change only when you run the migration below.');

    let templateDraft = this.plugin.settings.videoFrontmatterTemplate;
    let templateInput: HTMLTextAreaElement;
    new Setting(containerEl)
      .setName('Template')
      .setDesc('Available placeholders: title, aliases, source, channel, channelUrl, channelId, videoUrl, videoId, playlistUrl, playlistId, thumbnailUrl, videoDescription, uploadDate, videoCategory, durationSeconds, keywords, generated, tags, aiSummary, aiProvider, aiModel, aiGenerated. Missing optional values remove their line.')
      .addTextArea((text) => {
        templateInput = text.inputEl;
        textInputRows(text.inputEl, 18);
        text.setValue(templateDraft).onChange((value) => {
          templateDraft = value;
        });
      });

    new Setting(containerEl)
      .setName('Template actions')
      .setDesc('Validate before saving. Preview uses sample metadata and never modifies notes.')
      .addButton((button) => button.setButtonText('Validate and save').setCta().onClick(() => {
        try {
          validateVideoTemplate(templateDraft, parseYaml);
          this.plugin.settings.videoFrontmatterTemplate = templateDraft;
          void this.plugin.saveSettings().then(() => new Notice('Video frontmatter template saved.'));
        } catch (error) {
          new Notice(`Frontmatter template error: ${error instanceof Error ? error.message : String(error)}`);
        }
      }))
      .addButton((button) => button.setButtonText('Preview').onClick(() => {
        try {
          new TextPreviewModal(this.app, 'Frontmatter template preview', previewVideoTemplate(templateDraft, parseYaml)).open();
        } catch (error) {
          new Notice(`Frontmatter template error: ${error instanceof Error ? error.message : String(error)}`);
        }
      }))
      .addButton((button) => button.setButtonText('Reset default').onClick(() => {
        templateDraft = DEFAULT_VIDEO_FRONTMATTER_TEMPLATE;
        templateInput.value = templateDraft;
        this.plugin.settings.videoFrontmatterTemplate = templateDraft;
        void this.plugin.saveSettings().then(() => new Notice('Default frontmatter template restored.'));
      }));

    new Setting(containerEl)
      .setName('Apply template to existing notes')
      .setDesc('Preview and migrate generated video notes in the base folder. Note bodies and unknown frontmatter properties are preserved.')
      .addButton((button) => button.setButtonText('Preview migration').onClick(() => {
        void this.plugin.previewAndApplyFrontmatterMigration();
      }));

    new Setting(containerEl).setName('AI summaries').setHeading()
      .setDesc('Optional. Use OpenAI, NVIDIA NIM, or another OpenAI-compatible endpoint. Only the video title, channel, transcript, and configured summary instructions are sent.');

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
      .setName('AI prompt mode')
      .setDesc('Default uses the built-in guidance. Append adds your instructions. Replace is an advanced mode that replaces the guidance while retaining the required JSON response contract.')
      .addDropdown((dropdown) =>
        dropdown
          .addOption('default', 'Default guidance')
          .addOption('append', 'Append custom instructions')
          .addOption('replace', 'Replace guidance (advanced)')
          .setValue(this.plugin.settings.aiPromptMode)
          .onChange((value) => {
            this.plugin.settings.aiPromptMode = value as AIPromptMode;
            void this.plugin.saveSettings().then(() => this.refreshSettingsTab());
          }),
      );

    if (this.plugin.settings.aiPromptMode !== 'default') {
      new Setting(containerEl)
        .setName('Custom AI instructions')
        .setDesc('Control focus, tone, and level of detail. The title, channel, and transcript are supplied separately, and the summary output sections remain fixed.')
        .addTextArea((text) => {
          textInputRows(text.inputEl, 8);
          text.setValue(this.plugin.settings.aiCustomPrompt).onChange((value) => {
            this.plugin.settings.aiCustomPrompt = value;
            void this.plugin.saveSettings();
          });
        })
        .addButton((button) => button.setButtonText('Clear').onClick(() => {
          this.plugin.settings.aiCustomPrompt = '';
          void this.plugin.saveSettings().then(() => this.refreshSettingsTab());
        }));
    }

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
