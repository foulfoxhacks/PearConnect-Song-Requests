import { readFile, writeFile, rename, unlink, mkdir } from 'node:fs/promises';
import { dirname } from 'node:path';
import { randomUUID } from 'node:crypto';
import { loadConfig } from '../src/config.js';
import { InputError } from '../src/validation.js';
import { RULE_KEYS } from '../src/engine.js';
import { APPEARANCE_KEYS, validateAppearance } from './appearance.js';

export const CONNECTION_KEYS = ['YTMD_HOST', 'YTMD_CLIENT_ID', 'YTMD_TIMEOUT_MS', 'TIKFINITY_WS_URL', 'TIKFINITY_PORT', 'TWITCH_CHANNEL', 'TWITCH_USERNAME', 'YOUTUBE_CHANNEL_ID'];
export const SECRET_KEYS = ['YTMD_TOKEN', 'TIKFINITY_SECRET', 'TWITCH_OAUTH', 'LASTFM_KEY', 'OVERLAY_TOKEN'];
export const SETTING_KEYS = [...CONNECTION_KEYS, ...SECRET_KEYS, ...RULE_KEYS, ...APPEARANCE_KEYS, 'CONNECTION_MODE', 'REQUESTS_ENABLED', 'DRY_RUN', 'SESSION_MINUTES'];

export function validateSettings(env) {
  if (!env || typeof env !== 'object' || Array.isArray(env) || Object.keys(env).some(key => !SETTING_KEYS.includes(key)) || Object.values(env).some(value => typeof value !== 'string' || value.length > 4096)) throw new InputError('Invalid desktop settings.');
  // The desktop only authorizes a local player. Do not send credentials to a remote host.
  const config = loadConfig(env, { allowUnconfigured: true });
  validateAppearance(Object.fromEntries(Object.entries(env).filter(([key]) => APPEARANCE_KEYS.includes(key) || key === 'LASTFM_KEY')));
  if (env.OVERLAY_TOKEN && !/^[a-f\d]{64}$/.test(env.OVERLAY_TOKEN)) throw new InputError('Invalid overlay credential.');
  if (env.SESSION_MINUTES !== undefined && (!/^\d+$/.test(env.SESSION_MINUTES) || Number(env.SESSION_MINUTES) < 15 || Number(env.SESSION_MINUTES) > 1440)) throw new InputError('Session expiration must be 15 to 1440 minutes.');
  if (!['127.0.0.1', 'localhost', '[::1]'].includes(new URL(config.host).hostname)) throw new InputError('Pear Desktop must use a localhost address.');
  return config;
}

export class SettingsStore {
  constructor(path, safeStorage) { this.path = path; this.safeStorage = safeStorage; }
  encryptionAvailable() {
    return this.safeStorage.isEncryptionAvailable() && (process.platform !== 'linux' || this.safeStorage.getSelectedStorageBackend() !== 'basic_text');
  }
  async read() {
    let record;
    try { record = JSON.parse(await readFile(this.path, 'utf8')); } catch (error) { if (error.code === 'ENOENT') return null; throw new InputError('Saved settings could not be read. Restore the settings file or import your configuration.'); }
    if (record.version !== 1 || !record.env || typeof record.secrets !== 'string') throw new InputError('Saved settings use an unsupported format.');
    if (!this.encryptionAvailable()) throw new InputError('Operating-system credential storage is unavailable. Saved credentials remain encrypted; restore access before opening them.');
    let secrets;
    try { secrets = JSON.parse(this.safeStorage.decryptString(Buffer.from(record.secrets, 'base64'))); } catch { throw new InputError('Saved credentials could not be unlocked by this operating-system account. Import a local configuration or authorize again.'); }
    const env = { ...record.env, ...secrets }; validateSettings(env); return env;
  }
  async write(env) {
    validateSettings(env);
    if (!this.encryptionAvailable()) throw new InputError('Secure credential storage is unavailable. Settings were not saved. Restore the operating-system credential store and try again.');
    const secrets = Object.fromEntries(SECRET_KEYS.filter(key => key in env).map(key => [key, env[key] || '']));
    const publicEnv = Object.fromEntries(Object.entries(env).filter(([key]) => !SECRET_KEYS.includes(key)));
    const content = JSON.stringify({ version: 1, env: publicEnv, secrets: this.safeStorage.encryptString(JSON.stringify(secrets)).toString('base64') }, null, 2);
    await mkdir(dirname(this.path), { recursive: true });
    const temporary = `${this.path}.${randomUUID()}.tmp`;
    try { await writeFile(temporary, content, { flag: 'wx', mode: 0o600 }); await rename(temporary, this.path); }
    finally { await unlink(temporary).catch(error => { if (error.code !== 'ENOENT') throw error; }); }
  }
}
