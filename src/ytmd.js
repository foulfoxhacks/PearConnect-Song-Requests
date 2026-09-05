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
  async search(query) {
    const data = await this.#req('POST', `${API}/search`, { query });
    return data;
  }

  /**
   * Search and return the first usable {videoId, title, artist, durationSec}
   * or null if nothing matched.
   */
  async findFirstSong(query) {
    const data = await this.search(query);
    return extractFirstSong(data);
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
export function extractFirstSong(data) {
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
      if (!videoId) return;
      const title = textFromRuns(r.flexColumns?.[0]);
      const artistish = textFromRuns(r.flexColumns?.[1]);
      const durationSec = parseDurationFromColumns([...(r.fixedColumns || []), ...(r.flexColumns || [])]);
      found.push({ videoId, title: title || '(unknown)', artist: artistish || '', durationSec });
    }
  });
  return found[0] || null;
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
  const runs =
    column?.musicResponsiveListItemFixedColumnRenderer?.text?.runs ||
    column?.musicResponsiveListItemFlexColumnRenderer?.text?.runs ||
    column?.text?.runs;
  if (!Array.isArray(runs)) return '';
  return runs.map((r) => r.text || '').join('').trim();
}

function parseDurationFromColumns(columns) {
  if (!Array.isArray(columns)) return 0;
  for (const col of columns) {
    const txt = textFromRuns(col);
    const m = txt.match(/^(\d{1,2}):(\d{2})(?::(\d{2}))?$/);
    if (m && +m[2] < 60 && (!m[3] || +m[3] < 60)) {
      const a = +m[1], b = +m[2], c = m[3] ? +m[3] : null;
      return c == null ? a * 60 + b : a * 3600 + b * 60 + c;
    }
  }
  return 0;
}
