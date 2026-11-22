import {useEffect,useRef,type RefObject} from 'react';
import type {MotionFrame} from '../../engine/types.ts';
import type {MultiPoseGaitRouter} from '../../footprints/live/MultiPoseGaitRouter.ts';
import type {ExperimentalFrame} from './experimentSourceModel.ts';
import type {FullscreenDiagnostics} from '../../footprints/lines/FullscreenInputDiagnostics.ts';
import {paintFullscreenInputDiagnostics} from '../../footprints/lines/FullscreenInputDiagnostics.ts';
import {resolveFullscreenInput} from '../../footprints/lines/FullscreenInputSource.ts';
import {normalizeTrajectoryInput} from '../../footprints/lines/v3/SourceFrameNormalizer.ts';
import {DualFootTrajectoryEngine} from '../../footprints/lines/v3/DualFootTrajectoryEngine.ts';
import type {V3Settings} from '../../footprints/lines/v3/TrajectoryRenderer.ts';
import {PainterlyImpressionEngine} from '../../footprints/lines/v3/PainterlyImpressionEngine.ts';
import {paintPainterlyCanvas,type PainterlySettings} from '../../footprints/lines/v3/PainterlyCanvasRenderer.ts';
import {adaptFootBrushFrame,type PoseAdapterState} from '../../footprints/lines/v3/FootBrushPoseAdapter.ts';
import {FootContactGestureEngine} from '../../footprints/lines/v3/FootContactGestureEngine.ts';
import {buildFootBrushDabs} from '../../footprints/lines/v3/FootBrushGeometryBuilder.ts';
import {FootBrushDepositStore} from '../../footprints/lines/v3/FootBrushStrokeRenderer.ts';
import type {FootMotionEventV2} from '../../footprints/scenes/FootMotionEventV2.ts';
import './line-trails-v3.css';

type StageProps={
 fullscreenRef:RefObject<HTMLDivElement|null>;
 frameRef:RefObject<MotionFrame>;
 videoRef:RefObject<HTMLVideoElement|null>;
 experimentInputCanvas?:RefObject<HTMLCanvasElement|null>;
 experimentFrameRef?:RefObject<ExperimentalFrame|null>;
 router:MultiPoseGaitRouter;engine:DualFootTrajectoryEngine;settings:V3Settings;
 impressions:PainterlyImpressionEngine;painterly:PainterlySettings;motionEvents?:()=>readonly FootMotionEventV2[];
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
  let lastFrameMs=-1,lastPaused=false,lastSeeking=false,lastStale=false,lastGoodAt=0;
  let lastDiag=0;
  const gestures=new FootContactGestureEngine();
  const brushStore=new FootBrushDepositStore();
  let brushAdapter:PoseAdapterState={lastFrameMs:-1,epoch:0,sourceKey:''};
  let brushSource='';
  let brushMode=false;
  const clearBrush=()=>{brushStore.reset();gestures.reset();
   brushAdapter={lastFrameMs:-1,epoch:brushAdapter.epoch+1,sourceKey:''};};
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
   const nextBrushMode=p.painterly.enabled&&p.painterly.painterlyEngine==='foot-brush-v33';
   if(nextBrushMode!==brushMode){clearBrush();brushMode=nextBrushMode;}
   if(input.sourceKey!==brushSource){clearBrush();brushSource=input.sourceKey;}
   if(input.sourceKey!==lastSource){
    lastSource=input.sourceKey;lastFrameMs=-1;lastPaused=false;lastSeeking=false;lastStale=false;lastGoodAt=now;
    p.engine.ensureSource(input.sourceKey);
    p.impressions.ensureSource(input.sourceKey);
   }
   const off=p.blackout||!p.previewLive;
   if(off){
    p.engine.cutAll('manual-reset');
    // Any later frame must start a fresh stroke; retained pigment stays until cleared.
    gestures.reset();
    message='Preview padam';
   }else{
    if(input.seeking){
     if(!lastSeeking){p.engine.reset('seek');p.impressions.reset();clearBrush();}
     lastSeeking=true;
     message='MP4 · memindahkan posisi video';
    }else{
     lastSeeking=false;
     if(!input.ready){
      const waiting=input.status.includes('tertunda')||input.status.includes('menunggu')||
       input.status.includes('belum');
      // Pose inference in MP4 is asynchronous. Do not cut all four feet
      // immediately because a single decoded frame overtook its pose result.
      // A later valid frame will still cut a >390ms gap in the tracking engine.
      const graceMs=input.source==='video'?1000:500;
      if(waiting&&!lastStale&&now-lastGoodAt>graceMs){
       p.engine.cutAll('stale-frame');gestures.reset();lastStale=true;
      }
     }else if(input.frameMs!==lastFrameMs){
      p.engine.ingestFrame(input.samples,input.frameMs,now);
      p.impressions.ingestFrame(input.samples,input.frameMs,input.source);
      if(nextBrushMode){
       const batch=adaptFootBrushFrame(input.samples,input.sourceKey,
        input.frameMs,brushAdapter);
       brushAdapter=batch.state;
       if(batch.cut)gestures.reset();
       for(const event of gestures.ingest(batch.poses)){
        if(event.kind!=='imprint'&&event.kind!=='drag'&&event.kind!=='pivot')continue;
        const dabs=buildFootBrushDabs(event.from??event.pose,event.pose,
         event.kind,{pivot:event.pivot});
        brushStore.append(dabs,event.id);
       }
      }
      if(input.source!=='demo'&&p.motionEvents)
       p.impressions.ingestContacts(p.motionEvents(),input.source,input.frameMs);
      lastFrameMs=input.frameMs;lastGoodAt=now;
      lastStale=false;
     }
     if(input.paused)message='MP4 dijeda · jejak dipertahankan';
     if(lastPaused&&!input.paused)lastStale=false;
     lastPaused=input.paused;
    }
   }
   const fullscreen=document.fullscreenElement===p.fullscreenRef.current;
   paintPainterlyCanvas(ctx,p.engine,p.impressions,p.settings,p.painterly,input.presentationMs,off,fullscreen,brushStore);
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
    const cutSummary=p.engine.diagnostics.filter(x=>!x.accepted)
     .reduce<Record<string,number>>((sum,x)=>{const key=x.reason??'invalid';
      sum[key]=(sum[key]??0)+1;return sum;},{});
    const lag=input.source==='video'&&input.frameMs>=0?
     Math.round(input.presentationMs-input.frameMs):null;
    p.onDiagnostics?.([
     'Sumber: '+input.source+' · '+(input.ready?'frame siap':'frame belum siap'),
     'Frame: '+Math.max(0,input.frameMs).toFixed(0)+' ms',
     ...(lag===null?[]:['Selisih media/pose: '+lag+' ms']),
     'Jalur: '+p.engine.activeCount+' kaki · '+p.engine.sampleCount+' titik',
     'Cap: '+p.impressions.count+' ('+p.impressions.estimatedCount+' estimasi)',
     'Cut: '+JSON.stringify(cutSummary),
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
 painterly:PainterlySettings;onPainterlyChange:(next:PainterlySettings)=>void;
 impressions:PainterlyImpressionEngine;
 engine:DualFootTrajectoryEngine;onClear:()=>void;demo:boolean;onDemo:()=>void;
 status:string;diagnostics:string;performerCount:1|2;
 onUseV2:()=>void;fullscreenDiagnostics:FullscreenDiagnostics;
 onFullscreenDiagnostics:(next:FullscreenDiagnostics)=>void;
};
export function LineTrailsV3Panel({settings,onChange,painterly,onPainterlyChange,
 impressions,engine,onClear,demo,onDemo,status,diagnostics,
 performerCount,onUseV2,fullscreenDiagnostics,onFullscreenDiagnostics}:PanelProps){
 const actorColor=(actor:'A'|'B',value:string)=>onChange({
  ...settings,actorColors:{...settings.actorColors,[actor]:value}
 });
 const actorVisible=(actor:'A'|'B',value:boolean)=>onChange({
  ...settings,actors:{...settings.actors,[actor]:value}
 });
 const footVisible=(actor:'A'|'B',foot:'left'|'right',value:boolean)=>onChange({
  ...settings,footVisible:{...settings.footVisible,
   [actor]:{...settings.footVisible[actor],[foot]:value}}
 });
 const footOverride=(actor:'A'|'B',foot:'left'|'right',value:string|undefined)=>{
  const previous={...(settings.footOverrides[actor]??{})};
  if(value)previous[foot]=value;else delete previous[foot];
  const next={...settings.footOverrides};
  if(Object.keys(previous).length)next[actor]=previous;else delete next[actor];
  onChange({...settings,footOverrides:next});
 };
 const activeActors=performerCount===2?(['A','B'] as const):(['A'] as const);
 const material=(value:PainterlySettings['material'])=>onPainterlyChange({...painterly,material:value});
 const change=(patch:Partial<PainterlySettings>)=>onPainterlyChange({...painterly,...patch});
 return <section className="lt-beta-controls lt-v3-controls lt-painterly-controls" aria-label="Kontrol Garis V3">
  <header><strong>Garis · Painterly</strong><span>V3.2 BETA</span></header>
  <p className="lt-beta-status" role="status"><i data-live={status.includes('terbaca')||demo}/>{status}</p>
  <div className="lt-painterly-material" role="group" aria-label="Material lukisan">
   {([{id:'ink',label:'Tinta'},{id:'charcoal',label:'Arang'},
     {id:'pigment',label:'Pigmen'}] as const).map(m=><button key={m.id} type="button"
      aria-pressed={painterly.material===m.id} onClick={()=>material(m.id)}>{m.label}</button>)}
  </div>
  <div className="lt-painterly-layers">
   <div className="lt-painterly-layer">
    <label><input aria-label="Tampilkan tapak kaki" type="checkbox"
     checked={painterly.showSoles} onChange={e=>change({showSoles:e.target.checked})}/>
     <strong>Tapak kaki</strong></label>
    <label className="lt-painterly-stay"><input type="checkbox"
     aria-label="Tapak tetap" checked={painterly.footprintKeep}
     onChange={e=>change({footprintKeep:e.target.checked})}/>Tetap</label>
    <label className="lt-painterly-duration">Hilang <output>{painterly.footprintKeep?'Tetap':Math.round(painterly.footprintLifeMs/1000)+' dtk'}</output>
     <input type="range" min="1" max="30" step="1"
      aria-label="Durasi tapak kaki" disabled={painterly.footprintKeep||!painterly.showSoles}
      value={Math.round(painterly.footprintLifeMs/1000)}
      onChange={e=>change({footprintLifeMs:Number(e.target.value)*1000})}/>
    </label>
   </div>
   <div className="lt-painterly-layer">
    <label><input aria-label="Tampilkan garis lintasan" type="checkbox"
     checked={painterly.showTrails} onChange={e=>change({showTrails:e.target.checked})}/>
     <strong>Garis lintasan</strong></label>
    <label className="lt-painterly-stay"><input type="checkbox"
     aria-label="Garis tetap" checked={painterly.trailKeep}
     onChange={e=>change({trailKeep:e.target.checked})}/>Tetap</label>
    <label className="lt-painterly-duration">Hilang <output>{painterly.trailKeep?'Tetap':Math.round(painterly.trailLifeMs/1000)+' dtk'}</output>
     <input type="range" min="1" max="30" step="1"
      aria-label="Durasi garis lintasan" disabled={painterly.trailKeep||!painterly.showTrails}
      value={Math.round(painterly.trailLifeMs/1000)}
      onChange={e=>change({trailLifeMs:Number(e.target.value)*1000})}/>
    </label>
   </div>
  </div>
  {activeActors.map(actor=><div key={actor} className="lt-v31-actor">
   <label htmlFor={'v31-actor-color-'+actor}><strong>Aktor {actor}</strong>
    <small>{actor==='A'?'Merah':'Hitam arang'} · dua kaki</small></label>
   <input type="color" id={'v31-actor-color-'+actor}
    aria-label={'Warna Aktor '+actor} value={settings.actorColors[actor]}
    onChange={e=>actorColor(actor,e.target.value)}/>
   <input type="checkbox" checked={settings.actors[actor]}
    aria-label={'Tampilkan Aktor '+actor}
    onChange={e=>actorVisible(actor,e.target.checked)}/>
  </div>)}
  <details className="lt-painterly-characters"><summary>Karakter garis</summary>
  <div className="lt-v31-character" role="group" aria-label="Karakter garis">
   {([{value:'precision',label:'Presisi'},
      {value:'fluid',label:'Luwes'},
      {value:'paint',label:'Lukis'}] as const).map(mode=>
    <button key={mode.value} type="button"
     aria-pressed={settings.styleMode===mode.value}
     onClick={()=>onChange({...settings,styleMode:mode.value})}>{mode.label}</button>)}
  </div>
  </details>
  <label className="lt-beta-width">Ketebalan <output>{settings.width} px</output>
   <input type="range" min={1} max={12} step={1}
    aria-label="Ketebalan lintasan" value={settings.width}
    onChange={e=>onChange({...settings,width:Number(e.target.value)})}/>
  </label>
  <div className="lt-beta-actions">
   <button type="button" onClick={onClear}>Bersihkan</button>
   <button type="button" className="lt-beta-demo" aria-pressed={demo} onClick={onDemo}>
    {demo?'Hentikan Demo':'Coba Demo'}
   </button>
  </div>
  <small className="lt-beta-count">{engine.sampleCount} titik · {engine.allStrokes.length} segmen ·
   · {impressions.count} cap ({impressions.estimatedCount} estimasi) · Posisi 2D</small>
  <details className="lt-v31-foot-details">
   <summary>Detail kaki</summary>
   <p>Warna kedua kaki mengikuti aktor, kecuali saat warna khusus diaktifkan.</p>
   {activeActors.map(actor=><div key={actor} className="lt-v31-foot-group">
    <strong>Aktor {actor}</strong>
    {(['left','right'] as const).map(foot=>{
     const override=settings.footOverrides[actor]?.[foot];
     return <div className="lt-v31-foot-row" key={foot}>
      <span>{foot==='left'?'Kiri':'Kanan'}</span>
      <label><input type="checkbox" checked={Boolean(override)}
       aria-label={'Warna khusus '+actor+' '+foot}
       onChange={e=>footOverride(actor,foot,
        e.target.checked?settings.actorColors[actor]:undefined)}/> Khusus</label>
      <input type="color" aria-label={'Warna '+actor+' '+foot}
       value={override??settings.actorColors[actor]} disabled={!override}
       onChange={e=>footOverride(actor,foot,e.target.value)}/>
      <input type="checkbox" aria-label={'Tampilkan '+actor+' '+foot}
       checked={settings.footVisible[actor][foot]}
       onChange={e=>footVisible(actor,foot,e.target.checked)}/>
     </div>;
    })}
   </div>)}
  </details>
  <details className="lt-v3-debug">
   <summary>Periksa jalur</summary>
   <label><input type="checkbox" checked={settings.debug}
    onChange={e=>onChange({...settings,debug:e.target.checked})}/> Titik mentah dan hasil filter</label>
   <p>{diagnostics}</p>
   <small>Jejak pendek tetap tersimpan di engine. Luwes/Lukis hanya merapikan visual;
    Presisi menampilkan seluruh segmen valid.</small>
  </details>
  <details className="lt-v3-advanced">
   <summary>Pengaturan lanjutan</summary>
   <label><input type="checkbox"
    aria-label="Aktifkan Kuas V3.3 eksperimental"
    checked={painterly.painterlyEngine==='foot-brush-v33'}
    onChange={e=>change({painterlyEngine:e.target.checked?'foot-brush-v33':'legacy-v32'})}/>
    Kuas V3.3 (eksperimental · fallback V3.2 tersedia)</label>
   <label><input type="checkbox" checked={painterly.enabled}
    onChange={e=>change({enabled:e.target.checked})}/> Painterly aktif (matikan untuk Lintasan klasik)</label>
   <label>Ukuran tapak <output>{painterly.sizePx} px</output>
    <input type="range" min="30" max="110" step="2" aria-label="Ukuran tapak"
     value={painterly.sizePx} onChange={e=>change({sizePx:Number(e.target.value)})}/>
   </label>
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
