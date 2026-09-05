(() => {
  let latest, initialized = false;
  const $ = id => document.getElementById(id);
  const overview = window.PearWidget.create($('overview-widget')), preview = window.PearWidget.create($('studio-widget'));
  const formValues = form => Object.fromEntries(new FormData(form));
  const help = document.createElement('div'); help.className = 'button-row';
  for (const [action, label] of [['openLastfmSetup', 'Get a Last.fm API key ↗'], ['openLastfmTerms', 'Read API terms ↗']]) { const button = document.createElement('button'); button.type = 'button'; button.className = 'link-button'; button.dataset.action = action; button.textContent = label; help.append(button); }
  $('lastfm-form').append(help);
  function previewState() {
    if (!latest) return;
    const a = { ...latest.appearance, ...formValues($('widget-form')) };
    const sample = $('widget-demo').checked;
    preview.update({ ...latest, appearance: a, ...(sample ? { track: { title: 'Night Drive', artist: 'PearConnect Sessions · Sample track', album: 'After hours', duration: 246, elapsed: 83, paused: true, updatedAt: Date.now() }, art: 'assets/sample-cover.png' } : {}) });
    $('widget-preview-label').textContent = sample ? 'SAMPLE · NOT SENT TO OBS' : 'LIVE PLAYER';
  }
  function render(studio, forms = false) {
    latest = studio;
    const a = studio.appearance;
    document.body.dataset.background = a.APP_BACKGROUND; document.body.dataset.font = a.APP_FONT; document.body.dataset.text = a.APP_TEXT;
    const brand = document.querySelector('.brand-mark'); brand.style.color = ({ pear: '#c7e794', orchid: '#c6b4ff', ember: '#ffca93' })[a.APP_ICON];
    brand.style.fill = 'currentColor';
    if (!initialized || forms) {
      for (const id of ['widget-form', 'appearance-form', 'lastfm-form']) for (const [key, value] of Object.entries(a)) { const input = $(id).elements.namedItem(key); if (input) input.value = value; }
      $('lastfm-form').elements.LASTFM_KEY.value = ''; initialized = true;
    }
    overview.update({ ...studio, appearance: { ...a, WIDGET_LAYOUT: 'cover', WIDGET_ART: 'true', WIDGET_TIMING: 'true', WIDGET_SURFACE: 'transparent', WIDGET_LABEL: studio.track?.album || 'NOW PLAYING' } }); previewState();
    $('playback-freshness').textContent = studio.track ? `Player updates every 2s · ${studio.track.paused === true ? 'Paused' : studio.track.paused === false ? 'Playing' : 'Playback state unavailable'}` : 'Waiting for a fresh player update';
    const states = { disabled: 'Overlay server is off.', ready: 'Ready for OBS on this computer. Saved designs apply live.', port_unavailable: 'This port is already in use. Choose a different port and save.', not_configured: 'Save with the OBS widget enabled to create a private link.', error: 'Overlay server stopped. Save its settings to reconnect.' };
    $('overlay-status').textContent = states[studio.overlayState] || 'Overlay unavailable.';
    const metadata = studio.metadata || {};
    $('lastfm-status').textContent = `${studio.hasLastfmKey ? 'API key saved privately.' : 'No API key saved.'} ${metadata.state === 'invalid_key' ? 'Last.fm rejected this key.' : metadata.state === 'unavailable' ? 'Last.fm is temporarily unavailable; playback is unaffected.' : metadata.state === 'not_found' ? 'No Last.fm match for this track.' : metadata.state === 'loading' ? 'Looking up this track…' : ''}`;
    $('music-insight').hidden = metadata.state !== 'ready';
    $('music-tags').textContent = (metadata.tags || []).join(' / ') || 'Explore this track on Last.fm';
    const num = n => n ? Number(n).toLocaleString() : 'Unavailable';
    $('music-reach').textContent = `${num(metadata.listeners)} Last.fm listeners · ${num(metadata.playcount)} scrobbles across Last.fm`;
    const identity = JSON.stringify([studio.track?.title, studio.track?.artist]);
    if ($('similar-tracks').dataset.track !== identity) { $('similar-tracks').replaceChildren(); $('similar-tracks').dataset.track = identity; }
  }
  document.addEventListener('DOMContentLoaded', () => {});
  $('widget-form').addEventListener('input', previewState); $('widget-demo').addEventListener('change', previewState);
  setInterval(() => { overview.tick(); preview.tick(); }, 1000);
  window.PearStudio = Object.freeze({ render, similar(result) {
    const target = $('similar-tracks'); target.replaceChildren();
    if (result.state !== 'ready' || !result.tracks?.length) { const p = document.createElement('p'); p.textContent = 'No similar tracks available for this song. Your queue has not changed.'; target.append(p); return; }
    for (const track of result.tracks) { const row = document.createElement('p'); row.textContent = `${track.title} — ${track.artist}`; target.append(row); }
    const note = document.createElement('small'); note.textContent = 'Suggestions from Last.fm. Nothing has been added to the queue.'; target.append(note);
  } });
})();
