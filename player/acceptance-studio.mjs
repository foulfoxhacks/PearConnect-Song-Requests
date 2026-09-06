import { BrowserWindow, Menu, dialog } from 'electron';
import { readFile,writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import { createServer } from 'node:http';
import assert from 'node:assert/strict';
export async function runStudioAcceptance(player,profile){
  Menu.getApplicationMenu().items.find(i=>i.label==='PearConnect').submenu.items.find(i=>i.label==='Player Studio').click();
  let studio;
  for(let i=0;i<100;i++){studio=BrowserWindow.getAllWindows().find(w=>w.webContents.getURL()==='pcstudio://app/index.html');if(studio&&await studio.webContents.executeJavaScript('Boolean(window.pearStudio && document.getElementById("appearance-form"))').catch(()=>false))break;await new Promise(r=>setTimeout(r,50));}
  assert.ok(studio,'Studio window opened');
  const run=code=>studio.webContents.executeJavaScript(code);
  assert.equal(await run('document.querySelector("h1").textContent'),'A player withyour personality.');
  const prefs=studio.webContents.getLastWebPreferences();assert.equal(prefs.sandbox,true);assert.equal(prefs.nodeIntegration,false);
  assert.deepEqual(await run('[typeof require,typeof process,typeof window.ipcRenderer]'),['undefined','undefined','undefined']);
  const state=await run('pearStudio.status()');assert.equal(state.plugins.length,0);
  await run('pearStudio.appearance({palette:"violet",font:"system",density:"compact",background:false,motion:false})');
  assert.equal(await player.webContents.executeJavaScript('getComputedStyle(document.documentElement).getPropertyValue("--pc-accent").trim()'),'#c9b6ff');
  let incoming=0;
  const server=createServer((_req,res)=>{incoming++;res.end('Should never be reached');});server.on('upgrade',(_req,socket)=>{incoming++;socket.destroy();});await new Promise(r=>server.listen(0,'127.0.0.1',r));
  const originalOpen=dialog.showOpenDialog, originalReview=dialog.showMessageBox;
  let reviewChoice=0,reviewSeen=false;
  const sample=JSON.parse(await readFile('player/overlay/assets/pearconnect/example.pearplugin','utf8'));
  const file=join(profile,'test.pearplugin');
  const packageValue={...sample,id:'acceptance-plugin',javascript:'globalThis.scriptRan=true;',html:'<h1>Sandbox test</h1><script>globalThis.inlineRan=true;</script><iframe src="pcstudio://app/index.html"></iframe>'};
  await writeFile(file,JSON.stringify(packageValue));
  dialog.showOpenDialog=async()=>({canceled:false,filePaths:[file]});
  dialog.showMessageBox=async(_window,options)=>{assert.match(options.detail,/Read the current song/);assert.match(options.detail,/SHA-256:/);reviewSeen=true;return {response:reviewChoice,checkboxChecked:false};};
  try{
    dialog.showOpenDialog=async()=>({canceled:false,filePaths:[join(process.cwd(),'desktop','assets','pear.png')]});
    await run('pearStudio.importBackground()');assert.equal((await run('pearStudio.status()')).hasBackground,true);
    assert.match(await player.webContents.executeJavaScript('getComputedStyle(document.querySelector("ytmusic-app")).backgroundImage'),/data:image\/png/);
    await run('pearStudio.removeBackground()');assert.equal((await run('pearStudio.status()')).hasBackground,false);
    dialog.showOpenDialog=async()=>({canceled:false,filePaths:[file]});
    await run('pearStudio.importPlugin()');assert.ok(reviewSeen);assert.equal((await run('pearStudio.status()')).plugins.length,0,'Cancel leaves library unchanged');
    reviewChoice=1;await run('pearStudio.importPlugin()');assert.equal((await run('pearStudio.status()')).plugins.length,1);
    await run('pearStudio.openPlugin("acceptance-plugin")');
    let plugin=BrowserWindow.getAllWindows().find(w=>w.webContents.getURL().startsWith('pcplugin://acceptance-plugin/'));assert.ok(plugin);
    const probe=code=>plugin.webContents.executeJavaScript(code);
    assert.equal(plugin.webContents.getLastWebPreferences().sandbox,true);assert.notEqual(plugin.webContents.session,player.webContents.session);
    assert.deepEqual(await probe('[typeof require,typeof process,typeof window.ipcRenderer,typeof window.pearStudio,Boolean(globalThis.scriptRan),Boolean(globalThis.inlineRan)]'),['undefined','undefined','undefined','undefined',true,false]);
    assert.equal(typeof(await probe('pearconnect.getPlayback()')).title,'string');
    for(const url of [`http://127.0.0.1:${server.address().port}/probe`,'file:///C:/Windows/win.ini','pcstudio://app/index.html'])assert.equal(await probe(`fetch(${JSON.stringify(url)}).then(()=>"allowed",()=>"blocked")`),'blocked');
    assert.equal(incoming,0,'No network requests left the sandbox');
    const before=BrowserWindow.getAllWindows().length;await probe('window.open("https://example.com")');assert.equal(BrowserWindow.getAllWindows().length,before);
    await run('pearStudio.stopPlugin("acceptance-plugin")');assert.equal((await run('pearStudio.status()')).plugins[0].running,false);
    await writeFile(file,JSON.stringify({...sample,id:'no-permission',permissions:[],javascript:'',html:'<h1>No permissions</h1>'}));
    dialog.showMessageBox=async()=>({response:1,checkboxChecked:false});await run('pearStudio.importPlugin()');await run('pearStudio.openPlugin("no-permission")');
    plugin=BrowserWindow.getAllWindows().find(w=>w.webContents.getURL().startsWith('pcplugin://no-permission/'));
    assert.equal(await plugin.webContents.executeJavaScript('pearconnect.getPlayback().then(()=>"allowed",()=>"denied")'),'denied');
    await run('pearStudio.removePlugin("no-permission")');assert.ok(plugin.isDestroyed());
    // Import and render the shipped example too, after the adversarial probes.
    await writeFile(file,JSON.stringify(sample));await run('pearStudio.importPlugin()');await run('pearStudio.openPlugin("now-playing")');
    const exampleWindow=BrowserWindow.getAllWindows().find(w=>w.webContents.getURL().startsWith('pcplugin://now-playing/'));
    await new Promise(r=>setTimeout(r,1200));await writeFile(join(profile,'plugin.png'),(await exampleWindow.webContents.capturePage()).toPNG());
    // Refresh the first-party view without resetting saved settings.
    await studio.webContents.reload();await new Promise(r=>setTimeout(r,800));
    assert.equal((await run('pearStudio.status()')).appearance.palette,'violet');
    await run('pearStudio.sponsor({enabled:true,mode:"manual",categories:["sponsor"],minimumDuration:1})');
    await new Promise(r=>setTimeout(r,700));
    const seek=async()=>{await player.webContents.executeJavaScript('document.querySelector("video").currentTime=51');await new Promise(r=>setTimeout(r,450));await player.webContents.executeJavaScript('document.querySelector("video").dispatchEvent(new Event("timeupdate"))');};
    await seek();
    assert.equal(await player.webContents.executeJavaScript('document.querySelector("#pearconnect-sponsor-notice button")?.textContent'),'Skip');
    await player.webContents.executeJavaScript('document.querySelector("#pearconnect-sponsor-notice button").click()');
    assert.ok(await player.webContents.executeJavaScript('document.querySelector("video").currentTime>=55'));
    assert.equal(await player.webContents.executeJavaScript('document.querySelector("#pearconnect-sponsor-notice button")?.textContent'),'Undo');
    await writeFile(join(profile,'sponsorblock.png'),(await player.webContents.capturePage()).toPNG());
    await player.webContents.executeJavaScript('document.querySelector("#pearconnect-sponsor-notice button").click()');
    await new Promise(r=>setTimeout(r,300));assert.ok(await player.webContents.executeJavaScript('document.querySelector("video").currentTime<54'),'Undo does not immediately re-skip');
    await run('pearStudio.sponsor({enabled:true,mode:"auto",categories:["sponsor"],minimumDuration:1})');await new Promise(r=>setTimeout(r,700));await seek();
    assert.ok(await player.webContents.executeJavaScript('document.querySelector("video").currentTime>=55'),'Automatic mode skips the validated segment');
    await writeFile(join(profile,'studio.png'),(await studio.webContents.capturePage()).toPNG());
    await studio.setSize(760,820);await new Promise(r=>setTimeout(r,200));
    assert.equal(await run('document.documentElement.scrollWidth <= window.innerWidth'),true,'Narrow desktop layout has no horizontal overflow');
    await writeFile(join(profile,'studio-narrow.png'),(await studio.webContents.capturePage()).toPNG());
    await writeFile(join(profile,'studio-result.json'),JSON.stringify({sandbox:true,noNode:true,noNetwork:true,noAdminBridge:true,permissionReview:true,cancelSafe:true,revocation:true,readOnlyPlayback:true,appearancePersists:true,backgroundImport:true,sponsorManual:true,sponsorAuto:true,sponsorUndo:true,narrowLayout:true},null,2));
    console.log('Studio acceptance passed: permissions, sandbox restrictions, import/cancel/revoke, appearance and responsive layout.');
  }finally{dialog.showOpenDialog=originalOpen;dialog.showMessageBox=originalReview;await new Promise(r=>server.close(r));}
}
