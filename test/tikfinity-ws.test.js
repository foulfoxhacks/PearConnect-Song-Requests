import test from 'node:test';
import assert from 'node:assert/strict';
import { once } from 'node:events';
import { readFile } from 'node:fs/promises';
import { setTimeout as delay } from 'node:timers/promises';
import { WebSocketServer } from 'ws';
import { startTikfinitySocket, parseTikfinityEvent } from '../src/platforms/tikfinity-ws.js';
import { loadConfig } from '../src/config.js';
import { fixture, log } from './helpers.js';
const recorded = await readFile(new URL('./fixtures/tikfinity-chat.json', import.meta.url), 'utf8');
const nested = await readFile(new URL('./fixtures/tikfinity-chat-nested.json', import.meta.url), 'utf8');
async function until(fn) { for (let i = 0; i < 150; i++) { if (fn()) return; await delay(10); } throw new Error('Condition not observed.'); }

test('documented envelope fixture preserves exact IDs and Unicode; malformed identities fail closed', () => {
  const parsed = parseTikfinityEvent(recorded);
  assert.equal(parsed.userId, '1234567890123456789'); assert.equal(parsed.message, '!sr Björk  "Jóga" 🦊');
  assert.deepEqual(parseTikfinityEvent('{"event":"gift","data":{}}'), { type: 'other' });
  for (const raw of ['{', '[]', 'null', '{}', '{"event":"chat","data":{"nickname":"alice","comment":"!sr x"}}']) assert.throws(() => parseTikfinityEvent(raw));
  for (const patch of [{ uniqueId: '' }, { uniqueId: {} }, { userId: 1234567890123456789 }, { comment: 'x'.repeat(1025) }, { comment: '!sr x\u0000' }]) {
    const value = JSON.parse(recorded); Object.assign(value.data, patch); assert.throws(() => parseTikfinityEvent(JSON.stringify(value)));
  }
});

test('nested current connector fields normalize identically; conflicting identities are rejected', () => {
  assert.deepEqual(parseTikfinityEvent(nested), parseTikfinityEvent(recorded));
  const value = JSON.parse(nested); value.data.userId = 'different-id';
  assert.throws(() => parseTikfinityEvent(JSON.stringify(value)), /Conflicting/);
  delete value.data.userId; value.data.user.idStr = 123;
  assert.throws(() => parseTikfinityEvent(JSON.stringify(value)), /string/);
});

test('real local WebSocket tracks socket/chat/commands, deduplicates across reconnect, and stops cleanly', async t => {
  const server = new WebSocketServer({ host: '127.0.0.1', port: 0 }); await once(server, 'listening');
  const { queue, calls } = fixture({ dryRun: true }); const received = [];
  const original = queue.handleRequest.bind(queue); queue.handleRequest = async data => { received.push(data); return original(data); };
  const connections = []; server.on('connection', ws => connections.push(ws));
  const input = startTikfinitySocket({ url: `ws://127.0.0.1:${server.address().port}/`, commands: loadConfig({ DRY_RUN: 'true' }).commands, queue, log, reconnectMinMs: 10, reconnectMaxMs: 20 });
  t.after(async () => { input.stop(); for (const ws of server.clients) ws.terminate(); await new Promise(resolve => server.close(resolve)); });
  await until(() => input.status().state === 'connected_waiting_for_chat');
  assert.equal(input.status().lastChatAt, null); connections[0].send('{bad');
  await until(() => input.status().invalidEvents === 1);
  connections[0].send('{"event":"gift","data":{}}'); await until(() => input.status().lastEventAt);
  assert.equal(input.status().lastChatAt, null);
  connections[0].send(recorded); connections[0].send(recorded);
  await until(() => received.length === 1); assert.ok(input.status().lastCommandAt);
  assert.equal(received[0].query, 'Björk  "Jóga" 🦊'); assert.equal(calls.length, 0);
  connections[0].terminate(); await until(() => connections.length === 2);
  connections[1].send(nested); const next = JSON.parse(recorded); next.data.msgId = 'another-id'; connections[1].send(JSON.stringify(next));
  await until(() => received.length === 2); input.stop(); await delay(50); assert.equal(connections.length, 2);
});

test('migration preserves Advanced while explicit Simple defaults paused; unsafe endpoints rejected', () => {
  assert.equal(loadConfig({ DRY_RUN: 'true' }).connectionMode, 'advanced');
  const simple = loadConfig({ DRY_RUN: 'true', CONNECTION_MODE: 'simple' }); assert.equal(simple.requestsEnabled, false);
  for (const url of ['ws://remote.invalid/', 'https://localhost/', 'ws://user:pass@localhost/', 'ws://localhost/?token=x', 'ws://localhost/path']) assert.throws(() => loadConfig({ DRY_RUN: 'true', TIKFINITY_WS_URL: url }));
});
