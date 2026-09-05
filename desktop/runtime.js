import electron from 'electron';
import { join, dirname } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { readFile, writeFile, copyFile } from 'node:fs/promises';
import dotenv from 'dotenv';
import { SettingsStore, SETTING_KEYS } from './settings.js';
import { DesktopController } from './controller.js';
import { InputError } from '../src/validation.js';

const { app, BrowserWindow, ipcMain, session, dialog, clipboard, shell, net, protocol, safeStorage } = electron;
const directory = dirname(fileURLToPath(import.meta.url));
export const APP_URL = 'pearconnect://desktop/index.html';
protocol.registerSchemesAsPrivileged([{ scheme: 'pearconnect', privileges: { standard: true, secure: true, supportFetchAPI: false } }]);

export function trustedSender(event, window) {
  return event.sender === window.webContents && event.senderFrame === window.webContents.mainFrame && event.senderFrame.url === APP_URL;
}

export async function launchDesktop({ dataDir = app.getPath('userData'), show = true } = {}) {
  const controller = new DesktopController(new SettingsStore(join(dataDir, 'settings.json'), safeStorage));
  let initialError;
  try { await controller.init(); } catch (error) {
    initialError = error instanceof InputError ? error.message : 'Could not open saved settings.';
    // Keep a repair window available; never overwrite an unreadable settings file automatically.
    controller.env = { CONNECTION_MODE: 'simple', REQUESTS_ENABLED: 'false', TIKFINITY_PORT: '0' };
    const { PearConnectEngine } = await import('../src/engine.js');
    const { validateSettings } = await import('./settings.js');
    controller.engine = new PearConnectEngine(validateSettings(controller.env));
    controller.startupError = initialError;
  }
  const window = new BrowserWindow({ title: 'PearConnect Desktop', width: 1240, height: 850, minWidth: 860, minHeight: 620, show: false, backgroundColor: '#101510',
    webPreferences: { preload: join(directory, 'preload.cjs'), nodeIntegration: false, contextIsolation: true, sandbox: true, webSecurity: true, webviewTag: false } });
  window.setMenuBarVisibility(false);
  session.defaultSession.setPermissionRequestHandler((_contents, _permission, callback) => callback(false));
  session.defaultSession.setPermissionCheckHandler(() => false);
  const assets = new Map(['index.html', 'renderer.js', 'style.css'].map(file => [`/` + file, join(directory, file)]));
  protocol.handle('pearconnect', request => {
    const url = new URL(request.url); const path = url.hostname === 'desktop' && !url.search ? assets.get(url.pathname) : null;
    return path ? net.fetch(pathToFileURL(path).href) : new Response('Not found', { status: 404 });
  });
  window.webContents.setWindowOpenHandler(() => ({ action: 'deny' }));
  window.webContents.on('will-navigate', event => event.preventDefault());
  window.webContents.on('will-attach-webview', event => event.preventDefault());
  let preview;
  const actions = {
    snapshot: () => controller.snapshot(),
    testPlayer: async () => { await controller.engine.testPlayer(); return controller.snapshot(); },
    authorize: () => controller.authorize(),
    pause: () => { controller.engine.pauseRequests(); return controller.snapshot(); },
    resume: () => { controller.engine.resumeRequests(); return controller.snapshot(); },
    mode: value => controller.changeMode(value), rules: values => controller.saveRules(values),
    connections: values => controller.saveConnections(values), reconnect: () => controller.reconnect(),
    disconnect: async () => { await controller.serialized(() => controller.engine.stop()); return controller.snapshot(); },
    testRequest: values => controller.engine.validateRequest(values),
    testIntegration: async () => {
      const config = controller.engine.config;
      if (!config.port || controller.engine.lifecycle !== 'running') throw new InputError('Connect the local webhook before testing the integration.');
      const response = await fetch(`http://127.0.0.1:${config.port}/tikfinity/test`, { method: 'POST', redirect: 'error', signal: AbortSignal.timeout(config.timeoutMs),
        headers: { 'Content-Type': 'application/json', 'X-Webhook-Secret': config.secret }, body: JSON.stringify({ user: 'pearconnect-test', query: 'validation only' }) });
      if (!response.ok) throw new InputError('Local integration test failed. Check the port and webhook secret.');
      return { message: 'Local endpoint and authentication passed. No playback changes. Use the Streamer.bot Connection Test action to verify delivery from your automation.' };
    },
    playerQueue: async () => {
      if (controller.engine.config.dryRun || !controller.engine.config.token) return { tracks: [], message: 'Connect Pear Desktop to read its queue.' };
      const raw = await controller.engine.player.getQueue();
      const tracks = [];
      const visit = value => {
        if (!value || typeof value !== 'object') return;
        if (value.playlistPanelVideoRenderer) {
          const row = value.playlistPanelVideoRenderer;
          const text = field => typeof field === 'string' ? field : field?.runs?.map(run => typeof run.text === 'string' ? run.text : '').join('') || field?.simpleText || '';
          tracks.push({ title: text(row.title).slice(0, 512), artist: text(row.shortBylineText).slice(0, 512), selected: row.selected === true });
        }
      };
      const stack = [raw]; let visited = 0;
      while (stack.length && ++visited < 50000 && tracks.length < 200) { const item = stack.pop(); visit(item); if (item && typeof item === 'object') stack.push(...Object.values(item).reverse().filter(x => x && typeof x === 'object')); }
      return { tracks, message: tracks.length ? 'Pear Desktop queue snapshot. Ownership is not inferred.' : 'No recognized queue rows returned by Pear Desktop.' };
    },
    copyEndpoint: () => {
      const origin = `http://127.0.0.1:${controller.engine.config.port}`;
      clipboard.writeText(`${origin}/tikfinity`);
      return { message: `Endpoint copied. Streamer.bot’s PearConnect.Url uses only ${origin}, without /tikfinity.` };
    },
    revealSecret: async () => {
      const choice = await dialog.showMessageBox(window, { type: 'info', title: 'Webhook secret', message: controller.engine.config.secret || 'No secret configured', detail: 'Keep this value private. Configure it in Streamer.bot’s PearConnect.Secret global.', buttons: ['Close', 'Copy secret'], defaultId: 0, cancelId: 0, noLink: true });
      if (choice.response === 1) clipboard.writeText(controller.engine.config.secret);
      return { message: choice.response === 1 ? 'Secret copied to your clipboard. Keep it private.' : 'Secret dialog closed.' };
    },
    rotateSecret: () => controller.rotateSecret(),
    exportActions: async () => {
      const result = await dialog.showSaveDialog(window, { title: 'Export Streamer.bot action package', defaultPath: 'PearConnect.sb', filters: [{ name: 'Streamer.bot import', extensions: ['sb'] }] });
      if (!result.canceled) await copyFile(join(directory, '..', 'integrations', 'streamerbot', 'PearConnect.sb'), result.filePath);
      return { message: result.canceled ? 'Export cancelled.' : 'Action package exported. Import it in Streamer.bot.' };
    },
    importConfig: async () => {
      const result = await dialog.showOpenDialog(window, { title: 'Import existing PearConnect .env', properties: ['openFile', 'showHiddenFiles'] });
      if (result.canceled) return { message: 'Import cancelled.' };
      const raw = await readFile(result.filePaths[0], 'utf8'); if (raw.length > 65536) throw new InputError('Configuration file is too large.');
      const env = Object.fromEntries(Object.entries(dotenv.parse(raw)).filter(([key]) => SETTING_KEYS.includes(key)));
      return controller.importEnv(env);
    },
    openPlayer: async () => {
      const choice = await dialog.showOpenDialog(window, { title: 'Locate Pear Desktop', properties: ['openFile'], filters: [{ name: 'Windows application', extensions: ['exe'] }] });
      if (!choice.canceled) { const error = await shell.openPath(choice.filePaths[0]); if (error) throw new InputError('Could not open the selected player.'); }
      return { message: choice.canceled ? 'Open player cancelled.' : 'Player launch requested.' };
    },
    previewDiagnostics: () => { preview = JSON.stringify(controller.engine.diagnostics(), null, 2); return { preview }; },
    exportDiagnostics: async () => {
      if (!preview) throw new InputError('Preview the diagnostic report before exporting.');
      const result = await dialog.showSaveDialog(window, { title: 'Export previewed diagnostic report', defaultPath: 'pearconnect-diagnostics.json', filters: [{ name: 'JSON', extensions: ['json'] }] });
      if (!result.canceled) await writeFile(result.filePath, preview + '\n', { mode: 0o600 });
      preview = null; return { message: result.canceled ? 'Export cancelled.' : 'Previewed report exported.' };
    },
  };
  ipcMain.handle('pearconnect', async (event, operation, payload) => {
    if (!trustedSender(event, window) || typeof operation !== 'string' || !Object.hasOwn(actions, operation)) return { ok: false, error: 'Operation not permitted.' };
    if (payload !== undefined && JSON.stringify(payload).length > 16384) return { ok: false, error: 'Input is too large.' };
    try { return { ok: true, value: await actions[operation](payload) }; }
    catch (error) { return { ok: false, error: error instanceof InputError ? error.message : 'Operation failed. Check the connection and local file permissions.' }; }
  });
  await window.loadURL(APP_URL);
  if (show) window.show();
  let stopping = false;
  window.on('close', event => {
    if (stopping) return; event.preventDefault(); stopping = true;
    controller.engine.stop().finally(() => window.destroy());
  });
  return { window, controller };
}
