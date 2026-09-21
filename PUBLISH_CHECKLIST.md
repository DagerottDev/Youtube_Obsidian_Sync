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
- [ ] Production bundle verified on this host. The existing `main.js` is present and the
  published release asset was verified, but the local esbuild child process stalls under Node 26
  before producing output; rerun `npm run build` under a supported Node LTS runtime.
- [ ] YouTube fetch smoke test rerun against a live playlist.
- [x] Support links are present in `README.md`, `.github/FUNDING.yml`, and `manifest.json`.
- [x] `CONTRIBUTING.md` documents setup, checks, smoke testing, and pull request expectations.

## External publication gates

- [x] Make `DagerottDev/Youtube_Obsidian_Sync` public on GitHub.
- [x] Create GitHub release `0.3.1` with `main.js` and `manifest.json` attached.
- [x] Generate and verify GitHub artifact attestations for the release assets.
- [x] Sign in to the Obsidian Community directory.
- [x] Link the GitHub account that owns the repository to the Obsidian account.
- [x] Add **YouTube Playlist Sync** in the directory.
- [x] Resolve automated review feedback and publish the directory entry.
- [x] Add international and India support links to the public listing.

## After approval

- [x] Verify installation from **Settings → Community plugins → Browse** in the local E2E vault;
  the directory search showed **YouTube Playlist Sync — INSTALLED — v0.3.1**.
- [ ] Announce the first public release in the Obsidian forum and Discord updates channel.

## Promotion status

- [x] GitHub website, topics, README positioning, screenshots, GIF, and walkthrough video link.
- [x] X launch post and follow-up thread; plugin link added to the X profile bio/website.
- [x] Community directory listing audited: description, categories, screenshots, and funding links.
- [x] Funding links verified in the README, manifest, package metadata, and `.github/FUNDING.yml`.
- [x] Release assets and `versions.json` mapping verified for `0.3.1`.
- [ ] Forum, Reddit, and Discord posts — requires the account to be logged in.
- [ ] Obsidian Roundup submission — site was unavailable from this environment; submit via its form.
- [ ] YouTube/Shorts/Reels/TikTok uploads — requires creator accounts; the repository now includes a
  short screenshot walkthrough asset for use in those posts.
- [ ] Creator outreach, reviews, and guest-post pitches — use the templates in
  [`PROMOTION_CHECKLIST.md`](PROMOTION_CHECKLIST.md).

The active Awesome Obsidian repository currently states that plugin entries are not accepted, so
no PR was opened there. Recheck its contribution policy before attempting a future submission.

## Scorecard feedback backlog

The live community scorecard is currently **Excellent** for health and **Satisfactory** for review.
It reports no vulnerable dependencies or suspicious network patterns, and it reports 55 installs.
The next engineering pass should address these non-blocking findings:

- [x] Narrow the unsafe AI summary-array mapping in `src/ai/openai.ts`; add regression coverage in
  `test/openai.test.ts`.
- [ ] Migrate the settings tab to Obsidian's declarative `getSettingDefinitions()` API while
  retaining compatibility with the current minimum Obsidian version.
- [ ] Review the two typed-error warnings in the latest scorecard and narrow any remaining
  `unknown`/error paths where that improves safety without hiding useful diagnostics.
- [ ] Publish a patch release containing the source fix after a supported Node LTS production build.
- [ ] Re-run the scorecard after the settings migration and patch release.
