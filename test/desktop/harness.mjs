import electron from 'electron';
import assert from 'node:assert/strict';
import { join } from 'node:path';
import { writeFile } from 'node:fs/promises';
import http from 'node:http';
import { once } from 'node:events';
import { spawn } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { launchDesktop, trustedSender } from '../../desktop/runtime.js';
const { app, safeStorage } = electron;
const dataDir = process.argv[2];
app.setPath('userData', dataDir);
let runtime;
let playerServer;
app.whenReady().then(async () => {
try {
  assert.equal(safeStorage.isEncryptionAvailable(), true, 'OS credential storage must be available for desktop acceptance');
  const { SettingsStore } = await import('../../desktop/settings.js');
  const store = new SettingsStore(join(dataDir, 'settings.json'), safeStorage);
  await store.write({ CONNECTION_MODE: 'advanced', DRY_RUN: 'true', TIKFINITY_PORT: '0', TIKFINITY_SECRET: 'desktop-test-private-secret' });
  runtime = await launchDesktop({ dataDir, show: false });
  const { window, controller } = runtime;
  window.webContents.setBackgroundThrottling(false); // Let hidden visual checks wait for actual painted frames.
  const prefs = window.webContents.getLastWebPreferences();
  assert.equal(prefs.sandbox, true); assert.equal(prefs.contextIsolation, true); assert.equal(prefs.nodeIntegration, false);
  assert.equal(trustedSender({ sender: window.webContents, senderFrame: { url: 'https://evil.invalid' } }, window), false);
  const evaluate = expression => window.webContents.executeJavaScript(expression, true);
  await evaluate('new Promise(resolve => setTimeout(resolve, 300))');
  const pageErrors = [];
  window.webContents.on('console-message', event => { if (event.level === 'error') pageErrors.push(event.message); });
  const capture = async name => {
    await evaluate('new Promise(resolve => requestAnimationFrame(() => requestAnimationFrame(resolve)))');
    const screen = await window.webContents.capturePage(); await writeFile(join(dataDir, `${name}.png`), screen.toPNG());
  };
  await capture('first-run');
  const exposed = await evaluate('({ require: typeof window.require, process: typeof window.process, ipc: typeof window.ipcRenderer, api: Object.keys(window.pearconnect) })');
  assert.equal(exposed.require, 'undefined'); assert.equal(exposed.process, 'undefined'); assert.equal(exposed.ipc, 'undefined');
  assert.ok(exposed.api.includes('authorize')); assert.ok(!exposed.api.includes('send'));
  const state = await evaluate('window.pearconnect.snapshot()');
  assert.equal(state.ok, true); assert.equal(state.value.status.requestsEnabled, false);
  assert.doesNotMatch(JSON.stringify(state), /desktop-test-private-secret/);
  // Keyboard skip navigation must retain the exact URL trusted by the IPC boundary.
  const originalUrl = window.webContents.getURL();
  await evaluate('document.querySelector(".skip-link").click()');
  assert.equal(window.webContents.getURL(), originalUrl);
  assert.equal(await evaluate('document.activeElement.id'), 'main-content');
  assert.equal((await evaluate('window.pearconnect.snapshot()')).ok, true);
  const rules = await evaluate('window.pearconnect.rules({ MAX_SONG_SECONDS: "300", REQUEST_ALLOWLIST: "tiktok:alice" })');
  assert.equal(rules.ok, true); assert.equal(controller.engine.config.maxSongSeconds, 300);
  assert.equal((await evaluate('window.pearconnect.rules({ YTMD_TOKEN: "renderer-injected" })')).ok, false);
  assert.equal((await evaluate('window.pearconnect.testRequest({ user: "bob", query: "Test song" })')).value.code, 'forbidden');
  assert.equal((await evaluate('window.pearconnect.testRequest({ user: "alice", query: "Test song" })')).value.code, 'dry_run');
  const report = await evaluate('window.pearconnect.previewDiagnostics()'); assert.doesNotMatch(report.value.preview, /desktop-test-private-secret|alice/);
  // Exercise real renderer navigation/form submission and untrusted text rendering.
  assert.equal(await evaluate('document.querySelector("[name=CMD_REQUEST]").value="bad!command"; document.querySelector("[name=CMD_REQUEST]").validity.patternMismatch'), true);
  assert.equal(await evaluate('document.querySelector("[name=CMD_REQUEST]").value="song-request"; document.querySelector("[name=CMD_REQUEST]").checkValidity()'), true);
  await evaluate('document.querySelector("[name=CMD_REQUEST]").value="sr"');
  await evaluate('document.querySelector("[data-view=rules]").click(); document.querySelector("[name=COOLDOWN_SECONDS]").value="25"; document.querySelector("#rules-form").requestSubmit(); new Promise(resolve => setTimeout(resolve, 150))');
  assert.equal(controller.engine.config.cooldownSeconds, 25);
  controller.engine.activity.push({ id: 1, time: new Date().toISOString(), user: '<img src=x onerror=alert(1)>', query: 'Unicode “Jóga” 🦊', command: 'request', source: 'advanced', state: 'rejected', message: '<script>window.compromised=true</script>' });
  await evaluate('document.querySelector("[data-view=dashboard]").click(); call("snapshot")');
  assert.match(await evaluate('document.querySelector("#recent").textContent'), /<script>window.compromised=true<\/script>/);
  assert.equal(await evaluate('typeof window.compromised'), 'undefined');
  assert.equal(await evaluate('document.querySelectorAll(".activity-list img,.activity-list script").length'), 0);
  assert.equal(await evaluate('document.documentElement.scrollWidth <= window.innerWidth'), true);
  // The engine lock applies to a separate CLI process, even without a webhook listener.
  const cli = spawn(process.execPath, [fileURLToPath(new URL('../../src/index.js', import.meta.url)), '--dry-run'], { windowsHide: true,
    env: { ...process.env, ELECTRON_RUN_AS_NODE: '1', CONNECTION_MODE: 'advanced', TIKFINITY_PORT: '0', TWITCH_CHANNEL: '', YOUTUBE_CHANNEL_ID: '' } });
  let cliOutput = ''; cli.stdout.on('data', chunk => { cliOutput += chunk; }); cli.stderr.on('data', chunk => { cliOutput += chunk; });
  const [cliCode] = await once(cli, 'exit'); assert.equal(cliCode, 1); assert.match(cliOutput, /already running/);
  // Real authorization HTTP exchange, with a fake player and actual OS-encrypted persistence.
  let authCalls = 0, writes = 0, queueReads = 0;
  playerServer = http.createServer((request, response) => {
    response.setHeader('Content-Type', 'application/json');
    if (request.url.startsWith('/auth/')) { authCalls++; assert.equal(request.method, 'POST'); response.end(JSON.stringify({ accessToken: 'fresh-private-credential' })); }
    else if (request.url === '/api/v1/queue') {
      queueReads++; assert.equal(request.method, 'GET');
      response.end(JSON.stringify({ contents: [
        { playlistPanelVideoRenderer: { title: { simpleText: 'Jóga' }, shortBylineText: { runs: [{ text: 'Björk' }] }, selected: true } },
        { playlistPanelVideoRenderer: { title: { simpleText: 'A song for the stream' }, shortBylineText: { runs: [{ text: 'Local fixture' }] } } }
      ] }));
    }
    else { if (request.method !== 'GET') writes++; response.end(JSON.stringify({ title: 'Connected test player', artist: 'Local fixture' })); }
  });
  playerServer.listen(0, '127.0.0.1'); await once(playerServer, 'listening');
  await controller.importEnv({ CONNECTION_MODE: 'advanced', TIKFINITY_PORT: '0', YTMD_HOST: `http://127.0.0.1:${playerServer.address().port}`, REQUEST_ALLOWLIST: 'tiktok:alice' });
  const authorized = await evaluate('window.pearconnect.authorize()');
  assert.equal(authorized.ok, true); assert.equal(authorized.value.status.player, 'ready'); assert.equal(authCalls, 1); assert.equal(writes, 0);
  assert.doesNotMatch(JSON.stringify(authorized), /fresh-private-credential/);
  assert.equal((await store.read()).YTMD_TOKEN, 'fresh-private-credential');
  // Walk the actual interactive guide. Only the controlled chat/search fixture supplies evidence.
  await evaluate('document.querySelector("[data-view=setup]").click(); call("beginVerification")');
  assert.equal(controller.engine.requestsEnabled, false);
  await evaluate('document.querySelector("#verify-next").click()');
  assert.equal(await evaluate('document.querySelector("#verify-next").disabled'), true);
  const marker = controller.engine.verification.challenge;
  await controller.engine.execute('request', { user: 'alice', query: marker }, 'advanced');
  await evaluate('call("snapshot");');
  assert.equal(await evaluate('document.querySelector("#verify-next").disabled'), false);
  await evaluate('document.querySelector("#verify-next").click()');
  const originalSearch = controller.engine.player.findFirstSong;
  controller.engine.player.findFirstSong = async () => ({ videoId: 'test-song', title: 'Jóga', artist: 'Björk', durationSec: 120 });
  await evaluate('document.querySelector("#verify-song-form [name=user]").value="alice"; document.querySelector("#verify-song-form [name=query]").value="Björk Jóga"; document.querySelector("#verify-song-form").requestSubmit(); new Promise(r=>setTimeout(r,150))');
  assert.equal(writes, 0); assert.equal(controller.engine.verification.rulesPassed, true);
  await evaluate('document.querySelector("#verify-next").click(); call("finishVerification")');
  assert.equal(controller.engine.requestsEnabled, true);
  controller.engine.player.findFirstSong = originalSearch;
  assert.equal((await evaluate('window.pearconnect.resume()')).value.status.requestsEnabled, true);
  assert.equal((await evaluate('window.pearconnect.pause()')).value.status.requestsEnabled, false); assert.equal(writes, 0);
  assert.equal((await evaluate('window.pearconnect.connections({ YTMD_HOST: "http://evil.invalid" })')).ok, false);
  // The persistent control must still use its current action after a status refresh/navigation.
  await evaluate('call("snapshot")');
  await evaluate('document.querySelector("#intake-toggle").click(); new Promise(resolve => setTimeout(resolve, 150))');
  assert.equal(controller.engine.requestsEnabled, true);
  assert.equal(await evaluate('document.querySelector("#intake-toggle-label").textContent'), 'Pause requests');
  await evaluate('document.querySelector("[data-view=connections]").click(); document.querySelector("#intake-toggle").click(); new Promise(resolve => setTimeout(resolve, 150))');
  assert.equal(controller.engine.requestsEnabled, false); assert.equal(writes, 0);
  assert.equal(await evaluate('document.querySelector("#intake-toggle-label").textContent'), 'Enable requests');
  // Background status updates should preserve unfinished form edits.
  await evaluate('document.querySelector("[name=COOLDOWN_SECONDS]").value="27"; call("snapshot")');
  assert.equal(await evaluate('document.querySelector("[name=COOLDOWN_SECONDS]").value'), '27');
  assert.equal(await evaluate('document.querySelectorAll("[data-mode=advanced][aria-pressed=true]").length'), 2);
  await evaluate('document.querySelector("[data-view=requests]").click(); call("playerQueue")');
  assert.equal(queueReads, 1); assert.equal(writes, 0);
  assert.equal(await evaluate('document.querySelectorAll("#player-queue .queue-row").length'), 2);
  assert.match(await evaluate('document.querySelector("#player-queue").textContent'), /Jóga.*Björk.*CURRENT/);
  // Synthetic display fixtures cover each result style; these do not perform player writes.
  controller.engine.activity.splice(0, controller.engine.activity.length,
    { id: 101, time: new Date(Date.now() - 60000).toISOString(), user: 'river', query: 'Björk — Jóga', command: 'request', source: 'tiktok', state: 'enqueue_confirmed', message: 'Added to the player queue.' },
    { id: 102, time: new Date(Date.now() - 30000).toISOString(), user: 'midnight', query: 'An extended live session', command: 'request', source: 'twitch', state: 'rejected', message: 'This song exceeds your maximum duration.' },
    { id: 103, time: new Date().toISOString(), user: 'alex', query: 'A song for the stream', command: 'request', source: 'tiktok', state: 'outcome_uncertain', message: 'Check the player before retrying.' }
  );
  await evaluate('call("snapshot")');
  for (const width of [1240, 860]) {
    window.setSize(width, 850);
    for (const page of ['setup', 'session', 'rules', 'connections', 'requests', 'activity', 'dashboard']) {
      await evaluate(`document.querySelector('[data-view="${page}"]').click()`);
      assert.equal(await evaluate('document.documentElement.scrollWidth <= window.innerWidth'), true, `${page} must fit at ${width}px`);
      assert.equal(await evaluate('document.querySelectorAll("nav [aria-current=page]").length'), 1);
      assert.equal(await evaluate('document.querySelector("nav [aria-current=page]").dataset.view'), page);
      await capture(`${page}-${width}`);
    }
  }
  assert.deepEqual(pageErrors, []);
  console.log('PASS: real Electron sandbox, IPC boundary, encrypted authorization, GUI/CLI exclusion, shared rules, safe preview, forms, request controls, keyboard navigation and responsive rendering.');
  console.log(`Screenshots: ${dataDir}`);
  await controller.engine.stop(); playerServer.closeAllConnections(); await new Promise(resolve => playerServer.close(resolve)); window.destroy(); app.quit();
} catch (error) { console.error(error); playerServer?.closeAllConnections(); playerServer?.close(); await runtime?.controller.engine.stop(); runtime?.window.destroy(); app.exit(1); }
});
