import test from 'node:test';
import assert from 'node:assert/strict';
import { loadConfig, apiHost } from '../src/config.js';
import { validatePayload } from '../src/validation.js';
test('configuration defaults and dry-run do not require credentials', () => {
  const c = loadConfig({ DRY_RUN: 'true' });
  assert.equal(c.port, 7280); assert.equal(c.timeoutMs, 10000); assert.equal(c.maxPerUser, 2);
  assert.equal(c.commands.request, 'sr'); assert.throws(() => loadConfig({}), /YTMD_TOKEN/);
});
test('zero values disable features instead of reverting to defaults', () => {
  const c = loadConfig({ DRY_RUN: '1', TIKFINITY_PORT: '0', COOLDOWN_SECONDS: '0', MAX_SONG_SECONDS: '0', MAX_PER_USER: '0' });
  for (const field of ['port', 'cooldownSeconds', 'maxSongSeconds', 'maxPerUser']) assert.equal(c[field], 0);
});
for (const [name, value] of [['TIKFINITY_PORT', '65536'], ['TIKFINITY_PORT', '7280abc'], ['MAX_PER_USER', '-1'], ['COOLDOWN_SECONDS', '1.5'], ['YTMD_TIMEOUT_MS', '0'], ['DRY_RUN', 'perhaps'], ['CMD_REQUEST', '!sr'], ['TIKFINITY_SECRET', 'not safe']]) {
  test(`invalid ${name} is rejected without echoing supplied content`, () => { assert.throws(() => loadConfig({ DRY_RUN: 'true', [name]: value }), new RegExp(name)); });
}
test('custom commands are normalized and cannot collide', () => {
  assert.equal(loadConfig({ DRY_RUN: 'true', CMD_REQUEST: ' SONG ' }).commands.request, 'song');
  assert.throws(() => loadConfig({ DRY_RUN: 'true', CMD_REQUEST: 'np' }), /distinct/);
});
test('partial Twitch credentials fail early', () => { assert.throws(() => loadConfig({ YTMD_TOKEN: 'test', TWITCH_CHANNEL: 'channel' }), /TWITCH_USERNAME/); });
test('API host rejects embedded credentials and non-origin URLs', () => {
  for (const url of ['file:///x', 'http://a:user@localhost', 'http://localhost/api', 'http://localhost/?secret=x', 'nope']) assert.throws(() => apiHost(url));
  assert.equal(apiHost('http://127.0.0.1:26538/'), 'http://127.0.0.1:26538');
});
test('Unicode is preserved while unresolved placeholders and unsafe payload shapes fail', () => {
  assert.deepEqual(validatePayload({ user: '@alice', userId: '123', query: 'Björk "Jóga" 🦊' }), { user: 'alice', userId: '123', query: 'Björk "Jóga" 🦊' });
  for (const body of [null, [], 'x', {}, { user: 123 }, { user: '@' }, { user: '{username}' }, { user: '%username%' }, { user: 'a', query: {} }, { user: 'a', query: 'x\nq' }, { user: 'a', query: 'x'.repeat(513) }]) assert.throws(() => validatePayload(body));
});
