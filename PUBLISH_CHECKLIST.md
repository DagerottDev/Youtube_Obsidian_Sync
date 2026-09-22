# Obsidian Community Plugin Publication Checklist

Current GitHub release: **0.3.2** (`7b13e5e`). The Obsidian directory still shows **0.3.1** and
has not yet detected the new release.

## Repository readiness

- [x] `README.md` explains the plugin's purpose, setup, usage, limitations, and network use.
- [x] `LICENSE` is present and the license is identified in the README.
- [x] `manifest.json` is in the repository root with a unique ID and a SemVer version.
- [x] The manifest description is short, action-oriented, and ends with a period.
- [x] `versions.json` maps the current plugin version to its minimum Obsidian version.
- [x] `main.js` is built from `src/` and committed.
- [x] Type-check passes (`npm run typecheck`).
- [x] `npm run check` passes locally: type-check plus 31 tests.
- [x] Production bundle builds locally with `npm run build` on Node 26.
- [x] Re-run `npm run check` and `npm run build` on Node 24 LTS in GitHub Actions for the legacy
  settings-draft fix (`7b13e5e`); workflow run 35781527872 passed.
- [x] YouTube fetch smoke test rerun against a live playlist on 2026-09-23: 24 videos found,
  metadata fetched, English captions available, and 1,074 transcript lines parsed.
- [x] Support links are present in `README.md`, `.github/FUNDING.yml`, and `manifest.json`.
- [x] `CONTRIBUTING.md` documents setup, checks, smoke testing, and pull request expectations.

## External publication gates

- [x] Make `DagerottDev/Youtube_Obsidian_Sync` public on GitHub.
- [x] Create GitHub release `0.3.1` with `main.js` and `manifest.json` attached.
- [x] Generate and verify GitHub artifact attestations for the release assets.
- [x] GitHub Actions verified `npm run check` and `npm run build` on Node 24 for commit `7b13e5e`.
- [x] Prepare the 0.3.2 release draft with `main.js` and `manifest.json` assets.
- [x] Refresh the release assets after Node 24 CI: `main.js` (65,565 bytes; SHA-256
  `a3accf47608b92f545cc69890174d5b77839407973c29e526ba594c2483db14a`) and `manifest.json` (347
  bytes; SHA-256 `56bd75da45c061f0df916c0555897869e3c29267dd4046c75763acc04d155c3d`).
- [x] Publish GitHub release `0.3.2` on 2026-09-23; verify the page, tag, assets, and hashes.
- [ ] Verify the Obsidian directory's release-attestation/build review for 0.3.2 after it detects
  the release; the account page currently reports “No release matches your manifest version.”
- [x] Sign in to the Obsidian Community directory.
- [x] Link the GitHub account that owns the repository to the Obsidian account.
- [x] Add **YouTube Playlist Sync** in the directory.
- [x] Resolve automated review feedback and publish the directory entry.
- [x] Add international and India support links to the public listing.

## After approval

- [x] Verify installation from **Settings → Community plugins → Browse** in the local E2E vault;
  the directory showed **YouTube Playlist Sync — INSTALLED — v0.3.1** before the 0.3.2 release.
- [ ] Forum post — still needs the author's truthful answer to the mandatory yes/no comprehension
  disclosure; general posting authorization does not answer that personal attestation.
- [ ] Reddit post — waiting for author-written wording; r/ObsidianMD disallows primarily AI-generated
  posts.
- [x] Discord and YouTube/video promotions — excluded per the user's instruction.

## Promotion status

- [x] GitHub website, topics, README positioning, screenshots, GIF, and walkthrough video link.
- [x] X launch post and follow-up thread; plugin link added to the X profile bio/website.
- [x] Community directory listing audited: description, categories, screenshots, and funding links.
- [x] Funding links verified in the README, manifest, package metadata, and `.github/FUNDING.yml`.
- [x] Release assets and `versions.json` mapping verified for `0.3.2`.
- [ ] Forum and Reddit posts — see the platform-specific status and safety gates above in
  [`PROMOTION_CHECKLIST.md`](PROMOTION_CHECKLIST.md).
- [x] Obsidian Roundup path checked; the publisher retired the newsletter. Do not submit there.
- [x] YouTube/video promotion — excluded per the user's instruction.
- [ ] Creator outreach, reviews, and guest-post pitches — held for the creator-platform backlog;
  see [`PROMOTION_CHECKLIST.md`](PROMOTION_CHECKLIST.md).

The active Awesome Obsidian repository currently states that plugin entries are not accepted, so
no PR was opened there. Recheck its contribution policy before attempting a future submission.

## Scorecard feedback backlog

As of 2026-09-23, the directory still reports **217 downloads** and **58 installations**, **Excellent**
health, and **Satisfactory** review with 9 automated findings. The public entry and its scorecard
still identify 0.3.1 even though GitHub release 0.3.2 is live; wait for detection and rerun review
before treating these results as current for 0.3.2. The previous scorecard reported no vulnerable
dependencies or suspicious network patterns and verified the 0.3.1 release attestation/build.
Recheck these findings on the newly published release:

- [x] Narrow the unsafe AI summary-array mapping in `src/ai/openai.ts`; add regression coverage in
  `test/openai.test.ts`.
- [x] Add searchable settings via `getSettingDefinitions()` while retaining the legacy
  `display()` fallback for the current minimum Obsidian version (`1.11.4`). Focused tests and
  type-check pass locally.
- [ ] Recheck the unsafe typed-value warnings (4 findings across 3 rules) in the 0.3.2 scorecard.
  All point to `src/ai/openai.ts:61` in the 0.3.1 source; 0.3.2 contains the malformed-array
  regression fix, but the updated scorecard is not available until the directory detects 0.3.2.
- [x] Scope AI-summary and frontmatter-migration scans to the configured base folder instead of
  enumerating every vault Markdown file. Recursive traversal is covered by a focused test; the
  live scorecard still needs to be rerun after publication.
- [x] Publish a patch release containing the source fixes after a supported Node.js LTS build.
- [ ] Re-run the scorecard after the directory detects the settings migration and patch release.
