// Runs only in a fresh, muted test profile, never in a streamer's profile.
import { app, BrowserWindow } from 'electron';
import { mkdirSync, writeFileSync } from 'node:fs';
import { resolve, join } from 'node:path';
import { pathToFileURL } from 'node:url';
import { randomBytes } from 'node:crypto';
import assert from 'node:assert/strict';
import { YTMDClient } from '../src/ytmd.js';
import { QueueManager } from '../src/queue-manager.js';
import { loadConfig } from '../src/config.js';
import { playerQueue } from '../src/player-queue.js';
import { runStudioAcceptance } from './acceptance-studio.mjs';
const profile = resolve(process.argv[2]);
if (!profile.startsWith(resolve('dist/player-tests') + '\\') && !profile.startsWith(resolve('dist/player-tests') + '/')) throw Error('Isolated test profile required');
mkdirSync(profile, { recursive: true });
app.setName('PearConnect Player Acceptance');
app.setPath('userData', profile);
app.commandLine.appendSwitch('mute-audio');
app.setAsDefaultProtocolClient = () => false;
app.setLoginItemSettings = () => {};
app.on('browser-window-created',(_event,win)=>{ win.show=()=>{};win.focus=()=>{}; });
const realFetch=globalThis.fetch;
globalThis.fetch=(input,init)=>String(input).startsWith('https://sponsor.ajay.app/api/skipSegments')?Promise.resolve(new Response(JSON.stringify([{segment:[50,55],UUID:'acceptance-segment',category:'sponsor',actionType:'skip',videoDuration:0}]))):realFetch(input,init);
writeFileSync(join(profile, 'config.json'), JSON.stringify({
  url: 'https://music.youtube.com/watch?v=M38aWHxwtXE',
  options: { appVisible: false, autoUpdates: false, resumeOnStart: true },
  plugins: { 'sponsorblock':{enabled:true,categories:[],mode:'manual',minimumDuration:1},'api-server': { enabled: true, hostname: '127.0.0.1', port: 27639,
    authStrategy: 'AUTH_AT_FIRST', secret: randomBytes(32).toString('hex'), authorizedClients: ['PearConnect-Acceptance'] } },
}));
const packaged = process.argv.includes('--packaged');
await import(pathToFileURL(resolve(packaged ? 'dist/player-source-3.11.0/pack/win-unpacked/resources/app.asar/dist/main/index.js' : 'dist/player-source-3.11.0/dist/main/index.js')).href);
app.whenReady().then(async () => {
  const timer = setTimeout(() => app.exit(1), 90000);
  try {
    let win;
    for (let i = 0; i < 120; i++) {
      win = BrowserWindow.getAllWindows().find(w => w.webContents.getURL().startsWith('https://music.youtube.com'));
      if (win && await win.webContents.executeJavaScript('Boolean(document.querySelector("#queue")?.queue?.getItems()?.length)').catch(() => false)) break;
      await new Promise(r => setTimeout(r, 400));
    }
    const host = 'http://127.0.0.1:27639';
    const token = await YTMDClient.requestToken({host, clientId:'PearConnect-Acceptance',timeoutMs:10000});
    const client = new YTMDClient({host,token});
    const raw = async (path, body) => {
      const response = await fetch(host + path, { method: body ? 'POST':'GET', headers:{ Authorization:'Bearer '+token,'Content-Type':'application/json'},body:body?JSON.stringify(body):undefined,signal:AbortSignal.timeout(12000) });
      return { status:response.status, data:await response.json() };
    };
    const before = playerQueue(await client.getQueue());
    assert.ok(before.length > 0); assert.equal(before.filter(r=>r.videoId==='PLXzNgd-Wgw').length,0);
    const unauthorized = await fetch(host+'/api/v1/queue/compatibility'); assert.equal(unauthorized.status,401);
    const preview = await raw('/api/v1/queue/preview',{videoId:'PLXzNgd-Wgw'});
    assert.equal(preview.data.code,'queue_preview_ready');
    assert.deepEqual(playerQueue(await client.getQueue()).map(r=>r.videoId),before.map(r=>r.videoId));
    const malformed = await raw('/api/v1/queue',{videoId:'../bad'}); assert.equal(malformed.status,400);
    const config = loadConfig({YTMD_HOST:host,YTMD_TOKEN:token,MAX_DURATION_SEC:'600'});
    const engine = new QueueManager({...config,ytmd:client,logger:{info(){},warn(){},error(){}}});
    const result = await engine.handleRequest({ user:'Isolated test',userId:'test-user',query:'Bad Wolves - Hear Me Now feat. DIAMANTE',platform:'web' });
    const after = playerQueue(await client.getQueue());
    assert.equal(result.code,'added',JSON.stringify(result)); assert.equal(result.queueVerified,true);
    assert.equal(after.filter(r=>r.videoId==='PLXzNgd-Wgw').length,1);
    assert.equal(after.length,before.length+1);
    assert.deepEqual(after.slice(0,before.length).map(r=>r.videoId),before.map(r=>r.videoId));
    assert.equal(after.find(r=>r.selected)?.videoId,before.find(r=>r.selected)?.videoId);
    await win.webContents.executeJavaScript('document.querySelector("ytmusic-player-page")?.setAttribute("player-ui-state","FULLSCREEN")');
    const shot = await win.webContents.capturePage(); await import('node:fs/promises').then(fs=>fs.writeFile(join(profile,'queue.png'),shot.toPNG()));
    await runStudioAcceptance(win,profile);
    const report = {time:new Date().toISOString(),isolated:true,packaged,electron:process.versions.electron,preview:preview.data,result,beforeCount:before.length,afterCount:after.length,added:after.find(r=>r.videoId==='PLXzNgd-Wgw'),unauthorizedStatus:unauthorized.status,invalidStatus:malformed.status};
    writeFileSync(join(profile,'result.json'),JSON.stringify(report,null,2)); console.log(JSON.stringify(report,null,2));
  } catch(e) { console.error(e); process.exitCode=1; }
  finally { clearTimeout(timer); app.exit(process.exitCode||0); }
});
