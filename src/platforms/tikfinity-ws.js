import WebSocket from 'ws';
import { websocketUrl } from '../config.js';
import { parseCommand, dispatchChat } from '../commands.js';
import { text, validatePayload } from '../validation.js';

export function parseTikfinityEvent(raw) {
  if (typeof raw !== 'string' || Buffer.byteLength(raw) > 65536) throw new Error('Invalid event size.');
  const event = JSON.parse(raw);
  if (!event || typeof event !== 'object' || Array.isArray(event) || typeof event.event !== 'string') throw new Error('Invalid event envelope.');
  if (event.event !== 'chat') return { type: 'other' };
  const data = event.data;
  if (!data || typeof data !== 'object' || Array.isArray(data)) throw new Error('Missing chat data.');
  // uniqueId is the TikTok handle, never nickname/display name. Keep 64-bit IDs as strings.
  const identity = validatePayload({ user: data.uniqueId, userId: data.userId, query: '' });
  const message = text(data.comment, 'comment', { max: 1024 });
  const id = text(data.msgId, 'msgId', { max: 100, optional: true });
  return { type: 'chat', ...identity, message, id };
}

export function startTikfinitySocket({ url, commands, queue, log = console, onStatus = () => {},
  reconnectMinMs = 1000, reconnectMaxMs = 30000, heartbeatMs = 30000, now = Date.now }) {
  url = websocketUrl(url);
  let socket, retry, heartbeat, stopped = false, attempts = 0;
  const seen = new Map();
  const status = { state: 'connecting', lastEventAt: null, lastChatAt: null, lastCommandAt: null, invalidEvents: 0 };
  const update = patch => { Object.assign(status, patch); onStatus({ ...status }); };
  const invalid = () => update({ invalidEvents: status.invalidEvents + 1 });
  const connect = () => {
    if (stopped) return;
    update({ state: 'connecting' });
    const ws = new WebSocket(url, { handshakeTimeout: 5000, maxPayload: 65536, perMessageDeflate: false, followRedirects: false });
    socket = ws;
    let alive = true;
    ws.on('open', () => {
      if (stopped || socket !== ws) return ws.terminate();
      update({ state: 'connected_waiting_for_chat' });
      heartbeat = setInterval(() => {
        if (!alive) return ws.terminate();
        alive = false; ws.ping();
      }, heartbeatMs);
      heartbeat.unref?.();
    });
    ws.on('pong', () => { alive = true; });
    ws.on('message', (raw, binary) => {
      if (stopped || socket !== ws) return;
      if (binary) return invalid();
      let event;
      try { event = parseTikfinityEvent(raw.toString('utf8')); } catch { return invalid(); }
      attempts = 0;
      update({ lastEventAt: new Date(now()).toISOString() });
      if (event.type !== 'chat') return;
      update({ state: 'chat_received', lastChatAt: new Date(now()).toISOString() });
      if (!parseCommand(event.message, commands)) return;
      update({ lastCommandAt: new Date(now()).toISOString() });
      for (const [id, expires] of seen) if (expires <= now()) seen.delete(id);
      // No text-based deduplication: separate messages with the same text can be intentional.
      if (event.id) {
        if (seen.has(event.id)) return;
        if (seen.size >= 1000) { log.warn('[tikfinity] Event deduplication capacity reached; command ignored.'); return; }
        seen.set(event.id, now() + 300000);
      }
      dispatchChat({ ...event, commands, queue, platform: 'tiktok' }).catch(() => log.error('[tikfinity] Command processing failed.'));
    });
    ws.on('error', () => { /* Close drives one bounded retry; omit raw network details. */ });
    ws.on('close', () => {
      clearInterval(heartbeat);
      if (stopped || socket !== ws) return;
      update({ state: 'reconnecting' });
      const delay = Math.min(reconnectMaxMs, reconnectMinMs * 2 ** Math.min(attempts++, 5));
      retry = setTimeout(connect, delay + Math.floor(Math.random() * Math.min(250, delay / 4)));
    });
  };
  connect();
  return {
    stop() { stopped = true; clearTimeout(retry); clearInterval(heartbeat); socket?.terminate(); update({ state: 'disconnected' }); },
    status: () => ({ ...status }),
  };
}
