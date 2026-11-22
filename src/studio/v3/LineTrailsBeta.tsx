import {useEffect,useRef,type RefObject} from 'react';
import type {MotionFrame} from '../../engine/types.ts';
import type {MultiPoseGaitRouter} from '../../footprints/live/MultiPoseGaitRouter.ts';
import type {ExperimentalFrame} from './experimentSourceModel.ts';
import {FootLineTrailEngine} from '../../footprints/lines/FootLineTrailEngine.ts';
import {demoFootSamples,footSamplesFromExperiment,footSamplesFromLive} from '../../footprints/lines/FootLineSampleAdapter.ts';
import {paintLineTrails,type LineTrailsOptions} from '../../footprints/lines/LineTrailCanvasRenderer.ts';

export function LineTrailsBetaStage({fullscreenRef,frameRef,experimentFrameRef,router,engine,settings,
 blackout,previewLive,cameraOn,bodySelected,performerCount,experimentSource,sourceKind,selectedActor,
 demo,onStatus,motionSession}:{
 fullscreenRef:RefObject<HTMLDivElement|null>;
 frameRef:RefObject<MotionFrame>;
 experimentFrameRef?:RefObject<ExperimentalFrame|null>;
 router:MultiPoseGaitRouter;engine:FootLineTrailEngine;settings:LineTrailsOptions;
 blackout:boolean;previewLive:boolean;cameraOn:boolean;bodySelected:boolean;
 performerCount:1|2;experimentSource:'video'|'simulator'|null;
 sourceKind:'camera'|'phone';selectedActor:'A'|'B';demo:boolean;
 onStatus:(text:string)=>void;motionSession?:()=>string;
}){
 const canvas=useRef<HTMLCanvasElement>(null);
 const source=useRef({frameRef,experimentFrameRef,router,engine,settings,
  blackout,previewLive,cameraOn,bodySelected,performerCount,experimentSource,
  sourceKind,selectedActor,demo,onStatus,motionSession});
 source.current={frameRef,experimentFrameRef,router,engine,settings,
  blackout,previewLive,cameraOn,bodySelected,performerCount,experimentSource,
  sourceKind,selectedActor,demo,onStatus,motionSession};
 const demoStart=useRef(0);
 useEffect(()=>{demoStart.current=performance.now();},[demo]);
 useEffect(()=>{
  let raf=0,lastDraw=0,lastMessage='',lastStatus=0,lastSourceAt=-1;
  const paint=(now:number)=>{
   raf=requestAnimationFrame(paint);
   if(now-lastDraw<1000/30)return;
   lastDraw=now;
   const p=source.current;
   const c=canvas.current,ctx=c?.getContext('2d');
   if(!ctx)return;
   let message='Menunggu kaki';
   if(p.blackout||!p.previewLive){
    p.engine.disconnect();
    paintLineTrails(ctx,p.engine,p.settings,now,true);
    message='Preview padam';
   }else{
    let samples=[] as ReturnType<typeof footSamplesFromLive>;
    let nextSource='';
    if(p.demo){
     samples=demoFootSamples(now,demoStart.current);
     nextSource='demo';
     message='DEMO · dua garis sintetik';
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
     nextSource='track:'+p.sourceKind+':'+session+':'+p.performerCount+':'+p.selectedActor;
     if(p.cameraOn&&p.bodySelected&&f.tracked&&f.source==='camera'&&f.time>0&&
      now>=f.time&&now-f.time<450){
      samples=footSamplesFromLive(f,p.router.status,p.performerCount,p.sourceKind,session,0,p.selectedActor);
     }
     message='Track · preview 2D';
    }
    p.engine.ensureSource(nextSource);
    if(samples.length&&lastSourceAt>=0&&samples[0].atMs<lastSourceAt-60)p.engine.disconnect();
    if(samples.length)lastSourceAt=samples[0].atMs;
    if(!samples.length){p.engine.disconnect();message=p.demo?'DEMO':'Kaki belum terbaca';}
    else if(!p.demo){
     const sides=new Set(samples.map(v=>v.foot));
     message=sides.size===2?'Kaki 1 & 2 terbaca · Preview 2D':'Satu kaki terbaca';
    }
    p.engine.ingest(samples,now);
    paintLineTrails(ctx,p.engine,p.settings,now,false);
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

export function LineTrailsBetaPanel({settings,onChange,engine,onClear,demo,onDemo,status,
 performerCount,selectedActor,onActor}:{
 settings:LineTrailsOptions;onChange:(next:LineTrailsOptions)=>void;
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
  <label className="lt-beta-width">Ketebalan <output>{settings.width}px</output>
   <input type="range" min={2} max={28} step={1} value={settings.width}
    onChange={e=>onChange({...settings,width:Number(e.currentTarget.value)})}
    aria-label="Ketebalan garis"/>
  </label>
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
  <small className="lt-beta-count">{engine.sampleCount} sampel tersimpan dalam memori sesi</small>
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
  <p className="lt-beta-note">Visual software. Garis mengikuti kaki dari Track; Demo memakai gerak sintetik.</p>
 </section>;
}
