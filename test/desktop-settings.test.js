import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, readFile, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { SettingsStore, validateSettings } from '../desktop/settings.js';
import { DesktopController } from '../desktop/controller.js';
import { fixture, log } from './helpers.js';
const storage = { isEncryptionAvailable: () => true, getSelectedStorageBackend: () => 'gnome-libsecret', encryptString: value => Buffer.from(value), decryptString: value => value.toString() };

test('settings keep credentials out of public fields, round-trip through storage and fail closed without encryption', async t => {
  const dir = await mkdtemp(join(tmpdir(), 'pearconnect-settings-')); t.after(() => rm(dir, { recursive: true, force: true }));
  const store = new SettingsStore(join(dir, 'settings.json'), storage);
  assert.equal(await store.read(), null);
  const env = { YTMD_TOKEN: 'private-player-token', TWITCH_OAUTH: 'oauth:secret', TIKFINITY_SECRET: 'private-webhook', CONNECTION_MODE: 'advanced' };
  await store.write(env); assert.deepEqual(await store.read(), env);
  const raw = await readFile(store.path, 'utf8'); assert.doesNotMatch(raw, /private-player-token|oauth:secret|private-webhook/);
  assert.deepEqual(JSON.parse(raw).env, { CONNECTION_MODE: 'advanced' });
  store.safeStorage = { ...storage, isEncryptionAvailable: () => false };
  await assert.rejects(store.write({}), /Secure credential/); assert.equal(await readFile(store.path, 'utf8'), raw);
  await assert.rejects(store.read(), /unavailable/);
});

test('desktop rejects remote player authorization, unsupported settings and invalid rules', () => {
  for (const env of [{ YTMD_HOST: 'http://remote.invalid' }, { NODE_OPTIONS: '--inspect' }, { CMD_REQUEST: '!sr' }, { TIKFINITY_SECRET: 123 }, { YTMD_CLIENT_ID: '../anything' }]) assert.throws(() => validateSettings(env));
});

test('desktop shares policy, preserves counters on reconnect and imports legacy configuration as Advanced paused', async t => {
  const f = fixture(); let saved = { YTMD_TOKEN: 'private-token', TIKFINITY_PORT: '0', CONNECTION_MODE: 'advanced' };
  const store = { read: async () => saved, write: async value => { saved = { ...value }; }, encryptionAvailable: () => true };
  const controller = new DesktopController(store, { engineOptions: { player: f.ytmd, logger: log, lock: async () => async () => {}, connectPlatforms: false } });
  await controller.init(); t.after(() => controller.engine.stop());
  assert.equal(controller.snapshot().status.requestsEnabled, false); controller.engine.resumeRequests();
  const request = { user: 'alice', query: 'A song' };
  assert.equal((await controller.engine.execute('request', request, 'advanced')).code, 'added');
  await controller.reconnect(); controller.engine.resumeRequests();
  assert.equal((await controller.engine.execute('request', request, 'advanced')).code, 'cooldown');
  await controller.importEnv({ YTMD_TOKEN: 'private-token', TIKFINITY_PORT: '0' });
  assert.equal(controller.snapshot().status.connectionMode, 'advanced'); assert.equal(controller.snapshot().status.requestsEnabled, false);
  assert.doesNotMatch(JSON.stringify(controller.snapshot()), /private-token/);
});

test('rule persistence failure restores previous effective rules', async t => {
  const f = fixture();
  const controller = new DesktopController({ read: async () => ({ DRY_RUN: 'true', TIKFINITY_PORT: '0' }), encryptionAvailable: () => true, write: async () => { throw new Error('disk full'); } },
    { engineOptions: { player: f.ytmd, logger: log, lock: async () => async () => {}, connectPlatforms: false } });
  await controller.init(); t.after(() => controller.engine.stop());
  await assert.rejects(controller.saveRules({ MAX_SONG_SECONDS: '42' }), /disk full/);
  assert.equal(controller.engine.config.maxSongSeconds, 420);
});
