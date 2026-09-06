const api=window.pearStudio;
const $=id=>document.getElementById(id);
let state, busy=false;
const time=value=>{const n=Math.max(0,Math.floor(Number(value)||0));return `${Math.floor(n/60)}:${String(n%60).padStart(2,'0')}`;};
const message=(text,error=false)=>{$('message').textContent=text;$('message').classList.toggle('error',error);};
function display(data,forms=false){
  state=data;const p=data.playback;
  $('track-title').textContent=p.title;$('track-artist').textContent=p.artist;
  $('play-state').textContent=p.videoId?(p.paused?'PAUSED / LIVE PREVIEW':'NOW PLAYING / LIVE PREVIEW'):'WAITING FOR MUSIC';
  $('elapsed').textContent=time(p.elapsed)+' played';$('remaining').textContent=time(Math.max(0,p.duration-p.elapsed))+' remaining · '+time(p.duration)+' total';
  $('progress').max=p.duration||1;$('progress').value=p.elapsed||0;
  if($('artwork').getAttribute('src')!==p.artwork)$('artwork').src=p.artwork||'';
  $('artwork').hidden=!p.artwork;$('artwork-placeholder').hidden=Boolean(p.artwork);
  $('sponsor-status').textContent=data.sponsor.state;$('skip-count').textContent=data.sponsor.skipCount;$('saved-time').textContent=time(data.sponsor.skippedSeconds);
  document.documentElement.style.setProperty('--accent',{pear:'#c5e58c',violet:'#c9b6ff',ocean:'#80d6df',ember:'#ffb28d'}[data.appearance.palette]);
  if(forms){
    const a=$('appearance-form').elements,s=$('sponsor-form').elements;
    for(const k of ['palette','font','density','icon'])a[k].value=data.appearance[k];a.background.checked=data.appearance.background;
    s.enabled.checked=data.sponsorConfig.enabled;s.mode.value=data.sponsorConfig.mode;s.minimumDuration.value=data.sponsorConfig.minimumDuration;
    document.querySelectorAll('[name=category]').forEach(el=>el.checked=data.sponsorConfig.categories.includes(el.value));
    const list=$('plugin-list');list.replaceChildren();
    if(!data.plugins.length){const empty=document.createElement('p');empty.className='empty';empty.textContent='No imported plugins yet. Start with the example below.';list.append(empty);}
    for(const p of data.plugins){
      const row=document.createElement('div');row.className='plugin';const info=document.createElement('div');const title=document.createElement('h3');title.textContent=p.name+' · '+p.version;const desc=document.createElement('p');desc.textContent=p.description;const perms=document.createElement('small');perms.textContent=(p.permissions.length?'READS CURRENT SONG':'NO PLAYER PERMISSIONS')+' / '+(p.running?'OPEN':'STOPPED');info.append(title,desc,perms);const buttons=document.createElement('div');buttons.className='buttons';
      for(const [label,method] of [[p.running?'Close':'Open',p.running?'stopPlugin':'openPlugin'],['Remove','removePlugin']]){const b=document.createElement('button');b.textContent=label;b.addEventListener('click',()=>act(()=>api[method](p.id),label==='Remove'?'Plugin removed.':'Plugin updated.'));buttons.append(b);}row.append(info,buttons);list.append(row);
    }
  }
}
async function act(fn,text){if(busy)return;busy=true;document.querySelectorAll('button').forEach(b=>b.disabled=true);try{display(await fn(),true);message(text);}catch(e){message(String(e.message||e).replace(/^Error invoking remote method '[^']+': Error: /,''),true);}finally{busy=false;document.querySelectorAll('button').forEach(b=>b.disabled=false);}}
$('appearance-form').addEventListener('submit',e=>{e.preventDefault();const f=e.target.elements;act(()=>api.appearance({palette:f.palette.value,font:f.font.value,density:f.density.value,icon:f.icon.value,background:f.background.checked,motion:false}),'Appearance applied to the player.');});
$('sponsor-form').addEventListener('submit',e=>{e.preventDefault();const f=e.target.elements;const changed=f.enabled.checked!==state.sponsorConfig.enabled;act(()=>api.sponsor({enabled:f.enabled.checked,mode:f.mode.value,minimumDuration:Number(f.minimumDuration.value),categories:[...document.querySelectorAll('[name=category]:checked')].map(el=>el.value)}),changed?'Settings saved. Restart the player to enable or disable SponsorBlock.':'Skip settings saved for the current track.');});
for(const [id,method,text] of [['import-background','importBackground','Image selection finished.'],['remove-background','removeBackground','Background removed.'],['import-plugin','importPlugin','Plugin review finished. Open an installed plugin below.'],['example-plugin','examplePlugin','Starter export finished.'],['focus-player','focusPlayer','Player opened.']])$(id).addEventListener('click',()=>act(()=>api[method](),text));
api.status().then(s=>display(s,true)).catch(e=>message(e.message,true));
setInterval(()=>{if(!busy&&!document.hidden)api.status().then(s=>display(s)).catch(()=>{});},1000);
