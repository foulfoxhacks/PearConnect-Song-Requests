// src/ytmd.js
// Thin client around the Pear Desktop / YTMD API Server plugin.
// Routes verified against:
//   https://github.com/th-ch/youtube-music/blob/master/src/plugins/api-server/backend/routes/control.ts
//   https://github.com/th-ch/youtube-music/blob/master/src/plugins/api-server/backend/routes/auth.ts

const API = '/api/v1';

export class YTMDClient {
  constructor({ host, token, timeoutMs = 10000 }) {
    if (!host) throw new Error('YTMDClient: host is required');
    this.host = host.replace(/\/+$/, '');
    this.token = token || '';
    if (!Number.isInteger(timeoutMs) || timeoutMs < 1) throw new Error('timeoutMs must be a positive integer');
    this.timeoutMs = timeoutMs;
    this.searchTail = Promise.resolve();
  }

  static async requestToken({ host, clientId, timeoutMs = 120000 }) {
    const client = new YTMDClient({ host, timeoutMs });
    const body = await client.#req('POST', `/auth/${encodeURIComponent(clientId)}`);
    if (!body || typeof body.accessToken !== 'string' || !body.accessToken) {
      throw new Error('Auth response missing accessToken');
    }
    return body.accessToken;
  }

  async #req(method, path, body) {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), this.timeoutMs);
    timer.unref?.();
    try {
      const res = await fetch(`${this.host}${path}`, {
        method,
        redirect: 'error',
        signal: controller.signal,
        headers: {
          Accept: 'application/json',
          ...(body !== undefined ? { 'Content-Type': 'application/json' } : {}),
          ...(this.token ? { Authorization: `Bearer ${this.token}` } : {}),
        },
        body: body === undefined ? undefined : JSON.stringify(body),
      });
      // Never echo remote bodies, tokens, or authentication URLs into logs.
      if (!res.ok) {
        await res.body?.cancel();
        const error = new Error(`Pear Desktop API returned HTTP ${res.status}. Check authentication and API compatibility.`);
        error.status = res.status;
        throw error;
      }
      if (res.status === 204) return null;
      if (!(res.headers.get('content-type') || '').includes('application/json')) {
        await res.body?.cancel();
        throw new Error('Pear Desktop returned a non-JSON response. Check YTMD_HOST and the API Server plugin.');
      }
      return await res.json();
    } catch (error) {
      if (controller.signal.aborted) {
        const timeout = new Error('Pear Desktop request timed out. Check the queue before retrying a write.');
        timeout.code = 'UPSTREAM_TIMEOUT';
        throw timeout;
      }
      throw error;
    } finally {
      clearTimeout(timer);
    }
  }

  // --- Search ---
  // POST /api/v1/search { query, params?, continuation? }
  // Returns the raw YouTube Music search response. We dig out the first
  // playable songVideo from it.
  async search(query, params) {
    // Pear Desktop replies on a shared IPC channel. Overlapping searches can
    // otherwise receive another viewer's result from that upstream channel.
    const previous = this.searchTail;
    let release;
    this.searchTail = new Promise(resolve => { release = resolve; });
    await previous;
    try { return await this.#req('POST', `${API}/search`, { query, ...(params ? { params } : {}) }); }
    finally { release(); }
  }

  /**
   * Search and return the first usable {videoId, title, artist, durationSec}
   * or null if nothing matched.
   */
  async findFirstSong(query) {
    const data = await this.search(query);
    const song = extractFirstSong(data);
    if (!song || song.durationSec > 0) return song;
    // The overview now shows play counts instead of lengths. Its Songs/Videos
    // filters still provide duration metadata. Use only filters the response
    // supplies, and enrich only the exact video selected by the original search.
    for (const params of durationSearchFilters(data)) {
      const matching = extractFirstSong(await this.search(query, params), song.videoId);
      if (matching?.durationSec > 0) return { ...song, durationSec: matching.durationSec };
    }
    return song;
  }

  // --- Queue ---
  async addToQueue(videoId, { insertPosition = 'INSERT_AT_END' } = {}) {
    return this.#req('POST', `${API}/queue`, { videoId, insertPosition });
  }

  async getQueue() {
    return this.#req('GET', `${API}/queue`);
  }

  async getCurrentSong() {
    return this.#req('GET', `${API}/song`);
  }

  async getNextSong() {
    return this.#req('GET', `${API}/queue/next`);
  }

  async next() {
    return this.#req('POST', `${API}/next`);
  }
}

/**
 * Walk a YouTube Music searchResponse and pick the first item that has a videoId
 * and looks like a song. The shape is YouTube's internal renderer JSON; we
 * defensively scan because it changes occasionally.
 */
export function extractFirstSong(data, videoId) {
  if (!data || typeof data !== 'object') return null;

  const found = [];
  walk(data, (node) => {
    if (!node || typeof node !== 'object') return;
    // musicResponsiveListItemRenderer is the standard "row" in a search result.
    if (node.musicResponsiveListItemRenderer) {
      const r = node.musicResponsiveListItemRenderer;
      const videoId =
        r?.playlistItemData?.videoId ||
        r?.overlay?.musicItemThumbnailOverlayRenderer?.content
          ?.musicPlayButtonRenderer?.playNavigationEndpoint?.watchEndpoint?.videoId;
      if (typeof videoId !== 'string' || !videoId || videoId.length > 128) return;
      const title = textFromRuns(r.flexColumns?.[0]);
      const artistish = artistFromColumn(r.flexColumns?.[1]);
      // The title is never duration evidence, even when a song is named "3:42".
      const durationSec = parseDurationFromColumns(r.fixedColumns, false) || parseDurationFromColumns(Array.isArray(r.flexColumns) ? r.flexColumns.slice(1) : [], true);
      found.push({ videoId, title: title || '(unknown)', artist: artistish || '', durationSec });
    }
  });
  const first = videoId ? found.find(song => song.videoId === videoId) : found[0];
  // Top results can omit length while the same recording appears in a shelf.
  // Never borrow a duration from a different video/recording or change the match.
  if (first && !first.durationSec) first.durationSec = found.find(song => song.videoId === first.videoId && song.durationSec > 0)?.durationSec || 0;
  return first || null;
}

function durationSearchFilters(data) {
  const filters = new Map();
  walk(data, node => {
    const params = node.searchEndpoint?.params;
    if (typeof params !== 'string' || params.length > 1024) return;
    // YouTube Music's filter protobuf identifies Songs (08 01) and Videos
    // (10 01). Ignore albums, podcasts and personalized/library filters.
    let bytes;
    try { bytes = Buffer.from(decodeURIComponent(params), 'base64'); } catch { return; }
    if (bytes.subarray(0, 5).equals(Buffer.from([0x12, 0x05, 0x8a, 0x01, 0x02])) && [0x08, 0x10].includes(bytes[5]) && bytes[6] === 1) filters.set(bytes[5], params);
  });
  return [filters.get(0x08), filters.get(0x10)].filter(Boolean);
}

function walk(node, visit) {
  const stack = [node];
  const seen = new WeakSet();
  let visited = 0;
  while (stack.length) {
    const item = stack.pop();
    if (!item || typeof item !== 'object' || seen.has(item)) continue;
    if (++visited > 50000) throw new Error('YouTube Music search response is too complex.');
    seen.add(item);
    visit(item);
    const values = Object.values(item);
    for (let i = values.length - 1; i >= 0; i--) stack.push(values[i]);
  }
}

function textFromRuns(column) {
  return rendererText(columnText(column));
}

function columnText(column) {
  return column?.musicResponsiveListItemFixedColumnRenderer?.text || column?.musicResponsiveListItemFlexColumnRenderer?.text || column?.text;
}

export function rendererText(value) {
  if (typeof value === 'string') return value.trim();
  if (typeof value?.simpleText === 'string') return value.simpleText.trim();
  return Array.isArray(value?.runs) ? value.runs.map(run => typeof run?.text === 'string' ? run.text : '').join('').trim() : '';
}

function artistFromColumn(column) {
  const runs = columnText(column)?.runs;
  const artists = Array.isArray(runs) ? runs.filter(run => typeof run?.navigationEndpoint?.browseEndpoint?.browseId === 'string' && run.navigationEndpoint.browseEndpoint.browseId.startsWith('UC')).map(run => run.text).filter(text => typeof text === 'string') : [];
  if (artists.length) return artists.join(', ');
  return textFromRuns(column).split(/\s*[•·]\s*/).filter(part => part && !/^(song|video)$/i.test(part) && !/^\d+:\d+(?::\d+)?$/.test(part)).join(' · ');
}

function parseDurationFromColumns(columns, metadata) {
  if (!Array.isArray(columns)) return 0;
  for (const col of columns) {
    const text = columnText(col);
    let txt = rendererText(text);
    if (metadata) {
      // Inline lengths are the final unlinked metadata segment. Linked artist
      // names or album titles resembling timestamps must not satisfy the limit.
      const runs = Array.isArray(text?.runs) ? text.runs : [];
      const last = runs.filter(run => typeof run?.text === 'string' && run.text.trim()).at(-1);
      if (last?.navigationEndpoint) continue;
      txt = txt.split(/\s*[•·]\s*/).at(-1);
    }
    const m = txt.match(/^(\d{1,2}):(\d{2})(?::(\d{2}))?$/);
    if (m && +m[2] < 60 && (!m[3] || +m[3] < 60)) {
      const a = +m[1], b = +m[2], c = m[3] ? +m[3] : null;
      return c == null ? a * 60 + b : a * 3600 + b * 60 + c;
    }
  }
  return 0;
}
