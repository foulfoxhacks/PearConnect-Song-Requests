import { app, BrowserWindow, dialog, ipcMain, nativeImage, protocol, session } from 'electron';
import { readFile, writeFile, mkdir, rename, stat } from 'node:fs/promises';
import { join } from 'node:path';
import { randomUUID, createHash } from 'node:crypto';
import * as config from '@/config';
import { registerCallback } from '@/providers/song-info';
import { appearanceCSS, defaultAppearance, parsePlugin, validateAppearance, MAX_PACKAGE_BYTES, type Appearance, type WebPlugin } from './customization';

protocol.registerSchemesAsPrivileged(['pcstudio','pcplugin'].map(scheme=>({scheme,privileges:{standard:true,secure:true,supportFetchAPI:true}})));
type Library = { appearance:Appearance; background:string; plugins:WebPlugin[] };
let library:Library={appearance:{...defaultAppearance},background:'',plugins:[]};
let player:BrowserWindow;
let studio:BrowserWindow|null=null;
const pluginWindows=new Map<string,BrowserWindow>();
const pluginCalls=new Map<number,number>();
let playback:Record<string,unknown>={title:'Nothing playing',artist:'Start a track in the player',elapsed:0,duration:0,paused:true,artwork:''};
let sponsor:Record<string,unknown>={state:'Waiting for a track',skippedSeconds:0,skipCount:0};
let cssKey='';
let ready:Promise<void>|undefined;
const assetRoot=()=>join(import.meta.dirname,'..','..','assets','pearconnect');
const iconPath=()=>join(assetRoot(),library.appearance.icon+'.png');
const storePath=()=>join(app.getPath('userData'),'pearconnect-studio.json');
const csp="default-src 'none'; script-src 'self'; style-src 'self' 'unsafe-inline'; img-src 'self' data:; font-src 'self'; connect-src 'none'; media-src 'none'; frame-src 'none'; object-src 'none'; base-uri 'none'; form-action 'none'; worker-src 'none'";
const response=(body:BodyInit,status=200,type='text/html')=>new Response(body,{status,headers:{'Content-Type':type,'Content-Security-Policy':csp,'X-Content-Type-Options':'nosniff','Cache-Control':'no-store','Referrer-Policy':'no-referrer'}});
async function save(){await mkdir(app.getPath('userData'),{recursive:true});const tmp=storePath()+'.tmp';await writeFile(tmp,JSON.stringify(library));await rename(tmp,storePath());}
function publicState(){return {appearance:library.appearance,hasBackground:Boolean(library.background),plugins:library.plugins.map(p=>({id:p.id,name:p.name,version:p.version,description:p.description,permissions:p.permissions,running:pluginWindows.has(p.id)})),playback,sponsor,sponsorConfig:{enabled:false,mode:'auto',categories:['sponsor','selfpromo'],minimumDuration:1,...config.plugins.getOptions<Record<string,unknown>>('sponsorblock')}};}
function harden(win:BrowserWindow,url:string){
  const wc=win.webContents;
  wc.setWindowOpenHandler(()=>({action:'deny'}));
  wc.on('will-navigate',(e,target)=>{if(target!==url)e.preventDefault();});
  wc.on('will-redirect',e=>e.preventDefault());
  wc.on('will-attach-webview',e=>e.preventDefault());
  wc.setWebRTCIPHandlingPolicy('disable_non_proxied_udp');
  wc.session.setPermissionRequestHandler((_wc,_permission,callback)=>callback(false));
  wc.session.setPermissionCheckHandler(()=>false);
  wc.session.on('will-download',e=>e.preventDefault());
}
async function applyAppearance(){
  if(!player || player.isDestroyed())return;
  player.setIcon(iconPath());studio?.setIcon(iconPath());
  if(!player.webContents.getURL().startsWith('https://music.youtube.com/'))return;
  const previous=cssKey;
  cssKey=await player.webContents.insertCSS(appearanceCSS(library.appearance,library.background));
  if(previous)await player.webContents.removeInsertedCSS(previous).catch(()=>{});
}
async function importPlugin(){
  const selection=await dialog.showOpenDialog(studio!,{title:'Import a PearConnect web plugin',filters:[{name:'PearConnect web plugin',extensions:['pearplugin']}],properties:['openFile']});
  if(selection.canceled)return;
  if((await stat(selection.filePaths[0])).size>MAX_PACKAGE_BYTES)throw Error('Plugin files must be smaller than 2 MB.');
  const contents=await readFile(selection.filePaths[0],'utf8');
  const p=parsePlugin(contents);
  if(library.plugins.length>=20&&!library.plugins.some(x=>x.id===p.id))throw Error('Remove a plugin before adding another (20 maximum).');
  const fingerprint=createHash('sha256').update(contents).digest('hex');
  const result=await dialog.showMessageBox(studio!,{type:'question',title:'Review plugin permissions',message:`Install ${p.name} (${p.version})?`,detail:`${p.description}\n\nRequested permissions: ${p.permissions.includes('playback.read')?'Read the current song, artwork, elapsed time and playback state.':'None.'}\n\nRuns as sandboxed web content. No network, files, account access, player controls or queue writes are provided. This is not an endorsement of its author.\n\nSHA-256: ${fingerprint}\n\n${library.plugins.some(x=>x.id===p.id)?'This replaces the installed version and closes its window.':''}`,buttons:['Cancel','Install plugin'],defaultId:0,cancelId:0,noLink:true});
  if(result.response!==1)return;
  pluginWindows.get(p.id)?.close();
  library.plugins=library.plugins.filter(x=>x.id!==p.id);library.plugins.push(p);await save();
}
async function importBackground(){
  const result=await dialog.showOpenDialog(studio!,{title:'Import a background image',filters:[{name:'Images',extensions:['png','jpg','jpeg','webp']}],properties:['openFile']});
  if(result.canceled)return;
  if((await stat(result.filePaths[0])).size>8*1024*1024)throw Error('Choose an image smaller than 8 MB.');
  const raw=await readFile(result.filePaths[0]);
  const png=raw.subarray(0,8).equals(Buffer.from([137,80,78,71,13,10,26,10]));
  const jpg=raw[0]===255&&raw[1]===216&&raw[2]===255;
  const webp=raw.toString('ascii',0,4)==='RIFF'&&raw.toString('ascii',8,12)==='WEBP';
  if(!png&&!jpg&&!webp)throw Error('Use a PNG, JPEG or WebP image.');
  let image=nativeImage.createFromBuffer(raw);
  if(image.isEmpty())throw Error('This image could not be decoded.');
  const size=image.getSize();
  if(size.width>12000||size.height>12000)throw Error('Image dimensions must be below 12,000 pixels.');
  if(size.width>1920)image=image.resize({width:1920});
  library.background=image.toDataURL();library.appearance.background=true;await save();await applyAppearance();
}
export async function openPlugin(id:string){
  const p=library.plugins.find(x=>x.id===id);if(!p)throw Error('Plugin not found.');
  const existing=pluginWindows.get(id);if(existing){existing.show();existing.focus();return;}
  // Every launch receives a fresh, nonpersistent session; no player cookies are shared.
  const ses=session.fromPartition('pearconnect-plugin-'+randomUUID());
  const base='pcplugin://'+p.id;
  ses.webRequest.onBeforeRequest((details,callback)=>{let allowed=false;try{const u=new URL(details.url);allowed=u.protocol==='pcplugin:'&&u.host===p.id;}catch{}callback({cancel:!allowed});});
  await ses.protocol.handle('pcplugin',request=>{
    const u=new URL(request.url);if(u.protocol!=='pcplugin:'||u.host!==p.id)return response('Not found',404);
    if(u.pathname==='/index.html')return response(`<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><link rel="stylesheet" href="/plugin.css"></head><body>${p.html}<script src="/plugin.js"></script></body></html>`);
    if(u.pathname==='/plugin.css')return response(p.css,200,'text/css');
    if(u.pathname==='/plugin.js')return response(p.javascript,200,'text/javascript');
    return response('Not found',404);
  });
  const win=new BrowserWindow({width:650,height:440,minWidth:320,minHeight:240,title:p.name+' · PearConnect plugin',icon:iconPath(),backgroundColor:'#101714',show:false,webPreferences:{session:ses,preload:join(assetRoot(),'plugin-preload.cjs'),sandbox:true,contextIsolation:true,nodeIntegration:false,webSecurity:true,webviewTag:false,devTools:false}});
  pluginWindows.set(id,win);win.setMenu(null);harden(win,base+'/index.html');
  const contentsId=win.webContents.id;
  win.on('closed',()=>{pluginWindows.delete(id);pluginCalls.delete(contentsId);ses.protocol.unhandle('pcplugin');void ses.clearStorageData();});
  await win.loadURL(base+'/index.html');win.show();
}
async function initialize(win:BrowserWindow){
  player=win;
  try{
    const data=JSON.parse(await readFile(storePath(),'utf8')) as Library;
    library.appearance=validateAppearance(data.appearance);
    if(typeof data.background==='string'&&data.background.length<20*1024*1024&&/^data:image\/png;base64,[A-Za-z0-9+/=]+$/.test(data.background))library.background=data.background;
    if(Array.isArray(data.plugins))library.plugins=data.plugins.slice(0,20).flatMap((p:unknown)=>{try{return [parsePlugin(JSON.stringify(p))];}catch{return [];}});
  }catch{/* A new or invalid library starts with safe defaults. */}
  registerCallback(info=>{playback={title:String(info.title||'Nothing playing').slice(0,300),artist:String(info.artist||'').slice(0,300),videoId:info.videoId,elapsed:Number(info.elapsedSeconds)||0,duration:Number(info.songDuration)||0,paused:info.isPaused!==false,artwork:playback.videoId===info.videoId?playback.artwork:info.image&&!info.image.isEmpty()?info.image.resize({width:256}).toDataURL():''};});
  player.on('closed',()=>{studio?.close();for(const win of pluginWindows.values())win.destroy();});
  ipcMain.on('pearconnect:sponsor-status',(event,value)=>{if(event.sender!==player.webContents||event.senderFrame!==player.webContents.mainFrame)return;if(value&&typeof value.state==='string')sponsor={state:value.state.slice(0,160),skippedSeconds:Math.max(0,Number(value.skippedSeconds)||0),skipCount:Math.max(0,Number(value.skipCount)||0)};});
  ipcMain.on('pearconnect:open-studio',event=>{if(event.sender===player.webContents&&event.senderFrame===player.webContents.mainFrame)void openStudio(player);});
  player.webContents.on('did-finish-load',()=>{void applyAppearance();});
  ipcMain.handle('pearconnect:plugin-playback',event=>{
    const match=[...pluginWindows].find(([,win])=>win.webContents===event.sender&&event.senderFrame===win.webContents.mainFrame);
    const p=match&&library.plugins.find(p=>p.id===match[0]);
    if(!p?.permissions.includes('playback.read'))throw Error('Playback permission is not granted.');
    const now=Date.now();if(now-(pluginCalls.get(event.sender.id)||0)<250)throw Error('Poll at most four times per second.');pluginCalls.set(event.sender.id,now);
    return playback;
  });
  let operations=Promise.resolve();
  ipcMain.handle('pearconnect:studio',async(event,action:unknown,value:unknown)=>{
    if(!studio||event.sender!==studio.webContents||event.senderFrame!==studio.webContents.mainFrame||event.senderFrame.url!=='pcstudio://app/index.html')throw Error('Untrusted sender.');
    if(action==='status')return publicState();
    const operation=operations.then(async()=>{
      if(action==='appearance'){library.appearance=validateAppearance(value);await save();await applyAppearance();}
      else if(action==='background')await importBackground();
      else if(action==='remove-background'){library.background='';library.appearance.background=false;await save();await applyAppearance();}
      else if(action==='import-plugin')await importPlugin();
      else if(action==='open-plugin'&&typeof value==='string')await openPlugin(value);
      else if(action==='stop-plugin'&&typeof value==='string')pluginWindows.get(value)?.close();
      else if(action==='remove-plugin'&&typeof value==='string'){pluginWindows.get(value)?.close();library.plugins=library.plugins.filter(p=>p.id!==value);await save();}
      else if(action==='sponsor'){
        const v=value as {enabled:boolean;mode:string;categories:string[];minimumDuration:number};
        if(!v||typeof v.enabled!=='boolean'||!['auto','manual'].includes(v.mode)||!Array.isArray(v.categories)||v.categories.length>6||v.categories.some(c=>!['sponsor','intro','outro','interaction','selfpromo','music_offtopic'].includes(c))||!Number.isFinite(v.minimumDuration)||v.minimumDuration<0.25||v.minimumDuration>30)throw Error('Invalid SponsorBlock settings.');
        config.plugins.setOptions('sponsorblock',{enabled:v.enabled,mode:v.mode,categories:[...new Set(v.categories)],minimumDuration:v.minimumDuration},[]);
      }
      else if(action==='focus-player'){player.show();player.focus();}
      else if(action==='example-plugin'){
        const result=await dialog.showSaveDialog(studio!,{title:'Save starter plugin',defaultPath:'now-playing.pearplugin',filters:[{name:'PearConnect plugin',extensions:['pearplugin']}]});
        if(!result.canceled&&result.filePath)await writeFile(result.filePath,await readFile(join(assetRoot(),'example.pearplugin')));
      }
      else throw Error('Unknown operation.');
      return publicState();
    });operations=operation.then(()=>{},()=>{});return operation;
  });
  await applyAppearance();
}
export function setupStudio(win:BrowserWindow){ready??=initialize(win);return ready;}
export async function openStudio(win:BrowserWindow){
  await setupStudio(win);
  if(studio){studio.show();studio.focus();return;}
  const ses=session.fromPartition('pearconnect-studio');
  if(!await ses.protocol.isProtocolHandled('pcstudio')){
    await ses.protocol.handle('pcstudio',async request=>{
      const u=new URL(request.url);if(u.host!=='app')return response('Not found',404);
      const files:Record<string,string>={'/index.html':'text/html','/studio.js':'text/javascript','/studio.css':'text/css'};
      if(!files[u.pathname])return response('Not found',404);
      return response(new Uint8Array(await readFile(join(assetRoot(),u.pathname.slice(1)))),200,files[u.pathname]);
    });
    ses.webRequest.onBeforeRequest((details,callback)=>callback({cancel:!details.url.startsWith('pcstudio://app/')}));
  }
  studio=new BrowserWindow({width:1180,height:830,minWidth:720,minHeight:600,title:'PearConnect Player · Studio',icon:iconPath(),backgroundColor:'#101714',show:false,webPreferences:{session:ses,preload:join(assetRoot(),'studio-preload.cjs'),sandbox:true,contextIsolation:true,nodeIntegration:false,webSecurity:true,webviewTag:false}});
  studio.setMenu(null);harden(studio,'pcstudio://app/index.html');studio.on('closed',()=>{studio=null;});
  await studio.loadURL('pcstudio://app/index.html');studio.show();
}
