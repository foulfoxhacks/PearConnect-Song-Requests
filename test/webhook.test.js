import test from 'node:test';
import http from 'node:http';
import assert from 'node:assert/strict';
import { webhook, fixture, log, serve } from './helpers.js';
import { startTikfinity } from '../src/platforms/tikfinity.js';
test('four POST routes invoke correct player operations', async t => {
  const f = await webhook(t, { skipAllowlist: ['alice'] });
  for (const path of ['/tikfinity', '/tikfinity/np', '/tikfinity/queue', '/tikfinity/skip']) assert.equal((await f.send(path)).body.ok, true);
  assert.deepEqual(f.calls.map(c => c[0]), ['findFirstSong', 'addToQueue', 'getCurrentSong', 'getNextSong', 'next']);
});
test('authentication protects reads and writes; safe errors do not expose secrets', async t => {
  const f = await webhook(t, { secret: 'private-secret' });
  assert.equal((await f.send()).status, 403);
  assert.equal((await fetch(f.url + '/healthz')).status, 403);
  const good = await f.send('/tikfinity', undefined, { headers: { 'X-Webhook-Secret': 'private-secret' } }); assert.equal(good.status, 200);
  const bad = await f.send('/tikfinity', undefined, { headers: { 'X-Webhook-Secret': 'wrong' } }); assert.equal(bad.status, 403); assert.doesNotMatch(JSON.stringify(bad.body), /private-secret|wrong/);
});
test('browser origins and foreign hosts cannot call the local API', async t => {
  const f = await webhook(t);
  assert.equal((await f.send('/tikfinity', undefined, { headers: { Origin: 'https://evil.invalid' } })).status, 403);
  const status = await new Promise((resolve, reject) => {
    const req = http.request(f.url + '/tikfinity', { method: 'POST', headers: { Host: 'evil.invalid', 'Content-Type': 'application/json' } }, res => { res.resume(); resolve(res.statusCode); });
    req.on('error', reject); req.end(JSON.stringify({ user: 'alice', query: 'test' }));
  });
  assert.equal(status, 403);
  assert.equal(f.calls.length, 0);
});
test('health indicates process state and readiness checks actual player availability', async t => {
  const f = await webhook(t);
  const health = await fetch(f.url + '/healthz'); assert.equal(health.status, 200); assert.equal(health.headers.get('cache-control'), 'no-store');
  assert.equal((await (await fetch(f.url + '/readyz')).json()).pearDesktop, 'reachable');
  f.ytmd.getCurrentSong = async () => { throw new Error(); }; assert.equal((await fetch(f.url + '/readyz')).status, 503);
});
test('GET cannot enqueue, wrong content type fails, unknown paths are JSON', async t => {
  const f = await webhook(t);
  const get = await fetch(f.url + '/tikfinity?user=alice&query=test'); assert.equal(get.status, 405); assert.equal(get.headers.get('allow'), 'POST');
  assert.equal((await f.send('/tikfinity', undefined, { headers: { 'Content-Type': 'text/plain' } })).status, 415);
  assert.equal((await f.send('/unknown')).status, 404); assert.equal(f.calls.length, 0);
});
test('invalid payloads produce bounded JSON errors, never coerced viewer identities', async t => {
  const f = await webhook(t);
  for (const body of [{}, [], null, { user: 'a', query: {} }, { user: '{username}', query: '{message}' }]) assert.equal((await f.send('/tikfinity', body)).status, 400);
  const malformed = await fetch(f.url + '/tikfinity', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: '{ broken' });
  assert.equal(malformed.status, 400); assert.equal((await malformed.json()).ok, false);
  assert.equal((await f.send('/tikfinity', { user: 'a', query: 'x'.repeat(70000) })).status, 413); assert.equal(f.calls.length, 0);
});
test('Unicode payloads survive JSON and accepted versus rejected outcomes differ', async t => {
  const f = await webhook(t); const query = 'Björk "Jóga" 🦊';
  assert.equal((await f.send('/tikfinity', { user: 'alice', query })).body.code, 'added');
  assert.equal(f.calls[0][1], query);
  const declined = await f.send(); assert.equal(declined.status, 200); assert.equal(declined.body.ok, false); assert.equal(declined.body.code, 'cooldown');
});
test('idempotency coalesces simultaneous requests and detects reuse conflicts', async t => {
  const f = await webhook(t); const settings = { headers: { 'Idempotency-Key': 'test-key-123' } };
  const [a, b] = await Promise.all([f.send('/tikfinity', undefined, settings), f.send('/tikfinity', undefined, settings)]);
  assert.equal(a.body.code, 'added'); assert.deepEqual(a.body, b.body); assert.equal(f.calls.filter(c => c[0] === 'addToQueue').length, 1);
  assert.equal((await f.send('/tikfinity/skip', undefined, settings)).status, 409);
  assert.equal((await f.send('/tikfinity', { user: 'alice', query: 'different' }, settings)).status, 409);
});
test('idempotency preserves failed outcomes to avoid replaying uncertain writes', async t => {
  const f = await webhook(t); let writes = 0; f.ytmd.addToQueue = async () => { writes++; throw new Error(); };
  const settings = { headers: { 'Idempotency-Key': 'failed-key-123' } };
  for (let i = 0; i < 2; i++) assert.equal((await f.send('/tikfinity', undefined, settings)).status, 502);
  assert.equal(writes, 1);
});
test('expired idempotency keys are reusable and short keys are rejected', async t => {
  let now = 0; const f = await webhook(t, { now: () => now, maxPerUser: 0, cooldownSeconds: 0 });
  const settings = { headers: { 'Idempotency-Key': 'test-key-123' } };
  await f.send('/tikfinity', undefined, settings); now = 300001; await f.send('/tikfinity', undefined, settings);
  assert.equal(f.calls.filter(c => c[0] === 'addToQueue').length, 2);
  assert.equal((await f.send('/tikfinity', undefined, { headers: { 'Idempotency-Key': 'x' } })).status, 400);
});
test('validation endpoint never changes player or quota state', async t => {
  const f = await webhook(t); const r = await f.send('/tikfinity/test');
  assert.equal(r.body.code, 'validated'); assert.equal(r.body.dryRun, true); assert.equal(f.calls.length, 0); assert.equal(f.queue.pending.size, 0);
});
test('dry-run mode keeps reads and writes away from actual player', async t => {
  const f = await webhook(t, { dryRun: true, skipAllowlist: ['alice'] });
  for (const path of ['/tikfinity', '/tikfinity/np', '/tikfinity/queue', '/tikfinity/skip']) assert.equal((await f.send(path)).body.dryRun, true);
  assert.equal((await (await fetch(f.url + '/readyz')).json()).pearDesktop, 'not_checked'); assert.equal(f.calls.length, 0);
});
test('unexpected errors become safe JSON instead of an unhandled rejection', async t => {
  const f = await webhook(t); f.queue.handleRequest = async () => { throw new Error('sensitive-details'); };
  const r = await f.send(); assert.equal(r.status, 500); assert.doesNotMatch(JSON.stringify(r.body), /sensitive/);
});
test('disabled listener returns null and occupied port rejects startup', async t => {
  const f = fixture(); assert.equal(await startTikfinity({ port: 0, log, queue: f.queue }), null);
  const { server } = await serve(t, (_req, res) => res.end());
  await assert.rejects(startTikfinity({ port: server.address().port, log, queue: f.queue }), { code: 'EADDRINUSE' });
});
