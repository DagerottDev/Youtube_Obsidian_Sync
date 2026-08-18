// Standalone smoke test: verifies the innertube playlist/player/captions flow
// the plugin uses, without Obsidian. Run: node test/smoke.mjs <playlistId>
const PLAYLIST_ID = process.argv[2] || 'PL-DDW8QIRjNOVxrU2efygBw0xADVOgpmw';
const KEY = ['AIza', 'SyAO_FJ2SlqU8Q4STEHLGCilw', '_Y9_11qcW8'].join('');
const PLAYER = `https://www.youtube.com/youtubei/v1/player?key=${KEY}`;
const BROWSE = `https://www.youtube.com/youtubei/v1/browse?key=${KEY}`;

const ANDROID_CONTEXT = {
  client: {
    clientName: 'ANDROID',
    clientVersion: '20.10.38',
    androidSdkVersion: 30,
    hl: 'en',
    gl: 'US',
  },
};
const WEB_CONTEXT = {
  client: { clientName: 'WEB', clientVersion: '2.20240510.00.00', hl: 'en', gl: 'US' },
};
const ANDROID_UA = 'com.google.android.youtube/20.10.38 (Linux; U; Android 11) gzip';

async function post(endpoint, context, body) {
  const res = await fetch(endpoint, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'User-Agent': ANDROID_UA },
    body: JSON.stringify({ context, ...body }),
  });
  const text = await res.text();
  return JSON.parse(text);
}

const isObject = (v) => typeof v === 'object' && v !== null;
const rendererText = (v) => {
  if (!isObject(v)) return null;
  if (typeof v.simpleText === 'string') return v.simpleText;
  if (!Array.isArray(v.runs)) return null;
  return v.runs.map((r) => (isObject(r) && typeof r.text === 'string' ? r.text : '')).join('') || null;
};

function walkJson(value, visit) {
  if (Array.isArray(value)) { for (const item of value) walkJson(item, visit); return; }
  if (!isObject(value)) return;
  if (visit(value) === false) return;
  for (const child of Object.values(value)) walkJson(child, visit);
}

function continuationToken(node) {
  const ep = isObject(node.continuationItemRenderer) ? node.continuationItemRenderer.continuationEndpoint : undefined;
  if (isObject(ep)) {
    const token = isObject(ep.continuationCommand) ? ep.continuationCommand.token : undefined;
    if (typeof token === 'string' && token) return token;
    if (isObject(ep.commandExecutorCommand) && Array.isArray(ep.commandExecutorCommand.commands)) {
      for (const c of ep.commandExecutorCommand.commands) {
        if (isObject(c) && isObject(c.continuationCommand) && typeof c.continuationCommand.token === 'string' && c.continuationCommand.token) return c.continuationCommand.token;
      }
    }
  }
  if (Array.isArray(node.continuations)) {
    for (const c of node.continuations) {
      if (isObject(c) && isObject(c.nextContinuationData) && typeof c.nextContinuationData.continuation === 'string') return c.nextContinuationData.continuation;
    }
  }
  return null;
}

const norm = (t) => t.replace(/\s+/g, ' ').trim();

async function fetchPlaylist(playlistId) {
  const initial = await post(BROWSE, ANDROID_CONTEXT, { browseId: `VL${playlistId}` });
  let title = null;
  walkJson(initial, (node) => {
    if (title) return false;
    if (isObject(node.playlistMetadataRenderer) && typeof node.playlistMetadataRenderer.title === 'string') { title = norm(node.playlistMetadataRenderer.title); return false; }
    if (isObject(node.pageHeaderRenderer) && typeof node.pageHeaderRenderer.pageTitle === 'string') { title = norm(node.pageHeaderRenderer.pageTitle); return false; }
    const header = node.playlistHeaderRenderer;
    if (isObject(header)) { const c = rendererText(header.title); if (c) { title = norm(c); return false; } }
    return true;
  });

  const entries = new Map();
  let token = null;
  const collect = (payload) => {
    walkJson(payload, (node) => {
      const renderer = isObject(node.playlistVideoRenderer) ? node.playlistVideoRenderer : isObject(node.playlistPanelVideoRenderer) ? node.playlistPanelVideoRenderer : undefined;
      if (renderer && typeof renderer.videoId === 'string' && renderer.videoId && !entries.has(renderer.videoId)) {
        const idxRaw = rendererText(renderer.index) ?? rendererText(renderer.indexText) ?? '';
        const parsed = parseInt(idxRaw, 10);
        entries.set(renderer.videoId, {
          videoId: renderer.videoId,
          position: Number.isFinite(parsed) && parsed > 0 ? parsed : entries.size + 1,
          title: norm(rendererText(renderer.title) ?? `Video ${entries.size + 1}`),
          channel: norm(rendererText(renderer.shortBylineText) ?? ''),
          lengthText: rendererText(renderer.lengthText),
          published: rendererText(renderer.publishedTimeText),
        });
      }
      if (!token) token = continuationToken(node);
      return true;
    });
  };
  collect(initial);
  const seen = new Set();
  while (token && !seen.has(token)) {
    seen.add(token);
    const page = await post(BROWSE, ANDROID_CONTEXT, { continuation: token });
    collect(page);
    if (token) { /* collect may update token */ }
  }
  return { title, entries: [...entries.values()].sort((a, b) => a.position - b.position) };
}

async function fetchVideo(videoId) {
  const player = await post(PLAYER, ANDROID_CONTEXT, { videoId });
  const details = player.videoDetails || {};
  const tracks = player.captions?.playerCaptionsTracklistRenderer?.captionTracks || [];
  const web = await post(PLAYER, WEB_CONTEXT, { videoId });
  return { details, tracks, micro: web.microformat?.playerMicroformatRenderer || {} };
}

async function fetchCaptions(baseUrl) {
  const res = await fetch(baseUrl, {
    headers: {
      'Accept-Language': 'en-US,en;q=0.9',
      'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0 Safari/537.36',
    },
  });
  const xml = await res.text();
  // Mirror plugin logic: <p t> format first, then <text start> fallback.
  const lines = [];
  const parse = (re, readOffset) => {
    let m;
    while ((m = re.exec(xml)) !== null) {
      const offset = readOffset(m[1]);
      const text = norm(m[2].replace(/<[^>]+>/g, ' '));
      if (offset !== null && text) lines.push({ offset, text });
    }
  };
  parse(/<p\s+([^>]+)>([\s\S]*?)<\/p>/g, (attrs) => {
    const mm = attrs.match(/\bt="(\d+)"/);
    return mm ? parseInt(mm[1], 10) : null;
  });
  if (!lines.length) {
    parse(/<text\s+([^>]+)>([\s\S]*?)<\/text>/g, (attrs) => {
      const mm = attrs.match(/\bstart="([^"]+)"/);
      return mm ? Math.round(parseFloat(mm[1]) * 1000) : null;
    });
  }
  return lines;
}

const main = async () => {
  console.log(`Fetching playlist ${PLAYLIST_ID}...`);
  const { title, entries } = await fetchPlaylist(PLAYLIST_ID);
  console.log(`Title: "${title}"  |  ${entries.length} videos`);
  console.log('First 3 entries:');
  for (const e of entries.slice(0, 3)) {
    console.log(`  #${e.position} [${e.lengthText || '?'}] ${e.title} (${e.channel})`);
  }
  const first = entries[0];
  if (!first) { console.log('NO ENTRIES FOUND'); process.exit(1); }
  console.log(`\nFetching player metadata for ${first.videoId}...`);
  const { details, tracks, micro } = await fetchVideo(first.videoId);
  console.log(`  title: ${details.title}`);
  console.log(`  author: ${details.author}`);
  console.log(`  lengthSeconds: ${details.lengthSeconds}`);
  console.log(`  uploadDate: ${micro.uploadDate}`);
  console.log(`  category: ${micro.category}`);
  console.log(`  keywords: ${JSON.stringify((details.keywords || []).slice(0, 3))}`);
  console.log(`  caption tracks: ${tracks.length ? tracks.map((t) => t.languageCode).join(', ') : 'NONE'}`);
  if (tracks.length) {
    const lines = await fetchCaptions(tracks[0].baseUrl);
    console.log(`  transcript lines: ${lines.length}`);
    console.log('  first lines:');
    for (const l of lines.slice(0, 3)) console.log(`    [${l.offset}] ${l.text.slice(0, 80)}`);
  }
  console.log('\nSMOKE TEST OK');
};

main().catch((err) => {
  console.error('SMOKE TEST FAILED:', err);
  process.exit(1);
});
