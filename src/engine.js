import { EventEmitter } from 'node:events';
import { YTMDClient } from './ytmd.js';
import { QueueManager } from './queue-manager.js';
import { loadConfig } from './config.js';
import { validatePayload, InputError } from './validation.js';
import { createLogger, diagnosticReport, redact } from './diagnostics.js';
import { acquireInstance } from './instance.js';
import { startTikfinity } from './platforms/tikfinity.js';

const methods = { request: 'handleRequest', nowPlaying: 'handleNowPlaying', queue: 'handleQueuePeek', skip: 'handleSkip' };
export const RULE_KEYS = ['COOLDOWN_SECONDS', 'MAX_SONG_SECONDS', 'MAX_PER_USER', 'BLOCKLIST', 'REQUEST_ALLOWLIST', 'SKIP_ALLOWLIST', 'CMD_REQUEST', 'CMD_NOWPLAYING', 'CMD_QUEUE', 'CMD_SKIP'];

export class PearConnectEngine extends EventEmitter {
  constructor(config, { player = new YTMDClient(config), logger, lock = acquireInstance, startSocket, startWebhook = startTikfinity, connectPlatforms = true } = {}) {
    super();
    this.config = config;
    this.player = player;
    this.lock = lock;
    this.startSocket = startSocket;
    this.startWebhook = startWebhook;
    this.connectPlatforms = connectPlatforms;
    this.logs = [];
    this.activity = [];
    this.active = new Set();
    this.generation = 0;
    this.sequence = 0;
    this.lifecycle = 'stopped';
    this.playerState = config.dryRun ? 'dry_run' : config.token ? 'disconnected' : 'not_configured';
    this.requestsEnabled = config.requestsEnabled;
    this.input = { state: 'disconnected', lastEventAt: null, lastChatAt: null, lastCommandAt: null, invalidEvents: 0 };
    this.log = logger || createLogger({ secrets: () => [this.config.token, this.config.secret, this.config.twitch.oauth], onLog: entry => {
      this.logs.push(entry); if (this.logs.length > 200) this.logs.shift();
    } });
    this.queue = new QueueManager({ ...config, ytmd: player, logger: this.log, requestCommand: config.commands.request });
  }

  status() {
    const clean = value => redact(value, [this.config.token, this.config.secret, this.config.twitch.oauth]);
    return {
      lifecycle: this.lifecycle, connectionMode: this.config.connectionMode, dryRun: this.config.dryRun,
      requestsEnabled: this.requestsEnabled, player: this.playerState,
      currentTrack: this.currentTrack ? { title: clean(this.currentTrack.title || ''), artist: clean(this.currentTrack.artist || '') } : null,
      input: { ...this.input },
      chatReplies: this.config.connectionMode === 'simple' ? 'not_configured' : 'external_configuration',
      activity: this.activity.map(entry => ({ ...entry, user: clean(entry.user), query: clean(entry.query), message: clean(entry.message || '') })),
      logs: this.logs.map(entry => ({ ...entry, message: clean(entry.message) })),
    };
  }

  changed() { this.emit('status', this.status()); }
  diagnostics() { return diagnosticReport(this.status()); }

  adapter(source) {
    const engine = this;
    return { ytmd: this.player, ...Object.fromEntries(Object.entries(methods).map(([command, method]) => [method, data => engine.execute(command, data, source)])) };
  }

  async start({ strictPlayer = false } = {}) {
    if (this.lifecycle !== 'stopped') throw new Error('Engine has already started.');
    this.lifecycle = 'starting';
    try {
      this.releaseLock = await this.lock();
      await this.testPlayer();
      if (strictPlayer && !['ready', 'dry_run'].includes(this.playerState)) throw new Error('Pear Desktop is unavailable or unauthorized.');
      this.server = await this.startWebhook({ ...this.config, log: this.log, queue: this.adapter('advanced'), getStatus: () => this.status(), getDiagnostics: () => this.diagnostics() });
      this.lifecycle = 'running';
      await this.connectInput();
      if (!this.config.dryRun && this.connectPlatforms) {
        const [{ startTwitch }, { startYouTube }] = await Promise.all([import('./platforms/twitch.js'), import('./platforms/youtube.js')]);
        const shared = { commands: this.config.commands, skipAllowlist: this.config.skipAllowlist, log: this.log };
        this.twitch = startTwitch({ ...shared, ...this.config.twitch, queue: this.adapter('twitch') });
        this.youtube = startYouTube({ ...shared, channelId: this.config.channelId, queue: this.adapter('youtube') });
      }
      this.changed();
    } catch (error) { await this.stop(); throw error; }
  }

  async connectInput() {
    if (this.config.connectionMode === 'simple') {
      const factory = this.startSocket || (await import('./platforms/tikfinity-ws.js')).startTikfinitySocket;
      this.socket = factory({ url: this.config.websocketUrl, commands: this.config.commands, queue: this.adapter('simple'), log: this.log,
        onStatus: status => { this.input = { ...this.input, ...status }; this.changed(); } });
    } else { this.input.state = this.server ? 'webhook_listening' : 'disabled'; this.changed(); }
  }

  async testPlayer() {
    if (this.config.dryRun) { this.playerState = 'dry_run'; this.changed(); return { ok: true, code: 'dry_run' }; }
    if (!this.config.token) { this.playerState = 'not_configured'; this.changed(); return { ok: false, code: 'not_configured' }; }
    // Coalesce dashboard/health polling without creating unbounded upstream reads.
    if (this.playerCheck) return this.playerCheck;
    this.playerCheck = (async () => {
      try { this.currentTrack = await this.player.getCurrentSong(); this.playerState = 'ready'; return { ok: true, code: 'reachable' }; }
      catch (error) { this.currentTrack = null; this.playerState = [401, 403].includes(error.status) ? 'unauthorized' : 'disconnected'; return { ok: false, code: this.playerState }; }
      finally { this.playerCheck = null; this.changed(); }
    })();
    return this.playerCheck;
  }

  validateRequest(payload) {
    const data = validatePayload(payload);
    const preview = new QueueManager({ ...this.config, ytmd: this.player, logger: this.log, dryRun: true, requestCommand: this.config.commands.request });
    return preview.handleRequest({ ...data, platform: 'tiktok' });
  }

  pauseRequests() { this.requestsEnabled = false; this.generation++; this.changed(); }
  resumeRequests() {
    if (this.lifecycle !== 'running') throw new InputError('Start the engine before enabling requests.');
    if (!['ready', 'dry_run'].includes(this.playerState)) throw new InputError('Connect and test Pear Desktop before enabling requests.');
    this.requestsEnabled = true; this.changed();
  }

  async setMode(mode) {
    if (!['simple', 'advanced'].includes(mode)) throw new InputError('Choose Simple or Advanced.');
    if (this.transitioning) throw new InputError('A connection change is already in progress.');
    if (mode === this.config.connectionMode) return;
    this.transitioning = true;
    this.pauseRequests();
    try {
      this.socket?.stop(); this.socket = null;
      await Promise.allSettled([...this.active]);
      this.config.connectionMode = mode;
      this.input = { state: 'disconnected', lastEventAt: null, lastChatAt: null, lastCommandAt: null, invalidEvents: 0 };
      if (this.lifecycle === 'running') await this.connectInput();
    } finally { this.transitioning = false; this.changed(); }
  }

  updateRules(values) {
    if (!values || typeof values !== 'object' || Array.isArray(values) || Object.keys(values).some(key => !RULE_KEYS.includes(key)) || Object.values(values).some(value => typeof value !== 'string' || value.length > 4096)) throw new InputError('Supply supported rule fields as strings.');
    const merged = { ...this.ruleValues(), ...values };
    const next = loadConfig({ ...merged, DRY_RUN: 'true' });
    for (const key of ['cooldownSeconds', 'maxSongSeconds', 'maxPerUser', 'blocklist', 'requestAllowlist']) this.config[key] = next[key];
    // Existing adapter references and accounting remain valid.
    Object.assign(this.config.commands, next.commands);
    this.config.skipAllowlist.splice(0, this.config.skipAllowlist.length, ...next.skipAllowlist);
    Object.assign(this.queue, { cooldown: next.cooldownSeconds * 1000, maxSongSeconds: next.maxSongSeconds, maxPerUser: next.maxPerUser,
      blocklist: next.blocklist.map(value => value.toLowerCase()), requestAllowlist: next.requestAllowlist, requestCommand: next.commands.request });
    this.changed(); return this.ruleValues();
  }

  ruleValues() {
    const c = this.config;
    return { COOLDOWN_SECONDS: String(c.cooldownSeconds), MAX_SONG_SECONDS: String(c.maxSongSeconds), MAX_PER_USER: String(c.maxPerUser),
      BLOCKLIST: c.blocklist.join(','), REQUEST_ALLOWLIST: c.requestAllowlist.join(','), SKIP_ALLOWLIST: c.skipAllowlist.join(','),
      CMD_REQUEST: c.commands.request, CMD_NOWPLAYING: c.commands.nowPlaying, CMD_QUEUE: c.commands.queue, CMD_SKIP: c.commands.skip };
  }

  execute(command, data, source) {
    const task = this.runCommand(command, data, source);
    this.active.add(task);
    task.finally(() => this.active.delete(task)).catch(() => {});
    return task;
  }

  async runCommand(command, data, source) {
    const reject = (code, message) => {
      try { Promise.resolve(data.reply?.(message)).catch(() => {}); } catch { /* Reply cannot alter result. */ }
      return { ok: false, code, message };
    };
    if (!methods[command]) return reject('invalid_input', 'Unknown command.');
    if (this.lifecycle !== 'running' || this.transitioning || (['simple', 'advanced'].includes(source) && source !== this.config.connectionMode)) return reject('input_disabled', 'This input route is inactive.');
    if (this.active.size >= 32) return reject('busy', 'Too many commands are processing. Try later.');
    let payload;
    try { payload = validatePayload(data); } catch (error) { return reject('invalid_input', error.message); }
    const entry = { id: ++this.sequence, time: new Date().toISOString(), user: payload.user, query: payload.query, command, source, state: 'received' };
    this.activity.push(entry); if (this.activity.length > 200) this.activity.shift();
    if (['advanced', 'simple'].includes(source)) this.input.lastCommandAt = entry.time;
    this.changed();
    const generation = this.generation;
    let result;
    if (command === 'request' && !this.requestsEnabled) result = reject('requests_paused', 'Song requests are paused. Existing playback continues.');
    else if (!this.config.dryRun && !this.config.token) result = reject('not_ready', 'Authorize Pear Desktop in Connections.');
    else {
      entry.state = 'checking'; this.changed();
      try {
        result = await this.queue[methods[command]]({ ...payload, platform: data.platform || 'tiktok', reply: data.reply,
          allowlist: this.config.skipAllowlist,
          canMutate: () => this.lifecycle === 'running' && this.requestsEnabled && generation === this.generation && !this.transitioning,
          onStage: stage => { entry.state = stage; this.changed(); } });
      } catch { result = reject('internal_error', 'Could not process this command. Check the player before retrying.'); }
    }
    entry.code = result.code; entry.message = result.message;
    entry.state = result.outcomeUncertain ? 'outcome_uncertain' : result.code === 'added' ? 'enqueue_confirmed' : result.ok ? 'completed' : ['upstream_error', 'upstream_timeout', 'internal_error', 'not_ready'].includes(result.code) ? 'failed' : 'rejected';
    if (['upstream_error', 'upstream_timeout'].includes(result.code)) this.playerState = 'disconnected';
    this.log.info(`[command] ${source}/${command}: ${result.code}`);
    this.changed(); return result;
  }

  async stop() {
    if (this.lifecycle === 'stopped') return;
    this.lifecycle = 'stopping'; this.pauseRequests();
    this.socket?.stop(); this.socket = null;
    try { this.youtube?.stop(); } catch { /* Already stopped. */ }
    await Promise.allSettled([...(this.twitch ? [Promise.resolve().then(() => this.twitch.disconnect())] : []), ...this.active]);
    if (this.server) await new Promise(resolve => { this.server.close(resolve); this.server.closeIdleConnections?.(); });
    this.server = null;
    await this.releaseLock?.(); this.releaseLock = null;
    this.lifecycle = 'stopped'; this.input.state = 'disconnected'; this.changed();
  }
}
