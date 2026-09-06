import electron from 'electron';
import { join, dirname } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { readFile, writeFile, copyFile } from 'node:fs/promises';
import dotenv from 'dotenv';
import { SettingsStore, SETTING_KEYS } from './settings.js';
import { DesktopController } from './controller.js';
import { InputError } from '../src/validation.js';
import { PlaybackStudio } from './studio.js';
import { lastfmUrl } from '../src/playback.js';
import { playerQueue } from '../src/player-queue.js';
import { DiscordPresence } from './discord-presence.js';

const { app, BrowserWindow, ipcMain, session, dialog, clipboard, shell, net, protocol, safeStorage, nativeImage } = electron;
const directory = dirname(fileURLToPath(import.meta.url));
export const APP_URL = 'pearconnect://desktop/index.html';
protocol.registerSchemesAsPrivileged([{ scheme: 'pearconnect', privileges: { standard: true, secure: true, supportFetchAPI: false } }]);

export function trustedSender(event, window) {
  return event.sender === window.webContents && event.senderFrame === window.webContents.mainFrame && event.senderFrame.url === APP_URL;
}

export async function launchDesktop({ dataDir = app.getPath('userData'), show = true, studioOptions = {} } = {}) {
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
  controller.studio = new PlaybackStudio(controller, { decode: data => {
    const image = nativeImage.createFromBuffer(data); if (image.isEmpty()) return null;
    const size = image.getSize(); if (size.width > 8192 || size.height > 8192) return null;
    return image.resize({ width: Math.min(640, size.width), quality: 'good' }).toPNG();
  }, ...studioOptions });
  await controller.studio.start();
  controller.discord = new DiscordPresence({ getState: () => ({ running: controller.engine.lifecycle === 'running', requestsEnabled: controller.engine.requestsEnabled, track: controller.studio.snapshot().track }) });
  controller.discord.configure(controller.env);
  const iconPath = () => join(directory, 'assets', `${controller.env.APP_ICON || 'pear'}.png`);
  const window = new BrowserWindow({ title: 'PearConnect Desktop', icon: iconPath(), width: 1320, height: 900, minWidth: 860, minHeight: 620, show: false, backgroundColor: '#151819',
    webPreferences: { preload: join(directory, 'preload.cjs'), nodeIntegration: false, contextIsolation: true, sandbox: true, webSecurity: true, webviewTag: false } });
  window.setMenuBarVisibility(false);
  session.defaultSession.setPermissionRequestHandler((_contents, _permission, callback) => callback(false));
  session.defaultSession.setPermissionCheckHandler(() => false);
  const assets = new Map(['index.html', 'renderer.js', 'style.css', 'widget.js', 'widget.css', 'studio-ui.js', 'studio.css', 'social.js', 'social.css', ...['tiktok', 'twitch', 'discord', 'youtube', 'instagram', 'kick', 'website'].map(p => `assets/platforms/${p}.svg`), 'assets/pear.png', 'assets/orchid.png', 'assets/ember.png', 'assets/sample-cover.png'].map(file => [`/` + file, join(directory, file)]));
  protocol.handle('pearconnect', request => {
    const url = new URL(request.url);
    const artwork = /^\/artwork\/([a-f\d]{16})\.png$/.exec(url.pathname);
    if (url.hostname === 'desktop' && !url.search && artwork) {
      const data = controller.studio.artwork(artwork[1]); return new Response(data, { status: data ? 200 : 404, headers: { 'Content-Type': 'image/png', 'Cache-Control': 'no-store' } });
    }
    const path = url.hostname === 'desktop' && !url.search ? assets.get(url.pathname) : null;
    return path ? net.fetch(pathToFileURL(path).href) : new Response('Not found', { status: 404 });
  });
  window.webContents.setWindowOpenHandler(() => ({ action: 'deny' }));
  window.webContents.on('will-navigate', event => event.preventDefault());
  window.webContents.on('will-attach-webview', event => event.preventDefault());
  let preview;
  const actions = {
    snapshot: () => controller.snapshot(),
    appearance: async values => { const result = await controller.saveAppearance(values); window.setIcon(iconPath()); return result; },
    removeLastfm: () => controller.removeLastfm(),
    openLastfmSetup: async () => { await shell.openExternal('https://www.last.fm/api/account/create'); return { message: 'Last.fm API key setup opened in your browser.' }; },
    openLastfmTerms: async () => { await shell.openExternal('https://www.last.fm/api/tos'); return { message: 'Last.fm API terms opened in your browser.' }; },
    similarTracks: () => controller.studio.similar(),
    openTrackInfo: async () => { const url = lastfmUrl(controller.studio.snapshot().metadata?.url); if (!url) throw new InputError('Last.fm information is not available for this track.'); await shell.openExternal(url); return { message: 'Opened this track on Last.fm.' }; },
    copyOverlay: () => { clipboard.writeText(controller.studio.overlayUrl()); return { message: 'Private browser-source URL copied. In TikTok Studio, turn on Custom resolution and use the dimensions shown above the preview. Keep source sound off and Always keep active on.' }; },
    discordLive: value => { if (typeof value !== 'boolean') throw new InputError('Choose live or ended.'); if (!controller.discord.enabled) throw new InputError('Enable Discord presence first.'); controller.discord.setLive(value); return controller.snapshot(); },
    rotateOverlay: () => controller.rotateOverlay(),
    copySocial: () => { clipboard.writeText(controller.studio.socialUrl()); return { message: 'Social ticker URL copied. Add a separate Link / Browser source at 600 × 120, or 400 × 120 for portrait. Keep source sound off.' }; },
    testPlayer: async () => { await controller.engine.testPlayer(); return controller.snapshot(); },
    authorize: () => controller.authorize(),
    pause: () => controller.intake(false),
    resume: () => controller.intake(true),
    beginVerification: () => { controller.engine.beginVerification(); return controller.snapshot(); },
    verifySong: payload => controller.engine.verifySong(payload),
    finishVerification: () => { controller.engine.finishVerification(); return controller.snapshot(); },
    createSession: values => controller.createSession(values),
    updateSession: values => controller.updateSession(values),
    endSession: () => controller.endSession(),
    pairDashboard: async () => { await shell.openExternal(await controller.session.pairingUrl()); return { message: 'Pairing opened in your browser. The link expires in two minutes and works once.' }; },
    copySessionLink: () => {
      const info = controller.session?.snapshot();
      if (!info || info.ended) throw new InputError('Create a session first.');
      clipboard.writeText(info.url); return { message: 'Viewer request link copied. This link cannot manage the session.' };
    },
    copyTestCommand: () => {
      const v = controller.engine.verificationStatus(); if (!v || v.state !== 'waiting') throw new InputError('Start a new guided test first.');
      clipboard.writeText(v.command); return { message: 'Test command copied. Send it as a comment in your live TikTok chat.' };
    },
    mode: value => controller.changeMode(value), rules: values => controller.saveRules(values),
    connections: values => controller.saveConnections(values), reconnect: () => controller.reconnect(),
    disconnect: async () => { await controller.serialized(() => controller.stop()); return controller.snapshot(); },
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
      let tracks;
      try { tracks = playerQueue(raw); } catch { throw new InputError('Pear Desktop returned an unsupported queue format. Update the player and retry.'); }
      return { tracks, message: tracks.length ? `${tracks.length} tracks reported by Pear Desktop at ${new Date().toLocaleTimeString()}. New requests go to the end. Positions may change; viewer ownership is not inferred.` : 'Pear Desktop reports an empty queue.' };
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
    Promise.allSettled([controller.discord.close(), controller.studio.close()]).then(() => controller.stop()).finally(() => window.destroy());
  });
  return { window, controller };
}
