import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import vm from 'node:vm';
import { normalizePlayback, artworkUrl, LastFmClient, boundedBody } from '../src/playback.js';
import { validateAppearance } from '../desktop/appearance.js';
import { PlaybackStudio, newOverlayToken } from '../desktop/studio.js';

test('playback exposes bounded music fields, handles missing timing and clamps invalid values', () => {
  const track = normalizePlayback({ title: 'Jóga', artist: 'Björk', songDuration: 240, elapsedSeconds: 400, isPaused: true, token: 'private', image: { secret: true } }, 1000);
  assert.equal(track.elapsed, 240); assert.equal(track.paused, true); assert.equal(track.updatedAt, 1000);
  assert.doesNotMatch(JSON.stringify(track), /private|secret/);
  assert.equal(normalizePlayback({ title: 'Live', songDuration: 0, elapsedSeconds: -1 }).duration, null);
  assert.equal(normalizePlayback({ title: 'Unknown' }).elapsed, null);
  assert.equal(normalizePlayback(null), null);
});
test('artwork only accepts known HTTPS image hosts, never credentials or arbitrary localhost URLs', () => {
  assert.equal(artworkUrl('https://i.ytimg.com/vi/abcdefghijk/hqdefault.jpg'), 'https://i.ytimg.com/vi/abcdefghijk/hqdefault.jpg');
  for (const url of ['http://i.ytimg.com/a', 'https://i.ytimg.com.attacker.test/a', 'https://127.0.0.1/a', 'file:///private', 'data:image/png,a', 'https://key@i.ytimg.com/a', 'https://i.ytimg.com:444/a']) assert.equal(artworkUrl(url), null);
});
test('clock follows player pause and seek, caps extrapolation and stops on stale updates', async () => {
  const context = { window: {} }; vm.runInNewContext(await readFile(new URL('../desktop/widget.js', import.meta.url), 'utf8'), context);
  const timing = context.window.PearWidget.timing;
  const t = { duration: 200, elapsed: 30, updatedAt: 1000, paused: false };
  assert.equal(timing(t, 3000).elapsed, 32); assert.equal(timing(t, 9000).elapsed, 34);
  assert.equal(timing({ ...t, paused: true }, 3000).elapsed, 30);
  assert.equal(timing({ ...t, elapsed: 100 }, 2000).remaining, 99);
  assert.equal(timing(t, 15000).stale, true); assert.equal(timing(t, 15000).elapsed, 30);
  assert.equal(timing({ ...t, elapsed: null }, 3000).remaining, null);
});
test('Last.fm requests use a private key, coalesce/cache and expose text metadata without artwork or remote HTML', async () => {
  let calls = 0;
  const client = new LastFmClient('a'.repeat(32), async (url, options) => {
    calls++; assert.equal(url.hostname, 'ws.audioscrobbler.com'); assert.equal(options.redirect, 'error'); assert.equal(url.searchParams.get('api_key'), 'a'.repeat(32));
    return Response.json({ track: { listeners: '123', playcount: '900', url: 'https://www.last.fm/music/Bj%C3%B6rk/_/J%C3%B3ga', image: ['private-image'], wiki: '<script>bad</script>', toptags: { tag: [{ name: 'art pop' }] } } });
  });
  const track = { title: 'Jóga', artist: 'Björk' };
  const results = await Promise.all([client.read(track), client.read(track)]); await client.read(track);
  assert.equal(calls, 1); assert.equal(results[0].listeners, '123'); assert.deepEqual(results[0].tags, ['art pop']);
  assert.doesNotMatch(JSON.stringify(results), /private-image|script|aaaaaaaa/);
  const invalid = new LastFmClient('b'.repeat(32), async () => Response.json({ error: 10, message: 'secret-key' }));
  assert.deepEqual(await invalid.read(track), { state: 'invalid_key' });
  const off = new LastFmClient('', () => { throw new Error('must not call'); }); assert.equal((await off.read(track)).state, 'disabled');
});
test('bounded body cancels oversized remote responses and appearance rejects injection', async () => {
  await assert.rejects(boundedBody(new Response('abcdefgh'), 4), /exceeds/);
  for (const value of [{ WIDGET_ACCENT: 'red;url(file:)' }, { APP_BACKGROUND: '../secret' }, { OVERLAY_PORT: '0' }, { LASTFM_KEY: 'bad' }, { NODE_OPTIONS: '--inspect' }]) assert.throws(() => validateAppearance(value));
});
test('overlay is read-only, private, local, sanitized and revoked by rotation; artwork is fetched once', async t => {
  let reads = 0, imageReads = 0;
  const controller = { busy: false, env: { OVERLAY_ENABLED: 'true', OVERLAY_TOKEN: newOverlayToken(), OVERLAY_PORT: '18787', LASTFM_KEY: 'a'.repeat(32) }, engine: {
    lifecycle: 'running', generation: 0, playerState: 'ready', config: { token: 'private-player' }, currentTrack: { title: '<script>music</script>', artist: 'Fixture', songDuration: 180, elapsedSeconds: 12, isPaused: false, imageSrc: 'https://i.ytimg.com/a.png' },
    async testPlayer() { reads++; }
  } };
  const studio = new PlaybackStudio(controller, { fetcher: async () => { imageReads++; return new Response(Buffer.from('PNG fixture'), { headers: { 'content-type': 'image/png' } }); } });
  t.after(() => studio.close());
  await studio.start(); await studio.poll();
  for (let i = 0; i < 20 && !studio.snapshot().art; i++) await new Promise(resolve => setTimeout(resolve, 5));
  assert.equal(studio.overlayState, 'ready'); assert.ok(studio.snapshot().art); await studio.poll(); assert.equal(imageReads, 1);
  const url = studio.overlayUrl(), base = new URL('.', url).href;
  assert.equal((await fetch(url)).status, 200);
  const result = await fetch(base + 'state'); const data = await result.json();
  assert.equal(data.track.title, '<script>music</script>'); assert.equal('metadata' in data, false); assert.doesNotMatch(JSON.stringify(data), /private-player|aaaaaaaa/);
  assert.equal((await fetch(base + 'state', { headers: { Origin: 'https://attacker.test' } })).status, 403);
  assert.equal((await fetch(base + 'state', { method: 'POST' })).status, 403);
  assert.equal((await fetch(url.replace(controller.env.OVERLAY_TOKEN, '0'.repeat(64)))).status, 404);
  controller.env.OVERLAY_TOKEN = newOverlayToken(); await studio.configure(); assert.equal((await fetch(url)).status, 404);
  controller.engine.playerState = 'disconnected'; assert.equal(studio.snapshot().track, null);
  assert.ok(reads > 0);
});
