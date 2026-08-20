# YouTube Playlist Sync

An Obsidian plugin that automatically syncs **public YouTube playlists** into notes with the
**same metadata as YT Knowledge Notes** (title, channel, URLs, IDs, thumbnail, description,
upload date, category, duration, keywords) plus a **transcript** — no API key, no AI, no
external tools. Everything happens inside Obsidian.

## Features

- Fetches each configured playlist straight from YouTube (via the same internal API youtube.com
  uses — no API key required).
- **First sync**: creates one note per video in `YouTube/<Playlist Name>/`.
- **Later syncs**: only creates notes for videos that are **new** to the playlist. Existing
  notes are never modified, so your edits survive.
- Fetches the **transcript** for each video when one exists (readable paragraphs or
  timestamped lines) and embeds the video or thumbnail.
- Maintains an `_Index.md` per playlist (table of all videos) and a root `Index.md`.
- Runs automatically: **when Obsidian opens**, on an **interval** while Obsidian is open, and
  via a **Sync now** command / ribbon button.

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
3. Copy **`main.js`** and **`manifest.json`** from the latest [release](https://github.com/DagerottDev/Youtube_Obsidian_Sync/releases) into it.
4. Reload Obsidian and enable the plugin under **Settings → Community plugins**.

## Setup

1. **Settings → YouTube Playlist Sync → Playlists** — paste a public playlist URL
   (e.g. `https://www.youtube.com/playlist?list=PL...`) and click **Add**. Repeat for as many
   playlists as you want.
2. Click **Sync now** (or the 🔄 ribbon icon, or the command palette →
   "Sync YouTube playlists now").

The first sync creates all video notes; later syncs only add new ones.

## Settings

| Setting | Default | What it does |
| --- | --- | --- |
| Playlists | — | Public playlist URLs to sync |
| Sync when Obsidian opens | on | Run a sync ~3s after Obsidian starts |
| Sync interval (minutes) | 30 | Re-sync every N minutes while open; 0 disables |
| Base folder | `YouTube` | Vault folder where playlists are written |
| Create index notes | on | Per-playlist `_Index.md` + root `Index.md` |
| Transcript format | readable | `readable` paragraphs or `timestamped` lines |
| Preferred caption language | (empty) | e.g. `en`; empty = first available transcript |
| Media embed | video | Embed the YouTube player, thumbnail, or nothing |
| Tags | `youtube` | Extra tags added to every generated note |

## Note format (metadata parity with YT Knowledge Notes)

Every video note has YAML frontmatter with the same property set ytkn uses:
`title`, `aliases`, `source`, `channel`, `channelUrl`, `channelId`, `videoUrl`, `videoId`,
`playlistUrl`, `playlistId`, `thumbnailUrl`, `videoDescription`, `uploadDate`, `videoCategory`,
`durationSeconds`, `keywords`, `generated`, plus your `tags`. The body contains the media
embed, the transcript, and a Source section (channel, duration, upload date, playlist link).

## Notes & limitations

- **Public playlists only.** Private playlists require login and are not supported.
- Videos are processed one at a time with a small delay to be polite to YouTube — first sync of
  a large playlist can take a few minutes.
- If a video has no transcript, its note is still created with full metadata (a warning is
  logged).
- Transcript fetching needs the captions endpoint to work from your network; on rare occasions
  YouTube rate-limits it and some videos may be skipped on that run — the next sync will retry
  the ones that failed.

## Network use and privacy

The plugin makes outbound HTTPS requests to YouTube to fetch playlist data, video metadata,
thumbnails, and captions for the public playlists you configure. It uses Obsidian's request
API, does not require you to provide an API key, does not send vault contents to another
service, and does not collect telemetry. It only writes notes inside the vault.

## Development

```
npm install
npm run typecheck   # type check only
npm run build       # type check + bundle main.js
node test/smoke.mjs <playlistId>   # end-to-end check of the YouTube fetch layer
```

The fetch layer lives in `src/youtube.ts` (Innertube API, same approach as YT Knowledge
Notes), note rendering in `src/noteRenderer.ts`, sync orchestration in `src/main.ts`.

## License

[MIT](LICENSE)
