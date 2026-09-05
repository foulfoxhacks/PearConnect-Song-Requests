// Public playback data only. Never copy the raw player response into a window or overlay.
const text = (value, max = 300) => typeof value === 'string' ? value.slice(0, max).replace(/[\u0000-\u001f]/g, '') : '';
const seconds = value => typeof value === 'number' && Number.isFinite(value) && value >= 0 && value <= 604800 ? value : null;
export function normalizePlayback(raw, updatedAt = Date.now()) {
  if (!raw || typeof raw !== 'object' || !text(raw.title)) return null;
  const duration = seconds(raw.songDuration), elapsed = seconds(raw.elapsedSeconds);
  return { title: text(raw.title), artist: text(raw.artist), album: text(raw.album),
    videoId: /^[\w-]{11}$/.test(raw.videoId || '') ? raw.videoId : '',
    duration: duration > 0 ? duration : null, elapsed: elapsed === null ? null : duration > 0 ? Math.min(elapsed, duration) : elapsed,
    paused: typeof raw.isPaused === 'boolean' ? raw.isPaused : null, updatedAt };
}

export function artworkUrl(raw) {
  try {
    const url = new URL(raw);
    if (url.protocol !== 'https:' || url.username || url.password || url.port || url.hash) return null;
    if (!['i.ytimg.com', 'i1.ytimg.com', 'i2.ytimg.com', 'i3.ytimg.com', 'i4.ytimg.com', 'lh3.googleusercontent.com', 'lh4.googleusercontent.com'].includes(url.hostname)) return null;
    return url.href;
  } catch { return null; }
}

export async function boundedBody(response, maximum) {
  if (Number(response.headers.get('content-length')) > maximum) { await response.body?.cancel(); throw new Error('Response exceeds limit.'); }
  const reader = response.body?.getReader(); if (!reader) return Buffer.alloc(0);
  const chunks = []; let size = 0;
  try { for (;;) { const { value, done } = await reader.read(); if (done) break; size += value.byteLength; if (size > maximum) throw new Error('Response exceeds limit.'); chunks.push(value); } }
  catch (error) { await reader.cancel().catch(() => {}); throw error; }
  finally { reader.releaseLock(); }
  return Buffer.concat(chunks);
}

export function lastfmUrl(value) {
  try { const url = new URL(value); return url.protocol === 'https:' && url.hostname === 'www.last.fm' && !url.username && !url.password && !url.port && url.pathname.startsWith('/music/') ? url.href : null; } catch { return null; }
}
export class LastFmClient {
  #key; #fetch; #cache = new Map(); #pending = new Map();
  constructor(key, fetcher = fetch) { this.#key = key; this.#fetch = fetcher; }
  async read(track, similar = false) {
    if (!track?.title || !track.artist || !this.#key) return { state: 'disabled' };
    const id = JSON.stringify([track.artist, track.title, similar]);
    const cached = this.#cache.get(id); if (cached?.expires > Date.now()) return cached.value;
    if (this.#pending.has(id)) return this.#pending.get(id);
    if (this.#pending.size >= 2) return { state: 'unavailable' };
    const request = this.#request(track, similar).then(({ value, ttl }) => {
      if (this.#cache.size >= 30) this.#cache.delete(this.#cache.keys().next().value);
      if (ttl) this.#cache.set(id, { value, expires: Date.now() + ttl });
      return value;
    }).finally(() => this.#pending.delete(id));
    this.#pending.set(id, request); return request;
  }
  async #request(track, similar) {
    try {
      const url = new URL('https://ws.audioscrobbler.com/2.0/');
      url.search = new URLSearchParams({ method: similar ? 'track.getSimilar' : 'track.getInfo', artist: track.artist, track: track.title, api_key: this.#key, format: 'json', autocorrect: '1', ...(similar ? { limit: '6' } : {}) }).toString();
      const response = await this.#fetch(url, { redirect: 'error', signal: AbortSignal.timeout(6000), headers: { Accept: 'application/json' } });
      if (!response.ok) { await response.body?.cancel(); throw new Error('Unavailable'); }
      const raw = JSON.parse((await boundedBody(response, 256 * 1024)).toString('utf8'));
      if (raw.error) return { value: { state: [10, 26].includes(raw.error) ? 'invalid_key' : raw.error === 6 ? 'not_found' : 'unavailable' }, ttl: 60000 };
      const count = value => /^\d{1,16}$/.test(String(value)) ? String(value) : null;
      const value = similar ? { state: 'ready', tracks: (Array.isArray(raw.similartracks?.track) ? raw.similartracks.track : []).slice(0, 6).map(t => ({ title: text(t.name), artist: text(t.artist?.name), url: lastfmUrl(t.url) })).filter(t => t.title && t.url) } : raw.track ? {
        state: 'ready', url: lastfmUrl(raw.track.url), listeners: count(raw.track.listeners), playcount: count(raw.track.playcount),
        tags: (Array.isArray(raw.track.toptags?.tag) ? raw.track.toptags.tag : []).slice(0, 4).map(t => text(t.name, 40)).filter(Boolean),
      } : { state: 'not_found' };
      const control = response.headers.get('cache-control') || '';
      const maxAge = /max-age=(\d+)/i.exec(control);
      const ttl = /no-store|no-cache/i.test(control) ? 0 : maxAge ? Math.min(Number(maxAge[1]) * 1000, 3600000) : 300000;
      return { value, ttl };
    } catch { return { value: { state: 'unavailable' }, ttl: 60000 }; }
  }
}
