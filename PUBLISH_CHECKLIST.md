# Obsidian Community Plugin Publication Checklist

## Repository readiness

- [x] `README.md` explains the plugin's purpose, setup, usage, limitations, and network use.
- [x] `LICENSE` is present and the license is identified in the README.
- [x] `manifest.json` is in the repository root with a unique ID and a SemVer version.
- [x] The manifest description is short, action-oriented, and ends with a period.
- [x] `versions.json` maps the current plugin version to its minimum Obsidian version.
- [x] `main.js` is built from `src/` and committed.
- [x] Type-check, production build, and the YouTube fetch smoke test pass.
- [x] Support links are present in `README.md`, `.github/FUNDING.yml`, and `manifest.json`.

## External publication gates

- [x] Make `DagerottDev/Youtube_Obsidian_Sync` public on GitHub.
- [x] Create GitHub release `0.1.2` with `main.js` and `manifest.json` attached.
- [x] Generate and verify GitHub artifact attestations for the release assets.
- [x] Sign in to the Obsidian Community directory.
- [x] Link the GitHub account that owns the repository to the Obsidian account.
- [x] Add **YouTube Playlist Sync** in the directory.
- [x] Resolve automated review feedback and publish the directory entry.
- [x] Add international and India support links to the public listing.

## After approval

- [ ] Verify installation from **Settings → Community plugins → Browse**.
- [ ] Announce the first public release in the Obsidian forum and Discord updates channel.
