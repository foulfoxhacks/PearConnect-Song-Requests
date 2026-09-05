const api = window.pearconnect;
const $ = selector => document.querySelector(selector);
let snapshot, initialized = false, busy = false, previewReady = false;
let verificationStep = 1;
const labels = { ready: 'Connected', not_configured: 'Authorization needed', disconnected: 'Disconnected', unauthorized: 'Authorization expired', awaiting_authorization: 'Awaiting approval', dry_run: 'Dry run', connecting: 'Connecting…', reconnecting: 'Reconnecting…', connected_waiting_for_chat: 'Connected · waiting', chat_received: 'Chat arriving', webhook_listening: 'Webhook listening', disabled: 'Disabled', enqueue_confirmed: 'Enqueue confirmed', outcome_uncertain: 'Outcome uncertain', requests_paused: 'Requests paused', received: 'Received', checking: 'Checking', searching: 'Searching', enqueuing: 'Enqueuing', completed: 'Completed', rejected: 'Rejected', failed: 'Failed', tiktok: 'TikTok', twitch: 'Twitch', youtube: 'YouTube', simple: 'TikFinity', advanced: 'Streamer.bot' };
const label = value => labels[value] || String(value || 'unknown').replaceAll('_', ' ');
const when = value => value ? new Date(value).toLocaleTimeString() : 'never';
const pages = {
  dashboard: ['YOUR WORKSPACE', 'Stream overview', 'Your music, connections and requests. All in one place.'],
  requests: ['YOUR WORKSPACE', 'Requests & queue', 'Follow each request, then see what your player has queued.'],
  rules: ['CONFIGURATION', 'Request rules', 'Set the rhythm for your community. The same rules apply to every input.'],
  connections: ['CONFIGURATION', 'Connections', 'Bring your player and your stream together.'],
  activity: ['SUPPORT', 'Activity & diagnostics', 'Understand each result and find the details when you need them.'],
  studio: ['YOUR STREAM, YOUR STYLE', 'Visual studio', 'Artwork, atmosphere and a little more personality.'],
  setup: ['GETTING STARTED', 'Ready for your first request?', 'Connect your music, bring in your chat and make the rules yours.']
  ,session: ['OPTIONAL FALLBACK', 'A code for your stream.', 'A temporary request link, checked by your desktop.']
};
function notice(message, error = false) {
  $('#notice').hidden = false;
  $('#notice').textContent = message;
  $('#notice').classList.toggle('error', error);
}
function view(name) {
  if (!pages[name]) return;
  $('#notice').hidden = true;
  document.querySelectorAll('[data-page]').forEach(el => { el.hidden = el.dataset.page !== name; });
  document.querySelectorAll('nav button').forEach(el => {
    const selected = el.dataset.view === name;
    el.classList.toggle('selected', selected);
    if (selected) el.setAttribute('aria-current', 'page'); else el.removeAttribute('aria-current');
  });
  [$('#page-context').textContent, $('#page-title').textContent, $('#page-description').textContent] = pages[name];
  $('#main-content').focus({ preventScroll: true });
  window.scrollTo(0, 0);
}
function fill(form, values) {
  for (const [key, value] of Object.entries(values)) {
    const input = form.elements.namedItem(key);
    if (input) input.value = value;
  }
}
function element(tag, className, text) {
  const node = document.createElement(tag);
  if (className) node.className = className;
  if (text !== undefined) node.textContent = text;
  return node;
}
function rows(container, entries) {
  container.replaceChildren();
  if (!entries.length) {
    const empty = element('div', 'empty'), symbol = element('span', 'empty-symbol', '♫'), copy = element('div');
    symbol.setAttribute('aria-hidden', 'true');
    copy.append(element('strong', '', 'The next request is yours to discover.'), element('p', '', 'Requests and their results will appear here as they arrive.'));
    empty.append(symbol, copy); container.append(empty); return;
  }
  const table = element('table', 'activity-table'), head = element('thead'), header = element('tr'), body = element('tbody');
  const caption = element('caption', 'sr-only', container.id === 'recent' ? 'Recent song request results' : 'Command history and results');
  for (const title of ['Viewer / request', 'Source', 'Received', 'Result']) {
    const cell = element('th', '', title); cell.scope = 'col'; header.append(cell);
  }
  head.append(header);
  for (const entry of entries) {
    const row = element('tr'), detail = element('td'), result = element('td');
    detail.append(element('strong', '', entry.user || 'Unknown viewer'), element('span', 'request-query', entry.command === 'request' ? entry.query || 'Empty request' : label(entry.command)));
    if (entry.message) detail.append(element('p', 'request-message', entry.message));
    result.append(element('span', `result ${entry.state}`, label(entry.state)));
    row.append(detail, element('td', '', label(entry.source)), element('td', '', when(entry.time)), result); body.append(row);
  }
  table.append(caption, head, body); container.append(table);
}
function queue(tracks) {
  const container = $('#player-queue'); container.replaceChildren();
  if (!tracks.length) { container.append(element('p', 'empty-queue', 'No queue snapshot to display.')); return; }
  tracks.forEach((track, index) => {
    const row = element('div', 'queue-row'), copy = element('div');
    copy.append(element('strong', '', track.title), element('p', '', track.artist || 'Artist unavailable'));
    row.append(element('span', 'queue-index', String(index + 1).padStart(2, '0')), copy);
    if (track.selected) row.append(element('span', 'queue-current', 'CURRENT'));
    container.append(row);
  });
}
function render(value, forms = false) {
  window.PearStudio.render(value.studio, forms);
  renderVerification(value);
  const session = value.session;
  $('#session-create-form').hidden = !!session && !session.ended && session.state !== 'expired';
  $('#session-controls').hidden = !session || session.ended || session.state === 'expired';
  if (session) {
    $('#session-code').textContent = session.code;
    $('#session-status').textContent = session.message;
    $('#session-expiry').textContent = `Expires ${new Date(session.expiresAt).toLocaleString()}.`;
    $('#session-toggle').textContent = value.status.requestsEnabled ? 'Pause website requests' : 'Enable website requests';
  }
  if (!initialized) {
    $('#session-create-form').elements.minutes.value = value.sessionMinutes;
    $('#session-expiry-form').elements.minutes.value = value.sessionMinutes;
  }
  snapshot = value; const s = value.status;
  $('#mode-label').textContent = s.webFallback ? 'Session-code fallback' : s.connectionMode === 'simple' ? 'Simple connection' : 'Advanced connection';
  $('#connection-current').textContent = $('#mode-label').textContent;
  $('#player-state').textContent = label(s.player);
  $('#input-state').textContent = label(s.input.state);
  $('#track').textContent = s.dryRun ? 'Player writes are disabled for this session' : s.player === 'ready' ? 'Pear Desktop is reachable' : 'Open Connections to set up your player';
  $('#chat-detail').textContent = s.input.lastChatAt ? `Last chat received at ${when(s.input.lastChatAt)}` : s.connectionMode === 'simple' ? 'Waiting for a chat event from TikFinity' : 'Commands arrive through your automation';
  $('#intake-state').textContent = s.requestsEnabled ? 'Accepting requests' : 'Paused';
  $('#intake-toggle-label').textContent = s.requestsEnabled ? 'Pause requests' : 'Enable requests';
  $('#intake-toggle .control-icon').textContent = s.requestsEnabled ? 'Ⅱ' : '▷';
  $('#intake-toggle').dataset.action = s.requestsEnabled ? 'pause' : 'resume';
  $('#toolbar-status').textContent = s.dryRun ? 'Dry run · playback unchanged' : s.player === 'ready' ? 'Pear Desktop connected' : `Pear Desktop · ${label(s.player).toLowerCase()}`;
  const playerState = s.player === 'ready' ? 'ready' : ['disconnected', 'unauthorized'].includes(s.player) ? 'error' : 'waiting';
  $('#player-dot').dataset.state = playerState; $('#toolbar-dot').dataset.state = playerState;
  $('#input-dot').dataset.state = s.input.state === 'chat_received' ? 'ready' : ['connected_waiting_for_chat', 'webhook_listening', 'connecting', 'reconnecting'].includes(s.input.state) ? 'waiting' : s.input.state === 'disabled' ? 'disabled' : 'error';
  $('#intake-dot').dataset.state = s.requestsEnabled ? 'enabled' : 'paused';
  $('#now-playing').textContent = s.currentTrack?.title || (s.player === 'ready' ? 'Nothing playing right now' : 'Your music starts here');
  $('#now-artist').textContent = s.currentTrack?.artist || (s.player === 'ready' ? 'Waiting for the player to report a track.' : 'Connect Pear Desktop to see what’s playing.');
  $('#signal-event').textContent = s.input.lastEventAt ? when(s.input.lastEventAt) : '—';
  $('#signal-chat').textContent = s.input.lastChatAt ? when(s.input.lastChatAt) : '—';
  $('#signal-command').textContent = s.input.lastCommandAt ? when(s.input.lastCommandAt) : '—';
  $('#signal-note').textContent = s.connectionMode === 'simple' ? 'A connection is the first step. Chat events confirm that your stream is reaching PearConnect.' : 'Advanced input reports recognized commands. Individual chat events stay with your automation.';
  $('#reply-capability').textContent = s.chatReplies === 'not_configured' ? `TikTok chat replies: not configured. !${value.rules.CMD_NOWPLAYING} and !${value.rules.CMD_QUEUE} results appear in PearConnect’s activity feed.` : 'TikTok chat replies: managed by your Streamer.bot / TikFinity relay. PearConnect cannot verify reply delivery.';
  $('#connection-event').textContent = `Last event: ${when(s.input.lastEventAt)}`;
  $('#connection-command').textContent = `Last recognized command: ${when(s.input.lastCommandAt)}`;
  $('#credential-state').textContent = value.hasPlayerCredential ? 'Player credential saved · kept outside this window' : 'Authorization needed';
  $('#storage-state').textContent = value.secureStorage ? 'Credentials are encrypted using the operating system’s credential facilities.' : 'Secure credential storage is unavailable. Restore it to save settings or authorize the player.';
  $('#advanced-card').hidden = s.connectionMode !== 'advanced';
  $('#startup-error').hidden = !value.startupError; $('#startup-error').textContent = value.startupError || '';
  $('#welcome').hidden = value.hasPlayerCredential;
  document.querySelectorAll('[data-mode]').forEach(button => button.setAttribute('aria-pressed', String(button.dataset.mode === s.connectionMode)));
  const recent = s.activity.filter(entry => entry.command === 'request').slice(-4).reverse();
  $('#recent-count').textContent = `${recent.length} MOST RECENT`;
  rows($('#recent'), recent); rows($('#history'), s.activity.slice().reverse()); rows($('#all-activity'), s.activity.slice().reverse());
  $('#technical-log').textContent = s.logs.map(entry => `${entry.time} ${entry.level} ${entry.message}`).join('\n') || 'No technical entries this session.';
  if (!initialized || forms) { fill($('#rules-form'), value.rules); fill($('#connections-form'), value.connections); $('#connections-form').elements.TWITCH_OAUTH.value = ''; initialized = true; }
}
async function call(name, payload, formUpdate = false) {
  if (busy) return;
  busy = true;
  if (name !== 'snapshot') $('#notice').hidden = true;
  document.querySelectorAll('button:not([data-view])').forEach(button => { button.disabled = true; });
  if (name === 'authorize') notice('Approve PearConnect in Pear Desktop. Waiting for authorization…');
  try {
    const result = await api[name](payload);
    if (!result.ok) throw new Error(result.error);
    const value = result.value;
    if (name === 'beginVerification') verificationStep = 1;
    if (value?.status) render(value, formUpdate);
    if (value?.message) notice(value.message, value.ok === false);
    else if (name === 'testPlayer') notice(value.status.player === 'ready' ? 'Pear Desktop is reachable. Playback was not changed.' : `Player test: ${label(value.status.player)}.`, !['ready', 'dry_run'].includes(value.status.player));
    else if (name === 'rules') notice('Rules saved. They apply to every input immediately.');
    else if (['connections', 'reconnect', 'mode', 'authorize', 'importConfig', 'rotateSecret'].includes(name)) notice('Settings applied. Requests are paused; enable them when ready.');
    if (name === 'previewDiagnostics') { $('#diagnostic-preview').hidden = false; $('#diagnostic-preview').textContent = value.preview; previewReady = true; }
    if (name === 'exportDiagnostics') previewReady = false;
    if (name === 'playerQueue') { $('#queue-note').textContent = value.message; queue(value.tracks); }
    if (name === 'similarTracks') window.PearStudio.similar(value);
    if (name === 'appearance') notice('Design saved. Your desktop and enabled OBS widget are up to date.');
    if (name === 'verifySong') { const fresh = await api.snapshot(); if (fresh.ok) render(fresh.value); }
    if (name === 'finishVerification') { notice('Guided checks passed. Requests are enabled. Watch the activity feed for your first enqueue confirmation.'); view('dashboard'); }
    return value;
  } catch (error) { notice(error.message || 'Operation failed.', true); }
  finally { busy = false; document.querySelectorAll('button:not([data-view])').forEach(button => { button.disabled = false; }); $('#export-report').disabled = !previewReady; if (snapshot) renderVerification(snapshot); }
}

function renderVerification(value) {
  const v = value.status.verification;
  const active = v && v.state !== 'complete';
  $('#verify-intro').hidden = !!active;
  $('#verify-active').hidden = !active;
  $('#verify-progress').textContent = v?.state === 'complete' ? 'CHECKS PASSED' : active ? `STEP ${verificationStep} OF 4` : 'GUIDED TEST';
  document.querySelectorAll('[data-verify-step]').forEach(el => { el.hidden = Number(el.dataset.verifyStep) !== verificationStep; });
  document.querySelectorAll('[data-checkpoint]').forEach(el => { if (Number(el.dataset.checkpoint) === verificationStep) el.setAttribute('aria-current', 'step'); else el.removeAttribute('aria-current'); });
  if (!active) return;
  $('#verify-player').textContent = v.playerPassed ? 'Passed · Pear Desktop responded.' : `Not passed · ${label(value.status.player)}. A dry run does not verify a real player.`;
  $('#verify-command').textContent = v.command;
  $('#verify-route').textContent = v.mode === 'simple' ? 'Simple: TikFinity Desktop must be running on this computer and connected to your LIVE. No actions or overlay are needed.' : 'Advanced: import the PearConnect Streamer.bot package and set its URL and secret. In TikFinity, create an action using “Streamer.bot Action” → PearConnect Song Request. Create an event using “Commenting a command” and link that action.';
  $('#verify-delivery').textContent = v.state === 'received' ? `Passed · live test command received at ${when(v.receivedAt)}.` : v.state === 'expired' ? 'Test expired after five minutes. Restart the test and send the new command.' : v.state === 'interrupted' ? 'The chat connection was interrupted after verification. Reconnect and restart the test.' : 'Waiting for this exact live command. An open socket or a local endpoint test does not complete this step.';
  $('#verify-help').textContent = v.mode === 'simple' ? 'Check that TikFinity is connected to the correct livestream. Check the event WebSocket address in Connections and send a new comment in the live chat.' : `Use the command !${value.rules.CMD_REQUEST} in TikFinity’s event. Allow the test viewer to trigger it, and select the Song Request action under “Trigger all of these actions.” PearConnect.Url must be the origin without /tikfinity. The request text must reach PearConnect as the query, without the command prefix.`;
  $('#verify-rules').textContent = v.rulesMessage || 'Waiting for a sample song check.';
  $('#verify-back').disabled = busy || verificationStep === 1;
  $('#verify-next').hidden = verificationStep === 4;
  $('#verify-next').disabled = busy || !(verificationStep === 1 ? v.playerPassed : verificationStep === 2 ? v.state === 'received' : v.rulesPassed);
  $('[data-action="finishVerification"]').disabled = busy || !v.playerPassed || v.state !== 'received' || !v.rulesPassed;
}
$('#verify-next').addEventListener('click', () => { verificationStep = Math.min(4, verificationStep + 1); renderVerification(snapshot); $('#verify-progress').scrollIntoView({ block: 'center' }); });
$('#verify-back').addEventListener('click', () => { verificationStep = Math.max(1, verificationStep - 1); renderVerification(snapshot); });
$('#session-toggle').addEventListener('click', () => call('updateSession', { enabled: !snapshot.status.requestsEnabled }));
$('#session-unpair').addEventListener('click', () => call('updateSession', { unpair: true }));

// Focus the workspace without changing the URL used to authenticate desktop IPC.
$('.skip-link').addEventListener('click', event => { event.preventDefault(); $('#main-content').focus(); window.scrollTo(0, 0); });
document.querySelectorAll('[data-view]').forEach(button => button.addEventListener('click', () => view(button.dataset.view)));
document.querySelectorAll('[data-action]').forEach(button => button.addEventListener('click', () => call(button.dataset.action)));
document.querySelectorAll('[data-mode]').forEach(button => button.addEventListener('click', () => call('mode', button.dataset.mode, true)));
for (const [id, operation] of [['rules-form', 'rules'], ['connections-form', 'connections'], ['sample-form', 'testRequest'], ['verify-song-form', 'verifySong'], ['session-create-form', 'createSession'], ['session-expiry-form', 'updateSession'], ['widget-form', 'appearance'], ['appearance-form', 'appearance'], ['lastfm-form', 'appearance']]) {
  $(`#${id}`).addEventListener('submit', event => { event.preventDefault(); call(operation, Object.fromEntries(new FormData(event.currentTarget)), true); });
}
async function refresh() { if (busy || document.hidden) return; try { const result = await api.snapshot(); if (result.ok) render(result.value); } catch { /* A closing window needs no retry action. */ } }
call('snapshot');
setInterval(refresh, 2000);
