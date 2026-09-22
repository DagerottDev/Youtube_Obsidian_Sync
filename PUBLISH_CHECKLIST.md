# Obsidian Community Plugin Publication Checklist

Current published release: **0.3.1** (`1e09733`)

## Repository readiness

- [x] `README.md` explains the plugin's purpose, setup, usage, limitations, and network use.
- [x] `LICENSE` is present and the license is identified in the README.
- [x] `manifest.json` is in the repository root with a unique ID and a SemVer version.
- [x] The manifest description is short, action-oriented, and ends with a period.
- [x] `versions.json` maps the current plugin version to its minimum Obsidian version.
- [x] `main.js` is built from `src/` and committed.
- [x] Type-check passes (`npm run typecheck`).
- [x] `npm run check` passes locally: type-check plus 30 tests.
- [x] Production bundle builds locally with `npm run build` on Node 26.
- [ ] Verify `npm run check` and `npm run build` on Node 24 LTS in GitHub Actions. The workflow is
  updated locally to Node 24, but has not yet been pushed or run; Node 20's earlier success is
  historical because it reached EOL on 2026-03-24.
- [x] YouTube fetch smoke test rerun against a live playlist on 2026-09-23: 24 videos found,
  metadata fetched, English captions available, and 1,074 transcript lines parsed.
- [x] Support links are present in `README.md`, `.github/FUNDING.yml`, and `manifest.json`.
- [x] `CONTRIBUTING.md` documents setup, checks, smoke testing, and pull request expectations.

## External publication gates

- [x] Make `DagerottDev/Youtube_Obsidian_Sync` public on GitHub.
- [x] Create GitHub release `0.3.1` with `main.js` and `manifest.json` attached.
- [x] Generate and verify GitHub artifact attestations for the release assets.
- [x] GitHub Actions verified `npm run check` and `npm run build` on Node 20 for the 0.3.2 patch
  (historical result; the workflow still needs a supported-LTS rerun before publication).
- [x] Prepare the 0.3.2 release draft with `main.js` and `manifest.json` assets.
- [ ] Refresh the draft assets from the latest source after Node 24 CI passes; the current draft
  assets predate the settings migration and scoped-folder scan.
- [ ] Publish the 0.3.2 release publicly and wait for its asset attestations. This public action
  still needs your explicit go-ahead.
- [x] Sign in to the Obsidian Community directory.
- [x] Link the GitHub account that owns the repository to the Obsidian account.
- [x] Add **YouTube Playlist Sync** in the directory.
- [x] Resolve automated review feedback and publish the directory entry.
- [x] Add international and India support links to the public listing.

## After approval

- [x] Verify installation from **Settings → Community plugins → Browse** in the local E2E vault;
  the directory search showed **YouTube Playlist Sync — INSTALLED — v0.3.1**.
- [ ] Forum, Discord, and Reddit posts — Forum publication is waiting on the required truthful
  author-comprehension disclosure; Discord needs the user to re-authenticate; Reddit is held because
  the account has no visible prior r/ObsidianMD participation and the pinned moderator notice warns
  against first-and-only promotional posts.

## Promotion status

- [x] GitHub website, topics, README positioning, screenshots, GIF, and walkthrough video link.
- [x] X launch post and follow-up thread; plugin link added to the X profile bio/website.
- [x] Community directory listing audited: description, categories, screenshots, and funding links.
- [x] Funding links verified in the README, manifest, package metadata, and `.github/FUNDING.yml`.
- [x] Release assets and `versions.json` mapping verified for `0.3.1`.
- [ ] Forum, Reddit, and Discord posts — see the platform-specific status and safety gates above in
  [`PROMOTION_CHECKLIST.md`](PROMOTION_CHECKLIST.md).
- [x] Obsidian Roundup path checked; the publisher retired the newsletter and the old domain is
  unrelated. Do not submit there.
- [ ] YouTube/Shorts/Reels/TikTok uploads — held for the creator-platform backlog; a short
  screenshot walkthrough asset is available if this work is resumed later.
- [ ] Creator outreach, reviews, and guest-post pitches — held for the creator-platform backlog;
  see [`PROMOTION_CHECKLIST.md`](PROMOTION_CHECKLIST.md).

The active Awesome Obsidian repository currently states that plugin entries are not accepted, so
no PR was opened there. Recheck its contribution policy before attempting a future submission.

## Scorecard feedback backlog

As of 2026-09-23, the public listing reports **217 downloads** and the live scorecard reports
**58 installations**, **Excellent** health, and **Satisfactory** review with 9 automated findings.
Those findings are for the latest published version, 0.3.1—not the 0.3.2 draft. The scorecard
reports no vulnerable dependencies or suspicious network patterns and verifies the 0.3.1 release
attestation/build. The next engineering pass should address or recheck these findings:

- [x] Narrow the unsafe AI summary-array mapping in `src/ai/openai.ts`; add regression coverage in
  `test/openai.test.ts`.
- [x] Add searchable settings via `getSettingDefinitions()` while retaining the legacy
  `display()` fallback for the current minimum Obsidian version (`1.11.4`). Focused tests and
  type-check pass locally.
- [ ] Recheck the unsafe typed-value warnings (4 findings across 3 rules) in the latest scorecard.
  All point to `src/ai/openai.ts:61` in the 0.3.1 source; 0.3.2 contains the malformed-array
  regression fix, but the updated scorecard is not available until the release is published.
- [x] Scope AI-summary and frontmatter-migration scans to the configured base folder instead of
  enumerating every vault Markdown file. Recursive traversal is covered by a focused test; the
  live scorecard still needs to be rerun after publication.
- [ ] Publish a patch release containing the source fix after a supported Node.js LTS build.
- [ ] Re-run the scorecard after the settings migration and patch release.
