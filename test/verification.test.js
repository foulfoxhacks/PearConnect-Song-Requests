import test from 'node:test';
import assert from 'node:assert/strict';
import { PearConnectEngine } from '../src/engine.js';
import { loadConfig } from '../src/config.js';
import { fixture, log } from './helpers.js';
import { WebSocketServer } from 'ws';
import { once } from 'node:events';

async function setup(t, env = {}) {
  const f = fixture();
  const e = new PearConnectEngine(loadConfig({ YTMD_TOKEN: 'test', TIKFINITY_PORT: '0', CONNECTION_MODE: 'advanced', ...env }), { player: f.ytmd, logger: log, lock: async () => async () => {}, connectPlatforms: false });
  await e.start(); t.after(() => e.stop()); return { ...f, e };
}
test('guided test requires actual delivery and a real read-only song check, then explicit enable', async t => {
  const { e, calls } = await setup(t);
  const v = e.beginVerification(); assert.equal(e.requestsEnabled, false);
  assert.throws(() => e.finishVerification(), /Complete/);
  const n = calls.length;
  assert.equal((await e.execute('request', { user: 'alice', query: v.challenge }, 'twitch')).code, 'test_inactive');
  assert.equal(e.verification.state, 'waiting');
  assert.equal((await e.execute('request', { user: 'alice', query: v.challenge }, 'advanced')).code, 'connection_verified');
  assert.equal(calls.length, n);
  assert.equal((await e.verifySong({ user: 'alice', query: 'Björk “Jóga” 🦊' })).code, 'preview_passed');
  assert.equal(calls.filter(c => c[0] === 'addToQueue').length, 0);
  assert.equal(e.queue.lastRequest.size, 0); assert.equal(e.queue.pending.size, 0);
  e.finishVerification(); assert.equal(e.requestsEnabled, true);
  assert.equal((await e.execute('request', { user: 'alice', query: v.challenge }, 'advanced')).code, 'test_inactive');
});
test('expired markers, mode changes, restricted previews and changed rules cannot falsely pass validation', async t => {
  const { e, ytmd } = await setup(t);
  let v = e.beginVerification(); e.verification.expiresAt = Date.now() - 1;
  assert.equal((await e.execute('request', { user: 'alice', query: v.challenge }, 'advanced')).code, 'test_inactive');
  v = e.beginVerification(); await e.execute('request', { user: 'alice', query: v.challenge }, 'advanced');
  e.updateRules({ REQUEST_ALLOWLIST: 'tiktok:bob' });
  assert.equal((await e.verifySong({ user: 'alice', query: 'song' })).code, 'forbidden');
  ytmd.findFirstSong = async () => ({ videoId: 'abc', title: 'song', artist: 'artist' });
  assert.equal((await e.verifySong({ user: 'bob', query: 'song' })).code, 'unknown_duration');
  assert.throws(() => e.finishVerification(), /Complete/);
  e.updateRules({ CMD_REQUEST: 'song' }); assert.equal(e.verification, null);
});
test('a real local TikFinity WebSocket delivers the marker without performing a search or enqueue', async t => {
  const server = new WebSocketServer({ host: '127.0.0.1', port: 0 }); await once(server, 'listening');
  t.after(() => { for (const client of server.clients) client.terminate(); server.close(); });
  const connected = once(server, 'connection');
  const { e, calls } = await setup(t, { CONNECTION_MODE: 'simple', TIKFINITY_WS_URL: `ws://127.0.0.1:${server.address().port}/` });
  const [socket] = await connected; const v = e.beginVerification();
  const verified = new Promise((resolve, reject) => { const timeout = setTimeout(() => reject(new Error('No marker received')), 3000); e.on('status', s => { if (s.verification?.state === 'received') { clearTimeout(timeout); resolve(); } }); });
  socket.send(JSON.stringify({ event: 'chat', data: { uniqueId: 'viewer', userId: '123', msgId: 'marker-1', comment: v.command } }));
  await verified; assert.equal(calls.filter(c => ['findFirstSong', 'addToQueue'].includes(c[0])).length, 0);
});
test('website fallback excludes TikTok and cannot impersonate allowlisted viewers or send skips', async t => {
  const { e, calls } = await setup(t);
  e.setWebFallback(true); e.resumeRequests();
  const data = { user: 'alice', userId: 'web-private-identity', query: 'song', platform: 'tiktok' };
  assert.equal((await e.execute('request', data, 'advanced')).code, 'fallback_active');
  assert.equal((await e.execute('skip', data, 'web')).code, 'input_disabled');
  e.updateRules({ REQUEST_ALLOWLIST: 'alice,tiktok:alice,web:alice' });
  assert.equal((await e.execute('request', data, 'web')).code, 'forbidden');
  e.updateRules({ REQUEST_ALLOWLIST: '' });
  assert.equal((await e.execute('request', { ...data, beforeEnqueue: async () => false }, 'web')).code, 'session_changed');
  assert.equal(calls.filter(c => c[0] === 'addToQueue').length, 0);
  assert.equal((await e.execute('request', { ...data, beforeEnqueue: async () => true }, 'web')).code, 'added');
  assert.equal((await e.execute('request', { ...data, user: 'renamed' }, 'web')).code, 'cooldown');
});
