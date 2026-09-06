import test from 'node:test';
import assert from 'node:assert/strict';
import net from 'node:net';
import { once } from 'node:events';
import { setTimeout as delay } from 'node:timers/promises';
import { DiscordPresence, DISCORD_CLIENT_ID, rpcFrame, presenceActivity } from '../desktop/discord-presence.js';
const until = async fn => { for (let i = 0; i < 150; i++) { if (fn()) return; await delay(10); } throw new Error('RPC condition not observed'); };

test('presence uses explicit live state, excludes private input and makes track sharing optional', () => {
  const s = { running: true, live: false, requestsEnabled: true, track: { title: 'Private song', artist: 'Artist', token: 'secret' } };
  const a = presenceActivity(s, 1000);
  assert.equal(a.details, 'Preparing the next stream'); assert.doesNotMatch(JSON.stringify(a), /Private song|secret/);
  assert.equal(presenceActivity({ ...s, live: true, shareSong: true }, 1000).state, 'Private song · Artist');
  assert.equal(presenceActivity({ ...s, running: false }, 1000), null);
});

test('real IPC framing handles split messages, presence ACK, PING and clearing without secrets', async t => {
  const messages = [], clients = new Set();
  const server = net.createServer(socket => {
    clients.add(socket); socket.on('close', () => clients.delete(socket)); socket.on('error', () => {}); let buffer = Buffer.alloc(0);
    socket.on('data', data => {
      buffer = Buffer.concat([buffer, data]);
      while (buffer.length >= 8 && buffer.length >= buffer.readUInt32LE(4) + 8) {
        const size = buffer.readUInt32LE(4), op = buffer.readUInt32LE(0), value = JSON.parse(buffer.subarray(8, 8 + size)); buffer = buffer.subarray(8 + size);
        messages.push({ op, value });
        if (op === 0) {
          const ready = rpcFrame(1, { evt: 'READY' }); socket.write(ready.subarray(0, 5)); socket.write(ready.subarray(5));
          socket.write(rpcFrame(3, { probe: 1 }));
        } else if (op === 1) socket.write(rpcFrame(1, { cmd: value.cmd, nonce: value.nonce, data: value.args }));
      }
    });
  });
  await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
  const rpc = new DiscordPresence({ getState: () => ({ running: true, requestsEnabled: true }), paths: ['fixture'], intervalMs: 0, connect: () => net.createConnection({ port: server.address().port, host: '127.0.0.1' }) });
  t.after(async () => { await rpc.close(); for (const c of clients) c.destroy(); await new Promise(resolve => server.close(resolve)); });
  rpc.configure({}); await until(() => rpc.state === 'active');
  assert.deepEqual(messages[0].value, { v: 1, client_id: DISCORD_CLIENT_ID });
  assert.ok(messages.some(m => m.op === 4));
  assert.equal(messages.filter(m => m.value.cmd === 'SET_ACTIVITY').length, 1); rpc.tick(); await delay(20);
  assert.equal(messages.filter(m => m.value.cmd === 'SET_ACTIVITY').length, 1);
  rpc.setLive(true); await until(() => messages.some(m => m.value.args?.activity?.details === 'Live on stream'));
  await rpc.close(); assert.equal(messages.at(-1).value.args.activity, null);
  assert.doesNotMatch(JSON.stringify(messages), /client_secret|access_token|AUTHORIZE|AUTHENTICATE/);
});

test('absent Discord is nonfatal; disabling prevents reconnection', async () => {
  let calls = 0;
  const rpc = new DiscordPresence({ getState: () => ({ running: true }), paths: ['missing'], connect: () => { calls++; throw new Error('Absent'); } });
  rpc.configure({}); assert.equal(rpc.state, 'waiting_for_discord');
  await rpc.close(); rpc.tick(); assert.equal(calls, 1); assert.equal(rpc.state, 'disabled');
});
