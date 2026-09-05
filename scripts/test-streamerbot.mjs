import { readFile, writeFile, mkdir } from 'node:fs/promises';
import { spawn } from 'node:child_process';
import { once } from 'node:events';
import assert from 'node:assert/strict';
import { actions } from './build-streamerbot.mjs';
import { fixture, log } from '../test/helpers.js';
import { createTikfinityApp } from '../src/platforms/tikfinity.js';
const source = await readFile('integrations/streamerbot/PearConnect.cs', 'utf8');
await mkdir('test/streamerbot-csharp/generated', { recursive: true });
for (let i = 0; i < actions.length; i++) {
  const text = source.replace('public class CPHInline', `public class Script${i} : CPHInlineBase`)
    .replace('private const string Route = "/tikfinity";', `private const string Route = "${actions[i][1]}";`);
  await writeFile(`test/streamerbot-csharp/generated/Script${i}.cs`, text);
}
const f = fixture();
const server = createTikfinityApp({ queue: f.queue, secret: 'ci-test-secret', skipAllowlist: ['mod'], log }).listen(0, '127.0.0.1');
await once(server, 'listening');
try {
  const child = spawn('dotnet', ['run', '--project', 'test/streamerbot-csharp/BridgeTests.csproj', '--configuration', 'Release', '--', `http://127.0.0.1:${server.address().port}`], { stdio: 'inherit' });
  const timeout = setTimeout(() => child.kill(), 180000);
  const result = await new Promise((resolve, reject) => { child.once('error', reject); child.once('exit', resolve); }).finally(() => clearTimeout(timeout));
  assert.equal(result, 0, 'C# bridge compilation or integration checks failed.');
  assert.deepEqual(f.calls.filter(c => c[0] === 'findFirstSong').map(c => c[1]), ['Björk "Jóga" 🦊', 'Custom Query', '!srtune', 'Delivery Test']);
  assert.equal(f.calls.filter(c => c[0] === 'addToQueue').length, 4);
  assert.equal(f.calls.filter(c => c[0] === 'next').length, 1);
  console.log('PASS: actual C# POSTs reached the Node bridge; exact Unicode/prefix payloads and mutation counts verified.');
} finally { server.closeAllConnections(); await new Promise(resolve => server.close(resolve)); }
