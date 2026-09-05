import { InputError, text } from './validation.js';
import { isAllowed } from './commands.js';

// Local policy and request accounting. Playback remains owned by Pear Desktop.
export class QueueManager {
  constructor({ ytmd, cooldownSeconds = 60, maxSongSeconds = 420, maxPerUser = 2,
    blocklist = [], requestAllowlist = [], logger = console, requestCommand = 'sr', dryRun = false, now = Date.now }) {
    this.ytmd = ytmd;
    this.cooldown = cooldownSeconds * 1000;
    this.maxSongSeconds = maxSongSeconds;
    this.maxPerUser = maxPerUser;
    this.blocklist = blocklist.map((s) => s.toLowerCase()).filter(Boolean);
    this.log = logger;
    this.requestCommand = requestCommand;
    this.requestAllowlist = requestAllowlist;
    this.dryRun = dryRun;
    this.now = now;
    this.lastRequest = new Map();
    this.pending = new Map();
    this.inFlight = new Set();
  }

  #reply(reply, ok, code, message, extra = {}) {
    // A failed chat reply must never roll back an already accepted music request.
    try {
      const task = reply?.(message);
      task?.catch?.(() => this.log.warn('[reply] Delivery failed. Request outcome is unchanged.'));
    } catch { this.log.warn('[reply] Delivery failed. Request outcome is unchanged.'); }
    return { ok, code, message, ...extra };
  }

  #cleanIdentity(user, userId = '') {
    user = text(user, 'user', { max: 100 }).replace(/^@/, '');
    if (!user) throw new InputError('user must not be empty.');
    userId = text(userId, 'userId', { max: 100, optional: true });
    return { user, userId };
  }

  #prune() {
    const now = this.now();
    for (const [key, last] of this.lastRequest) if (now - last >= this.cooldown) this.lastRequest.delete(key);
    for (const [key, expiries] of this.pending) {
      const active = expiries.filter((expires) => expires > now);
      if (active.length) this.pending.set(key, active);
      else this.pending.delete(key);
    }
  }

  #blocked(value) { return this.blocklist.some((b) => value.toLowerCase().includes(b)); }

  async handleRequest({ user, userId = '', query, platform = 'tiktok', reply, canMutate = () => true, onStage = () => {} }) {
    try {
      ({ user, userId } = this.#cleanIdentity(user, userId));
      query = text(query ?? '', 'query', { optional: true });
      platform = text(platform, 'platform', { max: 32 });
    } catch (error) { return this.#reply(reply, false, 'invalid_input', error.message); }
    if (!query) return this.#reply(reply, false, 'usage', `@${user} usage: !${this.requestCommand} <song name>`);
    if (this.requestAllowlist.length && !isAllowed({ user, userId, platform }, this.requestAllowlist)) {
      return this.#reply(reply, false, 'forbidden', `@${user} song requests are limited to allowed users.`);
    }
    if (this.#blocked(query)) return this.#reply(reply, false, 'blocked', `@${user} that request was blocked.`);
    if (this.dryRun) return this.#reply(reply, true, 'dry_run', `@${user} dry-run: request validated. No song searched or queued.`, { dryRun: true });
    this.#prune();
    const key = JSON.stringify([platform, userId || user.toLowerCase()]);
    if (this.inFlight.has(key)) return this.#reply(reply, false, 'busy', `@${user} your previous request is still processing.`);
    if (this.inFlight.size >= 32) return this.#reply(reply, false, 'busy', 'Too many requests are processing. Try later.');
    if (this.lastRequest.has(key)) {
      const remaining = Math.max(0, Math.ceil((this.cooldown - (this.now() - this.lastRequest.get(key))) / 1000));
      if (remaining) return this.#reply(reply, false, 'cooldown', `@${user} slow down - try again in ${remaining}s.`, { retryAfter: remaining });
    }
    if (this.maxPerUser > 0 && (this.pending.get(key)?.length || 0) >= this.maxPerUser) {
      return this.#reply(reply, false, 'user_limit', `@${user} you already have ${this.maxPerUser} tracked request(s). Try again later.`);
    }
    // Reserve before the first await so concurrent requests cannot race the quota.
    this.inFlight.add(key);
    let writeStarted = false;
    try {
      onStage('searching');
      const song = await this.ytmd.findFirstSong(query);
      // Pause, mode switches and disconnects revoke work that has not reached the player yet.
      if (!canMutate()) return this.#reply(reply, false, 'intake_changed', 'Request intake changed while searching. No song was queued.');
      if (this.requestAllowlist.length && !isAllowed({ user, userId, platform }, this.requestAllowlist)) {
        return this.#reply(reply, false, 'forbidden', 'Request permissions changed while searching.');
      }
      if (!song) return this.#reply(reply, false, 'no_results', `@${user} no results for "${query.slice(0, 40)}".`);
      if (this.#blocked(query) || this.#blocked(`${song.title} ${song.artist}`)) return this.#reply(reply, false, 'blocked', `@${user} that request was blocked.`);
      if (this.maxSongSeconds > 0 && (!Number.isFinite(song.durationSec) || song.durationSec <= 0)) {
        return this.#reply(reply, false, 'unknown_duration', `@${user} the song length could not be verified. Try another result.`);
      }
      if (this.maxSongSeconds > 0 && song.durationSec > this.maxSongSeconds) {
        return this.#reply(reply, false, 'too_long', `@${user} "${song.title}" is too long (max ${formatDur(this.maxSongSeconds)}).`);
      }
      onStage('enqueuing');
      writeStarted = true;
      await this.ytmd.addToQueue(song.videoId);
      const now = this.now();
      if (this.cooldown > 0) this.lastRequest.set(key, now);
      if (this.maxPerUser > 0) {
        const pending = (this.pending.get(key) || []).filter((expires) => expires > now);
        // Best-effort request window, not an exact playback position tracker.
        // Unknown durations (allowed only when MAX_SONG_SECONDS=0) expire in 15 minutes.
        const ttl = Number.isFinite(song.durationSec) && song.durationSec > 0 ? Math.min(song.durationSec + 5, 604800) : 900;
        pending.push(now + ttl * 1000);
        this.pending.set(key, pending);
      }
      this.log.info(`[+queue] ${platform}/${user}: ${song.videoId}`);
      const duration = song.durationSec > 0 ? ` (${formatDur(song.durationSec)})` : '';
      return this.#reply(reply, true, 'added', `@${user} added: ${song.title} - ${song.artist}${duration}`);
    } catch (error) {
      this.log.error('[request] Pear Desktop request failed.');
      const timeout = error.code === 'UPSTREAM_TIMEOUT';
      return this.#reply(reply, false, timeout ? 'upstream_timeout' : 'upstream_error',
        `@${user} ${timeout ? 'the player timed out' : 'the player request failed'}. Check Pear Desktop and its queue before retrying.`, { outcomeUncertain: writeStarted });
    } finally { this.inFlight.delete(key); }
  }

  async #read(user, reply, read, present) {
    try {
      ({ user } = this.#cleanIdentity(user));
      if (this.dryRun) return this.#reply(reply, true, 'dry_run', `@${user} dry-run: player was not contacted.`, { dryRun: true });
      return this.#reply(reply, true, 'read', present(await read(), user));
    } catch (error) {
      return this.#reply(reply, false, error instanceof InputError ? 'invalid_input' : 'upstream_error', 'Could not read the player. Check the input and Pear Desktop.');
    }
  }

  handleNowPlaying({ user, reply }) {
    return this.#read(user, reply, () => this.ytmd.getCurrentSong(), (song, name) =>
      song?.title ? `@${name} now playing: ${song.title}${song.artist ? ` - ${song.artist}` : ''}` : `@${name} nothing playing right now.`);
  }

  handleQueuePeek({ user, reply }) {
    return this.#read(user, reply, () => this.ytmd.getNextSong(), (song, name) => {
      const title = typeof song?.title === 'string' ? song.title : song?.title?.runs?.map((r) => r.text || '').join('');
      return title ? `@${name} up next: ${title}` : `@${name} nothing queued up next.`;
    });
  }

  async handleSkip({ user, userId = '', platform = 'tiktok', reply, allowlist = [] }) {
    try { ({ user, userId } = this.#cleanIdentity(user, userId)); }
    catch (error) { return this.#reply(reply, false, 'invalid_input', error.message); }
    // YouTube display names are not unique: require the author's channel ID there.
    const allowed = isAllowed({ user, userId, platform }, allowlist);
    if (!allowed) return this.#reply(reply, false, 'forbidden', `@${user} you can't skip.`);
    if (this.dryRun) return this.#reply(reply, true, 'dry_run', `@${user} dry-run: skip authorized but not executed.`, { dryRun: true });
    try {
      await this.ytmd.next();
      return this.#reply(reply, true, 'skipped', `@${user} skipped.`);
    } catch { return this.#reply(reply, false, 'upstream_error', `@${user} couldn't skip. Check the player before retrying.`, { outcomeUncertain: true }); }
  }
}

function formatDur(seconds) {
  const sec = Math.max(0, Math.floor(seconds));
  return `${Math.floor(sec / 60)}:${String(sec % 60).padStart(2, '0')}`;
}
