import test from 'node:test';
import assert from 'node:assert/strict';
import { loadConfig } from '../src/config.js';
import { PearConnectEngine } from '../src/engine.js';
import { parseCommand } from '../src/commands.js';
import { acquireInstance } from '../src/instance.js';
import { fixture, log } from './helpers.js';
import { randomUUID } from 'node:crypto';

async function engine(t, env = {}) {
  const f = fixture();
  const e = new PearConnectEngine(loadConfig({ YTMD_TOKEN: 'private-token', TIKFINITY_PORT: '0', ...env }, { allowUnconfigured: true }), {
    player: f.ytmd, logger: log, lock: async () => async () => {}, connectPlatforms: false,
    startSocket: () => ({ stop() {} }),
  });
  await e.start(); t.after(() => e.stop()); return { ...f, e };
}
const data = { user: 'alice', userId: '123', query: 'Björk "Jóga" 🦊', platform: 'tiktok' };

test('engine stays open for missing authorization and disconnected player repair', async t => {
  const { e } = await engine(t, { YTMD_TOKEN: '' });
  assert.equal(e.status().lifecycle, 'running'); assert.equal(e.status().player, 'not_configured');
  assert.throws(() => e.resumeRequests(), /Connect/);
  assert.equal((await e.execute('request', data, 'advanced')).code, 'not_ready');
});

test('pause revokes a searching request, leaves playback alone, and preserves accounting', async t => {
  const { e, ytmd, song, calls } = await engine(t);
  let release; ytmd.findFirstSong = () => new Promise(resolve => { release = resolve; });
  const pending = e.execute('request', data, 'advanced'); e.pauseRequests(); release(song);
  assert.equal((await pending).code, 'intake_changed');
  assert.equal(calls.filter(c => ['next', 'addToQueue'].includes(c[0])).length, 0);
  assert.equal((await e.execute('request', data, 'advanced')).code, 'requests_paused');
});

test('mode switch drains an existing write before enabling the other route and requires resume', async t => {
  const { e, ytmd } = await engine(t);
  let release; const writing = new Promise(resolve => { ytmd.addToQueue = () => { resolve(); return new Promise(r => { release = r; }); }; });
  const pending = e.execute('request', data, 'advanced'); await writing;
  const changing = e.setMode('simple');
  assert.equal((await e.execute('request', data, 'simple')).code, 'input_disabled');
  release(); assert.equal((await pending).code, 'added'); await changing;
  assert.equal(e.status().requestsEnabled, false);
  assert.equal((await e.execute('request', data, 'advanced')).code, 'input_disabled');
  e.resumeRequests(); assert.equal((await e.execute('request', data, 'simple')).code, 'cooldown');
});

test('rules apply to all sources without erasing counters and preview never contacts player', async t => {
  const { e, calls } = await engine(t);
  e.updateRules({ REQUEST_ALLOWLIST: 'tiktok:alice', BLOCKLIST: 'bad', CMD_REQUEST: 'song' });
  const count = calls.length;
  assert.equal((await e.validateRequest(data)).code, 'dry_run'); assert.equal(calls.length, count);
  assert.equal((await e.execute('request', { ...data, platform: 'twitch' }, 'twitch')).code, 'forbidden');
  assert.equal((await e.execute('request', data, 'advanced')).code, 'added');
  e.updateRules({ MAX_SONG_SECONDS: '500' });
  assert.equal((await e.execute('request', data, 'advanced')).code, 'cooldown');
  assert.throws(() => e.updateRules({ YTMD_TOKEN: 'x' }), /supported/);
});

test('global engine command capacity covers chat reads as well as webhook writes', async t => {
  const { e, ytmd } = await engine(t); const releases = [];
  ytmd.getCurrentSong = () => new Promise(resolve => releases.push(resolve));
  const tasks = Array.from({ length: 32 }, () => e.execute('nowPlaying', data, 'advanced'));
  assert.equal((await e.execute('nowPlaying', data, 'advanced')).code, 'busy');
  releases.forEach(resolve => resolve(null)); await Promise.all(tasks);
});

test('uncertain writes are distinguished from failed searches; diagnostics omit private content', async t => {
  const { e, ytmd } = await engine(t);
  ytmd.addToQueue = async () => { throw new Error('private-token'); };
  assert.equal((await e.execute('request', data, 'advanced')).outcomeUncertain, true);
  assert.equal(e.status().activity.at(-1).state, 'outcome_uncertain');
  assert.doesNotMatch(JSON.stringify(e.diagnostics()), /alice|Björk|private-token|query|userId/);
  assert.doesNotMatch(JSON.stringify(e.status()), /private-token/);
});

test('shared parser preserves quotes, spacing and Unicode and ignores near commands', () => {
  const { commands } = loadConfig({ DRY_RUN: 'true' });
  assert.deepEqual(parseCommand('!SR Björk  "Jóga" 🦊', commands), { command: 'request', query: 'Björk  "Jóga" 🦊' });
  for (const message of ['!srs song', 'hello !sr song', {}, 'x'.repeat(5000)]) assert.equal(parseCommand(message, commands), null);
});

test('shared singleton refuses a second engine independently of webhook configuration', async () => {
  const address = process.platform === 'win32' ? `\\\\.\\pipe\\pearconnect-test-${randomUUID()}` : `\0pearconnect-test-${randomUUID()}`;
  const release = await acquireInstance(address);
  try { await assert.rejects(acquireInstance(address), /already running/); } finally { await release(); }
  const releaseAgain = await acquireInstance(address); await releaseAgain();
});
