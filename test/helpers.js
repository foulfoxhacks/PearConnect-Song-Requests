import { once } from 'node:events';
import http from 'node:http';
import { QueueManager } from '../src/queue-manager.js';
import { createTikfinityApp } from '../src/platforms/tikfinity.js';
export const log = { info() {}, warn() {}, error() {} };
export function fixture(options = {}) {
  const calls = [];
  const song = { videoId: 'video123', title: 'Test Song', artist: 'Test Artist', durationSec: 120 };
  const ytmd = Object.fromEntries(['findFirstSong', 'addToQueue', 'getCurrentSong', 'getNextSong', 'next'].map((method) => [method, async (...args) => { calls.push([method, ...args]); return ['findFirstSong', 'getCurrentSong', 'getNextSong'].includes(method) ? song : null; }]));
  ytmd.getQueue = async () => ({ items: calls.filter(call => call[0] === 'addToQueue').map(call => ({ playlistPanelVideoRenderer: { videoId: call[1], title: { simpleText: song.title } } })) });
  const queue = new QueueManager({ ytmd, logger: log, queueCheckDelayMs: 1, ...options });
  return { queue, ytmd, calls, song };
}
export async function serve(t, handler) {
  const server = http.createServer(handler);
  server.listen(0, '127.0.0.1');
  await once(server, 'listening');
  t.after(async () => { server.closeAllConnections(); await new Promise((resolve) => server.close(resolve)); });
  return { server, url: `http://127.0.0.1:${server.address().port}` };
}
export async function webhook(t, options = {}) {
  const f = fixture(options);
  const { server, url } = await serve(t, createTikfinityApp({ queue: f.queue, log, ...options }));
  const send = async (path = '/tikfinity', payload = { user: 'alice', query: 'Test Song' }, settings = {}) => {
    const res = await fetch(url + path, { method: 'POST', ...settings, headers: { 'Content-Type': 'application/json', ...settings.headers }, body: JSON.stringify(payload) });
    return { status: res.status, body: await res.json(), headers: res.headers };
  };
  return { ...f, server, url, send };
}
export const request = (user = 'alice', extra = {}) => ({ user, query: 'a song', platform: 'tiktok', ...extra });
