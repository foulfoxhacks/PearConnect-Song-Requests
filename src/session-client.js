import { InputError } from './validation.js';

export const SESSION_ORIGIN = 'https://pearconnect.mellozone.site';
const CODE = /^[A-HJ-NP-Z2-9]{8}$/;
const TOKEN = /^[a-f0-9]{64}$/;

// Native outbound HTTPS only. No public access to the local player or webhook is needed.
export class SessionClient {
  #credential;
  constructor(engine, { origin = SESSION_ORIGIN, fetcher = fetch, intervalMs = 2000 } = {}) {
    this.engine = engine; this.origin = origin; this.fetcher = fetcher; this.intervalMs = intervalMs;
    this.info = null; this.revision = -1; this.stopped = true; this.tasks = new Set(); this.generation = 0;
  }
  snapshot() { return this.info ? { ...this.info } : null; }
  async request(path, body = {}, authenticated = true) {
    let response;
    try {
      response = await this.fetcher(`${this.origin}/api/session/${path}`, { method: 'POST', redirect: 'error', signal: AbortSignal.timeout(8000),
        headers: { 'Content-Type': 'application/json', ...(authenticated && this.#credential ? { Authorization: `Bearer ${this.#credential}` } : {}) }, body: JSON.stringify(body) });
      if (!response.headers.get('content-type')?.includes('application/json')) throw new Error();
      const reader = response.body.getReader(); const chunks = []; let size = 0;
      try { while (true) { const { value, done } = await reader.read(); if (done) break; size += value.length; if (size > 65536) { await reader.cancel(); throw new Error(); } chunks.push(value); } }
      finally { reader.releaseLock(); }
      const data = JSON.parse(Buffer.concat(chunks).toString('utf8'));
      if (!response.ok || data.ok === false) {
        const error = new InputError(typeof data.message === 'string' ? data.message.slice(0, 1200) : 'Session service unavailable.');
        error.code = data.code; throw error;
      }
      return data;
    } catch (error) {
      if (error instanceof InputError) throw error;
      throw new InputError('Session connection interrupted. Check the existing request result before retrying.');
    }
  }
  async create(minutes) {
    if (this.#credential) throw new InputError('End the current session before creating another code.');
    if (!Number.isInteger(minutes) || minutes < 15 || minutes > 1440) throw new InputError('Choose 15 to 1440 minutes.');
    if (this.engine.lifecycle !== 'running' || this.engine.playerState !== 'ready' || this.engine.config.dryRun) throw new InputError('Connect a real Pear Desktop player before creating a website session.');
    if (this.engine.config.requestAllowlist.length) throw new InputError('Website visitors cannot verify chat identities. A restricted request list keeps website requests disabled.');
    this.engine.pauseRequests();
    await Promise.allSettled([...this.engine.active]);
    const result = await this.request('create', { minutes }, false);
    if (!CODE.test(result.code) || !TOKEN.test(result.ownerToken) || !Number.isFinite(result.expiresAt)) throw new InputError('The session service returned an invalid session.');
    this.#credential = result.ownerToken; this.info = this.publicInfo(result); this.stopped = false; this.revision = result.revision;
    this.generation++;
    this.engine.setWebFallback(true);
    await this.tick();
    return this.snapshot();
  }
  publicInfo(data) {
    return { code: data.code, expiresAt: data.expiresAt, enabled: data.enabled === true, ended: data.ended === true,
      online: data.online === true, accepting: data.accepting === true, state: 'connected',
      url: `${this.origin}/sessioncode#${data.code}`, message: data.accepting ? 'Website requests enabled.' : 'Website requests paused. TikTok command intake is suspended for this session.' };
  }
  ready() { return this.engine.lifecycle === 'running' && this.engine.playerState === 'ready' && !this.engine.config.dryRun && !this.engine.config.requestAllowlist.length; }
  async tick() {
    if (this.stopped) return;
    const generation = this.generation;
    try {
      const result = await this.request(`${this.info.code}/poll`, { ready: this.ready(), intake: this.engine.requestsEnabled && this.engine.webFallback });
      if (this.stopped || generation !== this.generation) return;
      if (result.revision >= this.revision) this.info = this.publicInfo(result);
      if (result.revision > this.revision) {
        this.revision = result.revision;
        if (result.enabled && this.ready()) this.engine.resumeRequests(); else this.engine.pauseRequests();
      }
      if (result.request) {
        const task = this.process(result.request);
        this.tasks.add(task); task.finally(() => this.tasks.delete(task)).catch(() => {});
      }
      this.engine.changed();
    } catch (error) {
      if (this.stopped || generation !== this.generation) return;
      this.engine.pauseRequests();
      this.info = { ...this.info, accepting: false, state: ['session_expired', 'unauthorized'].includes(error.code) ? 'expired' : 'disconnected', message: error.message };
      // Reconnection never silently enables intake after an error.
      if (this.info.state === 'expired') { this.stopped = true; this.engine.setWebFallback(false); this.#credential = null; }
    } finally {
      if (!this.stopped && generation === this.generation) { this.timer = setTimeout(() => this.tick(), this.intervalMs); this.timer.unref?.(); }
    }
  }
  async process(row) {
    if (typeof row.id !== 'string' || typeof row.userId !== 'string' || !Number.isFinite(row.deadline)) return;
    const code = this.info.code;
    const result = await this.engine.execute('request', { user: row.name, userId: row.userId, query: row.query, platform: 'web',
      beforeEnqueue: async () => {
        if (this.stopped || Date.now() >= row.deadline || !this.ready()) return false;
        try { return (await this.request(`${code}/permit`, { id: row.id })).permitted === true; } catch { return false; }
      } }, 'web');
    try { await this.request(`${code}/complete`, { id: row.id, result }); }
    catch { this.engine.log.warn('[session] Result delivery failed. The website may show an uncertain outcome; request will not be sent again.'); }
  }
  async update(values) {
    if (!this.#credential || this.stopped) throw new InputError('Create a new session in Desktop first.');
    if (values.enabled === false || values.end) this.engine.pauseRequests();
    const result = await this.request(`${this.info.code}/update`, values);
    this.info = this.publicInfo(result);
    if (typeof values.enabled === 'boolean') {
      this.revision = result.revision;
      if (values.enabled && this.ready()) this.engine.resumeRequests(); else this.engine.pauseRequests();
    }
    return this.snapshot();
  }
  async pairingUrl() {
    if (!this.#credential || this.stopped) throw new InputError('Create a session before pairing the dashboard.');
    const result = await this.request(`${this.info.code}/pair-link`);
    if (!TOKEN.test(result.pairingToken)) throw new InputError('Invalid pairing response.');
    return `${this.origin}/web/dashboard#pair=${this.info.code}.${result.pairingToken}`;
  }
  async close() {
    this.stopped = true; this.generation++; clearTimeout(this.timer); this.engine.setWebFallback(false); this.engine.pauseRequests();
    const credential = this.#credential;
    if (credential && this.info) {
      try { await this.request(`${this.info.code}/update`, { end: true }); }
      catch { /* Offline session rejects delivery and expires on its configured deadline. */ }
    }
    await Promise.allSettled([...this.tasks]);
    this.#credential = null; this.info = null;
  }
}
