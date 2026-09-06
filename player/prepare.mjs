import { readFile, writeFile, cp } from 'node:fs/promises';
import { resolve, join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { prepareStudio } from './prepare-studio.mjs';
const here = dirname(fileURLToPath(import.meta.url));
const target = resolve(process.argv[2] || 'dist/player-source-3.11.0');
const pkg = JSON.parse(await readFile(join(target, 'package.json'), 'utf8'));
if (pkg.version !== '3.11.0' || pkg.name !== 'youtube-music') throw new Error('Apply only to a clean official 3.11.0 source checkout.');
async function edit(file, fn) { const path = join(target, file); await writeFile(path, fn(await readFile(path, 'utf8'))); }
function replace(text, from, to) {
  if (text.split(from).length !== 2) throw new Error(`Expected one source marker: ${from.slice(0,70)}`);
  return text.replace(from, to);
}
await cp(join(here, 'overlay'), target, { recursive: true });
await edit('src/renderer.ts', text => {
  text = "import { createQueueCompatibility } from './queue-compat';\n" + text;
  const start = text.indexOf("  window.ipcRenderer.on(\n    'ytmd:add-to-queue',");
  const end = text.indexOf("  window.ipcRenderer.on(\n    'ytmd:move-in-queue',", start);
  if (start < 0 || end < 0) throw new Error('Queue renderer source markers missing');
  return text.slice(0, start) + `  const queueCompatibility = createQueueCompatibility({
    getQueue: () => document.querySelector('#queue'),
    getApp: () => document.querySelector('ytmusic-app'),
  });
  window.ipcRenderer.on('ytmd:add-to-queue', async (_, videoId: string, position: string, requestId?: string, deadline?: number, preview = false) => {
    const result = await queueCompatibility.enqueue(videoId, position, deadline, preview);
    if (requestId) window.ipcRenderer.send('pearconnect:queue-result', requestId, result);
    if (!result.ok) console.warn('[PearConnect queue]', result.code);
  });
` + text.slice(end);
});
await edit('src/providers/song-controls.ts', text => {
  text = "import { queueRequest } from './queue-rpc';\n" + text;
  text = text.replace(/const parseStringFromArgsType = [\s\S]*?\n};\n\n/, '');
  const start = text.indexOf('    addSongToQueue: (');
  const end = text.indexOf('    moveSongInQueue:', start);
  if (start < 0 || end < 0) throw new Error('Queue controller source markers missing');
  return text.slice(0,start) + `    addSongToQueue: (videoId: string, position: string) => queueRequest(win, videoId, position),
` + text.slice(end);
});
await edit('src/plugins/api-server/backend/routes/control.ts', text => {
  text = "import { queueRequest } from '@/providers/queue-rpc';\n" + text;
  const start = text.indexOf('  app.openapi(routes.addSongToQueue,');
  const end = text.indexOf('  app.openapi(routes.moveSongInQueue,', start);
  if (start < 0 || end < 0) throw new Error('Queue API markers missing');
  text = text.slice(0,start) + `  app.openapi(routes.addSongToQueue, async (ctx) => {
    const { videoId, insertPosition } = ctx.req.valid('json');
    const result = await controller.addSongToQueue(videoId, insertPosition);
    return ctx.json(result, result.ok ? 200 : 502);
  });
  app.get('/api/v1/queue/compatibility', (ctx) => ctx.json({ build: '3.11.0-pearconnect.1', verifiedQueueWrites: true, previewPath: '/api/v1/queue/preview' }));
  app.post('/api/v1/queue/preview', async (ctx) => {
    const body = await ctx.req.json().catch(() => null);
    if (typeof body?.videoId !== 'string' || !/^[A-Za-z0-9_-]{11}$/.test(body.videoId)) return ctx.json({ code: 'invalid_request' }, 400);
    const result = await queueRequest(window, body.videoId, 'INSERT_AT_END', true);
    return ctx.json(result, result.ok ? 200 : 502);
  });
` + text.slice(end);
  const definitionStart = text.indexOf('  addSongToQueue: createRoute(');
  const definitionEnd = text.indexOf('  moveSongInQueue: createRoute(', definitionStart);
  let definition = text.slice(definitionStart, definitionEnd);
  definition = replace(definition, `      204: {\n        description: 'Success',\n      },`, `      200: { description: 'Queue insertion verified', content: { 'application/json': { schema: z.object({ ok: z.boolean(), code: z.string(), videoId: z.string(), queueVerified: z.boolean().optional(), queuePosition: z.number().optional(), outcomeUncertain: z.boolean().optional() }) } } },
      502: { description: 'Queue insertion failed or could not be verified', content: { 'application/json': { schema: z.object({ ok: z.boolean(), code: z.string(), videoId: z.string(), outcomeUncertain: z.boolean().optional() }) } } },`);
  return text.slice(0, definitionStart) + definition + text.slice(definitionEnd);
});
await edit('src/plugins/api-server/backend/scheme/queue.ts', text => replace(text, 'videoId: z.string(),', 'videoId: z.string().regex(/^[A-Za-z0-9_-]{11}$/),'));
await edit('src/plugins/api-server/config.ts', text => text.replace('enabled: false,','enabled: true,').replace("hostname: '0.0.0.0'", "hostname: '127.0.0.1'").replace('Date.now().toString(36)', 'crypto.randomUUID() + crypto.randomUUID()'));
await edit('src/config/defaults.ts', text => text.replace('autoUpdates: true,', 'autoUpdates: false,').replace("    themes: [],", "    themes: [],\n    customWindowTitle: 'PearConnect Player · Queue edition',"));
await edit('src/plugins/skip-silences/renderer.ts', text => replace(text, 'fftBins: Float32Array)', 'fftBins: Float32Array<ArrayBuffer>)'));
await edit('src/menu.ts', text => replace(text, `          label: t('main.menu.options.submenu.auto-update'),
          type: 'checkbox',
          checked: config.get('options.autoUpdates'),
          click(item: MenuItem) {
            config.setMenuOption('options.autoUpdates', item.checked);
          },`, `          label: 'PearConnect Player releases',
          click() { void shell.openExternal('https://github.com/foulfoxhacks/PearConnect-Song-Requests/releases'); },`));
await edit('src/index.ts', text => {
  text = text.replace("import { autoUpdater } from 'electron-updater';\n", '').replace('autoUpdater.autoDownload = false;\n', '');
  const start = text.indexOf("  if (!is.dev() && config.get('options.autoUpdates')) {");
  const end = text.indexOf("  if (config.get('options.hideMenu')", start);
  if (start < 0 || end < 0) throw new Error('Updater markers missing');
  text = text.slice(0,start) + '  // Updates for this modified player are distributed separately by PearConnect.\n\n' + text.slice(end);
  return text.replaceAll('com.github.th-ch.youtube-music', 'site.mellozone.pearconnect.player').replaceAll('com.github.th_ch.youtube_music', 'site.mellozone.pearconnect.player').replace("'assets/generated/icon.ico'", "'assets/pearconnect.ico'");
});
await edit('src/providers/protocol-handler.ts', text => replace(text, "APP_PROTOCOL = 'youtubemusic'", "APP_PROTOCOL = 'pearconnect-player'"));
await cp(join(here, '../desktop/assets/pear.ico'), join(target, 'assets/pearconnect.ico'));
for(const icon of ['pear','orchid','ember'])await cp(join(here, `../desktop/assets/${icon}.png`),join(target,`assets/pearconnect/${icon}.png`));
await edit('electron-builder.yml', text => text.replace('appId: com.github.th-ch.youtube-music', 'appId: site.mellozone.pearconnect.player').replace('productName: YouTube Music', 'productName: PearConnect Player').replace('icon: assets/generated/icons/win/icon.ico', 'icon: assets/pearconnect.ico') + '\nnpmRebuild: false\nartifactName: PearConnect-Player-${version}-win-${arch}.${ext}\n');
pkg.name = 'pearconnect-player'; pkg.productName = 'PearConnect Player'; pkg.version = '3.11.0-pearconnect.1';
pkg.description = 'PearConnect queue edition of the 3.11.0 YouTube Music desktop player. Independently modified by FoulFoxHacks.';
pkg.desktopName = 'site.mellozone.pearconnect.player';
await writeFile(join(target, 'package.json'), JSON.stringify(pkg, null, 2) + '\n');
await prepareStudio(target);
await edit('electron-builder.yml', text => text+'\n# Retain the 3.11 player/plugin sources with the maintained PearConnect runtime.\nelectronVersion: 44.2.0\n');
console.log('Prepared PearConnect Player 3.11.0-pearconnect.1');
