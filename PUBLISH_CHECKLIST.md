# Obsidian Community Plugin Publication Checklist

## 0.4.0 — Your statistics

- [x] Collection totals scan only the configured base folder and nested folders; existing
  modern and legacy notes count, while indexes and unrelated notes are excluded.
- [x] Activity counters record saved playlist additions, note/transcript creation, summaries
  (including regenerations), and successful or failed sync runs.
- [x] Recording defaults on; pause/resume, confirmed reset, refresh, and preview/copy work in
  both declarative and legacy settings. Reset preserves notes, playlists, and recording preference.
- [x] Reports allowlist aggregates and dates; no content, titles, URLs, paths, credentials,
  detailed errors, identifiers, uploads, or new network requests.
- [x] Serialized saves recover after failures; failed statistics persistence does not fail note
  writes. Stale scans are discarded when the folder changes or the settings panel closes.
- [x] On 2026-10-13, `npm run check` passed type-check and 55 tests; `npm run build` and
  `git diff --check` passed. Live YouTube smoke test found 24 videos and 1,074 transcript lines.
- [x] Merged [PR #13](https://github.com/DagerottDev/Youtube_Obsidian_Sync/pull/13) at `966fda4`.
  Node 24.21.0 passed all 55 tests and reproduced the committed bundle on the branch
  (run 38340961414) and merged main (run 38341048408).
- [x] Published [0.4.0](https://github.com/DagerottDev/Youtube_Obsidian_Sync/releases/tag/0.4.0)
  on 2026-10-13; tag points to `966fda4`. Downloaded assets match tested files byte-for-byte:
  `main.js` (74,556 bytes, SHA-256 `5fd1500c25f642fe94be2f98ba9d22daea14d017111fbe51b4d6597541681d56`)
  and `manifest.json` (347 bytes, SHA-256 `6a1df409eab94716f87b3f3294240424ac7535e10d6aca203e8cdbac17e9e4b3`).
- [x] Attestation run 38341079769 passed; `gh attestation verify` passed for both downloaded assets.
- [ ] Obsidian public directory verification: release scan queued on 2026-10-13; review for
  0.4.0 / `966fda4` is Pending, while the public listing still shows 0.3.3.
- [x] Published and verified the existing [Forum topic update](https://forum.obsidian.md/t/youtube-playlist-sync-turn-public-playlists-into-obsidian-notes/118649/3)
  and [X announcement](https://x.com/Rajveer761SM/status/2109846755965911485).
- Physical iOS/Android device testing remains unverified; automated settings tests use mocks.

## Previous release — 0.3.3

The previous GitHub release and Obsidian directory version was **0.3.3** (`a0f4246`). The
directory's automated review for that release completed; the records below are historical.

## Repository readiness

- [x] `README.md` explains the plugin's purpose, setup, usage, limitations, and network use.
- [x] `LICENSE` is present and the license is identified in the README.
- [x] `manifest.json` is in the repository root with a unique ID and a SemVer version.
- [x] The manifest description is short, action-oriented, and ends with a period.
- [x] `versions.json` maps the current plugin version to its minimum Obsidian version.
- [x] `main.js` is built from `src/` and committed.
- [x] Type-check passes (`npm run typecheck`).
- [x] `npm run check` passes locally: type-check plus 33 tests.
- [x] Production bundle builds locally with `npm run build` on Node 26.
- [x] Re-run `npm run check` and `npm run build` on Node 24 LTS in GitHub Actions for the
  compatibility release (`a0f4246`); workflow run 35783738637 passed.
- [x] YouTube fetch smoke test rerun against a live playlist on 2026-09-23: 24 videos found,
  metadata fetched, English captions available, and 1,074 transcript lines parsed.
- [x] Support links are present in `README.md`, `.github/FUNDING.yml`, and `manifest.json`.
- [x] `CONTRIBUTING.md` documents setup, checks, smoke testing, and pull request expectations.

## External publication gates

- [x] Make `DagerottDev/Youtube_Obsidian_Sync` public on GitHub.
- [x] Create GitHub release `0.3.1` with `main.js` and `manifest.json` attached.
- [x] Generate and verify GitHub artifact attestations for the release assets.
- [x] GitHub Actions verified `npm run check` and `npm run build` on Node 24 for commit `a0f4246`.
- [x] Publish GitHub release [`0.3.3`](https://github.com/DagerottDev/Youtube_Obsidian_Sync/releases/tag/0.3.3)
  on 2026-09-23; verify the tag and attached `main.js` (65,587 bytes; SHA-256
  `adeec8e9de9e77bc54ccb44a682c0398d7d0e2305738b480cd081fbb2cec7ddf`) and
  `manifest.json` (347 bytes; SHA-256
  `e64847743dac26acb060ae4ff41b416da3532cc28be5dd3c378b0af2fadbb4c8`).
- [x] Verify the release-attestation workflow (35787307806) and Obsidian directory's 0.3.3
  automated review. The review passed attestation, build reproducibility, network, vault-behavior,
  and dependency checks; only non-blocking code-quality warnings remain.
- [x] Sign in to the Obsidian Community directory.
- [x] Link the GitHub account that owns the repository to the Obsidian account.
- [x] Add **YouTube Playlist Sync** in the directory.
- [x] Resolve automated review feedback and publish the directory entry.
- [x] Add international and India support links to the public listing.

## After approval

- [x] Verify the 0.3.3 release build in the existing temporary Obsidian vault: after a full app
  restart, the current settings UI retained an unsaved template draft across Preview and a settings
  redraw. Syncing a public 24-video playlist produced 24 notes with transcripts and did not save
  the unsaved draft marker. The public directory also displays version 0.3.3.
- [x] [Forum post](https://forum.obsidian.md/t/youtube-playlist-sync-turn-public-playlists-into-obsidian-notes/118649)
  — submitted on 2026-09-23 with the author's truthful disclosure; verified public on 2026-10-06.
  Use the existing topic for updates.
- [x] [Reddit post](https://www.reddit.com/r/ObsidianMD/comments/1wnwpzx/i_made_youtube_playlist_sync_because_existing/)
  — published on 2026-09-23 with author wording, developer disclosure, and `showcase` flair after
  the user said they had spoken with a moderator and explicitly directed publication.
  On 2026-10-06, the post is marked removed by moderators; further promotion there is paused.
- [x] Discord and YouTube/video promotions — excluded per the user's instruction.

## Promotion status

- [x] GitHub website, topics, README positioning, and existing project documentation.
- [x] X launch post and follow-up thread; plugin link added to the X profile bio/website.
- [x] Community directory listing audited: description, categories, screenshots, and funding links.
- [x] Funding links verified in the README, manifest, package metadata, and `.github/FUNDING.yml`.
- [x] Release assets and `versions.json` mapping verified for `0.3.3`.
- [x] Forum post approval — verified public on 2026-10-06; see the platform-specific status in
  [`PROMOTION_CHECKLIST.md`](PROMOTION_CHECKLIST.md).
- [x] Obsidian Roundup path checked; the publisher retired the newsletter. Do not submit there.
- [x] YouTube/video promotion — excluded per the user's instruction.
- [x] YouTube/video-based creator outreach excluded per the user's instruction.
- [ ] Non-video creator outreach, reviews, and guest-post pitches — held in the separate
  creator-platform backlog; not a release gate.

The active Awesome Obsidian repository currently states that plugin entries are not accepted, so
no PR was opened there. Recheck its contribution policy before attempting a future submission.

## Scorecard feedback backlog

As checked on 2026-09-23, the public directory shows **235 downloads**, **Excellent** health, and
**Satisfactory** review for 0.3.3. The current review reports no vulnerable dependencies or
suspicious network patterns and verifies the release attestation and reproducible build. Remaining
warnings are non-blocking Promise callback typing in `src/settings.ts` and the deprecated legacy
`display()` fallback, which supports the declared Obsidian minimum version (1.11.4).

- [x] Narrow the unsafe AI summary-array mapping in `src/ai/openai.ts`; add regression coverage in
  `test/openai.test.ts`.
- [x] Add searchable settings via `getSettingDefinitions()` while retaining the legacy
  `display()` fallback for the current minimum Obsidian version (`1.11.4`). Focused tests and
  type-check pass locally.
- [x] Recheck unsafe typed-value warnings in the 0.3.3 review; the former `src/ai/openai.ts`
  findings are no longer reported.
- [x] Scope AI-summary and frontmatter-migration scans to the configured base folder instead of
  enumerating every vault Markdown file. Recursive traversal is covered by a focused test; the
  current review has completed.
- [x] Publish a patch release containing the source fixes after a supported Node.js LTS build.
- [x] Re-run the review after the directory detects the settings migration and patch release.
