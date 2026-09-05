import test from 'node:test';
import assert from 'node:assert/strict';
import { fixture, request } from './helpers.js';
test('successful enqueue commits accounting and returns an explicit outcome', async () => {
  const f = fixture(); const r = await f.queue.handleRequest(request());
  assert.equal(r.ok, true); assert.equal(r.code, 'added'); assert.match(r.message, /added/);
  assert.deepEqual(f.calls.map(c => c[0]), ['findFirstSong', 'addToQueue']);
  assert.equal((await f.queue.handleRequest(request())).code, 'cooldown');
});
test('concurrent same-user requests cannot bypass cooldown or quota', async () => {
  const f = fixture(); let release;
  f.ytmd.findFirstSong = () => new Promise(resolve => { release = resolve; });
  const first = f.queue.handleRequest(request());
  const second = await f.queue.handleRequest(request()); assert.equal(second.code, 'busy');
  release(f.song); assert.equal((await first).ok, true);
  assert.equal(f.calls.filter(c => c[0] === 'addToQueue').length, 1);
});
test('failed writes consume no quota and release the in-flight lock', async () => {
  const f = fixture(); f.ytmd.addToQueue = async () => { throw new Error('secret should not appear'); };
  const r = await f.queue.handleRequest(request()); assert.equal(r.code, 'upstream_error'); assert.doesNotMatch(r.message, /secret/);
  assert.equal(f.queue.lastRequest.size, 0); assert.equal(f.queue.pending.size, 0); assert.equal(f.queue.inFlight.size, 0);
  f.ytmd.addToQueue = async id => { f.calls.push(['addToQueue', id]); }; assert.equal((await f.queue.handleRequest(request())).ok, true);
});
test('upstream timeout produces a non-retry promise and no false acceptance', async () => {
  const f = fixture(); f.ytmd.addToQueue = async () => { throw Object.assign(new Error(), { code: 'UPSTREAM_TIMEOUT' }); };
  const r = await f.queue.handleRequest(request()); assert.equal(r.code, 'upstream_timeout'); assert.match(r.message, /Check Pear Desktop/);
});
test('stable user IDs prevent rename bypass but platform quotas are independent', async () => {
  const f = fixture(); await f.queue.handleRequest(request('a', { userId: '123' }));
  assert.equal((await f.queue.handleRequest(request('renamed', { userId: '123' }))).code, 'cooldown');
  assert.equal((await f.queue.handleRequest(request('a', { userId: '123', platform: 'twitch' }))).ok, true);
});
test('blocklist checks both raw query and resolved metadata', async () => {
  const f = fixture({ blocklist: ['BLOCKED'] });
  assert.equal((await f.queue.handleRequest(request('a', { query: 'blocked phrase' }))).code, 'blocked'); assert.equal(f.calls.length, 0);
  f.song.artist = 'blocked'; assert.equal((await f.queue.handleRequest(request())).code, 'blocked');
  assert.equal(f.calls.filter(c => c[0] === 'addToQueue').length, 0);
});
test('maximum duration fails closed for unknown length and excessive length', async () => {
  const f = fixture(); f.song.durationSec = 0; assert.equal((await f.queue.handleRequest(request())).code, 'unknown_duration');
  f.song.durationSec = 421; assert.equal((await f.queue.handleRequest(request())).code, 'too_long');
});
test('unknown lengths expire after a bounded window when length checking is disabled', async () => {
  let now = 0; const f = fixture({ now: () => now, maxSongSeconds: 0, cooldownSeconds: 0, maxPerUser: 1 }); f.song.durationSec = 0;
  assert.equal((await f.queue.handleRequest(request())).ok, true);
  assert.equal((await f.queue.handleRequest(request())).code, 'user_limit');
  now = 900001; assert.equal((await f.queue.handleRequest(request())).ok, true);
});
test('known-length request window expires without real timers', async () => {
  let now = 0; const f = fixture({ now: () => now, cooldownSeconds: 0, maxPerUser: 1 });
  await f.queue.handleRequest(request()); assert.equal((await f.queue.handleRequest(request())).code, 'user_limit');
  now = 125001; assert.equal((await f.queue.handleRequest(request())).ok, true);
});
test('zero max-per-user and cooldown disable accounting', async () => {
  const f = fixture({ maxPerUser: 0, cooldownSeconds: 0 });
  for (let n = 0; n < 4; n++) assert.equal((await f.queue.handleRequest(request())).ok, true);
  assert.equal(f.queue.pending.size, 0); assert.equal(f.queue.lastRequest.size, 0);
});
test('custom command usage and no-results responses are explicit', async () => {
  const f = fixture({ requestCommand: 'song' });
  assert.match((await f.queue.handleRequest(request('a', { query: '' }))).message, /!song/);
  f.ytmd.findFirstSong = async () => null; assert.equal((await f.queue.handleRequest(request())).code, 'no_results');
});
test('reply delivery failures never turn an accepted request into a failure', async () => {
  const f = fixture(); assert.equal((await f.queue.handleRequest(request('a', { reply() { throw new Error(); } }))).ok, true);
  assert.equal((await f.queue.handleRequest(request('b', { reply: async () => { throw new Error(); } }))).ok, true);
});
test('skip uses scoped usernames and YouTube channel IDs instead of display-name impersonation', async () => {
  const f = fixture();
  assert.equal((await f.queue.handleSkip({ user: 'mod', platform: 'tiktok', allowlist: [] })).code, 'forbidden');
  assert.equal((await f.queue.handleSkip({ user: 'MOD', platform: 'tiktok', allowlist: ['tiktok:mod'] })).ok, true);
  assert.equal((await f.queue.handleSkip({ user: 'mod', platform: 'youtube', userId: 'UC123', allowlist: ['mod'] })).ok, false);
  assert.equal((await f.queue.handleSkip({ user: 'anything', platform: 'youtube', userId: 'UC123', allowlist: ['youtube:UC123'] })).ok, true);
});
test('dry-run never contacts player or mutates quota, including authorized skip', async () => {
  const f = fixture({ dryRun: true });
  for (const result of [await f.queue.handleRequest(request()), await f.queue.handleNowPlaying({ user: 'a' }), await f.queue.handleQueuePeek({ user: 'a' }), await f.queue.handleSkip({ user: 'a', allowlist: ['a'] })]) assert.equal(result.dryRun, true);
  assert.equal(f.calls.length, 0); assert.equal(f.queue.lastRequest.size, 0); assert.equal(f.queue.pending.size, 0);
});
test('idle player and renderer-shaped queue title are handled', async () => {
  const f = fixture(); f.ytmd.getCurrentSong = async () => null; f.ytmd.getNextSong = async () => ({ title: { runs: [{ text: 'Next ' }, { text: 'song' }] } });
  assert.match((await f.queue.handleNowPlaying({ user: 'a' })).message, /nothing playing/);
  assert.match((await f.queue.handleQueuePeek({ user: 'a' })).message, /Next song/);
});
