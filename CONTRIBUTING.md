# Contributing

Thanks for helping improve YouTube Playlist Sync.

## Development setup

```bash
npm install
npm run typecheck
npm test
npm run build
```

The plugin targets Obsidian desktop and mobile. Keep YouTube requests limited to public
playlists, preserve existing user note content, and avoid adding telemetry or API credentials to
the repository.

## Tests and smoke checks

- `npm run typecheck` checks the TypeScript sources.
- `npm test` runs the unit tests.
- `npm run build` creates the production `main.js` bundle.
- `node test/smoke.mjs <playlistId>` exercises the public YouTube playlist/player/captions path
  and requires network access.

When changing note rendering, frontmatter, transcript handling, or AI request formatting, add or
update a focused test in `test/`.

## Pull requests

1. Explain the user-facing problem and the smallest useful change.
2. Include tests for behavior changes and update the README when setup or output changes.
3. Do not include private playlists, API keys, vault data, or generated personal notes.
4. Run the checks above and include any environment limitation in the pull request description.

Bug reports and feature ideas are welcome through the repository issue tracker:
<https://github.com/DagerottDev/Youtube_Obsidian_Sync/issues>.
