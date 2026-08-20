# Obsidian Community Plugin Publication Checklist

## Repository readiness

- [x] `README.md` explains the plugin's purpose, setup, usage, limitations, and network use.
- [x] `LICENSE` is present and the license is identified in the README.
- [x] `manifest.json` is in the repository root with a unique ID and a SemVer version.
- [x] The manifest description is short, action-oriented, and ends with a period.
- [x] `versions.json` maps the current plugin version to its minimum Obsidian version.
- [x] `main.js` is built from `src/` and committed.
- [x] Type-check, production build, and the YouTube fetch smoke test pass.

## External publication gates

- [ ] Make `DagerottDev/Youtube_Obsidian_Sync` public on GitHub.
- [ ] Create GitHub release `0.1.0` with `main.js` and `manifest.json` attached.
- [ ] Sign in to the Obsidian Community directory.
- [ ] Link the GitHub account that owns the repository to the Obsidian account.
- [ ] Add **YouTube Playlist Sync** in the directory.
- [ ] Resolve any automated review feedback and publish the directory entry.

## After approval

- [ ] Verify installation from **Settings → Community plugins → Browse**.
- [ ] Announce the first public release in the Obsidian forum and Discord updates channel.
