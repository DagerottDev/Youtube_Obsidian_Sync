# YouTube Playlist Sync

An Obsidian plugin that automatically syncs **public YouTube playlists** into notes with the
**same metadata as YT Knowledge Notes** (title, channel, URLs, IDs, thumbnail, description,
upload date, category, duration, keywords) plus a **transcript**. YouTube syncing requires no
YouTube API key. Optional AI summaries can be enabled with your own OpenAI API key.

The plugin supports Obsidian on desktop, iOS, iPadOS, and Android.

## Features

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
- Optional **OpenAI summaries** with Summary, Key Takeaways, Important Concepts, Action Items,
  and Questions / Things to Explore.
- AI summaries can run automatically for new notes, manually for the active note, or in bulk
  for existing notes that are missing summaries.
- Regenerating an AI summary replaces only the plugin-managed AI block and preserves the rest
  of the note.

## Install

### From the community plugin directory (once approved)

**Settings → Community plugins → Browse → search "YouTube Playlist Sync" → Install → Enable.**

### With BRAT

1. Install **BRAT** from the community plugin directory.
2. In BRAT settings, add this repository as a beta plugin.
3. Reload Obsidian and enable **YouTube Playlist Sync**.

### Manually

1. In your vault, open the folder `.obsidian/plugins/` (create it if missing).
2. Create a folder named `youtube-playlist-sync` inside it.
3. Copy **`main.js`** and **`manifest.json`** from the latest release into it.
4. Reload Obsidian and enable the plugin under **Settings → Community plugins**.

## Setup

1. **Settings → YouTube Playlist Sync → Playlists** — paste a public playlist URL
   (e.g. `https://www.youtube.com/playlist?list=PL...`) and click **Add**. Repeat for as many
   playlists as you want.
2. Click **Sync now** (or the ribbon icon, or the command palette →
   "Sync YouTube playlists now").

The first sync creates all video notes; later syncs only add new ones.

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
| Enable AI summaries | off | Enables OpenAI summary features |
| OpenAI API key | — | Secret selected from Obsidian SecretStorage |
| OpenAI model | `gpt-5.6-luna` | Recommended model; Terra, Sol, or a custom model ID are also available |
| Generate summaries automatically | on | When AI is enabled, summarize new notes after they are created |

## AI summaries

AI is completely optional. YouTube playlist syncing, metadata, transcripts, and note creation
continue to work without OpenAI.

To enable AI summaries:

1. Open **Settings → YouTube Playlist Sync → AI summaries**.
2. Turn on **Enable AI summaries**.
3. Select or create an **OpenAI API key** secret.
4. Keep **GPT-5.6 Luna** for the recommended cost-sensitive default, or select another model.
5. Use **Test connection**.

Commands:

- **Generate AI summary for current YouTube note** — creates or regenerates the AI block in the
  active generated YouTube note.
- **Generate missing AI summaries** — scans the configured base folder and summarizes existing
  generated notes that contain transcripts but do not yet have an AI summary.

Automatic AI generation happens only **after** the YouTube note is successfully created. An
OpenAI error therefore never causes the underlying playlist sync or note creation to fail.

For very long transcripts, the plugin summarizes transcript chunks first and then produces one
final coherent summary.

## Note format (metadata parity with YT Knowledge Notes)

Every video note has YAML frontmatter with the same core property set ytkn uses:
`title`, `aliases`, `source`, `channel`, `channelUrl`, `channelId`, `videoUrl`, `videoId`,
`playlistUrl`, `playlistId`, `thumbnailUrl`, `videoDescription`, `uploadDate`, `videoCategory`,
`durationSeconds`, `keywords`, `generated`, plus your `tags`.

When an AI summary is generated, the plugin also records `aiSummary`, `aiProvider`, `aiModel`,
and `aiGenerated`. The AI content is wrapped in internal markers so regeneration can safely
replace that block without touching your other edits.

## Mobile behavior

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

## Notes & limitations

- **Public playlists only.** Private playlists require login and are not supported.
- Videos are processed one at a time with a small delay to be polite to YouTube — first sync of
  a large playlist can take a few minutes.
- If a video has no transcript, its note is still created with full metadata. AI summary
  generation is skipped for that video.
- YouTube or OpenAI can rate-limit requests. Failed YouTube videos can be retried on a later
  sync; failed AI summaries can be generated later with the manual/bulk commands.
- ChatGPT subscription access and OpenAI API billing are separate. This plugin uses a user-
  supplied OpenAI API key; it does not use an unsupported ChatGPT/Codex OAuth flow.

## Network use and privacy

For normal playlist syncing, the plugin makes outbound HTTPS requests to YouTube to fetch
playlist data, video metadata, thumbnails, and captions for the public playlists you configure.
It does not collect telemetry.

When **AI summaries are disabled**, no vault content is sent to an AI service.

When **AI summaries are enabled**, the plugin sends only the generated video's title, channel,
and transcript to OpenAI for summarization. Other vault notes and unrelated vault content are
not sent. The actual OpenAI API key is referenced through Obsidian SecretStorage rather than
stored in the plugin's `data.json`.

## Development

```bash
npm install
npm run typecheck   # type check only
npm run build       # type check + bundle main.js
node test/smoke.mjs <playlistId>   # end-to-end check of the YouTube fetch layer
```

The YouTube fetch layer lives in `src/youtube.ts`, note rendering in `src/noteRenderer.ts`, sync
orchestration in `src/main.ts`, and AI integration in `src/ai/`.

## Support

If this plugin saves you time, you can support its development:

[![Support the project — Buy Me a Coffee](https://raw.githubusercontent.com/DagerottDev/Youtube_Obsidian_Sync/main/assets/buy-me-a-coffee.svg)](https://buymeacoffee.com/dagerottdev)

> ☕✨ [Support the project — Buy Me a Coffee](https://buymeacoffee.com/dagerottdev) ✨

- [Buy Me a Coffee — international support](https://buymeacoffee.com/dagerottdev)
- [Bondin — India support](https://bondin.io/dagerottdev)

## License

[MIT](LICENSE)
