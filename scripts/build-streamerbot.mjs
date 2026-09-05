import { readFile, writeFile, mkdir } from 'node:fs/promises';
import { createHash } from 'node:crypto';
import { gzipSync, gunzipSync } from 'node:zlib';
import { fileURLToPath } from 'node:url';
const root = new URL('../', import.meta.url);
export const actions = [
  ['Song Request', '/tikfinity'], ['Now Playing', '/tikfinity/np'],
  ['Queue', '/tikfinity/queue'], ['Skip', '/tikfinity/skip'], ['Connection Test', '/tikfinity/test'],
];
const id = value => {
  const h = createHash('sha256').update('PearConnect-v0.2:' + value).digest('hex');
  return `${h.slice(0, 8)}-${h.slice(8, 12)}-4${h.slice(13, 16)}-a${h.slice(17, 20)}-${h.slice(20, 32)}`;
};
export function buildImport(source) {
  const payload = {
    meta: { name: 'PearConnect Song Requests', author: 'foulfoxhacks', version: '0.2.0', description: 'Five local TikFinity / Streamer.bot bridge actions. Configure globals before use.', autoRunAction: null, minimumVersion: null },
    data: { actions: actions.map(([name, path]) => ({
      id: id(name), queue: null, enabled: true, excludeFromHistory: false, excludeFromPending: false,
      name: `PearConnect - ${name}`, group: 'PearConnect', alwaysRun: false, randomAction: false, concurrent: false,
      triggers: [], actionGroups: [], collapsedGroups: [], actions: [{
        name: `PearConnect - ${name}`, description: 'Generated from reviewed PearConnect.cs',
        references: ['mscorlib.dll', 'System.dll', 'System.Core.dll', 'System.Net.Http.dll', '.\\Newtonsoft.Json.dll'],
        byteCode: Buffer.from(source.replace('private const string Route = "/tikfinity";', `private const string Route = "${path}";`), 'utf8').toString('base64'),
        precompile: true, delayStart: false, saveResultToVariable: false, saveToVariable: '',
        id: id(name + ':code'), weight: 0, type: 99999, group: null, enabled: true, index: 0,
      }],
    })), queues: [], commands: [], websocketServers: [], websocketClients: [], timers: [] },
    version: 11, exportedFrom: '0.2.6', minimumVersion: '0.2.6',
  };
  // Streamer.bot export envelope: base64(SBAE + gzip(UTF-8 JSON)).
  const gzip = gzipSync(Buffer.from(JSON.stringify(payload)), { level: 9 });
  gzip[9] = 255; // Platform-independent gzip OS marker.
  return Buffer.concat([Buffer.from('SBAE'), gzip]).toString('base64') + '\n';
}
export function decodeImport(encoded) {
  const bytes = Buffer.from(encoded.trim(), 'base64');
  if (bytes.subarray(0, 4).toString() !== 'SBAE') throw new Error('Not a Streamer.bot export.');
  return JSON.parse(gunzipSync(bytes.subarray(4)).toString('utf8'));
}
if (process.argv[1] === fileURLToPath(import.meta.url)) {
  const source = await readFile(new URL('integrations/streamerbot/PearConnect.cs', root), 'utf8');
  const target = new URL('integrations/streamerbot/PearConnect.sb', root);
  const expected = buildImport(source);
  if (process.argv.includes('--check')) {
    if (await readFile(target, 'utf8') !== expected) throw new Error('PearConnect.sb is stale. Run npm run build:streamerbot.');
    console.log('Streamer.bot import matches source; five actions, no automatic triggers.');
  } else {
    await mkdir(new URL('integrations/streamerbot/', root), { recursive: true });
    await writeFile(target, expected); console.log('Built integrations/streamerbot/PearConnect.sb');
  }
}
