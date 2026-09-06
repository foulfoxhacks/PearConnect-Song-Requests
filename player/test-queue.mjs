import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createQueueCompatibility } from './overlay/src/queue-compat.ts';
const id = 'PLXzNgd-Wgw';
const seed = 'M38aWHxwtXE';
const row = (videoId, selected = false) => ({ playlistPanelVideoRenderer: { videoId, selected } });
function fixture() {
  const state = { items: [row(seed, true)], nextQueueItemId: 2, queueContextParams: 'stale-context' };
  const requests = [], writes = [];
  let clock = 100;
  let fetcher = async () => ({ queueDatas: [{ content: row(id) }] });
  let dispatch = action => state.items.splice(action.payload.index, 0, ...action.payload.items);
  const queue = { queue: { store: { store: { getState: () => ({ queue: state }) } }, getItems: () => state.items }, dispatch: action => { writes.push(action); dispatch(action); } };
  let activeQueue = queue;
  const app = { networkManager: { fetch: (...args) => { requests.push(args); return fetcher(...args); } } };
  const api = createQueueCompatibility({ getQueue: () => activeQueue, getApp: () => app, now: () => clock, sleep: async () => {} });
  return { api, state, requests, writes, queue, setFetcher: fn => fetcher = fn, setDispatch: fn => dispatch = fn, advance: () => clock = 99999, navigate: () => activeQueue = null };
}
test('fetches exact video metadata without stale queue context, appends once and verifies visibility', async () => {
  const f = fixture(); const result = await f.api.enqueue(id);
  assert.equal(result.queueVerified, true); assert.equal(result.queuePosition, 2);
  assert.deepEqual(f.requests, [['/music/get_queue', { videoIds: [id] }]]);
  assert.equal(f.writes.length, 1); assert.equal(f.state.items[0].playlistPanelVideoRenderer.selected, true);
});
test('ignores unrelated response entries and alternative videos', async () => {
  const f = fixture(); f.setFetcher(async () => ({ queueDatas: [{ content: row(seed) }, { content: row(id) }, { content: row(seed) }] }));
  assert.equal((await f.api.enqueue(id)).ok, true); assert.equal(f.writes[0].payload.items.length, 1);
});
test('missing, malformed and unplayable metadata never mutates the queue', async () => {
  for (const response of [null, {}, { queueDatas: {} }, { queueDatas: [{ content: row(seed) }] }, { queueDatas: [{ content: { playlistPanelVideoRenderer: { videoId: id, isPlayable: false } } }] }]) {
    const f = fixture(); f.setFetcher(async () => response);
    assert.equal((await f.api.enqueue(id)).code, 'queue_item_unavailable'); assert.equal(f.writes.length, 0);
  }
});
test('preview validates metadata without dispatching', async () => {
  const f = fixture(); assert.equal((await f.api.enqueue(id, 'INSERT_AT_END', 8000, true)).code, 'queue_preview_ready'); assert.equal(f.writes.length, 0);
});
test('network errors cannot become enqueue success', async () => {
  const f = fixture(); f.setFetcher(async () => { throw Error('private remote error'); });
  assert.deepEqual(await f.api.enqueue(id), { ok: false, code: 'metadata_unavailable', videoId: id }); assert.equal(f.writes.length, 0);
});
test('a changed queue during the lookup is not modified', async () => {
  const f = fixture(); f.setFetcher(async () => { f.navigate(); return { queueDatas: [{ content: row(id) }] }; });
  assert.equal((await f.api.enqueue(id)).code, 'queue_changed'); assert.equal(f.writes.length, 0);
});
test('a late lookup cannot enqueue after its request deadline', async () => {
  const f = fixture(); f.setFetcher(async () => { f.advance(); return { queueDatas: [{ content: row(id) }] }; });
  assert.equal((await f.api.enqueue(id)).code, 'queue_timeout'); assert.equal(f.writes.length, 0);
});
test('no-op dispatch reports uncertainty and is never retried', async () => {
  const f = fixture(); f.setDispatch(() => {});
  const result = await f.api.enqueue(id); assert.equal(result.code, 'queue_unconfirmed'); assert.equal(result.outcomeUncertain, true); assert.equal(f.writes.length, 1);
});
test('a thrown dispatch remains uncertain and is never retried', async () => {
  const f = fixture(); f.setDispatch(() => { throw Error('dispatch'); });
  assert.equal((await f.api.enqueue(id)).outcomeUncertain, true); assert.equal(f.writes.length, 1);
});
test('an existing occurrence alone is not proof of insertion', async () => {
  const f = fixture(); f.state.items.push(row(id)); f.setDispatch(() => {});
  assert.equal((await f.api.enqueue(id)).ok, false);
});
test('several concurrent additions serialize their metadata and writes', async () => {
  const f = fixture(); let active = 0, maximum = 0;
  f.setFetcher(async () => { active++; maximum = Math.max(maximum, active); await new Promise(r => setTimeout(r, 4)); active--; return { queueDatas: [{ content: row(id) }] }; });
  const results = await Promise.all([f.api.enqueue(id), f.api.enqueue(id), f.api.enqueue(id)]);
  assert.equal(maximum, 1); assert.deepEqual(results.map(r => r.queuePosition), [2, 3, 4]); assert.equal(f.writes.length, 3);
});
test('play-next inserts after the selected first track, not the end', async () => {
  const f = fixture(); f.state.items.push(row(seed));
  assert.equal((await f.api.enqueue(id, 'INSERT_AFTER_CURRENT_VIDEO')).queuePosition, 2);
  assert.deepEqual(f.state.items.map(r => r.playlistPanelVideoRenderer.videoId), [seed, id, seed]);
});
test('invalid requests and absent player state fail before metadata or writes', async () => {
  const f = fixture(); assert.equal((await f.api.enqueue('../oops')).code, 'invalid_request');
  assert.equal((await f.api.enqueue(id, 'CLEAR')).code, 'invalid_request');
  f.navigate(); assert.equal((await f.api.enqueue(id)).code, 'queue_not_ready');
  assert.equal(f.requests.length, 0); assert.equal(f.writes.length, 0);
});
