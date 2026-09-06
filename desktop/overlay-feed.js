import { WebSocketServer, WebSocket } from 'ws';

// Output only. Slow clients cannot grow an unbounded send queue.
export function overlayFeed(server, authorize, snapshot) {
  const wss = new WebSocketServer({ noServer: true, maxPayload: 1024, perMessageDeflate: false });
  const send = client => {
    if (client.readyState !== WebSocket.OPEN) return;
    if (client.bufferedAmount > 128 * 1024) return client.terminate();
    client.send(JSON.stringify(snapshot(client.request)));
  };
  server.on('upgrade', (req, socket, head) => {
    socket.on('error', () => {});
    if (!authorize(req) || wss.clients.size >= 16) { socket.end('HTTP/1.1 403 Forbidden\r\nConnection: close\r\n\r\n'); return; }
    wss.handleUpgrade(req, socket, head, client => wss.emit('connection', client, req));
  });
  wss.on('connection', (client, request) => {
    client.request = { url: request.url };
    client.alive = true;
    client.on('error', () => {});
    client.on('pong', () => { client.alive = true; });
    client.on('message', () => client.close(1008, 'Read-only feed'));
    send(client);
  });
  const timer = setInterval(() => {
    for (const client of wss.clients) {
      if (!client.alive) { client.terminate(); continue; }
      client.alive = false; client.ping();
    }
  }, 15000); timer.unref?.();
  return {
    broadcast() { for (const client of wss.clients) send(client); },
    get clients() { return wss.clients.size; },
    close() { clearInterval(timer); for (const client of wss.clients) client.terminate(); wss.close(); },
  };
}
