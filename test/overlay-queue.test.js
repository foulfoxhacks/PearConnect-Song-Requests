import test from 'node:test';
import assert from 'node:assert/strict';
import { once } from 'node:events';
import { setTimeout as delay } from 'node:timers/promises';
import WebSocket from 'ws';
import { upcomingQueue } from '../desktop/queue-view.js';
import { PlaybackStudio, newOverlayToken } from '../desktop/studio.js';
import { validateAppearance } from '../desktop/appearance.js';
const row = (id, selected = false, title = id) => ({ playlistPanelVideoRenderer: { videoId: id, selected, title: { simpleText: title }, shortBylineText: { simpleText: 'Artist' }, lengthText: { simpleText: '3:14' } } });

test('upcoming queue excludes history/current, preserves duplicate order and refuses ambiguous position', () => {
  const raw = { items: [row('old'), row('current', true), row('next'), row('next')] };
  assert.deepEqual(upcomingQueue(raw, { videoId: 'current' }).tracks.map(t => t.videoId), ['next', 'next']);
  assert.equal(upcomingQueue(raw, { videoId: 'different' }).state, 'position_unknown');
  assert.equal(upcomingQueue({ items: [row('same'), row('same')] }, { videoId: 'same' }).state, 'position_unknown');
  assert.equal(upcomingQueue({ items: [row('one'), row('two')] }, { videoId: 'one' }).tracks[0].videoId, 'two');
  assert.equal(upcomingQueue({ items: [row('one', true), row('two', true)] }, {}).state, 'position_unknown');
  assert.equal(upcomingQueue(null, {}).state, 'empty');
  assert.equal(upcomingQueue({ items: [row('now', true), ...Array.from({ length: 20 }, (_, i) => row(String(i)))] }, {}).tracks.length, 5);
});

test('social settings allow public text but reject unsafe paths, overlong handles and unbounded rotation', () => {
  validateAppearance({ SOCIAL_TIKTOK: '@Jóga', SOCIAL_WEBSITE: 'example.test', SOCIAL_SECONDS: '6', SOCIAL_ICONS: 'brand' });
  for (const value of [{ SOCIAL_SECONDS: '0' }, { SOCIAL_SECONDS: '999' }, { SOCIAL_ICONS: '../../private' }, { SOCIAL_TWITCH: 'x'.repeat(101) }, { SOCIAL_DISCORD: 'line\nnext' }]) assert.throws(() => validateAppearance(value));
});

test('a slow queue never stalls playback updates and a late old-track result is discarded', async t => {
  let complete, calls = 0;
  const c = { env: {}, engine: { lifecycle: 'running', generation: 0, playerState: 'ready', config: { token: 'fixture' }, currentTrack: { title: 'First', videoId: 'abcdefghijk', elapsedSeconds: 10 },
    async testPlayer() {}, player: { getQueue() { calls++; return new Promise(resolve => { complete = resolve; }); } } } };
  const studio = new PlaybackStudio(c); t.after(() => studio.close());
  await studio.poll(); await delay(0);
  c.engine.currentTrack = { title: 'Second', videoId: 'lmnopqrstuv', elapsedSeconds: 30 };
  await studio.poll();
  assert.equal(studio.snapshot().track.title, 'Second'); assert.equal(studio.snapshot().track.elapsed, 30); assert.equal(calls, 1);
  complete({ items: [row('abcdefghijk', true), row('stale-next1')] }); await delay(0);
  assert.equal(studio.snapshot().queue.state, 'unavailable');
});

test('real overlay WebSocket sends fresh ordered queue, rejects origins/writes and revokes connected clients', async t => {
  let raw = { items: [row('abcdefghijk', true), row('next-video1', false, '<script>hello</script>')] };
  const c = { env: { OVERLAY_ENABLED: 'true', OVERLAY_PORT: '0', OVERLAY_TOKEN: newOverlayToken(), LASTFM_KEY: 'a'.repeat(32) }, engine: {
    lifecycle: 'running', generation: 0, playerState: 'ready', config: { token: 'private-player' }, currentTrack: { title: 'Current', videoId: 'abcdefghijk' },
    async testPlayer() {}, player: { async getQueue() { return raw; } },
  } };
  const studio = new PlaybackStudio(c); t.after(() => studio.close()); await studio.start();
  for (let i = 0; i < 100 && studio.snapshot().queue.state !== 'ready'; i++) await delay(5);
  const endpoint = new URL('./events', studio.overlayUrl()); endpoint.protocol = 'ws:';
  const ws = new WebSocket(endpoint); const received = []; ws.on('message', b => received.push(JSON.parse(b))); t.after(() => ws.terminate());
  await once(ws, 'open');
  for (let i = 0; i < 100 && !received.length; i++) await delay(5);
  assert.equal(received[0].queue.tracks[0].title, '<script>hello</script>');
  assert.doesNotMatch(JSON.stringify(received), /private-player|aaaaaaaa|OVERLAY_TOKEN/);
  c.env.SOCIAL_ENABLED = 'true'; c.env.SOCIAL_TIKTOK = '@streamer';
  const socialData = await (await fetch(new URL('./state', studio.socialUrl()))).json();
  assert.equal(socialData.appearance.SOCIAL_TIKTOK, '@streamer');
  assert.doesNotMatch(JSON.stringify(socialData), /private-player|Current|LASTFM|WIDGET|token/i);
  raw.items.push(row('last-video1')); await studio.poll();
  for (let i = 0; i < 100 && received.at(-1).queue.total !== 2; i++) await delay(5);
  assert.equal(received.at(-1).queue.total, 2);
  const blocked = new WebSocket(endpoint, { origin: 'https://attacker.test' });
  assert.match(String((await once(blocked, 'error'))[0]), /403/);
  const writer = new WebSocket(endpoint); await once(writer, 'open'); writer.send('{"skip":true}');
  assert.equal((await once(writer, 'close'))[0], 1008);
  c.engine.playerState = 'disconnected'; await studio.poll();
  assert.equal(studio.snapshot().queue.state, 'unavailable');
  const ended = once(ws, 'close'); c.env.OVERLAY_TOKEN = newOverlayToken(); await studio.configure(); await ended;
  endpoint.port = new URL(studio.overlayUrl()).port;
  const revoked = new WebSocket(endpoint); assert.match(String((await once(revoked, 'error'))[0]), /403/);
});
