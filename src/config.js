import { InputError } from './validation.js';

export function numberSetting(env, name, fallback, max = 86400) {
  const value = env[name]?.trim();
  if (value === undefined || value === '') return fallback;
  if (!/^\d+$/.test(value) || !Number.isSafeInteger(Number(value)) || Number(value) > max) {
    throw new InputError(`${name} must be an integer between 0 and ${max}.`);
  }
  return Number(value);
}

export function booleanSetting(env, name, fallback = false) {
  const value = env[name]?.trim().toLowerCase();
  if (value === undefined || value === '') return fallback;
  if (value === 'true' || value === '1') return true;
  if (value === 'false' || value === '0') return false;
  throw new InputError(`${name} must be true or false.`);
}

export function apiHost(value = 'http://127.0.0.1:26538') {
  let url;
  try { url = new URL(value); } catch { throw new InputError('YTMD_HOST must be an HTTP(S) origin.'); }
  if (!['http:', 'https:'].includes(url.protocol) || url.username || url.password ||
      url.pathname !== '/' || url.search || url.hash) {
    throw new InputError('YTMD_HOST must be an HTTP(S) origin without credentials, path, query, or fragment.');
  }
  return url.origin;
}

export function websocketUrl(value = 'ws://127.0.0.1:21213/') {
  let url;
  try { url = new URL(value); } catch { throw new InputError('TIKFINITY_WS_URL must be a local WebSocket URL.'); }
  if (!['ws:', 'wss:'].includes(url.protocol) || !['127.0.0.1', 'localhost', '[::1]'].includes(url.hostname) ||
      url.username || url.password || url.search || url.hash || url.pathname !== '/') {
    throw new InputError('TIKFINITY_WS_URL must use ws/wss on localhost, without credentials, path, query or fragment.');
  }
  return url.href;
}

export function loadConfig(env = process.env, { allowUnconfigured = false } = {}) {
  const commands = {};
  for (const [key, variable, fallback] of [
    ['request', 'CMD_REQUEST', 'sr'], ['nowPlaying', 'CMD_NOWPLAYING', 'np'],
    ['queue', 'CMD_QUEUE', 'queue'], ['skip', 'CMD_SKIP', 'skip'],
  ]) {
    const command = (env[variable] || fallback).trim().toLowerCase();
    if (!/^[a-z0-9_-]{1,32}$/.test(command)) throw new InputError(`${variable} must be 1-32 letters, digits, underscores or hyphens, without !.`);
    commands[key] = command;
  }
  if (new Set(Object.values(commands)).size !== 4) throw new InputError('CMD_* names must be distinct.');
  const split = (value) => (value || '').split(',').map((s) => s.trim()).filter(Boolean);
  const dryRun = booleanSetting(env, 'DRY_RUN');
  const token = (env.YTMD_TOKEN || '').trim();
  if (!allowUnconfigured && !dryRun && !token) throw new InputError('YTMD_TOKEN is not set. Run npm run auth, or use npm run start:dry-run for a no-playback test.');
  // Missing mode means an existing v0.2 configuration: preserve automation.
  const connectionMode = (env.CONNECTION_MODE || 'advanced').trim().toLowerCase();
  if (!['simple', 'advanced'].includes(connectionMode)) throw new InputError('CONNECTION_MODE must be simple or advanced.');
  const timeoutMs = numberSetting(env, 'YTMD_TIMEOUT_MS', 10000, 60000);
  if (timeoutMs < 100) throw new InputError('YTMD_TIMEOUT_MS must be between 100 and 60000.');
  const secret = (env.TIKFINITY_SECRET || '').trim();
  if (secret.length > 256 || /[^\x21-\x7e]/.test(secret)) throw new InputError('TIKFINITY_SECRET must be up to 256 printable ASCII characters without spaces.');
  const clientId = (env.YTMD_CLIENT_ID || 'ytmd-stream-bot').trim();
  if (!/^[a-zA-Z0-9_-]{1,100}$/.test(clientId)) throw new InputError('YTMD_CLIENT_ID must be 1-100 letters, digits, underscores or hyphens.');
  const twitch = { channel: env.TWITCH_CHANNEL?.trim(), username: env.TWITCH_USERNAME?.trim(), oauth: env.TWITCH_OAUTH?.trim() };
  if (!dryRun && twitch.channel && (!twitch.username || !twitch.oauth)) {
    throw new InputError('TWITCH_CHANNEL requires TWITCH_USERNAME and TWITCH_OAUTH; clear the channel to disable Twitch.');
  }
  return {
    host: apiHost(env.YTMD_HOST || undefined), token, timeoutMs, dryRun, secret,
    connectionMode, websocketUrl: websocketUrl(env.TIKFINITY_WS_URL || undefined),
    requestsEnabled: booleanSetting(env, 'REQUESTS_ENABLED', connectionMode === 'advanced'),
    clientId,
    port: numberSetting(env, 'TIKFINITY_PORT', 7280, 65535), commands,
    cooldownSeconds: numberSetting(env, 'COOLDOWN_SECONDS', 60),
    maxSongSeconds: numberSetting(env, 'MAX_SONG_SECONDS', 420, 604800),
    maxPerUser: numberSetting(env, 'MAX_PER_USER', 2, 1000),
    blocklist: split(env.BLOCKLIST), skipAllowlist: split(env.SKIP_ALLOWLIST), requestAllowlist: split(env.REQUEST_ALLOWLIST),
    twitch, channelId: env.YOUTUBE_CHANNEL_ID?.trim(),
  };
}
