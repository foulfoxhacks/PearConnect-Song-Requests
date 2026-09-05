import net from 'node:net';
import { createHash } from 'node:crypto';
import { homedir, tmpdir } from 'node:os';
import { join } from 'node:path';
import { unlink } from 'node:fs/promises';

export function instanceAddress() {
  const id = createHash('sha256').update(homedir()).digest('hex').slice(0, 20);
  if (process.platform === 'win32') return `\\\\.\\pipe\\pearconnect-${id}`;
  // Linux abstract sockets are kernel-owned and disappear on crashes without a stale-file race.
  if (process.platform === 'linux') return `\0pearconnect-${id}`;
  return join(tmpdir(), `pearconnect-${id}.sock`);
}

export async function acquireInstance(address = instanceAddress()) {
  const server = net.createServer(socket => socket.destroy());
  const listen = () => new Promise((resolve, reject) => {
    server.once('error', reject);
    server.listen(address, () => { server.off('error', reject); resolve(); });
  });
  try { await listen(); }
  catch (error) {
    // Unix sockets survive abrupt exits. Only reclaim after ECONNREFUSED; never remove a live lock.
    if (error.code === 'EADDRINUSE' && process.platform !== 'win32') {
      const stale = await new Promise(resolve => {
        const probe = net.connect(address);
        probe.once('connect', () => { probe.destroy(); resolve(false); });
        probe.once('error', e => resolve(e.code === 'ECONNREFUSED'));
        probe.setTimeout(1000, () => { probe.destroy(); resolve(false); });
      });
      if (stale) { await unlink(address).catch(e => { if (e.code !== 'ENOENT') throw e; }); await listen(); }
      else throw alreadyRunning();
    } else if (['EADDRINUSE', 'EACCES'].includes(error.code)) throw alreadyRunning();
    else throw error;
  }
  server.on('error', () => {});
  // The lock alone should not keep a CLI with all listeners disabled alive.
  server.unref();
  return () => new Promise(resolve => server.close(resolve));
}

function alreadyRunning() {
  return Object.assign(new Error('PearConnect is already running. Close the existing desktop or CLI engine first; a second engine was not started.'), { code: 'ENGINE_RUNNING' });
}
