const widget = window.PearWidget.create(document.querySelector('#widget'));
let last = { track: null, appearance: {} };
document.body.style.margin = '0'; document.body.style.background = 'transparent';
async function poll() {
  try {
    const response = await fetch('./state', { cache: 'no-store', redirect: 'error', signal: AbortSignal.timeout(4000) });
    if (!response.ok) throw new Error('Offline'); last = await response.json(); widget.update(last);
  } catch { last = { ...last, track: null, art: null }; widget.update(last); }
  setTimeout(poll, 2000);
}
setInterval(() => widget.tick(), 1000); void poll();
