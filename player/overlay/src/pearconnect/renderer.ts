// First-party chrome only. Uploaded plugins never execute inside this page.
export function mountPearConnect(){
  const install=()=>{
    const nav=document.querySelector('ytmusic-nav-bar .right-content');
    if(nav&&!document.getElementById('pc-studio-button')){
      const button=document.createElement('button');button.id='pc-studio-button';button.textContent='PearConnect Studio';button.title='Appearance, SponsorBlock and imported web plugins';button.onclick=()=>window.ipcRenderer.send('pearconnect:open-studio');nav.prepend(button);
    }
    const bar=document.querySelector('ytmusic-player-bar .middle-controls');
    if(bar&&!document.getElementById('pc-playing-time')){const span=document.createElement('span');span.id='pc-playing-time';bar.append(span);}
    const video=document.querySelector('video'),label=document.getElementById('pc-playing-time');
    if(video&&label){const time=(n:number)=>`${Math.floor(n/60)}:${String(Math.floor(n%60)).padStart(2,'0')}`;label.textContent=Number.isFinite(video.duration)?`${time(video.currentTime)} played · ${time(Math.max(0,video.duration-video.currentTime))} left`:'';}
  };
  setInterval(()=>{if(!document.hidden)install();},1000);install();
}
