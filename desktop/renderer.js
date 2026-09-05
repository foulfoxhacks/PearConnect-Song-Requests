const api = window.pearconnect;
const $ = selector => document.querySelector(selector);
let snapshot, initialized = false, busy = false, previewReady = false;
const labels = { ready: 'Connected', not_configured: 'Authorization needed', disconnected: 'Disconnected', unauthorized: 'Authorization expired', awaiting_authorization: 'Awaiting approval', dry_run: 'Dry run', connecting: 'Connecting…', reconnecting: 'Reconnecting…', connected_waiting_for_chat: 'Connected · waiting', chat_received: 'Chat arriving', webhook_listening: 'Webhook listening', disabled: 'Disabled', enqueue_confirmed: 'Enqueue confirmed', outcome_uncertain: 'Outcome uncertain', requests_paused: 'Requests paused' };
const label = value => labels[value] || value.replaceAll('_', ' ');
const when = value => value ? new Date(value).toLocaleTimeString() : 'never';
function notice(message, error = false) { $('#notice').hidden = false; $('#notice').textContent = message; $('#notice').classList.toggle('error', error); }
function view(name) {
  document.querySelectorAll('[data-page]').forEach(el => { el.hidden = el.dataset.page !== name; });
  document.querySelectorAll('nav button').forEach(el => el.classList.toggle('selected', el.dataset.view === name));
  $('#page-title').textContent = { dashboard: 'Dashboard', requests: 'Requests & queue', rules: 'Request rules', connections: 'Connections', activity: 'Activity & diagnostics', setup: 'Let’s set up your stream' }[name];
}
function fill(form, values) { for (const [key, value] of Object.entries(values)) { const input = form.elements.namedItem(key); if (input) input.value = value; } }
function rows(container, entries) {
  container.replaceChildren();
  if (!entries.length) { const empty = document.createElement('div'); empty.className = 'empty'; empty.textContent = 'Your next request will appear here.'; container.append(empty); return; }
  for (const entry of entries) {
    const row = document.createElement('div'); row.className = 'activity-row';
    const detail = document.createElement('div'), title = document.createElement('strong'), message = document.createElement('p'), time = document.createElement('small'), result = document.createElement('div');
    title.textContent = `${entry.user} · ${entry.command === 'request' ? entry.query || 'Empty request' : label(entry.command)}`;
    message.textContent = entry.message || label(entry.state); time.textContent = `${when(entry.time)} · ${entry.source}`;
    result.className = `result ${entry.state}`; result.textContent = label(entry.state);
    detail.append(title, message, time); row.append(detail, result); container.append(row);
  }
}
function render(value, forms = false) {
  snapshot = value; const s = value.status;
  $('#mode-label').textContent = s.connectionMode === 'simple' ? 'Simple connection' : 'Advanced connection';
  $('#connection-current').textContent = $('#mode-label').textContent;
  $('#player-state').textContent = label(s.player);
  $('#input-state').textContent = label(s.input.state);
  $('#track').textContent = s.currentTrack?.title || (s.player === 'ready' ? 'Player reachable · currently idle' : 'Open Connections to set up your player');
  $('#chat-detail').textContent = `Last chat: ${when(s.input.lastChatAt)} · last command: ${when(s.input.lastCommandAt)}`;
  $('#intake-state').textContent = s.requestsEnabled ? 'Accepting requests' : 'Paused';
  $('#intake-toggle').textContent = s.requestsEnabled ? 'Pause requests' : 'Start accepting requests';
  $('#intake-toggle').dataset.action = s.requestsEnabled ? 'pause' : 'resume';
  $('#now-playing').textContent = s.currentTrack?.title || (s.player === 'ready' ? 'Nothing playing right now' : 'Connect your player');
  $('#now-artist').textContent = s.currentTrack?.artist || 'Enqueue confirmation appears in request history.';
  $('#reply-capability').textContent = s.chatReplies === 'not_configured' ? 'TikTok chat replies: not configured. !np and !queue results appear in PearConnect’s activity feed.' : 'TikTok chat replies: managed by your Streamer.bot / TikFinity relay. PearConnect cannot verify reply delivery.';
  $('#connection-event').textContent = `Last event: ${when(s.input.lastEventAt)}`;
  $('#connection-command').textContent = `Last recognized command: ${when(s.input.lastCommandAt)}`;
  $('#credential-state').textContent = value.hasPlayerCredential ? 'Player credential saved · kept outside this window' : 'Authorization needed';
  $('#storage-state').textContent = value.secureStorage ? 'Credentials are encrypted using the operating system’s credential facilities.' : 'Secure credential storage is unavailable. Restore it to save settings or authorize the player.';
  $('#advanced-card').hidden = s.connectionMode !== 'advanced';
  $('#startup-error').hidden = !value.startupError; $('#startup-error').textContent = value.startupError || '';
  $('#welcome').hidden = value.hasPlayerCredential;
  rows($('#recent'), s.activity.slice(-4).reverse()); rows($('#history'), s.activity.slice().reverse()); rows($('#all-activity'), s.activity.slice().reverse());
  $('#technical-log').textContent = s.logs.map(entry => `${entry.time} ${entry.level} ${entry.message}`).join('\n') || 'No technical entries this session.';
  if (!initialized || forms) { fill($('#rules-form'), value.rules); fill($('#connections-form'), value.connections); $('#connections-form').elements.TWITCH_OAUTH.value = ''; initialized = true; }
}
async function call(name, payload, formUpdate = false) {
  if (busy) return;
  busy = true;
  document.querySelectorAll('button:not([data-view])').forEach(button => { button.disabled = true; });
  if (name === 'authorize') notice('Approve PearConnect in Pear Desktop. Waiting for authorization…');
  try {
    const result = await api[name](payload);
    if (!result.ok) throw new Error(result.error);
    const value = result.value;
    if (value?.status) render(value, formUpdate);
    if (value?.message) notice(value.message, value.ok === false);
    else if (name === 'testPlayer') notice(value.status.player === 'ready' ? 'Pear Desktop is reachable. Playback was not changed.' : `Player test: ${label(value.status.player)}.`, !['ready', 'dry_run'].includes(value.status.player));
    else if (name === 'rules') notice('Rules saved. They apply to every input immediately.');
    else if (['connections', 'reconnect', 'mode', 'authorize', 'importConfig', 'rotateSecret'].includes(name)) notice('Settings applied. Requests are paused; enable them when ready.');
    if (name === 'previewDiagnostics') { $('#diagnostic-preview').hidden = false; $('#diagnostic-preview').textContent = value.preview; previewReady = true; }
    if (name === 'exportDiagnostics') previewReady = false;
    if (name === 'playerQueue') {
      $('#queue-note').textContent = value.message; $('#player-queue').replaceChildren();
      for (const track of value.tracks) { const row = document.createElement('div'); row.className = 'activity-row'; row.textContent = `${track.selected ? 'Current · ' : ''}${track.title}${track.artist ? ' — ' + track.artist : ''}`; $('#player-queue').append(row); }
    }
    return value;
  } catch (error) { notice(error.message || 'Operation failed.', true); }
  finally { busy = false; document.querySelectorAll('button:not([data-view])').forEach(button => { button.disabled = false; }); $('#export-report').disabled = !previewReady; }
}
document.querySelectorAll('[data-view]').forEach(button => button.addEventListener('click', () => view(button.dataset.view)));
document.querySelectorAll('[data-action]').forEach(button => button.addEventListener('click', () => call(button.dataset.action)));
document.querySelectorAll('[data-mode]').forEach(button => button.addEventListener('click', () => call('mode', button.dataset.mode, true)));
for (const [id, operation] of [['rules-form', 'rules'], ['connections-form', 'connections'], ['sample-form', 'testRequest']]) {
  $(`#${id}`).addEventListener('submit', event => { event.preventDefault(); call(operation, Object.fromEntries(new FormData(event.currentTarget)), true); });
}
async function refresh() { if (busy || document.hidden) return; try { const result = await api.snapshot(); if (result.ok) render(result.value); } catch { /* A closing window needs no retry action. */ } }
call('snapshot');
setInterval(refresh, 3000);
// Low-frequency player reads update now-playing without polling during setup or authorization.
setInterval(async () => {
  if (busy || document.hidden || !snapshot?.hasPlayerCredential || snapshot.status.lifecycle !== 'running') return;
  try { const result = await api.testPlayer(); if (result.ok && !busy) render(result.value); } catch { /* Next visible poll can recover. */ }
}, 15000);
