# Obsidian Community Plugin Publication Checklist

Current GitHub release and Obsidian directory version: **0.3.3** (`a0f4246`). The directory's
automated review for this release is complete.

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
- [ ] Forum post — submitted on 2026-09-23 with the author's truthful disclosure; the Forum
  reports one post pending moderator approval. Do not submit a duplicate.
- [x] [Reddit post](https://www.reddit.com/r/ObsidianMD/comments/1wnwpzx/i_made_youtube_playlist_sync_because_existing/)
  — published on 2026-09-23 with author wording, developer disclosure, and `showcase` flair after
  the user said they had spoken with a moderator and explicitly directed publication.
- [x] Discord and YouTube/video promotions — excluded per the user's instruction.

## Promotion status

- [x] GitHub website, topics, README positioning, and existing project documentation.
- [x] X launch post and follow-up thread; plugin link added to the X profile bio/website.
- [x] Community directory listing audited: description, categories, screenshots, and funding links.
- [x] Funding links verified in the README, manifest, package metadata, and `.github/FUNDING.yml`.
- [x] Release assets and `versions.json` mapping verified for `0.3.3`.
- [ ] Forum post approval — see the platform-specific status above in
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
