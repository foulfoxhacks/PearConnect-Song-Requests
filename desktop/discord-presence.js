import net from 'node:net';
import { join } from 'node:path';
import { randomUUID } from 'node:crypto';

// Public application identifier. Local Rich Presence needs no OAuth secret,
// Discord user token, bot account, or access to messages/friends.
export const DISCORD_CLIENT_ID = '1545979656262389900';
const MAX_FRAME = 64 * 1024;
export function rpcFrame(op, value) {
  const body = Buffer.isBuffer(value) ? value : Buffer.from(JSON.stringify(value));
  const header = Buffer.alloc(8); header.writeUInt32LE(op); header.writeUInt32LE(body.length, 4);
  return Buffer.concat([header, body]);
}
export function presenceActivity({ running, live, requestsEnabled, track, shareSong }, startedAt) {
  if (!running) return null;
  const clean = value => Array.from(String(value || '').replace(/[\u0000-\u001f]/g, '')).slice(0, 100).join('');
  return { type: 0, details: live ? 'Live on stream' : 'Preparing the next stream',
    state: shareSong && track ? clean(`${track.title} · ${track.artist}`) : requestsEnabled ? 'Song requests open' : 'Song requests paused',
    timestamps: { start: Math.floor(startedAt / 1000) },
    buttons: [{ label: 'Get PearConnect', url: 'https://pearconnect.mellozone.site/' }] };
}

export class DiscordPresence {
  constructor({ getState, connect = path => net.createConnection(path), paths, now = Date.now, intervalMs = 15000 } = {}) {
    this.getState = getState; this.connect = connect; this.now = now; this.intervalMs = intervalMs;
    const prefix = process.env.XDG_RUNTIME_DIR || process.env.TMPDIR || process.env.TMP || process.env.TEMP || '/tmp';
    this.paths = paths || Array.from({ length: 10 }, (_, n) => process.platform === 'win32' ? `\\\\?\\pipe\\discord-ipc-${n}` : join(prefix, `discord-ipc-${n}`));
    this.state = 'disabled'; this.live = false; this.startedAt = now(); this.enabled = false; this.nextTry = 0; this.lastSent = -Infinity;
  }
  snapshot() { return { state: this.state, enabled: this.enabled, live: this.live, shareSong: this.shareSong, clientId: DISCORD_CLIENT_ID }; }
  configure(env) {
    this.shareSong = env.DISCORD_SHARE_SONG === 'true';
    const enabled = env.DISCORD_ENABLED !== 'false';
    if (!enabled) { void this.close(); return; }
    if (!this.enabled) {
      this.enabled = true; this.startedAt = this.now(); this.nextTry = 0;
      this.timer = setInterval(() => this.tick(), 1000); this.timer.unref?.();
    }
    this.tick();
  }
  setLive(value) {
    if (typeof value !== 'boolean') throw new Error('Choose live or ended.');
    this.live = value; this.startedAt = this.now(); this.tick();
  }
  tick() {
    if (!this.enabled) return;
    if (!this.socket && this.now() >= this.nextTry) this.open(0);
    if (!this.ready || this.pending || this.now() - this.lastSent < this.intervalMs) return;
    const state = this.getState(); if (!state.running) this.live = false;
    const activity = presenceActivity({ ...state, live: this.live, shareSong: this.shareSong }, this.startedAt);
    const serialized = JSON.stringify(activity);
    if (serialized === this.acknowledged) return;
    const nonce = randomUUID(); this.pending = { nonce, serialized, activity }; this.lastSent = this.now();
    this.socket.write(rpcFrame(1, { cmd: 'SET_ACTIVITY', args: { pid: process.pid, activity }, nonce }));
    this.ackTimer = setTimeout(() => this.socket?.destroy(), 5000); this.ackTimer.unref?.();
  }
  open(index) {
    if (!this.enabled) return;
    if (index >= this.paths.length) { this.state = 'waiting_for_discord'; this.nextTry = this.now() + 15000; return; }
    this.state = 'connecting';
    let socket;
    try { socket = this.connect(this.paths[index]); } catch { this.open(index + 1); return; }
    this.socket = socket; let buffer = Buffer.alloc(0), connected = false;
    const timeout = setTimeout(() => socket.destroy(), 3000); timeout.unref?.();
    socket.on('connect', () => { connected = true; socket.write(rpcFrame(0, { v: 1, client_id: DISCORD_CLIENT_ID })); });
    socket.on('error', () => {});
    socket.on('data', data => {
      if (this.socket !== socket) return;
      if (buffer.length + data.length > MAX_FRAME + 8) { socket.destroy(); return; }
      buffer = Buffer.concat([buffer, data]);
      while (buffer.length >= 8) {
        const opcode = buffer.readUInt32LE(0), length = buffer.readUInt32LE(4);
        if (length > MAX_FRAME) { socket.destroy(); return; }
        if (buffer.length < length + 8) break;
        const body = buffer.subarray(8, length + 8); buffer = buffer.subarray(length + 8);
        if (opcode === 3) { socket.write(rpcFrame(4, body)); continue; }
        if (opcode === 4) continue;
        if (opcode !== 1) { socket.destroy(); return; }
        let value; try { value = JSON.parse(body.toString('utf8')); } catch { socket.destroy(); return; }
        if (value?.evt === 'READY') { clearTimeout(timeout); this.ready = true; this.state = 'connected'; this.tick(); }
        else if (this.pending && value?.nonce === this.pending.nonce) {
          clearTimeout(this.ackTimer);
          if (value.evt === 'ERROR') { this.state = 'rejected'; }
          else if (value.cmd === 'SET_ACTIVITY') { this.acknowledged = this.pending.serialized; this.state = this.pending.activity ? 'active' : 'connected'; }
          this.pending = null;
        }
      }
    });
    socket.on('close', () => {
      clearTimeout(timeout);
      if (this.socket !== socket) return;
      clearTimeout(this.ackTimer); this.socket = null; this.ready = false; this.pending = null; this.acknowledged = undefined;
      if (!this.enabled) return;
      if (!connected) this.open(index + 1);
      else { this.state = 'waiting_for_discord'; this.nextTry = this.now() + 15000; }
    });
  }
  async close() {
    this.enabled = false; this.live = false; this.state = 'disabled';
    clearInterval(this.timer); clearTimeout(this.ackTimer);
    const socket = this.socket, ready = this.ready;
    this.socket = null; this.ready = false; this.pending = null; this.acknowledged = undefined;
    if (!socket) return;
    if (!ready) { socket.destroy(); return; }
    await new Promise(resolve => {
      const timeout = setTimeout(() => { socket.destroy(); resolve(); }, 500);
      socket.once('close', () => { clearTimeout(timeout); resolve(); });
      socket.end(rpcFrame(1, { cmd: 'SET_ACTIVITY', args: { pid: process.pid, activity: null }, nonce: randomUUID() }));
    });
  }
}
