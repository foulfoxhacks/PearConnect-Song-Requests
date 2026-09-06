const widget = document.querySelector('#social') ? window.PearSocial.create(document.querySelector('#social')) : window.PearWidget.create(document.querySelector('#widget'));
let last = { track: null, queue: { state: 'unavailable', tracks: [] }, appearance: {} };
let socket, reconnect, failures = 0, receivedAt = 0, polling = false, closed = false;
function update(value) { receivedAt = Date.now(); last = value; widget.update(value); }
async function fallback() {
  if (closed || polling || Date.now() - receivedAt < 4000) return;
  polling = true;
  try {
    const response = await fetch('./state', { cache: 'no-store', redirect: 'error', signal: AbortSignal.timeout(4000) });
    if (response.ok) update(await response.json());
  } catch { /* Freshness timer clears stale playback and queue data. */ }
  finally { polling = false; }
}
function connect() {
  if (closed) return;
  const url = new URL('./events', location.href); url.protocol = 'ws:';
  socket = new WebSocket(url);
  socket.onmessage = event => { try { update(JSON.parse(event.data)); failures = 0; } catch { socket.close(); } };
  socket.onerror = () => socket.close();
  socket.onclose = () => {
    if (!closed) reconnect = setTimeout(connect, Math.min(15000, 1000 * 2 ** Math.min(failures++, 4)));
  };
}
const ticker = setInterval(() => {
  if (Date.now() - receivedAt > 10000) {
    last = { ...last, track: null, art: null, queue: { state: 'unavailable', tracks: [] }, appearance: { ...last.appearance, SOCIAL_ENABLED: 'false' } }; widget.update(last);
  }
  widget.tick();
}, 1000);
const poller = setInterval(() => void fallback(), 4000);
addEventListener('pagehide', () => { closed = true; clearTimeout(reconnect); clearInterval(ticker); clearInterval(poller); socket?.close(); });
connect(); void fallback();
