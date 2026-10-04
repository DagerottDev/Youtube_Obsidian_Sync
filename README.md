<a id="readme-top"></a>

[![Release][release-shield]][releases]
[![Build][build-shield]][build-workflow]
[![Stars][stars-shield]][repository]
[![Issues][issues-shield]][issues]
[![MIT License][license-shield]](LICENSE)

<div align="center">
  <h1>YouTube Playlist Sync</h1>
  <p>Turn public YouTube playlists into Obsidian notes with metadata, transcripts, indexes, and optional AI summaries.</p>
  <p>
    <a href="https://obsidian.md/plugins?id=youtube-playlist-sync">Install in Obsidian</a>
    · <a href="https://github.com/DagerottDev/Youtube_Obsidian_Sync/releases">Download a release</a>
    · <a href="#usage">Usage guide</a>
    · <a href="https://github.com/DagerottDev/Youtube_Obsidian_Sync/issues/new?template=bug-report.yml">Report a bug</a>
    · <a href="https://github.com/DagerottDev/Youtube_Obsidian_Sync/issues/new">Request a feature</a>
  </p>
</div>

<details>
  <summary>Table of Contents</summary>
  <ul>
    <li><a href="#about-the-project">About The Project</a>
      <ul><li><a href="#built-with">Built With</a></li></ul>
    </li>
    <li><a href="#getting-started">Getting Started</a>
      <ul>
        <li><a href="#prerequisites">Prerequisites</a></li>
        <li><a href="#installation">Installation</a></li>
      </ul>
    </li>
    <li><a href="#usage">Usage</a></li>
    <li><a href="#settings">Settings</a></li>
    <li><a href="#ai-summaries">AI Summaries</a></li>
    <li><a href="#note-format">Note Format</a></li>
    <li><a href="#mobile-behavior">Mobile Behavior</a></li>
    <li><a href="#notes-and-limitations">Notes and Limitations</a></li>
    <li><a href="#network-use-and-privacy">Network Use and Privacy</a></li>
    <li><a href="#development">Development</a></li>
    <li><a href="#contributing">Contributing</a></li>
    <li><a href="#license">License</a></li>
    <li><a href="#contact-and-support">Contact and Support</a></li>
    <li><a href="#acknowledgments">Acknowledgments</a></li>
  </ul>
</details>

## About The Project

![Generated video note with transcript][product-screenshot]

For Obsidian users who learn or research through YouTube, this plugin turns a playlist into
searchable notes in your vault. Each video gets its own note with metadata and any available
transcript. YouTube syncing requires no user-supplied YouTube API key; AI summaries are optional.

The plugin supports Obsidian on desktop, iOS, iPadOS, and Android.

### Features

- Fetches each configured playlist straight from YouTube (via the same internal API youtube.com
  uses — no YouTube API key required).
- **First sync**: creates one note per video in `YouTube/<Playlist Name>/`.
- **Later syncs**: only creates notes for videos that are **new** to the playlist. Existing
  user content is preserved.
- Fetches the **transcript** for each video when one exists (readable paragraphs or
  timestamped lines) and embeds the video or thumbnail.
- Maintains an `_Index.md` per playlist (table of all videos) and a root `Index.md`.
- Runs automatically: **when Obsidian opens**, on an **interval while Obsidian is active**, and
  via a **Sync now** command / ribbon button. Mobile re-checks the interval after the app resumes.
- Optional AI summaries with Summary, Key Takeaways, Important Concepts, Action Items,
  and Questions / Things to Explore.
- AI provider presets for **OpenAI** and **NVIDIA NIM**, plus a **Custom OpenAI-compatible**
  endpoint option.
- Users control the AI base URL, API protocol, model ID, and SecretStorage credential.
- AI summaries can run automatically for new notes, manually for the active note, or in bulk
  for existing notes that are missing summaries.
- Regenerating an AI summary replaces only the plugin-managed AI block and preserves the rest
  of the note.
- A validated YAML template controls video-note frontmatter, with an explicit preview-and-confirm
  migration for existing notes.

Video notes are preserved during repeat syncs. The plugin-managed playlist and root indexes
are regenerated, so keep personal annotations in video notes or separate notes.

### Recent additions

- **Custom AI instructions:** Keep the built-in summary prompt, append your own guidance, or
  replace the guidance while retaining the structured summary format.
- **Custom video-note properties:** Define video frontmatter with a validated YAML template and
  preview or migrate existing generated notes without changing their bodies.
- **Timestamped summary fix:** Manual and bulk AI summaries now strip the plugin's timestamp links
  before sending transcript text to the selected provider.
- **Safer AI response parsing:** Malformed summary arrays are rejected instead of being processed
  as untyped values.

### Screenshots

<details>
  <summary>Settings, playlist management, note properties, and walkthrough</summary>

#### Configure sync and note output

![Sync settings][sync-screenshot]

#### Manage multiple YouTube playlists

![Playlist management][playlists-screenshot]

#### Generated video note metadata

![Generated video note properties][properties-screenshot]

#### Playlist index with linked notes

![Playlist index][index-screenshot]

#### Visual walkthrough

![YouTube Playlist Sync walkthrough][walkthrough]

[Download the short walkthrough video](assets/screenshots/playlist-sync-walkthrough.mp4)

</details>

### Built With

- [Obsidian Plugin API](https://docs.obsidian.md/Home): Vault, HTTP, settings, and SecretStorage APIs.
- [TypeScript](https://www.typescriptlang.org/) and [esbuild](https://esbuild.github.io/): plugin source and bundling.
- [Vitest](https://vitest.dev/): unit tests.

### Works with your Obsidian workflow

- **Dataview:** query the generated frontmatter to build dashboards for channels, playlists, tags, and upload dates.
- **Templater:** use the stable video-note properties as inputs for your own note templates and workflows.
- **QuickAdd:** connect Obsidian commands and capture flows around a repeatable playlist-sync workflow.
- **Excalidraw:** link generated video notes from visual maps, lesson plans, and research diagrams.

<p align="right"><a href="#readme-top">Back to top</a></p>

## Getting Started

Install the released plugin to use it in a vault. Node.js and npm are needed only for
[development](#development).

### Prerequisites

- **Obsidian 1.11.4 or later**, with community plugins enabled.
- At least one **public YouTube playlist** and network access to YouTube.
- For optional AI summaries, a compatible endpoint and an API key if the endpoint requires one.

### Installation

#### From the community plugin directory

[Install YouTube Playlist Sync from the Obsidian Community Plugins directory][community-listing],
then enable it under **Settings → Community plugins**.

#### With BRAT

1. Install **BRAT** from the community plugin directory.
2. In BRAT settings, add `https://github.com/DagerottDev/Youtube_Obsidian_Sync` as a beta plugin.
3. Reload Obsidian and enable **YouTube Playlist Sync**.

#### Manually

1. Download **`main.js`** and **`manifest.json`** from the [latest release][latest-release].
2. In your vault, create `.obsidian/plugins/youtube-playlist-sync/` if it does not exist.
3. Copy both files into that folder.
4. Reload Obsidian and enable **YouTube Playlist Sync** under **Settings → Community plugins**.

<p align="right"><a href="#readme-top">Back to top</a></p>

## Usage

1. **Settings → YouTube Playlist Sync → Playlists** — paste a public playlist URL
   (e.g. `https://www.youtube.com/playlist?list=PL...`) and click **Add**. Repeat for as many
   playlists as you want.
2. Click **Sync now** (or the ribbon icon, or the command palette →
   "Sync YouTube playlists now").

The first sync creates all video notes; later syncs only add new ones.

Open a generated video note and check its properties, video embed, and transcript. With the
default settings, the output looks like this:

```text
YouTube/
├── Index.md
└── <Playlist Name>/
    ├── _Index.md
    ├── <Video Title>.md
    └── ...
```

Open `_Index.md` to browse the playlist's video links, or `YouTube/Index.md` to browse all
configured playlists. Run **Sync YouTube playlists now** again to add newly discovered videos
without rewriting existing video notes.

<p align="right"><a href="#readme-top">Back to top</a></p>

## Settings

| Setting | Default | What it does |
| --- | --- | --- |
| Playlists | — | Public YouTube playlist URLs to sync |
| Sync when Obsidian opens | on | Run a sync shortly after Obsidian starts |
| Sync interval (minutes) | 30 | Re-sync every N minutes while active; 0 disables |
| Base folder | `YouTube` | Vault folder where playlists are written |
| Create index notes | on | Per-playlist `_Index.md` + root `Index.md` |
| Transcript format | readable | Readable paragraphs or timestamped lines |
| Preferred caption language | (empty) | e.g. `en`; empty = first available transcript |
| Media embed | video | Embed the YouTube player, thumbnail, or nothing |
| Tags | `youtube` | Extra tags added to every generated note |
| Video frontmatter template | built-in metadata template | Customize properties for newly generated video notes |
| Enable AI summaries | off | Enables optional AI summary features |
| AI provider | OpenAI | OpenAI, NVIDIA NIM, or Custom OpenAI-compatible endpoint |
| API key | — | Secret selected from Obsidian SecretStorage; optional for unauthenticated custom/local endpoints |
| API base URL | provider default | Endpoint base URL, normally ending in `/v1` |
| API protocol | provider default | Responses API or Chat Completions |
| Model ID | provider default | Any model ID available from the configured endpoint |
| AI prompt mode | default | Use, append to, or replace the built-in summarization guidance |
| Custom AI instructions | (empty) | Optional focus, tone, and detail instructions |
| Generate summaries automatically | on | When AI is enabled, summarize new notes after they are created |

<p align="right"><a href="#readme-top">Back to top</a></p>

## AI Summaries

AI is completely optional. YouTube playlist syncing, metadata, transcripts, and note creation
continue to work without any AI provider.

To enable AI summaries:

1. Open **Settings → YouTube Playlist Sync → AI summaries**.
2. Turn on **Enable AI summaries**.
3. Choose an **AI provider**.
4. Select or create its API-key secret when required.
5. Confirm the **API base URL**, **protocol**, and **model ID**.
6. Use **Test connection**.

### OpenAI

The OpenAI preset uses:

- Base URL: `https://api.openai.com/v1`
- Protocol: Responses API
- Starter model: `gpt-5.6-luna`

These are the plugin's preset values, not a guarantee of model access. The model ID and endpoint
remain editable; select a model supported by your account and endpoint.

The plugin authenticates through the selected API-key secret. It does not implement
ChatGPT subscription sign-in or OAuth.

### NVIDIA NIM

The NVIDIA NIM preset uses:

- Base URL: `https://integrate.api.nvidia.com/v1`
- Protocol: Chat Completions
- Starter model: `openai/gpt-oss-20b`

Replace the starter model with any model ID available to your NVIDIA endpoint. NVIDIA NIM is
OpenAI-compatible, so the same summary provider can be reused with a NIM API key.

### Custom OpenAI-compatible endpoint

Choose **Custom OpenAI-compatible endpoint** to use another service or your own server. Configure:

- API base URL
- Responses API or Chat Completions
- model ID
- optional SecretStorage API key

This can work with compatible hosted providers or self-hosted servers such as NIM/vLLM-style
endpoints. A trusted local endpoint that requires no authentication may leave the secret unset.
Compatibility depends on the endpoint implementing the selected OpenAI-style API.

**Security:** the selected credential is sent as a Bearer token to the configured base URL.
Only configure endpoints you trust. Switching provider presets clears the selected secret to
reduce the chance of accidentally sending one provider's key to another provider.

Commands:

- **Generate AI summary for current YouTube note** — creates or regenerates the AI block in the
  active generated YouTube note.
- **Generate missing AI summaries** — scans the configured base folder and summarizes existing
  generated notes that contain transcripts but do not yet have an AI summary.

Automatic AI generation happens only **after** the YouTube note is successfully created. An
AI-provider error therefore never causes the underlying playlist sync or note creation to fail.

For very long transcripts, the plugin summarizes transcript chunks first and then produces one
final coherent summary.

### Custom AI instructions

The **AI prompt mode** setting has three choices:

- **Default guidance** uses the plugin's built-in prompt.
- **Append custom instructions** keeps the built-in prompt and adds your guidance.
- **Replace guidance (advanced)** replaces the built-in guidance with your text.

The fixed JSON response contract is always retained so the five rendered summary sections stay
reliable. The video title, channel, and transcript are supplied separately; custom instructions
should describe the desired focus, tone, or level of detail. Clear the instructions and switch
back to **Default guidance** to restore the original behavior.

<p align="right"><a href="#readme-top">Back to top</a></p>

## Note Format

The default video frontmatter template uses the same core property set as YT Knowledge Notes:
`title`, `aliases`, `source`, `channel`, `channelUrl`, `channelId`, `videoUrl`, `videoId`,
`playlistUrl`, `playlistId`, `thumbnailUrl`, `videoDescription`, `uploadDate`, `videoCategory`,
`durationSeconds`, `keywords`, `generated`, plus your `tags`.

When an AI summary is generated, the plugin also records `aiSummary`, `aiProvider`, `aiModel`,
and `aiGenerated`. The AI content is wrapped in internal markers so regeneration can safely
replace that block without touching your other edits.

### Frontmatter templates

The **Video frontmatter template** setting accepts YAML without the opening and closing `---`
lines. Values are inserted with placeholders:

`title`, `aliases`, `source`, `channel`, `channelUrl`, `channelId`, `videoUrl`, `videoId`,
`playlistUrl`, `playlistId`, `thumbnailUrl`, `videoDescription`, `uploadDate`, `videoCategory`,
`durationSeconds`, `keywords`, `generated`, `tags`, `aiSummary`, `aiProvider`, `aiModel`, and
`aiGenerated`.

For example:

```yaml
title: {{title}}
source: youtube
videoId: {{videoId}}
url: {{videoUrl}}
creator: {{channel}}
topics: {{tags}}
```

Placeholder values are YAML-encoded. If an optional value is unavailable, its entire template
line is omitted. `source: youtube` and a non-empty `videoId` are required so the plugin can
recognize notes and avoid duplicates. Use **Validate and save** before syncing, **Preview** to
inspect sample output, or **Reset default** to restore all standard properties.

Template changes affect new notes only. To update existing generated video notes, run
**Apply frontmatter template to existing YouTube notes** from the command palette or plugin
settings. The migration shows a sample and note counts before confirmation, preserves note
bodies and unknown user properties, and reports changed, unchanged, skipped, and failed notes.
YAML comments and formatting may be normalized. Playlist and root index notes are never migrated.

<p align="right"><a href="#readme-top">Back to top</a></p>

## Mobile Behavior

The plugin supports iOS/iPadOS and Android using Obsidian's cross-platform Vault and HTTP APIs.
Mobile operating systems may suspend Obsidian when it is in the background, so the plugin does
not claim background execution while the app is closed or suspended.

Supported mobile behavior:

- manual **Sync now**
- sync on Obsidian startup
- interval sync while Obsidian remains active
- interval re-check when Obsidian returns to the foreground
- playlist management, metadata, transcripts, note/index creation
- manual and automatic AI summaries

If a mobile sync is interrupted, already-created notes are detected on the next run and skipped,
so syncing resumes with the remaining videos.

<p align="right"><a href="#readme-top">Back to top</a></p>

## Notes and Limitations

- **Public playlists only.** Private playlists require login and are not supported.
- Videos are processed one at a time with a small delay to be polite to YouTube — first sync of
  a large playlist can take a few minutes.
- If a video has no transcript, its note is still created with full metadata. AI summary
  generation is skipped for that video.
- YouTube or an AI provider can rate-limit requests. Failed YouTube videos can be retried on a
  later sync; failed AI summaries can be generated later with the manual/bulk commands.
- Provider compatibility depends on support for the selected OpenAI-style endpoint and response
  format.

<p align="right"><a href="#readme-top">Back to top</a></p>

## Network Use and Privacy

For normal playlist syncing, the plugin makes outbound HTTPS requests to YouTube to fetch
playlist data, video metadata, thumbnails, and captions for the public playlists you configure.
It does not collect telemetry.

When **AI summaries are disabled**, no vault content is sent to an AI service.

When **AI summaries are enabled**, the plugin sends only the generated video's title, channel,
transcript, and configured summary instructions to the AI endpoint you configured. Other vault
notes and unrelated vault content are not sent. API keys are referenced through Obsidian
SecretStorage rather than stored in the plugin's `data.json`.

The hidden metadata marker used for repeatable frontmatter migrations contains video and playlist
metadata plus AI provider/model status. It never contains transcripts, summary text, credentials,
or API keys.

<p align="right"><a href="#readme-top">Back to top</a></p>

## Development

Use **Node.js 24 with npm**, matching the build workflow. The release-attestation workflow
uses Node.js 20; the package does not declare an `engines` constraint.

```bash
git clone https://github.com/DagerottDev/Youtube_Obsidian_Sync.git
cd Youtube_Obsidian_Sync
npm ci
npm run check       # TypeScript checks + unit tests
npm run build       # TypeScript checks + production main.js bundle
```

Other supported commands:

```bash
npm run typecheck   # TypeScript checks only
npm test            # Unit tests only
npm run dev         # One development build with inline source maps; does not watch files
```

To try your build, copy `main.js` and `manifest.json` into
`.obsidian/plugins/youtube-playlist-sync/` in a test vault, then reload Obsidian and enable
the plugin. Rebuild and copy `main.js` again after source changes.

For a live check of the YouTube fetch layer, replace `YOUR_PUBLIC_PLAYLIST_ID` with the value
of the playlist URL's `list` parameter:

```bash
node test/smoke.mjs YOUR_PUBLIC_PLAYLIST_ID
```

This smoke check needs network access and does not exercise Obsidian UI or AI providers.
No environment-variable configuration is required by the plugin; playlists and AI credentials
are configured in Obsidian settings.

| Area | Source |
| --- | --- |
| YouTube playlist, metadata, and caption fetching | [src/youtube.ts](src/youtube.ts) |
| Note and index rendering | [src/noteRenderer.ts](src/noteRenderer.ts) |
| Sync orchestration and commands | [src/main.ts](src/main.ts) |
| Frontmatter templates and migration | [src/frontmatter.ts](src/frontmatter.ts), [src/noteFrontmatter.ts](src/noteFrontmatter.ts) |
| AI request formatting and summary updates | [src/ai/](src/ai/) |

See the [publication checklist](PUBLISH_CHECKLIST.md) for release procedures and recorded
validation, and the [promotion checklist](PROMOTION_CHECKLIST.md) for project outreach history.

<p align="right"><a href="#readme-top">Back to top</a></p>

## Contributing

Read [CONTRIBUTING.md](CONTRIBUTING.md) for setup, tests, smoke checks, and pull request
expectations. Before submitting code changes, run `npm run check` and `npm run build`.
Discuss bugs and feature ideas through the [issue tracker][issues].

<p align="right"><a href="#readme-top">Back to top</a></p>

## License

Distributed under the **MIT License**. See [LICENSE](LICENSE) for the full text.

<p align="right"><a href="#readme-top">Back to top</a></p>

## Contact and Support

Use the [issue tracker][issues] for questions, reproducible bugs, and feature ideas.
Bug reports can start with the [bug report form][bug-report].

If this plugin saves you time, you can support its development:

[![Support the project — Buy Me a Coffee][coffee-image]][coffee]

- [Buy Me a Coffee — international support][coffee]
- [Bondin — India support](https://bondin.io/dagerottdev)

<p align="right"><a href="#readme-top">Back to top</a></p>

## Acknowledgments

- YT Knowledge Notes for the metadata property conventions used by the default note template.
- README layout inspired by [Best-README-Template](https://github.com/othneildrew/Best-README-Template).

<p align="right"><a href="#readme-top">Back to top</a></p>

[repository]: https://github.com/DagerottDev/Youtube_Obsidian_Sync
[releases]: https://github.com/DagerottDev/Youtube_Obsidian_Sync/releases
[latest-release]: https://github.com/DagerottDev/Youtube_Obsidian_Sync/releases/latest
[issues]: https://github.com/DagerottDev/Youtube_Obsidian_Sync/issues
[bug-report]: https://github.com/DagerottDev/Youtube_Obsidian_Sync/issues/new?template=bug-report.yml
[community-listing]: https://obsidian.md/plugins?id=youtube-playlist-sync
[build-workflow]: https://github.com/DagerottDev/Youtube_Obsidian_Sync/actions/workflows/build-main.yml
[release-shield]: https://img.shields.io/github/v/release/DagerottDev/Youtube_Obsidian_Sync?style=for-the-badge
[build-shield]: https://img.shields.io/github/actions/workflow/status/DagerottDev/Youtube_Obsidian_Sync/build-main.yml?branch=main&style=for-the-badge&label=build
[stars-shield]: https://img.shields.io/github/stars/DagerottDev/Youtube_Obsidian_Sync?style=for-the-badge
[issues-shield]: https://img.shields.io/github/issues/DagerottDev/Youtube_Obsidian_Sync?style=for-the-badge
[license-shield]: https://img.shields.io/github/license/DagerottDev/Youtube_Obsidian_Sync?style=for-the-badge
[product-screenshot]: assets/screenshots/playlist-index.webp
[sync-screenshot]: assets/screenshots/settings-sync.webp
[playlists-screenshot]: assets/screenshots/playlist-management.webp
[properties-screenshot]: assets/screenshots/video-note-properties.webp
[index-screenshot]: assets/screenshots/video-note-transcript.webp
[walkthrough]: assets/screenshots/playlist-sync-walkthrough.gif
[coffee-image]: assets/buy-me-a-coffee.svg
[coffee]: https://buymeacoffee.com/dagerottdev
