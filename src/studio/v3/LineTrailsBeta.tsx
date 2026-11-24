import {useEffect,useRef,type RefObject} from 'react';
import type {MotionFrame} from '../../engine/types.ts';
import type {MultiPoseGaitRouter} from '../../footprints/live/MultiPoseGaitRouter.ts';
import type {ExperimentalFrame} from './experimentSourceModel.ts';
import {FootLineTrailEngine} from '../../footprints/lines/FootLineTrailEngine.ts';
import {FootprintBrushEngine} from '../../footprints/lines/FootprintBrushEngine.ts';
import {ActiveFootSelector} from '../../footprints/lines/ActiveFootSelector.ts';
import {resolveFullscreenInput} from '../../footprints/lines/FullscreenInputSource.ts';
import {paintFullscreenInputDiagnostics,type FullscreenDiagnostics}
 from '../../footprints/lines/FullscreenInputDiagnostics.ts';
import type {FootMotionEventV2} from '../../footprints/scenes/FootMotionEventV2.ts';
import {demoFootSamples,footSamplesFromExperiment,footSamplesFromLive} from '../../footprints/lines/FootLineSampleAdapter.ts';
import {paintLineTrails,type LineTrailsOptions,type LineStyle} from '../../footprints/lines/LineTrailCanvasRenderer.ts';

export function LineTrailsBetaStage({fullscreenRef,frameRef,videoRef,experimentInputCanvas,experimentFrameRef,router,engine,settings,fullscreenDiagnostics,
 blackout,previewLive,cameraOn,bodySelected,performerCount,experimentSource,sourceKind,selectedActor,
 demo,onStatus,onBrushCount,motionSession,motionEvents,brushEngine}:{
 fullscreenRef:RefObject<HTMLDivElement|null>;
 frameRef:RefObject<MotionFrame>;
 videoRef:RefObject<HTMLVideoElement|null>;
 experimentInputCanvas?:RefObject<HTMLCanvasElement|null>;
 experimentFrameRef?:RefObject<ExperimentalFrame|null>;
 fullscreenDiagnostics:FullscreenDiagnostics;
 router:MultiPoseGaitRouter;engine:FootLineTrailEngine;brushEngine:FootprintBrushEngine;settings:LineTrailsOptions;
 blackout:boolean;previewLive:boolean;cameraOn:boolean;bodySelected:boolean;
 performerCount:1|2;experimentSource:'video'|'simulator'|null;
 sourceKind:'camera'|'phone';selectedActor:'A'|'B';demo:boolean;
 onStatus:(text:string)=>void;onBrushCount?:(value:number)=>void;motionSession?:()=>string;
 motionEvents?:()=>readonly FootMotionEventV2[];
}){
 const canvas=useRef<HTMLCanvasElement>(null);
 const singleBrush=useRef(new ActiveFootSelector());
 const source=useRef({frameRef,videoRef,experimentInputCanvas,experimentFrameRef,router,engine,settings,fullscreenDiagnostics,
  blackout,previewLive,cameraOn,bodySelected,performerCount,experimentSource,
  sourceKind,selectedActor,demo,onStatus,onBrushCount,motionSession,motionEvents,brushEngine});
 source.current={frameRef,videoRef,experimentInputCanvas,experimentFrameRef,router,engine,settings,fullscreenDiagnostics,
  blackout,previewLive,cameraOn,bodySelected,performerCount,experimentSource,
  sourceKind,selectedActor,demo,onStatus,onBrushCount,motionSession,motionEvents,brushEngine};
 const demoStart=useRef(0);
 useEffect(()=>{demoStart.current=performance.now();},[demo]);
 useEffect(()=>{
  let raf=0,lastDraw=0,lastMessage='',lastStatus=0,lastSourceAt=-1,lastSourceKey='';
  let lastVisualKey='',lastCount=-1,lastCountAt=0;
  const redraw=(ctx:CanvasRenderingContext2D,p:typeof source.current,now:number,off:boolean)=>{
   const fullscreen=document.fullscreenElement===fullscreenRef.current;
   const overlays=fullscreen&&(p.fullscreenDiagnostics.camera||p.fullscreenDiagnostics.skeleton);
   const key=JSON.stringify([p.engine.sampleCount,p.brushEngine.count,p.settings,off,fullscreen,overlays]);
   const moving=p.engine.lastObservedAt>0&&now-p.engine.lastObservedAt<135;
   if(key!==lastVisualKey||moving||overlays||(p.settings.decay==='fade'&&!off&&p.engine.sampleCount>0)){
    paintLineTrails(ctx,p.engine,p.settings,now,off,p.brushEngine.visible(now,p.settings.decay,8000,p.settings.brush.mode));
    if(!off&&overlays)
     paintFullscreenInputDiagnostics(ctx,p.fullscreenDiagnostics,resolveFullscreenInput(p,now));
    lastVisualKey=key;
   }
  };
  const paint=(now:number)=>{
   raf=requestAnimationFrame(paint);
   if(now-lastDraw<1000/60)return;
   lastDraw=now;
   const p=source.current;
   const c=canvas.current,ctx=c?.getContext('2d');
   if(!ctx)return;
   let message='Menunggu kaki';
   if(p.blackout||!p.previewLive){
    p.engine.disconnect();p.brushEngine.disconnect();singleBrush.current.reset();
    redraw(ctx,p,now,true);
    message='Preview padam';
   }else{
    let samples=[] as ReturnType<typeof footSamplesFromLive>;
    let nextSource='';
    if(p.demo){
     samples=demoFootSamples(now,demoStart.current);
     nextSource='demo';
     message='DEMO · lintasan kaki sintetik';
    }else if(p.experimentSource){
     const frame=p.experimentFrameRef?.current??null;
     nextSource='experiment:'+p.experimentSource+':'+
      (frame?.kind==='video'?frame.name+':'+(frame.snapshot?.segment??0):frame?.kind==='simulator'?frame.name:'none')+
      ':'+p.selectedActor;
     if(frame&&frame.kind===p.experimentSource)
      samples=footSamplesFromExperiment(frame,'line-'+p.experimentSource,0,p.selectedActor);
     message=frame?.kind==='video'?'MP4 · preview 2D':frame?.kind==='simulator'?'SIMULASI · posisi kaki':'Menunggu input';
    }else{
     const f=p.frameRef.current,session=p.motionSession?.()??'live';
     nextSource='track:'+p.sourceKind+':'+session+':'+p.performerCount+':'+p.selectedActor+':'+(p.router.previewStatus.identityEpoch??0);
     if(p.cameraOn&&p.bodySelected&&(p.performerCount===2||f.tracked)&&f.source==='camera'&&f.time>0&&
      now>=f.time&&now-f.time<450){
      samples=footSamplesFromLive(f,p.router.previewStatus,p.performerCount,p.sourceKind,session,0,p.selectedActor);
     }
     message='Track · preview 2D';
    }
    if(nextSource!==lastSourceKey){
     lastSourceAt=-1;lastSourceKey=nextSource;
     // Old MP4, webcam and demo marks must never contaminate a new source.
     p.engine.clear();p.brushEngine.clear();singleBrush.current.reset();
    }
    p.engine.ensureSource(nextSource);
    if(samples.length&&lastSourceAt>=0&&samples[0].atMs<lastSourceAt-60)p.engine.disconnect();
    if(samples.length)lastSourceAt=samples[0].atMs;
    if(!samples.length){
     p.engine.disconnect();p.brushEngine.disconnect();singleBrush.current.reset();
     message=p.demo?'DEMO · menunggu gerak':'Kaki belum terbaca · jejak terakhir tersimpan';
    }else{
     const selected=singleBrush.current.select(samples);
     // Duplicate camera frames do not reset the previous pen stroke.
     if(selected.length)p.engine.ingest(selected,now,p.settings.smoothness);
     if(!p.demo)message=selected.length?
      '1 sapuan aktif · kaki '+(selected[0].foot==='left'?'kiri':'kanan')+' · Preview 2D':
      'Menunggu frame kaki berikutnya';
    }
    p.brushEngine.ingestSweeps(p.engine.allStrokes,now,
     p.settings.brush.size,p.settings.brush.spacing,ctx.canvas.width,ctx.canvas.height,p.demo);
    if(p.demo)p.brushEngine.demoStepsFromSweeps(now);
    else p.brushEngine.ingestContacts(p.motionEvents?.()??[],
     p.performerCount===2?p.selectedActor:'all',p.motionSession?.(),now);
    redraw(ctx,p,now,false);
   }
   if(now-lastCountAt>360&&p.brushEngine.count!==lastCount){
    lastCountAt=now;lastCount=p.brushEngine.count;p.onBrushCount?.(lastCount);
   }
   if(message!==lastMessage&&now-lastStatus>150){
    lastMessage=message;lastStatus=now;p.onStatus(message);
   }
  };
  raf=requestAnimationFrame(paint);
  return()=>{cancelAnimationFrame(raf);source.current.engine.disconnect();};
 },[]);
 return <div ref={fullscreenRef} className="lt-beta-frame" aria-label="Kanvas Line Trails Beta, visual kaki satu dan dua">
  <canvas ref={canvas} width={1600} height={900} aria-label="Coretan kaki satu dan dua"/>
 </div>;
}

const LINE_STYLES:{id:LineStyle;label:string;stroke:number}[]=[
 {id:'ink',label:'Tinta',stroke:4.5},
 {id:'contour',label:'Kontur',stroke:2},
 {id:'ribbon',label:'Pita',stroke:8},
 {id:'fiber',label:'Serat',stroke:1.4}
];
const SMOOTH_CHOICES=[{id:'responsive',label:'Responsif'},{id:'smooth',label:'Halus'},
 {id:'silky',label:'Sangat halus'}] as const;
export function LineTrailsBetaPanel({settings,onChange,engine,brushEngine,onClear,demo,onDemo,status,fullscreenDiagnostics,onFullscreenDiagnostics,
 performerCount,selectedActor,onActor}:{
 settings:LineTrailsOptions;onChange:(next:LineTrailsOptions)=>void;brushEngine:FootprintBrushEngine;
 fullscreenDiagnostics:FullscreenDiagnostics;
 onFullscreenDiagnostics:(next:FullscreenDiagnostics)=>void;
 engine:FootLineTrailEngine;onClear:()=>void;demo:boolean;onDemo:()=>void;status:string;
 performerCount:1|2;selectedActor:'A'|'B';onActor:(actor:'A'|'B')=>void;
}){
 const setColor=(foot:'left'|'right',color:string)=>onChange({
  ...settings,colors:{...settings.colors,[foot]:color}
 });
 const setVisible=(foot:'left'|'right',value:boolean)=>onChange({
  ...settings,visible:{...settings.visible,[foot]:value}
 });
 const contrast= settings.background==='#111512'&&
  (settings.colors.left.toLowerCase()==='#1d1d1d'||settings.colors.right.toLowerCase()==='#1d1d1d');
 return <section className="lt-beta-controls" aria-label="Kontrol Garis Beta">
  <header><strong>Garis</strong><span>BETA</span></header>
  <p className="lt-beta-status" role="status"><i data-live={status.includes('terbaca')||demo}/>{status}</p>
  <div className="lt-beta-style-section">
   {settings.showLines&&<strong className="lt-beta-subheading">Gaya garis</strong>}
   {settings.showLines&&<div className="lt-beta-style-picker" role="group" aria-label="Gaya garis">
    {LINE_STYLES.map(style=><button type="button" key={style.id}
     aria-label={'Gaya '+style.label} aria-pressed={settings.style===style.id}
     onClick={()=>onChange({...settings,style:style.id})}>
     <svg viewBox="0 0 60 28" aria-hidden="true">
      {style.id==='ribbon'&&<path d="M3 22 Q17 1 29 13 T57 7"
       fill="none" stroke="#F34725" strokeOpacity=".24" strokeWidth="11" strokeLinecap="round"/>}
      <path d="M3 22 Q17 1 29 13 T57 7" fill="none" stroke="#F34725"
       strokeWidth={style.stroke} strokeLinecap="round"/>
      {style.id==='fiber'&&[-3,3].map(offset=><path key={offset}
       d="M3 22 Q17 1 29 13 T57 7" transform={'translate(0 '+offset+')'}
       fill="none" stroke="#F34725" strokeOpacity=".55" strokeWidth="1" strokeLinecap="round"/>)}
     </svg><span>{style.label}</span>
    </button>)}
   </div>}
  </div>
  {performerCount===2&&<div className="lt-beta-actor-choice" role="group" aria-label="Performer garis">
   <button type="button" aria-pressed={selectedActor==='A'} onClick={()=>onActor('A')}>Performer A</button>
   <button type="button" aria-pressed={selectedActor==='B'} onClick={()=>onActor('B')}>Performer B</button>
  </div>}
  {(['left','right'] as const).map((foot,index)=><div key={foot} className="lt-beta-foot">
   <label htmlFor={'lt-beta-color-'+foot}>
    <strong>Kaki {index+1}</strong><small>{foot==='left'?'Kiri':'Kanan'}</small>
   </label>
   <input id={'lt-beta-color-'+foot} type="color" value={settings.colors[foot]}
    onChange={e=>setColor(foot,e.currentTarget.value)} aria-label={'Warna Kaki '+(index+1)}/>
   <input type="checkbox" checked={settings.visible[foot]}
    onChange={e=>setVisible(foot,e.currentTarget.checked)} aria-label={'Tampilkan Kaki '+(index+1)}/>
  </div>)}
  <section className="lt-beta-brush-wrap" aria-label="Kontrol Footprint Brush">
   <label className="lt-beta-brush-toggle" htmlFor="lt-beta-brush-enabled">
    <span><strong>Jejak Kaki</strong><small>Lukis dengan gerakan kaki</small></span>
    <input type="checkbox" id="lt-beta-brush-enabled" aria-label="Jejak Kaki"
     checked={settings.brush.enabled}
     onChange={e=>onChange({...settings,
      showLines:e.target.checked?false:settings.showLines,
      brush:{...settings.brush,enabled:e.target.checked}})}/>
   </label>
   {settings.brush.enabled&&<>
    <div className="lt-beta-modes" role="group" aria-label="Mode Jejak Kaki">
     <button type="button" aria-pressed={settings.brush.mode==='sweep'}
      onClick={()=>onChange({...settings,brush:{...settings.brush,mode:'sweep'}})}>Sapuan</button>
     <button type="button" aria-pressed={settings.brush.mode==='step'}
      onClick={()=>onChange({...settings,brush:{...settings.brush,mode:'step'}})}>Pijakan</button>
    </div>
    <label className="lt-beta-width">Ukuran telapak <output>{settings.brush.size} px</output>
     <input type="range" min={20} max={100} step={2} aria-label="Ukuran telapak"
      value={settings.brush.size}
      onChange={e=>onChange({...settings,brush:{...settings.brush,size:Number(e.currentTarget.value)}})}/>
    </label>
    {settings.brush.mode==='step'&&!demo&&
     <small className="lt-beta-note">Pijakan menunggu event kontak kaki yang terdeteksi.</small>}
   </>}
  </section>
  <label className="lt-beta-show-lines" htmlFor="lt-beta-lines-visible">
   <span>Tampilkan garis</span>
   <input id="lt-beta-lines-visible" type="checkbox" aria-label="Tampilkan garis"
    checked={settings.showLines} onChange={e=>onChange({...settings,showLines:e.target.checked})}/>
  </label>
  <section className="lt-beta-diagnostics" aria-label="Overlay layar penuh">
   <div className="lt-beta-diagnostics-heading">
    <strong>Overlay fullscreen</strong>
    <small>Default OFF · V / K saat fullscreen</small>
   </div>
   <div className="lt-beta-diagnostics-choices">
    <label htmlFor="lt-beta-show-input">
     <input id="lt-beta-show-input" type="checkbox" aria-keyshortcuts="V"
      aria-label="Preview Kamera Input" checked={fullscreenDiagnostics.camera}
      onChange={e=>onFullscreenDiagnostics({...fullscreenDiagnostics,camera:e.target.checked})}/>
     <span>Preview Kamera Input</span><kbd>V</kbd>
    </label>
    <label htmlFor="lt-beta-show-skeleton">
     <input id="lt-beta-show-skeleton" type="checkbox" aria-keyshortcuts="K"
      aria-label="Skeleton Fullscreen" checked={fullscreenDiagnostics.skeleton}
      onChange={e=>onFullscreenDiagnostics({...fullscreenDiagnostics,skeleton:e.target.checked})}/>
     <span>Skeleton</span><kbd>K</kbd>
    </label>
   </div>
  </section>
  <div className="lt-beta-smooth-wrap">
   <strong className="lt-beta-subheading">Kehalusan</strong>
   <div className="lt-beta-smoothness" role="group" aria-label="Kehalusan gerak">
    {SMOOTH_CHOICES.map(choice=><button key={choice.id} type="button"
     aria-label={'Kehalusan '+choice.label}
     aria-pressed={settings.smoothness===choice.id}
     onClick={()=>onChange({...settings,smoothness:choice.id})}>{choice.label}</button>)}
   </div>
  </div>
  {settings.showLines&&<label className="lt-beta-width">Ketebalan <output>{settings.width}px</output>
   <input type="range" min={2} max={28} step={1} value={settings.width}
    onChange={e=>onChange({...settings,width:Number(e.currentTarget.value)})}
    aria-label="Ketebalan garis"/>
  </label>}
  <div className="lt-beta-modes" role="group" aria-label="Durasi jejak">
   <button type="button" aria-pressed={settings.decay==='keep'}
    onClick={()=>onChange({...settings,decay:'keep'})}>Tetap</button>
   <button type="button" aria-pressed={settings.decay==='fade'}
    onClick={()=>onChange({...settings,decay:'fade'})}>Memudar</button>
  </div>
  <div className="lt-beta-actions">
   <button type="button" onClick={onClear}>Bersihkan</button>
   <button type="button" className="lt-beta-demo" aria-pressed={demo} onClick={onDemo}>
    {demo?'Hentikan Demo':'Coba Demo'}
   </button>
  </div>
  <small className="lt-beta-count">{engine.sampleCount} sampel tersimpan · {brushEngine.sweepCount} sapuan · {brushEngine.count-brushEngine.sweepCount} pijakan</small>
  {contrast&&<p className="lt-beta-warning">Warna hitam sulit terlihat pada latar gelap. Pilih warna yang lebih terang.</p>}
  <details className="lt-beta-more">
   <summary>Pengaturan latar</summary>
   <div role="group" aria-label="Warna latar garis">
    <button type="button" aria-pressed={settings.background==='#F5F5F2'}
     onClick={()=>onChange({...settings,background:'#F5F5F2'})}>Terang</button>
    <button type="button" aria-pressed={settings.background==='#111512'}
     onClick={()=>onChange({...settings,background:'#111512'})}>Gelap</button>
   </div>
  </details>
  <p className="lt-beta-note">Preview 2D · Fullscreen bersih saat overlay OFF. Kamera dan Skeleton hanya tampil saat diaktifkan.</p>
 </section>;
}
