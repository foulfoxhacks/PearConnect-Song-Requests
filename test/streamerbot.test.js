import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { buildImport, decodeImport, actions } from '../scripts/build-streamerbot.mjs';
test('native import deterministically round-trips all five actions without overwriting server settings', async () => {
  const source = await readFile(new URL('../integrations/streamerbot/PearConnect.cs', import.meta.url), 'utf8');
  const saved = await readFile(new URL('../integrations/streamerbot/PearConnect.sb', import.meta.url), 'utf8');
  assert.equal(buildImport(source), saved); const p = decodeImport(saved);
  assert.equal(p.meta.autoRunAction, null); assert.equal(p.version, 11);
  for (const name of ['queues', 'commands', 'websocketServers', 'websocketClients', 'timers']) assert.deepEqual(p.data[name], []);
  assert.equal(p.data.actions.length, 5);
  for (let n = 0; n < 5; n++) {
    const action = p.data.actions[n]; assert.deepEqual(action.triggers, []);
    const decoded = Buffer.from(action.actions[0].byteCode, 'base64').toString('utf8');
    assert.equal(decoded, source.replace('private const string Route = "/tikfinity";', `private const string Route = "${actions[n][1]}";`));
    assert.equal(action.actions[0].type, 99999);
  }
  const ids = p.data.actions.flatMap(a => [a.id, a.actions[0].id]); assert.equal(new Set(ids).size, 10);
});
