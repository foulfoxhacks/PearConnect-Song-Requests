import { readFile } from 'node:fs/promises';
import { createHash } from 'node:crypto';

// Preserve every original smoke assertion and its requested exit status.
// Let HTTP/undici handles drain instead of abruptly tearing down libuv on Windows.
const source = await readFile(new URL('../test-smoke.mjs', import.meta.url));
const hash = createHash('sha1').update(`blob ${source.length}\0`).update(source).digest('hex');
if (hash !== '19ad627d8294f6ea8ebeb694f112a1713a9010b8') {
  throw new Error('The original smoke test changed; review the regression ledger before updating its fingerprint.');
}
process.exit = (code = process.exitCode ?? 0) => { process.exitCode = code; };
await import('../test-smoke.mjs');
