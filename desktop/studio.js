import http from 'node:http';
import { readFile } from 'node:fs/promises';
import { createHash, randomBytes, timingSafeEqual } from 'node:crypto';
import { normalizePlayback, artworkUrl, boundedBody, LastFmClient } from '../src/playback.js';
import { appearance } from './appearance.js';
import { InputError } from '../src/validation.js';

export class PlaybackStudio {
  #controller; #fetch; #decode; #art = null; #artSource = ''; #generation = 0; #lastfm; #key = ''; #token = ''; #polling; #server; #timer; #closed = false;
  constructor(controller, { fetcher = fetch, decode = data => data } = {}) {
    this.#controller = controller; this.#fetch = fetcher; this.#decode = decode;
    this.track = null; this.metadata = { state: 'disabled' }; this.overlayState = 'disabled';
  }
  async start() { this.#closed = false; await this.configure(); void this.poll(); this.#timer = setInterval(() => void this.poll(), 2000); this.#timer.unref?.(); }
  async configure() {
    const env = this.#controller.env;
    const key = env.LASTFM_ENABLED === 'true' ? env.LASTFM_KEY || '' : '';
    if (this.#key !== key) { this.#key = key; this.#lastfm = new LastFmClient(key, this.#fetch); this.metadata = { state: 'disabled' }; this.metadataTrack = ''; this.#generation++; }
    const a = appearance(env);
    if (this.#server && (a.OVERLAY_ENABLED !== 'true' || this.#server.address()?.port !== Number(a.OVERLAY_PORT) || this.#token !== env.OVERLAY_TOKEN)) await this.stopOverlay();
    if (a.OVERLAY_ENABLED === 'true' && !this.#server) await this.startOverlay();
    if (a.OVERLAY_ENABLED !== 'true') this.overlayState = 'disabled';
  }
  async poll() {
    if (this.#closed || this.#polling) return;
    this.#polling = this.#poll();
    try { await this.#polling; } finally { this.#polling = null; }
  }
  async #poll() {
    const c = this.#controller, engine = c.engine;
    if (c.busy) return;
    if (engine.lifecycle !== 'running' || engine.config.dryRun || !engine.config.token) { this.track = null; return; }
    const generation = this.#generation, engineGeneration = engine.generation;
    await engine.testPlayer();
    if (this.#closed || c.busy || generation !== this.#generation || engineGeneration !== engine.generation || engine.lifecycle !== 'running') return;
    this.track = engine.playerState === 'ready' ? normalizePlayback(engine.currentTrack) : null;
    this.trackGeneration = engineGeneration;
    const raw = this.track ? engine.currentTrack : null;
    const source = artworkUrl(raw?.imageSrc);
    if (!source) { this.#art = null; this.#artSource = ''; }
    else if (source !== this.#artSource || (!this.#art && Date.now() > (this.artRetry || 0))) {
      this.#artSource = source; this.#art = null; this.artRetry = Date.now() + 60000;
      // Artwork is fetched only when changed/missing, never on every progress tick.
      void this.loadArt(source, generation);
    }
    const trackKey = this.track ? JSON.stringify([this.track.title, this.track.artist]) : '';
    if (trackKey !== this.metadataTrack || Date.now() > (this.metadataRetry || 0)) {
      this.metadataTrack = trackKey; this.metadata = { state: this.#key && trackKey ? 'loading' : 'disabled' }; this.metadataRetry = Date.now() + 300000;
      if (this.#key && trackKey) {
        const client = this.#lastfm;
        void client.read(this.track).then(value => { if (!this.#closed && client === this.#lastfm && this.metadataTrack === trackKey) this.metadata = value; });
      }
    }
  }
  async loadArt(source, generation) {
    try {
      const response = await this.#fetch(source, { redirect: 'error', signal: AbortSignal.timeout(5000), headers: { Accept: 'image/webp,image/png,image/jpeg' } });
      if (!response.ok || !/^image\/(jpeg|png|webp)(;|$)/i.test(response.headers.get('content-type') || '')) { await response.body?.cancel(); return; }
      const data = this.#decode(await boundedBody(response, 2 * 1024 * 1024));
      if (!data || data.length > 2 * 1024 * 1024 || generation !== this.#generation || this.#artSource !== source || this.#closed) return;
      this.#art = { data, hash: createHash('sha256').update(data).digest('hex').slice(0, 16) };
    } catch { /* Artwork is optional. Keep the designed placeholder and bounded retry. */ }
  }
  snapshot({ overlay = false } = {}) {
    const c = this.#controller;
    const live = c.engine.lifecycle === 'running' && c.engine.playerState === 'ready' && !c.engine.config.dryRun && this.trackGeneration === c.engine.generation;
    const track = live && this.track && Date.now() - this.track.updatedAt < 10000 ? { ...this.track } : null;
    return { track, art: track && this.#art ? (overlay ? `./art.png?v=${this.#art.hash}` : `pearconnect://desktop/artwork/${this.#art.hash}.png`) : null,
      appearance: appearance(c.env), ...(overlay ? {} : { metadata: track ? this.metadata : { state: 'disabled' }, hasLastfmKey: !!c.env.LASTFM_KEY, overlayState: this.overlayState }) };
  }
  artwork(hash) { return this.#art && this.#art.hash === hash && this.snapshot().track ? this.#art.data : null; }
  async similar() {
    if (!this.#key || !this.track) throw new InputError('Enable Last.fm and play a track with an artist first.');
    const id = this.metadataTrack, value = await this.#lastfm.read(this.track, true);
    return this.metadataTrack === id ? value : { state: 'changed', tracks: [] };
  }
  overlayUrl() { if (!this.#server || this.overlayState !== 'ready') throw new InputError('Enable the overlay server first.'); return `http://127.0.0.1:${this.#server.address().port}/widget/${this.#token}/index.html`; }
  async startOverlay() {
    const env = this.#controller.env;
    if (!/^[a-f\d]{64}$/.test(env.OVERLAY_TOKEN || '')) { this.overlayState = 'not_configured'; return; }
    this.#token = env.OVERLAY_TOKEN;
    const assets = new Map();
    for (const name of ['overlay.html', 'overlay.js', 'widget.js', 'widget.css']) assets.set(name, await readFile(new URL(name, import.meta.url)));
    const server = http.createServer((req, res) => {
      const origin = `http://127.0.0.1:${server.address()?.port}`;
      const send = (status, type, body) => { res.writeHead(status, { 'Content-Type': type, 'Cache-Control': 'no-store', 'X-Content-Type-Options': 'nosniff', 'Referrer-Policy': 'no-referrer', 'X-Robots-Tag': 'noindex, nofollow', 'Content-Security-Policy': "default-src 'none'; script-src 'self'; style-src 'self'; img-src 'self'; connect-src 'self'; frame-ancestors 'none'; base-uri 'none'; form-action 'none'" }); res.end(req.method === 'HEAD' ? undefined : body); };
      if (!['GET', 'HEAD'].includes(req.method) || req.headers.host !== origin.slice(7) || (req.headers.origin && req.headers.origin !== origin)) return send(403, 'text/plain', 'Not permitted');
      const match = /^\/widget\/([a-f\d]{64})\/(index\.html|state|art\.png|widget\.js|widget\.css|overlay\.js)(?:\?v=[a-f\d]{16})?$/.exec(req.url || '');
      if (!match || !timingSafeEqual(Buffer.from(match[1]), Buffer.from(this.#token))) return send(404, 'text/plain', 'Not found');
      const name = match[2];
      if (name === 'state') return send(200, 'application/json', JSON.stringify(this.snapshot({ overlay: true })));
      if (name === 'art.png') return send(this.#art && this.snapshot().track ? 200 : 404, 'image/png', this.#art && this.snapshot().track ? this.#art.data : '');
      return send(200, name.endsWith('.css') ? 'text/css' : name.endsWith('.js') ? 'text/javascript' : 'text/html', assets.get(name === 'index.html' ? 'overlay.html' : name));
    });
    server.maxConnections = 32; server.requestTimeout = 5000; server.headersTimeout = 5000; server.keepAliveTimeout = 1000;
    try {
      await new Promise((resolve, reject) => { server.once('error', reject); server.listen(Number(appearance(env).OVERLAY_PORT), '127.0.0.1', resolve); });
      server.on('error', () => { this.overlayState = 'error'; }); this.#server = server; this.overlayState = 'ready';
    } catch { this.overlayState = 'port_unavailable'; server.close(); }
  }
  async stopOverlay() { const server = this.#server; this.#server = null; if (server) await new Promise(resolve => { server.close(resolve); server.closeAllConnections(); }); }
  async close() { this.#closed = true; clearInterval(this.#timer); this.#generation++; await this.stopOverlay(); this.track = null; this.#art = null; }
}
export const newOverlayToken = () => randomBytes(32).toString('hex');
