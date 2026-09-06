(() => {
  let latest, initialized = false;
  const $ = id => document.getElementById(id);
  const overview = window.PearWidget.create($('overview-widget')), preview = window.PearWidget.create($('studio-widget'));
  const socials = window.PearSocial.create($('social-preview'));
  const formValues = form => Object.fromEntries(new FormData(form));
  const help = document.createElement('div'); help.className = 'button-row';
  for (const [action, label] of [['openLastfmSetup', 'Get a Last.fm API key ↗'], ['openLastfmTerms', 'Read API terms ↗']]) { const button = document.createElement('button'); button.type = 'button'; button.className = 'link-button'; button.dataset.action = action; button.textContent = label; help.append(button); }
  $('lastfm-form').append(help);
  function previewState() {
    if (!latest) return;
    const a = { ...latest.appearance, ...formValues($('widget-form')) };
    const sample = $('widget-demo').checked;
    preview.update({ ...latest, appearance: a, ...(sample ? { track: { title: 'Night Drive', artist: 'PearConnect Sessions · Sample track', album: 'After hours', duration: 246, elapsed: 83, paused: true, updatedAt: Date.now() }, art: 'assets/sample-cover.png', queue: { state: 'ready', updatedAt: Date.now(), total: 5, tracks: ['Golden Hour', 'Afterglow', 'New Horizons', 'Open Road', 'Daylight'].map(title => ({ title, artist: 'PearConnect Sessions · Sample', duration: '3:42' })) } } : {}) });
    const size = window.PearWidget.dimensions(a);
    $('overlay-size').textContent = `${size.width} × ${size.height} · set Custom resolution`;
    $('studio-widget').style.maxWidth = a.WIDGET_LAYOUT === 'vertical' ? '400px' : 'none';
    $('widget-preview-label').textContent = sample ? 'SAMPLE · PREVIEW ONLY' : 'LIVE PLAYER';
  }
  function socialPreview() {
    if (!latest) return;
    const a = { ...latest.appearance, ...formValues($('social-form')) };
    if ($('social-demo').checked) Object.assign(a, { SOCIAL_ENABLED: 'true', SOCIAL_TIKTOK: '@yourchannel', SOCIAL_TWITCH: '@yourchannel', SOCIAL_DISCORD: 'discord.gg/your-community' });
    socials.update({ appearance: a });
    $('social-preview-empty').hidden = a.SOCIAL_ENABLED === 'true' && window.PearSocial.entries(a).length > 0;
  }
  function render(studio, forms = false) {
    latest = studio;
    const a = studio.appearance;
    document.body.dataset.background = a.APP_BACKGROUND; document.body.dataset.font = a.APP_FONT; document.body.dataset.text = a.APP_TEXT;
    const brand = document.querySelector('.brand-mark'); brand.style.color = ({ pear: '#c7e794', orchid: '#c6b4ff', ember: '#ffca93' })[a.APP_ICON];
    brand.style.fill = 'currentColor';
    if (!initialized || forms) {
      for (const id of ['widget-form', 'appearance-form', 'lastfm-form', 'discord-form', 'social-form']) for (const [key, value] of Object.entries(a)) { const input = $(id).elements.namedItem(key); if (input) input.value = value; }
      $('lastfm-form').elements.LASTFM_KEY.value = ''; initialized = true;
    }
    overview.update({ ...studio, appearance: { ...a, WIDGET_LAYOUT: 'cover', WIDGET_ART: 'true', WIDGET_TIMING: 'true', WIDGET_QUEUE: 'true', WIDGET_QUEUE_ROWS: '3', WIDGET_SURFACE: 'transparent', WIDGET_LABEL: studio.track?.album || 'NOW PLAYING' } }); previewState();
    $('playback-freshness').textContent = studio.track ? `Player updates every 2s · ${studio.track.paused === true ? 'Paused' : studio.track.paused === false ? 'Playing' : 'Playback state unavailable'}` : 'Waiting for a fresh player update';
    socialPreview();
    const states = { disabled: 'Overlay server is off.', ready: 'Ready for OBS on this computer. Saved designs apply live.', port_unavailable: 'This port is already in use. Choose a different port and save.', not_configured: 'Save with the OBS widget enabled to create a private link.', error: 'Overlay server stopped. Save its settings to reconnect.' };
    $('overlay-status').textContent = studio.overlayState === 'ready' ? `Overlay ready · ${studio.overlayClients || 0} live browser source${studio.overlayClients === 1 ? '' : 's'} connected. Saved designs apply live.` : states[studio.overlayState] || 'Overlay unavailable.';
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
  $('social-form').addEventListener('input', socialPreview); $('social-demo').addEventListener('change', socialPreview);
  setInterval(() => { overview.tick(); preview.tick(); socials.tick(); }, 1000);
  window.PearStudio = Object.freeze({ render, discord(value) {
    const states = { disabled: 'Discord presence is off.', connecting: 'Connecting to Discord desktop…', waiting_for_discord: 'Waiting for Discord desktop. Reconnects automatically.', connected: 'Discord connected.', active: 'Discord accepted your presence. Visibility follows your activity-sharing preferences.', rejected: 'Discord rejected the presence update. Check the application in the Developer Portal.' };
    $('discord-status').textContent = states[value?.state] || 'Discord unavailable.';
    $('discord-live').textContent = value?.live ? 'End live label on Discord' : 'Mark stream live on Discord';
    $('discord-live').disabled = !value?.enabled;
  }, similar(result) {
    const target = $('similar-tracks'); target.replaceChildren();
    if (result.state !== 'ready' || !result.tracks?.length) { const p = document.createElement('p'); p.textContent = 'No similar tracks available for this song. Your queue has not changed.'; target.append(p); return; }
    for (const track of result.tracks) { const row = document.createElement('p'); row.textContent = `${track.title} — ${track.artist}`; target.append(row); }
    const note = document.createElement('small'); note.textContent = 'Suggestions from Last.fm. Nothing has been added to the queue.'; target.append(note);
  } });
})();
