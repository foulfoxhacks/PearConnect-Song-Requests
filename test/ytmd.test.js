import test from 'node:test';
import assert from 'node:assert/strict';
import { serve } from './helpers.js';
import { YTMDClient, extractFirstSong } from '../src/ytmd.js';
import { readFile } from 'node:fs/promises';
const row = duration => ({ musicResponsiveListItemRenderer: { playlistItemData: { videoId: 'video123' }, flexColumns: [{ musicResponsiveListItemFlexColumnRenderer: { text: { runs: [{ text: 'A song' }] } } }], fixedColumns: [{ musicResponsiveListItemFixedColumnRenderer: { text: { runs: [{ text: duration }] } } }] } });
const overview = JSON.parse(await readFile(new URL('./fixtures/pear-search-overview.json', import.meta.url)));
const songs = JSON.parse(await readFile(new URL('./fixtures/pear-search-songs.json', import.meta.url)));

test('live sanitized overview and Songs fixtures resolve the same recording with its actual duration', async t => {
  assert.equal(extractFirstSong(overview).durationSec, 0);
  assert.deepEqual(extractFirstSong(songs), { videoId: 'PLXzNgd-Wgw', title: 'Hear Me Now (feat. DIAMANTE)', artist: 'Bad Wolves', durationSec: 220 });
  const calls = [];
  const { url } = await serve(t, async (req, res) => {
    assert.equal(req.url, '/api/v1/search'); let body = ''; for await (const chunk of req) body += chunk;
    const input = JSON.parse(body); calls.push(input);
    res.writeHead(200, { 'Content-Type': 'application/json' }); res.end(JSON.stringify(input.params ? songs : overview));
  });
  const client = new YTMDClient({ host: url });
  for (const query of ['Diamante - Hear Me Now', 'Bad Wolves - Hear Me Now feat. DIAMANTE']) {
    assert.equal((await client.findFirstSong(query)).durationSec, 220);
    assert.deepEqual(calls.slice(-2).map(call => call.query), [query, query]);
  }
  assert.equal(calls.length, 4);
});

test('duration lookup never substitutes another recording and performs at most two filtered searches', async t => {
  let calls = 0;
  const other = structuredClone(songs); other.contents.forEach(item => { item.musicResponsiveListItemRenderer.playlistItemData.videoId = 'different-video'; });
  const { url } = await serve(t, async (req, res) => {
    let body = ''; for await (const chunk of req) body += chunk; calls++;
    res.writeHead(200, { 'Content-Type': 'application/json' }); res.end(JSON.stringify(JSON.parse(body).params ? other : overview));
  });
  const song = await new YTMDClient({ host: url }).findFirstSong('Hear Me Now');
  assert.equal(song.videoId, 'PLXzNgd-Wgw'); assert.equal(song.durationSec, 0); assert.equal(calls, 3);
});

test('metadata parsing accepts inline/simpleText lengths but excludes linked timestamp titles and play counts', () => {
  const data = structuredClone(songs.contents[0]);
  const renderer = data.musicResponsiveListItemRenderer;
  renderer.flexColumns[1].musicResponsiveListItemFlexColumnRenderer.text = { simpleText: 'Bad Wolves • Disobey • 3:40' };
  assert.equal(extractFirstSong(data).durationSec, 220);
  renderer.flexColumns[0].musicResponsiveListItemFlexColumnRenderer.text = { simpleText: '3:40' };
  renderer.flexColumns[1].musicResponsiveListItemFlexColumnRenderer.text = { runs: [{ text: 'Bad Wolves • ' }, { text: '3:40', navigationEndpoint: { browseEndpoint: { browseId: 'album' } } }] };
  assert.equal(extractFirstSong(data).durationSec, 0);
  renderer.flexColumns[1].musicResponsiveListItemFlexColumnRenderer.text = { simpleText: 'Bad Wolves • 119M plays' };
  assert.equal(extractFirstSong(data).durationSec, 0);
  renderer.flexColumns[1].musicResponsiveListItemFlexColumnRenderer.text = { simpleText: 'Bad Wolves • LIVE' };
  assert.equal(extractFirstSong(data).durationSec, 0);
});

test('concurrent searches do not overlap the upstream shared response channel', async t => {
  let active = 0, peak = 0;
  const { url } = await serve(t, async (req, res) => {
    let body = ''; for await (const chunk of req) body += chunk;
    active++; peak = Math.max(peak, active); await new Promise(resolve => setTimeout(resolve, 20));
    const data = row('3:42'); data.musicResponsiveListItemRenderer.playlistItemData.videoId = JSON.parse(body).query;
    active--; res.writeHead(200, { 'Content-Type': 'application/json' }); res.end(JSON.stringify(data));
  });
  const client = new YTMDClient({ host: url });
  const results = await Promise.all(['first', 'second', 'third'].map(query => client.findFirstSong(query)));
  assert.equal(peak, 1); assert.deepEqual(results.map(song => song.videoId), ['first', 'second', 'third']);
});
test('search parser handles fixed-column duration, hours, invalid times, and cycles', () => {
  assert.equal(extractFirstSong(row('3:42')).durationSec, 222);
  assert.equal(extractFirstSong(row('1:02:03')).durationSec, 3723);
  assert.equal(extractFirstSong(row('1:99')).durationSec, 0);
  const data = row('3:42'); data.self = data; assert.equal(extractFirstSong(data).title, 'A song');
  assert.equal(extractFirstSong(null), null); assert.equal(extractFirstSong({}), null);
});
test('client sends actual Pear Desktop routes, methods, headers and payloads', async t => {
  const calls = [];
  const { url } = await serve(t, async (req, res) => {
    let body = ''; for await (const chunk of req) body += chunk;
    calls.push({ path: req.url, method: req.method, auth: req.headers.authorization, body: body ? JSON.parse(body) : null });
    if (req.url.includes('/search')) { res.writeHead(200, { 'Content-Type': 'application/json' }); res.end(JSON.stringify(row('3:42'))); }
    else { res.writeHead(204); res.end(); }
  });
  const client = new YTMDClient({ host: url, token: 'test-token' });
  assert.equal((await client.findFirstSong('Björk "Jóga"')).durationSec, 222);
  await client.addToQueue('video123'); assert.equal(await client.getCurrentSong(), null); await client.getNextSong(); await client.getQueue(); await client.next();
  assert.deepEqual(calls.map(c => [c.method, c.path]), [['POST', '/api/v1/search'], ['POST', '/api/v1/queue'], ['GET', '/api/v1/song'], ['GET', '/api/v1/queue/next'], ['GET', '/api/v1/queue'], ['POST', '/api/v1/next']]);
  assert.deepEqual(calls[1].body, { videoId: 'video123', insertPosition: 'INSERT_AT_END' }); assert.equal(calls[0].body.query, 'Björk "Jóga"');
  assert.ok(calls.every(c => c.auth === 'Bearer test-token'));
});
test('auth uses encoded client ID and validates returned token', async t => {
  let path;
  const { url } = await serve(t, (req, res) => { path = req.url; res.writeHead(200, { 'Content-Type': 'application/json' }); res.end('{"accessToken":"safe-test-token"}'); });
  assert.equal(await YTMDClient.requestToken({ host: url, clientId: 'Pear Connect' }), 'safe-test-token'); assert.equal(path, '/auth/Pear%20Connect');
});
test('remote errors do not leak sensitive body content', async t => {
  const { url } = await serve(t, (_req, res) => { res.writeHead(401); res.end('TOP-SECRET'); });
  await assert.rejects(new YTMDClient({ host: url }).getCurrentSong(), error => error.status === 401 && !error.message.includes('TOP-SECRET'));
});
test('non-JSON and malformed responses fail clearly', async t => {
  const { url } = await serve(t, (_req, res) => { res.writeHead(200, { 'Content-Type': 'text/html' }); res.end('<html>not API</html>'); });
  await assert.rejects(new YTMDClient({ host: url }).getCurrentSong(), /non-JSON/);
});
test('network timeouts cancel slow responses and do not retry', async t => {
  let count = 0; const { url } = await serve(t, () => { count++; });
  await assert.rejects(new YTMDClient({ host: url, timeoutMs: 50 }).next(), { code: 'UPSTREAM_TIMEOUT' }); assert.equal(count, 1);
});
test('timeout remains active while response body is streamed', async t => {
  const { url } = await serve(t, (_req, res) => { res.writeHead(200, { 'Content-Type': 'application/json' }); res.write('{'); });
  await assert.rejects(new YTMDClient({ host: url, timeoutMs: 50 }).getCurrentSong(), { code: 'UPSTREAM_TIMEOUT' });
});
test('redirects are not followed, preventing credential forwarding', async t => {
  let calls = 0; const { url } = await serve(t, (_req, res) => { calls++; res.writeHead(307, { Location: '/elsewhere' }); res.end(); });
  await assert.rejects(new YTMDClient({ host: url, token: 'private-test' }).getCurrentSong()); assert.equal(calls, 1);
});
