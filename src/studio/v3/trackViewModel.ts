import type {FootprintsInputChoice,FootprintsInputPhase} from './sourceSwitchModel.ts';

/** A short, truthful Track status. All detailed diagnostics live in Advanced. */
export function trackStatus(input:{
 selection:FootprintsInputChoice|null;phase:FootprintsInputPhase;message:string;
 videoLoaded:boolean;videoVisible:number|null;cameraOn:boolean;
 frameFresh:boolean;visibleCount:number;performerCount:1|2;
}):{label:string;detail:string;kind:'idle'|'busy'|'ready'|'error'}{
 const {selection,phase,message,videoLoaded,videoVisible,cameraOn,frameFresh,visibleCount,performerCount}=input;
 if(phase==='error')return {label:'Periksa sumber',detail:message,kind:'error'};
 if(phase==='connecting')return {label:'Menghubungkan…',detail:'',kind:'busy'};
 if(!selection)return {label:'Pilih sumber',detail:'',kind:'idle'};
 if(selection==='phone'&&phase==='pairing')return {label:'Menunggu HP',detail:'Buka pairing QR',kind:'busy'};
 if(selection==='webcam'&&!cameraOn)return {label:'Kamera belum aktif',detail:'Periksa izin kamera',kind:'idle'};
 if(selection==='video'){
  if(!videoLoaded)return {label:'Belum ada video',detail:'Pilih MP4',kind:'idle'};
  if(videoVisible===null)return {label:'Video dimuat',detail:'Menunggu pose',kind:'busy'};
  return {label:'Video aktif',detail:Math.min(videoVisible,performerCount)+' / '+performerCount+' aktor',kind:'ready'};
 }
 if(selection==='simulator')return {label:'Simulasi aktif',detail:'',kind:'ready'};
 if(!frameFresh)return {label:'Kamera aktif',detail:'Menunggu pose',kind:'busy'};
 return {label:'Tracking aktif',detail:visibleCount+' / '+performerCount+' aktor',kind:'ready'};
}
