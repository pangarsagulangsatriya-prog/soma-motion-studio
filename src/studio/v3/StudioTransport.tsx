import {useEffect,useRef,useState,type SyntheticEvent} from 'react';
import {Camera,CameraOff,ChevronDown,Circle,Image,Monitor,Pause,Play,SlidersHorizontal,Volume2} from 'lucide-react';
import {cameraView,formatElapsed} from './interaction';
import type {InputKind,Mode,Settings} from '../../engine/types';

const SOURCES:{id:InputKind;name:string}[]=[
 {id:'hands',name:'Tangan'},{id:'body',name:'Tubuh'},{id:'face',name:'Wajah'},{id:'mouse',name:'Mouse'}
];
const SOUNDS:{id:Mode;name:string}[]=[
 {id:'theremin',name:'Theremin'},{id:'drone',name:'Body Drone'},
 {id:'percussion',name:'Gesture Percussion'},{id:'lab',name:'Performance Lab'}
];
export function StudioTransport(props:{
 input:InputKind;onSource:(source:InputKind)=>void;
 cameraOn:boolean;cameraBusy:boolean;cameraError:string;tracking:boolean;hadTracking:boolean;status:string;onCamera:()=>void;
 output:Settings['output'];onOutputChange:(value:Settings['output'])=>void;
 audioOn:boolean;muted:boolean;onAudio:()=>void;soundMode:Mode;onSoundMode:(mode:Mode)=>void;
 audioRecording:boolean;videoRecording:boolean;onRecordAudio:()=>void;onRecordVideo:()=>void;videoAvailable:boolean;
 onCapture:()=>void;hold:boolean;onHold:()=>void;onAdvanced:()=>void;onStatusClick:()=>void;
 projectorOpen:boolean;projectorConnected:boolean;projectorMode:'live'|'hold'|'blackout';onProjectorOpen:()=>void;
 onProjectorLive:()=>void;onProjectorHold:()=>void;onProjectorBlackout:()=>void;onProjectionSettings:()=>void;
}){
 const p=props,recording=p.audioRecording||p.videoRecording;
 const root=useRef<HTMLElement|null>(null);
 const [seconds,setSeconds]=useState(0);
 const camera=cameraView({source:p.input==='mouse'?'mouse':'camera',busy:p.cameraBusy,error:p.cameraError,cameraOn:p.cameraOn,tracked:p.tracking,hadTracking:p.hadTracking,input:p.input});
 useEffect(()=>{
  if(!recording){setSeconds(0);return;}
  const started=performance.now(),interval=window.setInterval(()=>setSeconds((performance.now()-started)/1000),250);
  return ()=>window.clearInterval(interval);
 },[recording]);
 useEffect(()=>{
  const close=()=>root.current?.querySelectorAll('details[open]').forEach(x=>{(x as HTMLDetailsElement).open=false;});
  const outside=(event:PointerEvent)=>{if(root.current&&!root.current.contains(event.target as Node))close();};
  const escape=(event:KeyboardEvent)=>{
   if(event.key!=='Escape'||document.querySelector('dialog[open]'))return;
   const open=root.current?.querySelector('details[open]') as HTMLDetailsElement|null;
   if(!open)return;
   close();open.querySelector('summary')?.focus();
   event.preventDefault();event.stopPropagation();
  };
  document.addEventListener('pointerdown',outside);document.addEventListener('keydown',escape,true);
  return ()=>{document.removeEventListener('pointerdown',outside);document.removeEventListener('keydown',escape,true);};
 },[]);
 const onlyOneMenu=(event:SyntheticEvent<HTMLDetailsElement>)=>{
  const current=event.currentTarget;
  if(!current.open)return;
  root.current?.querySelectorAll('details[open]').forEach(x=>{if(x!==current)(x as HTMLDetailsElement).open=false;});
 };
 return <section ref={root} className="v3-transport" aria-label="Kontrol pertunjukan">
  <details className="v3-transport-menu" onToggle={onlyOneMenu}><summary><SlidersHorizontal size={17}/><span>{SOURCES.find(s=>s.id===p.input)?.name||p.input}</span><ChevronDown size={14}/></summary>
   <div className="v3-popover" role="group" aria-label="Pilih sumber gerak"><b>SUMBER GERAK</b>
    {SOURCES.map(s=><button type="button" key={s.id} aria-pressed={p.input===s.id} onClick={e=>{p.onSource(s.id);e.currentTarget.closest('details')?.removeAttribute('open');}}>{s.name}{p.input===s.id?' · aktif':''}</button>)}
    <small>Perubahan sumber dapat mengatur ulang pemetaan gesture.</small>
   </div>
  </details>
  <button type="button" className="v3-transport-action" disabled={p.cameraBusy||p.input==='mouse'} onClick={p.onCamera} title={p.input==='mouse'?'Pilih Tangan, Tubuh, atau Wajah untuk memakai kamera':p.cameraOn?'Hentikan kamera':'Mulai kamera'}>
   {p.cameraOn?<CameraOff size={18}/>:<Camera size={18}/>}<span>{p.cameraBusy?'Memuat…':p.cameraOn?'Stop kamera':'Kamera'}</span>
  </button>
  <details className="v3-transport-menu" onToggle={onlyOneMenu}><summary><Volume2 size={17}/><span>Suara</span><ChevronDown size={14}/></summary>
   <div className="v3-popover v3-popover-wide"><b>INSTRUMEN SUARA</b>
    {SOUNDS.map(s=><button type="button" key={s.id} aria-pressed={p.soundMode===s.id} onClick={e=>{p.onSoundMode(s.id);e.currentTarget.closest('details')?.removeAttribute('open');}}>{s.name}</button>)}
    <b>KELUARAN</b>{([['visual','Visual'],['sound','Suara'],['both','Keduanya']] as const).map(([id,name])=><button type="button" key={id} aria-pressed={p.output===id} onClick={e=>{p.onOutputChange(id);e.currentTarget.closest('details')?.removeAttribute('open');}}>{name}</button>)}
    <button type="button" className="v3-accent" onClick={p.onAudio}>{p.audioOn&&!p.muted?'Mute audio':'Aktifkan audio'}</button>
   </div>
  </details>
  <span className="v3-transport-separator" aria-hidden="true"/>
  <details className="v3-transport-menu" onToggle={onlyOneMenu}><summary aria-label={recording?`Merekam ${formatElapsed(seconds)}. Buka pilihan rekam`:"Buka pilihan rekam"} className={recording?'v3-recording':''}><Circle size={17} fill={recording?'currentColor':'none'}/><span>{recording?'REC '+formatElapsed(seconds):'Rekam'}</span><ChevronDown size={14}/></summary>
   <div className="v3-popover"><b>PILIH REKAMAN</b>
    <button type="button" onClick={p.onRecordAudio}>{p.audioRecording?'Stop rekam audio':'Rekam audio'}</button>
    <button type="button" disabled={!p.videoAvailable} onClick={p.onRecordVideo}>{p.videoRecording?'Stop video':'Rekam video Footprints'}</button>
    {!p.videoAvailable&&<small>Video tersedia di scene Footprints saat kamera Body siap.</small>}
   </div>
  </details>
  <button type="button" className="v3-transport-action v3-accent" onClick={p.onCapture}><Image size={18}/><span>Capture</span></button>
  <button type="button" className="v3-transport-action" aria-pressed={p.hold} onClick={p.onHold}><Pause size={17}/><span>{p.hold?'Lepas gambar':'Tahan gambar'}</span></button>
  <details className="v3-transport-menu v3-output-menu" onToggle={onlyOneMenu}><summary><Monitor size={17}/><span>Output</span><span className={'v3-led'+(p.projectorConnected?' connected':'')}/><ChevronDown size={14}/></summary>
   <div className="v3-popover v3-popover-right"><b>PROYEKTOR</b>
    <small>{p.projectorConnected?'Output tersambung · '+(p.projectorMode==='blackout'?'Blackout':p.projectorMode==='hold'?'Hold':'Live'):p.projectorOpen?'Menunggu sambungan':'Jendela output belum dibuka'}</small>
    <button type="button" onClick={p.onProjectorOpen}>{p.projectorOpen?'Buka ulang jendela':'Buka jendela output'}</button>
    <button type="button" disabled={!p.projectorOpen} aria-pressed={p.projectorMode==='live'} onClick={p.onProjectorLive}><Play size={14}/> Live</button>
    <button type="button" disabled={!p.projectorOpen} aria-pressed={p.projectorMode==='hold'} onClick={p.onProjectorHold}><Pause size={14}/> Tahan output</button>
    <button type="button" disabled={!p.projectorOpen} aria-pressed={p.projectorMode==='blackout'} className={p.projectorMode==='blackout'?'v3-danger-action':''} onClick={p.onProjectorBlackout}>Blackout proyektor</button>
    <button type="button" onClick={p.onProjectionSettings}>Kalibrasi & pengaturan</button>
   </div>
  </details>
  <button type="button" className={"v3-transport-status state-"+camera.state} onClick={p.onStatusClick} aria-label={"Status: "+camera.label+". Buka detail"} title={camera.hint}>
   <span className={'v3-led'+(camera.state==='tracking'?' connected':'')}/><span>{camera.label}</span>
  </button>
  <button type="button" className="v3-transport-settings" onClick={p.onAdvanced} title="Atur visual" aria-label="Atur visual"><SlidersHorizontal size={18}/></button>
  {p.cameraError&&<div className="v3-transport-error" role="alert">{p.cameraError} <button type="button" disabled={p.cameraBusy} onClick={p.onCamera}>Coba lagi</button></div>}
 </section>;
}
