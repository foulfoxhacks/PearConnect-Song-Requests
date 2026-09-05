import test from 'node:test';
import assert from 'node:assert/strict';
import { playerQueue, findQueueAddition } from '../src/player-queue.js';
import { fixture, request, serve } from './helpers.js';
import { QueueManager } from '../src/queue-manager.js';
import { YTMDClient } from '../src/ytmd.js';
const item = id => ({ playlistPanelVideoRenderer: { videoId: id, title: { simpleText: id }, shortBylineText: { runs: [{ text: 'Artist' }] }, lengthText: { runs: [{ text: '3:40' }] } } });

test('queue parsing preserves positions, current track, durations and primary wrapper entries only', () => {
  const first = item('first'); first.playlistPanelVideoRenderer.selected = true;
  const wrapped = { playlistPanelVideoWrapperRenderer: { primaryRenderer: item('second'), counterpart: item('ignore') } };
  const rows = playerQueue({ items: [first, wrapped], other: item('ignore-too') });
  assert.deepEqual(rows.map(row => [row.videoId, row.position, row.selected, row.duration]), [['first', 1, true, '3:40'], ['second', 2, false, '3:40']]);
  assert.equal(findQueueAddition(rows, rows, 'second'), null);
  assert.equal(findQueueAddition(rows, playerQueue({ items: [first, wrapped, item('second')] }), 'second').position, 3);
  assert.throws(() => playerQueue({ unexpected: [] })); assert.throws(() => playerQueue({ items: [{}] }));
  assert.deepEqual(playerQueue(null), []);
});

test('HTTP 204 without a new entry is uncertain, including when that video was already queued', async t => {
  let writes = 0;
  const { url } = await serve(t, (req, res) => {
    if (req.method === 'POST') { writes++; res.writeHead(204); res.end(); }
    else { res.writeHead(200, { 'Content-Type': 'application/json' }); res.end(JSON.stringify({ items: [item('video123')] })); }
  });
  const client = new YTMDClient({ host: url }); client.findFirstSong = async () => fixture().song;
  const queue = new QueueManager({ ytmd: client, queueCheckDelayMs: 1, logger: { info() {}, error() {} } });
  const result = await queue.handleRequest(request());
  assert.equal(result.code, 'queue_unconfirmed'); assert.equal(result.outcomeUncertain, true); assert.equal(writes, 1);
  assert.equal((await queue.handleRequest(request())).code, 'cooldown');
});

test('delayed queue update is verified without repeating the enqueue', async () => {
  const f = fixture(); let reads = 0;
  f.ytmd.getQueue = async () => ({ items: ++reads < 4 ? [] : [item('video123')] });
  const result = await f.queue.handleRequest(request());
  assert.equal(result.code, 'added'); assert.equal(result.queuePosition, 1);
  assert.equal(f.calls.filter(call => call[0] === 'addToQueue').length, 1);
});

test('unreadable initial queue makes no write; failed verification after a write is uncertain', async () => {
  const f = fixture(); f.ytmd.getQueue = async () => { throw new Error(); };
  assert.equal((await f.queue.handleRequest(request())).outcomeUncertain, false);
  assert.equal(f.calls.filter(call => call[0] === 'addToQueue').length, 0);
  let reads = 0; f.ytmd.getQueue = async () => { if (++reads > 1) throw new Error(); return { items: [] }; };
  assert.equal((await f.queue.handleRequest(request())).code, 'queue_unconfirmed');
  assert.equal(f.calls.filter(call => call[0] === 'addToQueue').length, 1);
});

test('concurrent same-song requests observe separate additions, and changed rules revoke a waiting write', async () => {
  const f = fixture();
  const results = await Promise.all(['alice', 'bob'].map(user => f.queue.handleRequest(request(user))));
  assert.deepEqual(results.map(result => result.queuePosition), [1, 2]);
  const g = fixture(); const read = g.ytmd.getQueue;
  g.ytmd.getQueue = async () => { g.queue.maxSongSeconds = 30; return read(); };
  assert.equal((await g.queue.handleRequest(request())).code, 'rules_changed');
  assert.equal(g.calls.filter(call => call[0] === 'addToQueue').length, 0);
});
