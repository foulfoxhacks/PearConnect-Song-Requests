import { randomBytes } from 'node:crypto';
import { PearConnectEngine, validateRuleUpdates } from '../src/engine.js';
import { YTMDClient } from '../src/ytmd.js';
import { InputError } from '../src/validation.js';
import { validateSettings, CONNECTION_KEYS } from './settings.js';
import { SessionClient } from '../src/session-client.js';
import { appearance, validateAppearance } from './appearance.js';
import { newOverlayToken } from './studio.js';

export class DesktopController {
  constructor(store, { engineOptions = {}, sessionOptions = {} } = {}) { this.store = store; this.engineOptions = engineOptions; this.sessionOptions = sessionOptions; this.busy = false; }
  async init() {
    this.env = await this.store.read() || { CONNECTION_MODE: 'simple', REQUESTS_ENABLED: 'false', TIKFINITY_SECRET: randomBytes(32).toString('hex') };
    const config = validateSettings(this.env);
    config.requestsEnabled = false; // Every desktop launch requires deliberate enable, including migration.
    this.engine = new PearConnectEngine(config, this.engineOptions);
    this.session = new SessionClient(this.engine, this.sessionOptions);
    try { await this.engine.start(); } catch (error) { this.startupError = error.code === 'ENGINE_RUNNING' ? error.message : 'Could not start the engine. Check the webhook port in Connections and retry.'; }
    return this.snapshot();
  }
  snapshot() {
    return { status: this.engine.status(), rules: this.engine.ruleValues(), session: this.session?.snapshot(), sessionMinutes: this.env.SESSION_MINUTES || '240',
      studio: this.studio?.snapshot() || { appearance: appearance(this.env), track: null, metadata: { state: 'disabled' }, overlayState: 'disabled', hasLastfmKey: !!this.env.LASTFM_KEY },
      connections: Object.fromEntries(CONNECTION_KEYS.map(key => [key, this.env[key] || ({ YTMD_HOST: this.engine.config.host, YTMD_CLIENT_ID: this.engine.config.clientId, YTMD_TIMEOUT_MS: String(this.engine.config.timeoutMs), TIKFINITY_WS_URL: this.engine.config.websocketUrl, TIKFINITY_PORT: String(this.engine.config.port) }[key] || '')])),
      hasPlayerCredential: !!this.env.YTMD_TOKEN, hasTwitchCredential: !!this.env.TWITCH_OAUTH,
      secureStorage: this.store.encryptionAvailable(), startupError: this.startupError || null };
  }
  async serialized(fn) {
    if (this.busy) throw new InputError('A setup operation is already in progress.');
    this.busy = true;
    try { return await fn(); } finally { this.busy = false; }
  }
  async saveAppearance(values) {
    return this.serialized(async () => {
      validateAppearance(values);
      const next = { ...this.env, ...values };
      if (values.LASTFM_KEY === '') next.LASTFM_KEY = this.env.LASTFM_KEY || '';
      if (next.OVERLAY_ENABLED === 'true' && !next.OVERLAY_TOKEN) next.OVERLAY_TOKEN = newOverlayToken();
      await this.store.write(next); this.env = next;
      await this.studio?.configure(); return this.snapshot();
    });
  }
  async removeLastfm() { return this.serialized(async () => { const next = { ...this.env, LASTFM_KEY: '', LASTFM_ENABLED: 'false' }; await this.store.write(next); this.env = next; await this.studio?.configure(); return this.snapshot(); }); }
  async rotateOverlay() { return this.serialized(async () => { const next = { ...this.env, OVERLAY_TOKEN: newOverlayToken() }; await this.store.write(next); this.env = next; await this.studio?.configure(); return this.snapshot(); }); }
  async saveRules(values) {
    return this.serialized(async () => {
      validateRuleUpdates(values, this.engine.ruleValues());
      const next = { ...this.env, ...this.engine.ruleValues(), ...values };
      // Persist before applying: a failed save must never temporarily relax live permissions.
      await this.store.write(next);
      this.engine.updateRules(values); this.env = next;
      return this.snapshot();
    });
  }
  async changeMode(mode) {
    return this.serialized(async () => {
      if (!['simple', 'advanced'].includes(mode)) throw new InputError('Choose Simple or Advanced.');
      if (this.session?.info) await this.session.close();
      const next = { ...this.env, CONNECTION_MODE: mode, REQUESTS_ENABLED: 'false' };
      await this.store.write(next); this.env = next;
      await this.engine.setMode(mode); return this.snapshot();
    });
  }
  async reconfigure(next) {
    const config = validateSettings(next); config.requestsEnabled = false;
    await this.store.write(next);
    await this.session?.close();
    await this.engine.stop();
    this.env = next;
    await this.studio?.configure();
    // Preserve the QueueManager and its counters/history while replacing connections.
    const e = this.engine;
    e.config = config;
    e.player.host = config.host; e.player.token = config.token; e.player.timeoutMs = config.timeoutMs;
    e.queue.dryRun = config.dryRun;
    e.updateRules(Object.fromEntries(Object.entries(next).filter(([key]) => key in e.ruleValues())));
    e.requestsEnabled = false; this.startupError = null;
    try { await e.start(); } catch (error) { this.startupError = error.code === 'ENGINE_RUNNING' ? error.message : 'Engine could not restart. Check the webhook port and retry Connect.'; }
    return this.snapshot();
  }
  async saveConnections(values) {
    return this.serialized(async () => {
      if (!values || typeof values !== 'object' || Array.isArray(values) || Object.keys(values).some(key => ![...CONNECTION_KEYS, 'TWITCH_OAUTH'].includes(key)) || Object.values(values).some(value => typeof value !== 'string')) throw new InputError('Invalid connection fields.');
      const next = { ...this.env, ...values, REQUESTS_ENABLED: 'false' };
      if (values.YTMD_HOST && new URL(values.YTMD_HOST).origin !== this.engine.config.host) next.YTMD_TOKEN = '';
      if (values.TWITCH_OAUTH === '') next.TWITCH_OAUTH = this.env.TWITCH_OAUTH || '';
      return this.reconfigure(next);
    });
  }
  async authorize() {
    return this.serialized(async () => {
      const guided = !!this.engine.verification;
      if (!this.store.encryptionAvailable()) throw new InputError('Restore secure credential storage before authorizing.');
      this.engine.playerState = 'awaiting_authorization'; this.engine.changed();
      let token;
      try { token = await YTMDClient.requestToken({ host: this.engine.config.host, clientId: this.engine.config.clientId }); }
      catch { this.engine.playerState = 'disconnected'; throw new InputError('Authorization failed or timed out. Open Pear Desktop, enable the API Server plugin and approve PearConnect.'); }
      await this.reconfigure({ ...this.env, YTMD_TOKEN: token, REQUESTS_ENABLED: 'false' });
      if (guided && this.engine.lifecycle === 'running') this.engine.beginVerification();
      return this.snapshot();
    });
  }
  async rotateSecret() {
    return this.serialized(async () => this.reconfigure({ ...this.env, TIKFINITY_SECRET: randomBytes(32).toString('hex'), REQUESTS_ENABLED: 'false' }));
  }
  async importEnv(values) {
    return this.serialized(async () => this.reconfigure({ ...values, CONNECTION_MODE: values.CONNECTION_MODE || 'advanced', REQUESTS_ENABLED: 'false' }));
  }
  async reconnect() { return this.serialized(() => this.reconfigure({ ...this.env, REQUESTS_ENABLED: 'false' })); }
  async createSession(values) {
    return this.serialized(async () => {
      const duration = Number(values?.minutes);
      if (!Number.isInteger(duration) || duration < 15 || duration > 1440) throw new InputError('Choose 15 to 1440 minutes.');
      const next = { ...this.env, SESSION_MINUTES: String(duration) };
      await this.store.write(next); this.env = next;
      await this.session.create(duration); return this.snapshot();
    });
  }
  async updateSession(values) {
    return this.serialized(async () => {
      if (!values || typeof values !== 'object' || Array.isArray(values) || Object.keys(values).some(k => !['minutes', 'enabled', 'unpair'].includes(k))) throw new InputError('Unsupported session setting.');
      const update = { ...values };
      if (update.minutes !== undefined) {
        update.minutes = Number(update.minutes);
        if (!Number.isInteger(update.minutes) || update.minutes < 15 || update.minutes > 1440) throw new InputError('Choose 15 to 1440 minutes.');
        const next = { ...this.env, SESSION_MINUTES: String(update.minutes) }; await this.store.write(next); this.env = next;
      }
      await this.session.update(update); return this.snapshot();
    });
  }
  async intake(enabled) {
    if (!enabled) this.engine.pauseRequests();
    if (this.session?.info && !this.session.stopped) await this.session.update({ enabled });
    else if (enabled) this.engine.resumeRequests();
    return this.snapshot();
  }
  async endSession() { return this.serialized(async () => { await this.session.close(); return this.snapshot(); }); }
  async stop() { await this.session?.close(); await this.engine.stop(); }
}
