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
  const prefs = window.webContents.getLastWebPreferences();
  assert.equal(prefs.sandbox, true); assert.equal(prefs.contextIsolation, true); assert.equal(prefs.nodeIntegration, false);
  assert.equal(trustedSender({ sender: window.webContents, senderFrame: { url: 'https://evil.invalid' } }, window), false);
  const evaluate = expression => window.webContents.executeJavaScript(expression, true);
  await evaluate('new Promise(resolve => setTimeout(resolve, 300))');
  const exposed = await evaluate('({ require: typeof window.require, process: typeof window.process, ipc: typeof window.ipcRenderer, api: Object.keys(window.pearconnect) })');
  assert.equal(exposed.require, 'undefined'); assert.equal(exposed.process, 'undefined'); assert.equal(exposed.ipc, 'undefined');
  assert.ok(exposed.api.includes('authorize')); assert.ok(!exposed.api.includes('send'));
  const state = await evaluate('window.pearconnect.snapshot()');
  assert.equal(state.ok, true); assert.equal(state.value.status.requestsEnabled, false);
  assert.doesNotMatch(JSON.stringify(state), /desktop-test-private-secret/);
  const rules = await evaluate('window.pearconnect.rules({ MAX_SONG_SECONDS: "300", REQUEST_ALLOWLIST: "tiktok:alice" })');
  assert.equal(rules.ok, true); assert.equal(controller.engine.config.maxSongSeconds, 300);
  assert.equal((await evaluate('window.pearconnect.rules({ YTMD_TOKEN: "renderer-injected" })')).ok, false);
  assert.equal((await evaluate('window.pearconnect.testRequest({ user: "bob", query: "Test song" })')).value.code, 'forbidden');
  assert.equal((await evaluate('window.pearconnect.testRequest({ user: "alice", query: "Test song" })')).value.code, 'dry_run');
  const report = await evaluate('window.pearconnect.previewDiagnostics()'); assert.doesNotMatch(report.value.preview, /desktop-test-private-secret|alice/);
  // Exercise real renderer navigation/form submission and untrusted text rendering.
  await evaluate('document.querySelector("[data-view=rules]").click(); document.querySelector("[name=COOLDOWN_SECONDS]").value="25"; document.querySelector("#rules-form").requestSubmit(); new Promise(resolve => setTimeout(resolve, 150))');
  assert.equal(controller.engine.config.cooldownSeconds, 25);
  controller.engine.activity.push({ id: 1, time: new Date().toISOString(), user: '<img src=x onerror=alert(1)>', query: 'Unicode “Jóga” 🦊', command: 'request', source: 'advanced', state: 'rejected', message: '<script>window.compromised=true</script>' });
  await evaluate('document.querySelector("[data-view=dashboard]").click(); new Promise(resolve => setTimeout(resolve, 3200))');
  assert.equal(await evaluate('typeof window.compromised'), 'undefined');
  assert.equal(await evaluate('document.querySelectorAll(".activity-list img,.activity-list script").length'), 0);
  assert.equal(await evaluate('document.documentElement.scrollWidth <= window.innerWidth'), true);
  const pageErrors = [];
  window.webContents.on('console-message', (_event, level, message) => { if (level === 3) pageErrors.push(message); });
  // The engine lock applies to a separate CLI process, even without a webhook listener.
  const cli = spawn(process.execPath, [fileURLToPath(new URL('../../src/index.js', import.meta.url)), '--dry-run'], { windowsHide: true,
    env: { ...process.env, ELECTRON_RUN_AS_NODE: '1', CONNECTION_MODE: 'advanced', TIKFINITY_PORT: '0', TWITCH_CHANNEL: '', YOUTUBE_CHANNEL_ID: '' } });
  let cliOutput = ''; cli.stdout.on('data', chunk => { cliOutput += chunk; }); cli.stderr.on('data', chunk => { cliOutput += chunk; });
  const [cliCode] = await once(cli, 'exit'); assert.equal(cliCode, 1); assert.match(cliOutput, /already running/);
  // Real authorization HTTP exchange, with a fake player and actual OS-encrypted persistence.
  let authCalls = 0, writes = 0;
  playerServer = http.createServer((request, response) => {
    response.setHeader('Content-Type', 'application/json');
    if (request.url.startsWith('/auth/')) { authCalls++; assert.equal(request.method, 'POST'); response.end(JSON.stringify({ accessToken: 'fresh-private-credential' })); }
    else { if (request.method !== 'GET') writes++; response.end(JSON.stringify({ title: 'Connected test player', artist: 'Local fixture' })); }
  });
  playerServer.listen(0, '127.0.0.1'); await once(playerServer, 'listening');
  await controller.importEnv({ CONNECTION_MODE: 'advanced', TIKFINITY_PORT: '0', YTMD_HOST: `http://127.0.0.1:${playerServer.address().port}`, REQUEST_ALLOWLIST: 'tiktok:alice' });
  const authorized = await evaluate('window.pearconnect.authorize()');
  assert.equal(authorized.ok, true); assert.equal(authorized.value.status.player, 'ready'); assert.equal(authCalls, 1); assert.equal(writes, 0);
  assert.doesNotMatch(JSON.stringify(authorized), /fresh-private-credential/);
  assert.equal((await store.read()).YTMD_TOKEN, 'fresh-private-credential');
  assert.equal((await evaluate('window.pearconnect.resume()')).value.status.requestsEnabled, true);
  assert.equal((await evaluate('window.pearconnect.pause()')).value.status.requestsEnabled, false); assert.equal(writes, 0);
  assert.equal((await evaluate('window.pearconnect.connections({ YTMD_HOST: "http://evil.invalid" })')).ok, false);
  for (const page of ['setup', 'rules', 'connections', 'requests', 'activity', 'dashboard']) {
    await evaluate(`document.querySelector('[data-view="${page}"]').click()`);
    assert.equal(await evaluate('document.documentElement.scrollWidth <= window.innerWidth'), true);
  }
  assert.deepEqual(pageErrors, []);
  const screen = await window.webContents.capturePage(); await writeFile(join(dataDir, 'dashboard.png'), screen.toPNG());
  console.log('PASS: real Electron sandbox, IPC boundary, encrypted authorization, GUI/CLI exclusion, shared rules, safe preview, forms and rendering.');
  console.log(`Screenshot: ${join(dataDir, 'dashboard.png')}`);
  await controller.engine.stop(); playerServer.closeAllConnections(); await new Promise(resolve => playerServer.close(resolve)); window.destroy(); app.quit();
} catch (error) { console.error(error); playerServer?.closeAllConnections(); playerServer?.close(); await runtime?.controller.engine.stop(); runtime?.window.destroy(); app.exit(1); }
});
