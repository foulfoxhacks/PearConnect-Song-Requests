import { createPlugin } from '@/utils';
import { t } from '@/i18n';
import { normalizeSegments, segmentAt, type Segment, type Policy } from './policy';
import type { GetPlayerResponse } from '@/types/get-player-response';

export type SponsorBlockPluginConfig = Policy & { enabled:boolean; apiURL:string };
type Packet = { videoId:string; segments:Segment[]; mode:'auto'|'manual'; state:string };
let packet:Packet={videoId:'',segments:[],mode:'auto',state:'Waiting for a track'};
let video:HTMLVideoElement|null=null;
let notice:HTMLDivElement|null=null;
let noticeTimer:ReturnType<typeof setTimeout>|undefined;
const ignored=new Set<string>();
let skipCount=0, skippedSeconds=0;
let reload:()=>Promise<void>=async()=>{};
let cancel:()=>void=()=>{};
function currentId(){return (document.querySelector('#movie_player') as unknown as {getVideoData?:()=>{video_id?:string}})?.getVideoData?.()?.video_id||'';}
function status(state:string){window.ipcRenderer.send('pearconnect:sponsor-status',{state,skipCount,skippedSeconds});}
function clearNotice(){notice?.remove();notice=null;clearTimeout(noticeTimer);}
function showNotice(text:string,label:string,action:()=>void){
  clearNotice();notice=document.createElement('div');notice.setAttribute('role','status');notice.id='pearconnect-sponsor-notice';
  Object.assign(notice.style,{position:'fixed',bottom:'100px',right:'28px',zIndex:'9999',display:'flex',gap:'16px',alignItems:'center',padding:'15px 20px',background:'#17231b',color:'#edf1e9',border:'1px solid #657658',borderLeft:'3px solid #c5e58c',font:'14px Segoe UI, sans-serif',boxShadow:'0 8px 30px #0005',maxWidth:'calc(100vw - 50px)'});
  const message=document.createElement('span');message.textContent=text;
  const button=document.createElement('button');button.textContent=label;Object.assign(button.style,{background:'#c5e58c',border:'0',padding:'8px 12px',color:'#101714',cursor:'pointer',font:'600 13px Segoe UI, sans-serif'});button.addEventListener('click',action);
  const close=document.createElement('button');close.textContent='×';close.setAttribute('aria-label','Dismiss SponsorBlock notice');Object.assign(close.style,{background:'transparent',border:'0',color:'#edf1e9',cursor:'pointer',fontSize:'20px'});close.onclick=clearNotice;
  notice.append(message,button,close);document.body.append(notice);
}
function skip(segment:Segment){
  if(!video||currentId()!==packet.videoId||!Number.isFinite(video.duration)||segment.end>video.duration+0.5)return;
  const original=video.currentTime, id=packet.videoId;
  if(original<segment.start||original>=segment.end)return;
  video.currentTime=segment.end;const seconds=Math.max(0,segment.end-original);skipCount++;skippedSeconds+=seconds;
  status(`Skipped ${segment.category.replaceAll('_',' ')} · ${Math.round(seconds)} seconds`);
  showNotice(`SponsorBlock · skipped ${Math.round(seconds)}s`,'Undo',()=>{
    if(video&&currentId()===id){for(const s of packet.segments)if(s.start<segment.end&&s.end>segment.start)ignored.add(s.uuid);video.currentTime=original;skipCount=Math.max(0,skipCount-1);skippedSeconds=Math.max(0,skippedSeconds-seconds);status('Skip undone · this segment will play');}clearNotice();
  });noticeTimer=setTimeout(clearNotice,7000);
}
function onTime(){
  if(!video||packet.videoId!==currentId()||video.seeking||video.paused)return;
  const segment=segmentAt(packet.segments,video.currentTime,ignored);
  if(!segment)return;
  if(packet.mode==='auto')skip(segment);
  else if(!notice){
    showNotice(`SponsorBlock · ${segment.category.replaceAll('_',' ')}`,'Skip',()=>skip(segment));
    // Once offered, allow it to play unless the viewer chooses Skip.
    ignored.add(segment.uuid);noticeTimer=setTimeout(clearNotice,Math.min(15000,(segment.end-video.currentTime)*1000));
  }
}
function reset(){packet={videoId:'',segments:[],mode:'auto',state:'Waiting for a track'};ignored.clear();clearNotice();}

export default createPlugin({
  name:()=>t('plugins.sponsorblock.name'),description:()=>t('plugins.sponsorblock.description'),restartNeeded:true,
  config:{enabled:false,apiURL:'https://sponsor.ajay.app',mode:'auto',categories:['sponsor','selfpromo'],minimumDuration:1} as SponsorBlockPluginConfig,
  backend:{
    async start({getConfig,ipc}){
      let last:GetPlayerResponse|undefined,sequence=0,controller:AbortController|undefined;
      const cache=new Map<string,{until:number;data:unknown}>();
      cancel=()=>{sequence++;controller?.abort();};
      reload=async()=>{
        cancel();const generation=sequence;
        const videoId=last?.videoDetails?.videoId||'',duration=Number(last?.videoDetails?.lengthSeconds);
        if(!/^[A-Za-z0-9_-]{11}$/.test(videoId))return;
        const settings=await getConfig();if(generation!==sequence)return;
        const policy:Policy={mode:settings.mode==='manual'?'manual':'auto',categories:Array.isArray(settings.categories)?settings.categories:[],minimumDuration:Math.max(.25,Number(settings.minimumDuration)||1)};
        const send=(segments:Segment[],state:string)=>{if(generation===sequence)ipc.send('sponsorblock-skip',{videoId,segments,mode:policy.mode,state});};
        send([],'Looking up community segments');
        if(!policy.categories.length){send([],'No segment categories selected');return;}
        controller=new AbortController();const activeController=controller;const timer=setTimeout(()=>activeController.abort(),6000);
        try{
          const base=new URL(settings.apiURL);
          if(base.protocol!=='https:'||base.username||base.password)throw Error('Use an HTTPS SponsorBlock server.');
          const url=new URL('/api/skipSegments',base);url.searchParams.set('videoID',videoId);url.searchParams.set('categories',JSON.stringify(policy.categories));url.searchParams.set('actionTypes','["skip"]');
          const key=url.href;let entry=cache.get(key);
          if(!entry||entry.until<Date.now()){
            const result=await fetch(url,{signal:activeController.signal,redirect:'error'});
            if(result.status===404)entry={data:[],until:Date.now()+300000};
            else{if(!result.ok)throw Error('Service unavailable');const body=await result.text();if(body.length>1024*1024)throw Error('Response too large');entry={data:JSON.parse(body),until:Date.now()+3600000};}
            if(cache.size>=100)cache.delete(cache.keys().next().value!);cache.set(key,entry);
          }
          const segments=normalizeSegments(entry.data,duration,policy);send(segments,segments.length?`${segments.length} segments ready · ${policy.mode} mode`:'No matching segments · full track will play');
        }catch{send([],'SponsorBlock unavailable · playback continues');}finally{clearTimeout(timer);}
      };
      ipc.on('ytmd:video-src-changed',(data:GetPlayerResponse)=>{last=data;void reload();});
    },
    onConfigChange(){void reload();},
    stop(){cancel();},
  },
  renderer:{
    start({ipc}){ipc.on('sponsorblock-skip',(incoming:Packet)=>{if(incoming.videoId!==currentId())return;packet=incoming;ignored.clear();clearNotice();status(packet.state);});},
    onPlayerApiReady(){if(video){video.removeEventListener('timeupdate',onTime);video.removeEventListener('emptied',reset);}video=document.querySelector('video');video?.addEventListener('timeupdate',onTime);video?.addEventListener('emptied',reset);},
    stop(){video?.removeEventListener('timeupdate',onTime);video?.removeEventListener('emptied',reset);video=null;reset();},
  },
});
