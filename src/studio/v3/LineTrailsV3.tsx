import {useEffect,useRef,type RefObject} from 'react';
import type {MotionFrame} from '../../engine/types.ts';
import type {MultiPoseGaitRouter} from '../../footprints/live/MultiPoseGaitRouter.ts';
import type {ExperimentalFrame} from './experimentSourceModel.ts';
import type {FullscreenDiagnostics} from '../../footprints/lines/FullscreenInputDiagnostics.ts';
import {paintFullscreenInputDiagnostics} from '../../footprints/lines/FullscreenInputDiagnostics.ts';
import {resolveFullscreenInput} from '../../footprints/lines/FullscreenInputSource.ts';
import {normalizeTrajectoryInput} from '../../footprints/lines/v3/SourceFrameNormalizer.ts';
import {DualFootTrajectoryEngine} from '../../footprints/lines/v3/DualFootTrajectoryEngine.ts';
import {paintTrajectory,type V3Settings} from '../../footprints/lines/v3/TrajectoryRenderer.ts';
import './line-trails-v3.css';

type StageProps={
 fullscreenRef:RefObject<HTMLDivElement|null>;
 frameRef:RefObject<MotionFrame>;
 videoRef:RefObject<HTMLVideoElement|null>;
 experimentInputCanvas?:RefObject<HTMLCanvasElement|null>;
 experimentFrameRef?:RefObject<ExperimentalFrame|null>;
 router:MultiPoseGaitRouter;engine:DualFootTrajectoryEngine;settings:V3Settings;
 fullscreenDiagnostics:FullscreenDiagnostics;blackout:boolean;previewLive:boolean;
 cameraOn:boolean;bodySelected:boolean;performerCount:1|2;
 experimentSource:'video'|'simulator'|null;sourceKind:'camera'|'phone';
 demo:boolean;motionSession?:()=>string;
 onStatus:(text:string)=>void;
 onDiagnostics?:(text:string)=>void;
};

export function LineTrailsV3Stage(props:StageProps){
 const canvas=useRef<HTMLCanvasElement|null>(null);
 const args=useRef(props);args.current=props;
 const demoStart=useRef(0);
 useEffect(()=>{demoStart.current=performance.now();},[props.demo]);
 useEffect(()=>{
  let raf=0,lastDraw=0,lastStatus='',lastStatusAt=0,lastSource='';
  let lastFrameMs=-1,lastPaused=false,lastSeeking=false,lastStale=false;
  let lastDiag=0;
  const paint=(now:number)=>{
   raf=requestAnimationFrame(paint);
   if(now-lastDraw<1000/45)return;
   lastDraw=now;
   const p=args.current;
   const c=canvas.current,ctx=c?.getContext('2d');
   if(!ctx)return;
   const input=normalizeTrajectoryInput({
    nowMs:now,demo:p.demo,demoStart:demoStart.current,
    experimentSource:p.experimentSource,experiment:p.experimentFrameRef?.current??null,
    live:p.frameRef.current,cameraOn:p.cameraOn,bodySelected:p.bodySelected,
    performers:p.performerCount,status:p.router.status,sourceKind:p.sourceKind,
    motionSession:p.motionSession?.()??'track'
   });
   let message=input.status;
   if(input.sourceKey!==lastSource){
    lastSource=input.sourceKey;lastFrameMs=-1;lastPaused=false;lastSeeking=false;lastStale=false;
    p.engine.ensureSource(input.sourceKey);
   }
   const off=p.blackout||!p.previewLive;
   if(off){
    p.engine.cutAll('manual-reset');
    message='Preview padam';
   }else{
    if(input.seeking){
     if(!lastSeeking)p.engine.cutAll('seek');
     lastSeeking=true;
     message='MP4 · memindahkan posisi video';
    }else{
     lastSeeking=false;
     if(!input.ready){
      if(!lastStale&&(input.status.includes('tertunda')||input.status.includes('menunggu')||
       input.status.includes('belum'))){
       p.engine.cutAll('stale-frame');
       lastStale=true;
      }
     }else if(input.frameMs!==lastFrameMs){
      p.engine.ingestFrame(input.samples,input.frameMs,now);
      lastFrameMs=input.frameMs;
      lastStale=false;
     }
     if(input.paused)message='MP4 dijeda · jejak dipertahankan';
     if(lastPaused&&!input.paused)lastStale=false;
     lastPaused=input.paused;
    }
   }
   const fullscreen=document.fullscreenElement===p.fullscreenRef.current;
   paintTrajectory(ctx,p.engine,p.settings,input.presentationMs,off,fullscreen);
   if(!off&&fullscreen&&(p.fullscreenDiagnostics.camera||p.fullscreenDiagnostics.skeleton)){
    // Diagnostics live only on explicit V/K; V3 fullscreen default is clean.
    paintFullscreenInputDiagnostics(ctx,p.fullscreenDiagnostics,resolveFullscreenInput({
     frameRef:p.frameRef,videoRef:p.videoRef,
     experimentInputCanvas:p.experimentInputCanvas,experimentFrameRef:p.experimentFrameRef,
     experimentSource:p.experimentSource,cameraOn:p.cameraOn,
     performerCount:p.performerCount,router:p.router,selectedActor:'A',demo:p.demo
    },now));
   }
   if(message!==lastStatus&&now-lastStatusAt>150){
    lastStatus=message;lastStatusAt=now;p.onStatus(message);
   }
   if(now-lastDiag>480){
    lastDiag=now;
    const recent=p.engine.diagnostics.slice(-4);
    const reasons=recent.filter(x=>!x.accepted).map(x=>x.id+': '+x.reason);
    p.onDiagnostics?.([
     'Sumber: '+input.source+' · '+(input.ready?'frame siap':'frame belum siap'),
     'Waktu frame: '+Math.max(0,input.frameMs).toFixed(0)+' ms',
     'Jalur: '+p.engine.activeCount+' kaki · '+p.engine.sampleCount+' titik',
     ...(reasons.length?reasons:['Basis: '+(input.source==='video'?'image-2d':input.source)])
    ].join(' | '));
   }
  };
  raf=requestAnimationFrame(paint);
  return()=>{cancelAnimationFrame(raf);args.current.engine.cutAll('manual-reset');};
 },[]);
 return <div ref={props.fullscreenRef} className="lt-beta-frame lt-v3-stage"
  aria-label="Kanvas Garis V3, lintasan dua kaki">
  <canvas ref={canvas} width={1600} height={900} aria-label="Lintasan nyata kaki kiri dan kanan"/>
 </div>;
}

type PanelProps={
 settings:V3Settings;onChange:(next:V3Settings)=>void;
 engine:DualFootTrajectoryEngine;onClear:()=>void;demo:boolean;onDemo:()=>void;
 status:string;diagnostics:string;performerCount:1|2;
 onUseV2:()=>void;fullscreenDiagnostics:FullscreenDiagnostics;
 onFullscreenDiagnostics:(next:FullscreenDiagnostics)=>void;
};
export function LineTrailsV3Panel({settings,onChange,engine,onClear,demo,onDemo,status,
 diagnostics,performerCount,onUseV2,fullscreenDiagnostics,onFullscreenDiagnostics}:PanelProps){
 const color=(foot:'left'|'right',value:string)=>onChange({
  ...settings,colors:{...settings.colors,[foot]:value}
 });
 const show=(foot:'left'|'right',value:boolean)=>onChange({
  ...settings,visible:{...settings.visible,[foot]:value}
 });
 return <section className="lt-beta-controls lt-v3-controls" aria-label="Kontrol Garis V3">
  <header><strong>Garis · Lintasan</strong><span>V3 BETA</span></header>
  <p className="lt-beta-status" role="status"><i data-live={status.includes('terbaca')||demo}/>{status}</p>
  <div className="lt-v3-mode" role="group" aria-label="Mode Garis">
   <button type="button" aria-pressed="true">Lintasan</button>
   <button type="button" disabled title="Menunggu gate kontak kaki yang terverifikasi">Pijakan · P1</button>
  </div>
  {(['left','right'] as const).map(foot=><div key={foot} className="lt-beta-foot">
   <label htmlFor={'v3-color-'+foot}><strong>Kaki {foot==='left'?'kiri':'kanan'}</strong>
    <small>Lintasan terdeteksi</small></label>
   <input type="color" id={'v3-color-'+foot} aria-label={'Warna kaki '+foot}
    value={settings.colors[foot]} onChange={e=>color(foot,e.target.value)}/>
   <input type="checkbox" checked={settings.visible[foot]}
    aria-label={'Tampilkan kaki '+foot} onChange={e=>show(foot,e.target.checked)}/>
  </div>)}
  {performerCount===2&&<div className="lt-v3-actors">
   {(['A','B'] as const).map(actor=><label key={actor}>
    <input type="checkbox" checked={settings.actors[actor]}
     onChange={e=>onChange({...settings,actors:{...settings.actors,[actor]:e.target.checked}})}/>
    Aktor {actor}</label>)}
  </div>}
  <label className="lt-beta-width">Ketebalan <output>{settings.width} px</output>
   <input type="range" min={1} max={12} step={1}
    aria-label="Ketebalan lintasan" value={settings.width}
    onChange={e=>onChange({...settings,width:Number(e.target.value)})}/>
  </label>
  <div className="lt-v3-duration"><strong>Durasi jejak</strong>
   <div className="lt-v3-three" role="group" aria-label="Durasi lintasan">
    <button type="button" aria-pressed={settings.decay==='keep'}
     onClick={()=>onChange({...settings,decay:'keep'})}>Tetap</button>
    <button type="button" aria-pressed={settings.decay==='fade'&&settings.lifeMs===8000}
     onClick={()=>onChange({...settings,decay:'fade',lifeMs:8000})}>8 dtk</button>
    <button type="button" aria-pressed={settings.decay==='fade'&&settings.lifeMs===20000}
     onClick={()=>onChange({...settings,decay:'fade',lifeMs:20000})}>20 dtk</button>
   </div>
  </div>
  <div className="lt-beta-actions">
   <button type="button" onClick={onClear}>Bersihkan</button>
   <button type="button" className="lt-beta-demo" aria-pressed={demo} onClick={onDemo}>
    {demo?'Hentikan Demo':'Coba Demo'}
   </button>
  </div>
  <small className="lt-beta-count">{engine.sampleCount} titik · {engine.allStrokes.length} segmen ·
   Preview posisi 2D, belum diproyeksikan</small>
  <details className="lt-v3-debug">
   <summary>Periksa jalur</summary>
   <label><input type="checkbox" checked={settings.debug}
    onChange={e=>onChange({...settings,debug:e.target.checked})}/> Titik mentah dan hasil filter</label>
   <p>{diagnostics}</p>
   <small>Garis putus saat kaki hilang, identitas tidak pasti, atau frame tidak cocok.</small>
  </details>
  <details className="lt-v3-advanced">
   <summary>Pengaturan lanjutan</summary>
   <div className="lt-v3-three" role="group" aria-label="Latar garis">
    <button type="button" aria-pressed={settings.background==='#F5F5F2'}
     onClick={()=>onChange({...settings,background:'#F5F5F2'})}>Terang</button>
    <button type="button" aria-pressed={settings.background==='#111512'}
     onClick={()=>onChange({...settings,background:'#111512'})}>Gelap</button>
   </div>
   <label><input type="checkbox" checked={fullscreenDiagnostics.camera}
    onChange={e=>onFullscreenDiagnostics({...fullscreenDiagnostics,camera:e.target.checked})}/>
    Overlay video (V)</label>
   <label><input type="checkbox" checked={fullscreenDiagnostics.skeleton}
    onChange={e=>onFullscreenDiagnostics({...fullscreenDiagnostics,skeleton:e.target.checked})}/>
    Overlay skeleton (K)</label>
   <button type="button" onClick={onUseV2}>Pakai engine V2 (rollback)</button>
  </details>
 </section>;
}
