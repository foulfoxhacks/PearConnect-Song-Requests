import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { pathToFileURL } from 'node:url';
import { resolve } from 'node:path';
import { parsePlugin, validateAppearance, defaultAppearance, appearanceCSS } from './overlay/src/pearconnect/customization.ts';
import { normalizeSegments, segmentAt } from './overlay/src/plugins/sponsorblock/policy.ts';
const example=JSON.parse(await readFile('player/overlay/assets/pearconnect/example.pearplugin','utf8'));
test('web packages admit only explicit supported permissions and copy validated fields',()=>{
  const parsed=parsePlugin(JSON.stringify({...example,node:'evil',permissions:[]}));assert.deepEqual(parsed.permissions,[]);assert.equal(parsed.node,undefined);
  for(const permissions of [['filesystem'],['network'],['playback.write'],['playback.read','playback.read'],[null]])assert.throws(()=>parsePlugin(JSON.stringify({...example,permissions})));
  for(const id of ['../escape','a/b','UPPER','x','__proto__','some.host'])assert.throws(()=>parsePlugin(JSON.stringify({...example,id})));
  assert.throws(()=>parsePlugin(JSON.stringify({...example,javascript:'x'.repeat(500001)})));
  for(const p of [null,[],{}, {...example,html:42},{...example,format:2},{...example,name:''}])assert.throws(()=>parsePlugin(JSON.stringify(p)));
});
test('appearance cannot inject arbitrary CSS through preset settings',()=>{
  for(const field of ['palette','font','density'])assert.throws(()=>validateAppearance({...defaultAppearance,[field]:'red; background:url(https://evil)'}));
  const a=validateAppearance({...defaultAppearance,palette:'violet'});assert.match(appearanceCSS(a),/#c9b6ff/);assert.equal(appearanceCSS(a).includes('undefined'),false);
});
const policy={mode:'auto',categories:['sponsor'],minimumDuration:1};
const row=(segment,extra={})=>({segment,UUID:segment.join('-'),actionType:'skip',category:'sponsor',videoDuration:220,...extra});
test('SponsorBlock rejects malformed, stale, non-skip and unwanted segments',()=>{
  const raw=[row([2,10]),row([-1,2]),row([3,2]),row([1,221]),row([1,2],{videoDuration:240}),row([1,2],{actionType:'mute'}),row([1,2],{category:'intro'}),row([1,1.5]),null,{},row(['1',5]),row([NaN,4])];
  assert.deepEqual(normalizeSegments(raw,220,policy).map(s=>[s.start,s.end]),[[2,10]]);
  assert.deepEqual(normalizeSegments(raw,NaN,policy),[]);
});
test('overlapping skip ranges coalesce without changing cached data; Undo exclusions are respected',()=>{
  const segments=normalizeSegments([row([0,8]),row([5,12]),row([12,15]),row([20,25])],220,policy);
  const snapshot=JSON.stringify(segments);
  assert.equal(segmentAt(segments,0,new Set()).end,15);
  assert.equal(segmentAt(segments,15,new Set()),null);
  assert.equal(segmentAt(segments,3,new Set(['0-8'])),null);
  assert.equal(JSON.stringify(segments),snapshot);
});
test('SponsorBlock drops a slow response after the track changes and refreshes settings',async()=>{
  // Exercise the actual plugin backend with its Electron/plugin registration replaced by inert adapters.
  const ts=await import(pathToFileURL(resolve('dist/player-source-3.11.0/node_modules/typescript/lib/typescript.js')));
  let source=await readFile('player/overlay/src/plugins/sponsorblock/index.ts','utf8');
  source=source.replace("import { createPlugin } from '@/utils';",'const createPlugin = value => value;').replace("import { t } from '@/i18n';",'const t = value => value;').replace("from './policy'",`from '${pathToFileURL(resolve('player/overlay/src/plugins/sponsorblock/policy.ts')).href}'`);
  const js=ts.default.transpileModule(source,{compilerOptions:{module:ts.default.ModuleKind.ESNext,target:ts.default.ScriptTarget.ES2022}}).outputText;
  const plugin=(await import('data:text/javascript;base64,'+Buffer.from(js).toString('base64'))).default;
  const originalFetch=globalThis.fetch, pending=[],sent=[],handlers={};let settings={...plugin.config};
  globalThis.fetch=async url=>new Promise(resolve=>pending.push({url:String(url),resolve}));
  const flush=()=>new Promise(r=>setTimeout(r,15));
  try{
    await plugin.backend.start({getConfig:async()=>settings,ipc:{on:(key,fn)=>handlers[key]=fn,send:(_key,p)=>sent.push(p)}});
    const change=id=>handlers['ytmd:video-src-changed']({videoDetails:{videoId:id,lengthSeconds:'220'}});
    change('AAAAAAAAAAA');await flush();change('BBBBBBBBBBB');await flush();
    assert.equal(pending.length,2);
    pending[1].resolve(new Response(JSON.stringify([row([1,4])])));await flush();
    pending[0].resolve(new Response(JSON.stringify([row([100,110])])));await flush();
    assert.equal(sent.at(-1).videoId,'BBBBBBBBBBB');assert.equal(sent.at(-1).segments[0].start,1);
    settings={...settings,mode:'manual'};plugin.backend.onConfigChange();await flush();assert.equal(sent.at(-1).mode,'manual');assert.equal(pending.length,2,'cached data reused for same track/categories');
    settings={...settings,categories:[]};plugin.backend.onConfigChange();await flush();assert.deepEqual(sent.at(-1).segments,[]);
  }finally{plugin.backend.stop();globalThis.fetch=originalFetch;}
});
