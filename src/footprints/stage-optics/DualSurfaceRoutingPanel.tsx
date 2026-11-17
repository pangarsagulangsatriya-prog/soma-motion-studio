import {useEffect,useRef,useState,type RefObject} from 'react';
import {Download,Monitor,ShieldAlert,Square,Target} from 'lucide-react';
import type {Projection} from '../../projection/useProjection.ts';
import {ProjectionLink} from '../../projection/channel.ts';
import type {BodyMask} from '../../studio/bodyField.ts';
import {download} from '../../engine/recording.ts';
import {drawSurfaceTestPattern} from './SurfaceTestPattern.ts';
import {STAGE_BLACKOUT_EVENT} from './StageBlackout.ts';
import {claimDualOutputStatus,releaseDualOutputStatus,reportDualOutputStatus} from './DualSurfaceTelemetry.ts';
import {stageHardwareAvailable} from './StageHardwareGate.ts';
import {ProjectorWysiwygPreview} from './ProjectorWysiwygPreview.tsx';
import {dualPhysicalOutputAllowed,type PreviewView} from './projectorWysiwygModel.ts';
const STAGE_HARDWARE_ENABLED=stageHardwareAvailable(import.meta.env.DEV,
 import.meta.env.VITE_SOMA_STAGE_OUTPUTS);
import {SURFACE_TARGETS,defaultStageSurfacePlan,stageSurfaceSignature,stageSurfaceReport,
 stageSurfaceState,assessSurfaceProof,emptySurfaceProof,recordSurfaceSample,
 outputSurfaceDecision,validateStageSurfacePlan,
 type StageSurface,type StageSurfacePlan,type SurfaceProof,type StageOutputContext} from './DualSurfaceCalibration.ts';
import './dual-surface-routing.css';

const ids=['body','floor'] as const;
type Requested='blackout'|'test'|'live';
export type StageRouteInput={
 mode:'simulation'|'live';frameAtMs:number;computedAtMs:number;
 cameraSafe:boolean;bodyMediaReady:boolean;bridgeSafe:boolean;
 mask:BodyMask|null;cameraKey:string|null;floorKey:string|null;
};
type Props={
 frameRef:RefObject<StageRouteInput|null>;
 bodyCanvas:RefObject<HTMLCanvasElement|null>;
 floorCanvas:RefObject<HTMLCanvasElement|null>;
 legacyProjection:Projection;experimentLocked:boolean;
};
const labels:{[K in StageSurface]:string}={body:'BODY · paha hingga kaki',floor:'FLOOR · arsip pada pad'};
const signal=()=>{
 const ref={current:null as Record<StageSurface,ProjectionLink>|null};
 ref.current={body:new ProjectionLink(),floor:new ProjectionLink()};
 return ref.current;
};
export function DualSurfaceRoutingPanel({frameRef,bodyCanvas,floorCanvas,legacyProjection,experimentLocked}:Props){
 const links=useRef<Record<StageSurface,ProjectionLink>|null>(null);
 if(!links.current)links.current=signal();
 const ports=links.current;
 const telemetryOwner=ports.body.id+':'+ports.floor.id;
 const [plans,setPlans]=useState<Record<StageSurface,StageSurfacePlan>>({
  body:defaultStageSurfacePlan('body'),floor:defaultStageSurfacePlan('floor')
 });
 const [proofs,setProofs]=useState<Record<StageSurface,SurfaceProof|null>>({body:null,floor:null});
 const [requested,setRequested]=useState<Record<StageSurface,Requested>>({body:'blackout',floor:'blackout'});
 const [armed,setArmed]=useState<Record<StageSurface,boolean>>({body:false,floor:false});
 const [epoch,setEpoch]=useState<Record<StageSurface,number>>({body:0,floor:0});
 const [target,setTarget]=useState<Record<StageSurface,string>>({body:'B1',floor:'F1'});
 const [selected,setSelected]=useState<StageSurface>('body');
 const [dx,setDx]=useState(''),[dy,setDy]=useState(''),[message,setMessage]=useState('Kedua output terkunci di Blackout.');
 const [devices,setDevices]=useState<Record<StageSurface,{connected:boolean;opened:boolean;viewport:StageOutputContext['viewport'];mode:string;reason:string}>>({
  body:{connected:false,opened:false,viewport:null,mode:'blackout',reason:'Output belum dibuka.'},
  floor:{connected:false,opened:false,viewport:null,mode:'blackout',reason:'Output belum dibuka.'}
 });
 const [operatorConfirm,setOperatorConfirm]=useState(false);
 const [previewView,setPreviewView]=useState<PreviewView>('draft');
 const latest=useRef({plans,proofs,requested,armed,epoch,operatorConfirm,experimentLocked});
 latest.current={plans,proofs,requested,armed,epoch,operatorConfirm,experimentLocked};
 const legacyRef=useRef(legacyProjection);legacyRef.current=legacyProjection;
 const testCanvases=useRef<Record<StageSurface,HTMLCanvasElement>|null>(null);
 const context=(id:StageSurface,plan=plans[id],output=devices[id]):StageOutputContext=>{
  const stage=frameRef.current;
  return {cameraBinding:stage?.cameraKey??null,floorContext:stage?.floorKey??null,
   windowSession:epoch[id]>0?ports[id].id+':'+epoch[id]:'',
   viewport:output.viewport};
 };
 const signature=(id:StageSurface)=>stageSurfaceSignature(plans[id],context(id));
 const assessment=(id:StageSurface)=>assessSurfaceProof(plans[id],signature(id),proofs[id]);
 useEffect(()=>{
  claimDualOutputStatus(telemetryOwner);
  ids.forEach(id=>ports[id].start());
  const make=(w:number,h:number)=>{const c=document.createElement('canvas');
   c.width=w;c.height=h;return c;};
  testCanvases.current={body:make(160,90),floor:make(640,360)};
  let timer=0,lastUI=0;
  const send=(now:number)=>{
   const current=latest.current,stage=frameRef.current;
   for(const id of ids){
    const link=ports[id],plan=current.plans[id],output=link.outputInfo;
    const viewport=link.connected&&output?{
     width:output.viewportWidth,height:output.viewportHeight,dpr:output.dpr}:null;
    const key=stageSurfaceSignature(plan,{
     cameraBinding:stage?.cameraKey??null,floorContext:stage?.floorKey??null,
     windowSession:current.epoch[id]>0?link.id+':'+current.epoch[id]:'',
     viewport
    });
    const fresh=!!stage&&stage.mode==='live'&&stage.frameAtMs>0&&
     stage.computedAtMs>0&&now-stage.frameAtMs>=0&&now-stage.frameAtMs<450&&
     now-stage.computedAtMs>=0&&now-stage.computedAtMs<300;
    const safe=dualPhysicalOutputAllowed(STAGE_HARDWARE_ENABLED,current.experimentLocked,current.operatorConfirm)&&
     !!stage&&stage.cameraSafe&&fresh;
    const sourceSafe=id==='body'?!!stage?.bodyMediaReady:!!stage?.bridgeSafe;
    const decision=outputSurfaceDecision({
     plan,signature:key,proof:current.proofs[id],requested:current.requested[id],
     connected:link.connected,cameraSafe:safe,sourceFresh:fresh,
     bridgeSafe:sourceSafe,operatorArmed:current.armed[id]
    });
    let canvas:HTMLCanvasElement|null=null;
    if(decision.mode==='live')canvas=(id==='body'?bodyCanvas:floorCanvas).current;
    if(decision.mode==='test'&&testCanvases.current){
     canvas=testCanvases.current[id];
     const ok=drawSurfaceTestPattern(canvas,id,
      id==='body'?'B1':current.epoch[id]>=0?targetRef.current[id]:'F1',
      stage?.mask??null);
     if(!ok)canvas=null;
    }
    if(canvas&&canvas.width>=16&&canvas.height>=16){
     link.sendArtwork(stageSurfaceState(plan,decision.mode,true),canvas,now);
    }else link.send(stageSurfaceState(plan,'blackout',false),now);
    if(now-lastUI>240){
     reportDualOutputStatus(telemetryOwner,{
      surface:id,reported:true,opened:link.opened,connected:link.connected,
      mode:canvas&&link.connected?decision.mode:'blackout',
      qa:decision.assessment.status,
      sampledAtMs:now,reason:canvas?decision.reason:'Sumber visual atau output tidak siap.'
     });
     setDevices(prev=>{
      const next={connected:link.connected,opened:link.opened,viewport,mode:canvas?decision.mode:'blackout',
       reason:canvas?decision.reason:'Sumber visual/test tidak siap atau output terputus.'};
      const prior=prev[id];
      if(prior.connected===next.connected&&prior.opened===next.opened&&
       prior.mode===next.mode&&prior.reason===next.reason&&
       JSON.stringify(prior.viewport)===JSON.stringify(next.viewport))return prev;
      return {...prev,[id]:next};
     });
    }
   }
   if(now-lastUI>240)lastUI=now;
  };
  timer=window.setInterval(()=>send(performance.now()),75);
  return()=>{clearInterval(timer);for(const id of ids){
   ports[id].send(stageSurfaceState(latest.current.plans[id],'blackout',false),performance.now(),true);
   ports[id].dispose();
  }
   testCanvases.current=null;
   releaseDualOutputStatus(telemetryOwner);
  };
 },[ports,frameRef,bodyCanvas,floorCanvas,telemetryOwner]);
 const targetRef=useRef(target);targetRef.current=target;
 const urgentBlackout=(id:StageSurface)=>{
  // Invalidate the request synchronously, before the next 75 ms send tick.
  // React state updates alone could otherwise resend one obsolete live frame.
  latest.current.requested={...latest.current.requested,[id]:'blackout'};
  latest.current.armed={...latest.current.armed,[id]:false};
  const now=performance.now();
  ports[id].send(stageSurfaceState(latest.current.plans[id],'blackout',false),now,true);
  reportDualOutputStatus(telemetryOwner,{
   surface:id,reported:true,opened:ports[id].opened,connected:ports[id].connected,
   mode:'blackout',
   qa:assessSurfaceProof(latest.current.plans[id],
    stageSurfaceSignature(latest.current.plans[id],{
     cameraBinding:frameRef.current?.cameraKey??null,
     floorContext:frameRef.current?.floorKey??null,
     windowSession:latest.current.epoch[id]>0?ports[id].id+':'+latest.current.epoch[id]:'',
     viewport:ports[id].outputInfo?{
      width:ports[id].outputInfo!.viewportWidth,
      height:ports[id].outputInfo!.viewportHeight,dpr:ports[id].outputInfo!.dpr
     }:null
    }),latest.current.proofs[id]).status,
   sampledAtMs:now,reason:'Blackout manual diperintahkan; periksa cahaya panggung.'
  });
 };
 const editPlan=(id:StageSurface,fn:(p:StageSurfacePlan)=>StageSurfacePlan)=>{
  try{
   // Validate synchronously before committing React state: number fields often
   // produce transient invalid quads while typing. Keep the last valid setup.
   const next=validateStageSurfacePlan(fn(latest.current.plans[id]));
   urgentBlackout(id);
   latest.current.plans={...latest.current.plans,[id]:next};
   setPlans(prev=>({...prev,[id]:next}));
   setRequested(prev=>({...prev,[id]:'blackout'}));
   setArmed(prev=>({...prev,[id]:false}));
   setMessage('Kalibrasi '+id+' berubah. Output Blackout dan uji fisik harus diulang.');
  }catch(e){setMessage(e instanceof Error?e.message:'Kalibrasi tidak valid.');}
 };
 const open=(id:StageSurface)=>{
  if(experimentLocked){
   urgentBlackout(id);
   setMessage('MP4/3D hanya untuk preview lokal. Output fisik BODY/FLOOR dikunci.');return;
  }
  if(!STAGE_HARDWARE_ENABLED){
   setMessage('Output proyektor fisik terkunci pada rilis Production. Gunakan preview lokal untuk QA.');
   return;
  }
  if(!operatorConfirm){setMessage('Konfirmasi terlebih dahulu bahwa area cahaya aman dan diawasi.');return;}
  legacyRef.current.setTransport('blackout');
  legacyRef.current.closeOutput(); // prevent a third, legacy floor output from competing
  ids.forEach(urgentBlackout);
  setRequested({body:'blackout',floor:'blackout'});
  setArmed({body:false,floor:false});
  const opened=ports[id].open(id);
  if(opened){
   setEpoch(prev=>({...prev,[id]:prev[id]+1}));
   setProofs(prev=>({...prev,[id]:null}));
   setMessage('Jendela '+id+' dibuka dalam Blackout. Pindahkan ke proyektor yang sesuai.');
  }else setMessage(ports[id].error||'Browser memblokir jendela proyeksi.');
 };
 const close=(id:StageSurface)=>{
  urgentBlackout(id);
  ports[id].closeOutput();setRequested(prev=>({...prev,[id]:'blackout'}));
  setArmed(prev=>({...prev,[id]:false}));setMessage('Output '+id+' ditutup.');
 };
 const allBlackout=()=>{
  ids.forEach(urgentBlackout);
  setRequested({body:'blackout',floor:'blackout'});
  setArmed({body:false,floor:false});
  setMessage('Dua output diperintah Blackout. Periksa cahaya proyektor secara fisik.');
 };
 // Keep the operator's always-visible Studio Blackout effective even while
 // the dual-projector controls are nested below the Archive preview.
 const allBlackoutRef=useRef(allBlackout);
 allBlackoutRef.current=allBlackout;
 useEffect(()=>{
  const external=()=>allBlackoutRef.current();
  window.addEventListener(STAGE_BLACKOUT_EVENT,external);
  return()=>window.removeEventListener(STAGE_BLACKOUT_EVENT,external);
 },[]);
 const changeMode=(id:StageSurface,mode:Requested)=>{
  if(experimentLocked&&mode!=='blackout'){
   urgentBlackout(id);
   setMessage('Eksperimen MP4/3D tidak boleh mengaktifkan output fisik.');return;
  }
  if(!STAGE_HARDWARE_ENABLED&&mode!=='blackout'){
   urgentBlackout(id);
   setMessage('Build Production ini belum mengizinkan output fisik.');
   return;
  }
  if(mode==='blackout')urgentBlackout(id);
  if(mode==='live'){
   if(!operatorConfirm||assessment(id).status!=='within-provisional-target'){
    setMessage('Live memerlukan kelima pengukuran, uji Blackout, pemeriksa, dan izin manual.');
    return;
   }
   setArmed(prev=>({...prev,[id]:true}));
  }else setArmed(prev=>({...prev,[id]:false}));
  setRequested(prev=>({...prev,[id]:mode}));
  setMessage(mode==='test'?'Uji optik '+id+' dimulai dengan gambar terbatas.':
   mode==='live'?'Live '+id+' diminta; engine tetap memeriksa frame dan QA pada setiap kiriman.':
    'Blackout '+id+' aktif.');
 };
 const ensureProof=():SurfaceProof|null=>{
  const sig=signature(selected);
  if(!sig){setMessage('Hubungkan output '+selected+' dan pastikan kamera/lantai terkalibrasi.');return null;}
  const previous=proofs[selected];
  return previous&&previous.signature===sig?previous:emptySurfaceProof(plans[selected],sig);
 };
 const updateProof=(fn:(p:SurfaceProof)=>SurfaceProof)=>{
  const base=ensureProof();if(!base)return;
  try{
   const updated=fn(base);
   urgentBlackout(selected);
   setProofs(prev=>({...prev,[selected]:updated}));
   setRequested(prev=>({...prev,[selected]:'blackout'}));
   setArmed(prev=>({...prev,[selected]:false}));
  }catch(e){setMessage(e instanceof Error?e.message:'Bukti QA tidak valid.');}
 };
 const addSample=()=>{
  if(!dx.trim()||!dy.trim())return setMessage('Isi selisih X dan Y dalam sentimeter.');
  updateProof(proof=>recordSurfaceSample(proof,target[selected],Number(dx),Number(dy)));
  setDx('');setDy('');
 };
 const signOff=()=>{
  updateProof(p=>{
   if(!p.reviewer.trim()||p.samples.length<5||!Object.values(p.checklist).every(Boolean))
    throw Error('Lengkapi lima titik, checklist optik, dan nama pemeriksa.');
   return {...p,completedAt:new Date().toISOString()};
  });
  setMessage('Pengukuran dicatat sebagai bukti operator, bukan verifikasi otomatis cahaya.');
 };
 const exportReport=()=>{
  const result={schema:'soma.footprints.dual-surface-report',version:1,
   files:ids.map(id=>stageSurfaceReport(plans[id],proofs[id],context(id))),
   exportedAt:new Date().toISOString(),
   releaseApproved:false};
  download(new Blob([JSON.stringify(result,null,2)],{type:'application/json'}),
   'SOMA-S5-7-4-dual-surface-calibration.json');
 };
 useEffect(()=>{if(experimentLocked){allBlackout();setOperatorConfirm(false);}},[experimentLocked]);
 const activePlan=plans[selected],proof=proofs[selected],qa=assessment(selected);
 return <section className="stage-dual" aria-label="S5.7.4 Dual-Surface Calibration & Output Routing">
  <div className="live-floor-heading"><Monitor size={15}/> 04 / DUAL-SURFACE OUTPUT ROUTING</div>
  <p>Dua jendela berbeda: satu ke tubuh, satu ke pad lantai. Setiap jendela memerlukan kalibrasi dan pengukuran sendiri. Tampilan langsung dikunci saat tracking tidak aman atau pemeriksaan perangkat berubah.</p>
  {!STAGE_HARDWARE_ENABLED&&<p role="status"><b>OUTPUT FISIK TERKUNCI DI PRODUCTION.</b> Simulasi, arsip dan pad tetap bisa digunakan. Aktifkan keluaran panggung hanya melalui build khusus dengan VITE_SOMA_STAGE_OUTPUTS=enabled setelah pengawasan operator dan pemeriksaan fisik.</p>}
  <label className="stage-dual-check"><input type="checkbox" disabled={!STAGE_HARDWARE_ENABLED||experimentLocked} checked={operatorConfirm}
   onChange={e=>{setOperatorConfirm(e.target.checked);if(!e.target.checked)allBlackout();}}/>
   Operator menjaga area proyeksi, menghindari sorot mata/wajah, dan siap mematikan proyektor secara fisik</label>
  {experimentLocked&&<p role="status">SOURCE EXPERIMENT · MP4/3D hanya untuk WYSIWYG lokal. Dua output fisik terkunci.</p>}
  <button type="button" className="stage-dual-emergency" onClick={allBlackout}>
   <Square size={15}/> BLACKOUT KEDUA OUTPUT
  </button>
  <div className="stage-dual-outputs">
   {ids.map(id=>{
    const s=devices[id],a=assessment(id);
    return <div className="stage-dual-output" key={id}>
     <b>{labels[id]}</b>
     <p>{s.opened?(s.connected?'Jendela terhubung':'Menunggu heartbeat output'):'Jendela belum dibuka'}</p>
     <p>Pengukuran {a.count}/5 · {a.status==='within-provisional-target'?'Target sementara tercapai':a.status==='needs-adjustment'?'Perlu koreksi':'Bukti belum lengkap'}</p>
     <div className="stage-dual-buttons">
      <button type="button" disabled={!STAGE_HARDWARE_ENABLED||experimentLocked||!operatorConfirm||s.opened} onClick={()=>open(id)}>Buka output</button>
      <button type="button" disabled={!s.opened} onClick={()=>close(id)}>Tutup</button>
      <button type="button" disabled={!STAGE_HARDWARE_ENABLED||experimentLocked||!s.connected||!operatorConfirm}
       onClick={()=>changeMode(id,'test')}><Target size={13}/> Uji terbatas</button>
      <button type="button" disabled={!STAGE_HARDWARE_ENABLED||experimentLocked||!s.connected||!operatorConfirm||a.status!=='within-provisional-target'}
       onClick={()=>changeMode(id,'live')}>LIVE</button>
      <button type="button" onClick={()=>changeMode(id,'blackout')}>Blackout</button>
     </div>
     <small>Status cahaya yang dikirim: <b>{s.mode.toUpperCase()}</b>. {s.reason}</small>
    </div>;
   })}
  </div>
  <section className="stage-wysiwyg" aria-label="Projector WYSIWYG dan Output QA">
   <div className="stage-wysiwyg-head">
    <div><b>PROJECTOR / WYSIWYG</b>
     <small>BODY dan FLOOR memakai transformasi kalibrasi yang sama dengan jendela output</small>
    </div>
    <div className="stage-wysiwyg-switch" role="group" aria-label="Mode preview proyektor">
     <button type="button" aria-pressed={previewView==='draft'}
      onClick={()=>setPreviewView('draft')}>Draf lokal</button>
     <button type="button" aria-pressed={previewView==='sent'}
      onClick={()=>setPreviewView('sent')}>Sinyal dikirim</button>
    </div>
   </div>
   <div className="stage-wysiwyg-grid">
    {ids.map(id=><ProjectorWysiwygPreview key={id} surface={id}
     plan={plans[id]} view={previewView} softwareMode={devices[id].mode}
     connected={devices[id].connected} qa={assessment(id)}
     liveCanvas={id==='body'?bodyCanvas:floorCanvas}
     testCanvases={testCanvases} viewport={devices[id].viewport}/>)}
   </div>
   <p className="stage-wysiwyg-limit">Draf lokal menampilkan komposisi dengan
    transformasi dan batas kecerahan yang dipakai output. Mode Sinyal dikirim
    mengikuti perintah software terbaru (LIVE / TEST / BLACKOUT). Preview
    ini belum mengukur cahaya pada kain, tubuh, lantai, atau mata penonton.
    Pengukuran fisik, blackout nyata, dan pemeriksaan area tetap wajib.</p>
  </section>
  <div className="stage-dual-calibration">
   <label>Bidang yang diedit<select value={selected} onChange={e=>{setSelected(e.target.value as StageSurface);setDx('');setDy('');}}>
    <option value="body">BODY</option><option value="floor">FLOOR</option>
   </select></label>
   <label>Kecerahan maksimal · {Math.round(activePlan.brightness*100)}%
    <input type="range" min="0" max=".6" step=".02" value={activePlan.brightness}
     onChange={e=>editPlan(selected,p=>({...p,brightness:Number(e.target.value)}))}/></label>
   <label>Resolusi output<select value={activePlan.resolution}
    onChange={e=>editPlan(selected,p=>({...p,resolution:e.target.value as '720p'|'1080p'}))}>
    <option value="720p">720p</option><option value="1080p">1080p</option>
   </select></label>
   <details>
    <summary>Kalibrasi empat titik · Source UV → Projector UV</summary>
    <p>Urutan: kiri atas, kanan atas, kanan bawah, kiri bawah. Angka 0–1 terikat pada bidang output yang dipilih. Atur ulang dan ukur fisik setiap kali perangkat dipindahkan.</p>
    <div className="stage-dual-quad">
     {(['sourceQuad','projectorQuad'] as const).map(group=><div key={group}>
      <b>{group==='sourceQuad'?'Sumber kamera/pad':'Target proyektor'}</b>
      {activePlan[group].map((point,i)=><div key={i}>
       <span>{i+1}</span>
       {(['x','y'] as const).map(axis=><label key={axis}>{axis.toUpperCase()}
        <input type="number" min="0" max="1" step=".01" value={point[axis]}
         onChange={e=>editPlan(selected,p=>({
          ...p,[group]:p[group].map((v,j)=>j===i?{...v,[axis]:Number(e.target.value)}:v) as typeof p[typeof group]
         }))}/></label>)}
      </div>)}
     </div>)}
    </div>
   </details>
   <div className="stage-dual-qa">
    <b><ShieldAlert size={14}/> Five-Point Physical QA · {selected.toUpperCase()}</b>
    <p>Ukur selisih dari tanda fisik yang seharusnya disentuh cahaya. Catat ΔX dan ΔY menggunakan video/ruler panggung. Data ini berasal dari operator; sistem tidak mengukur foton secara otomatis.</p>
    <label>Pilih titik / gerakan uji
     <select value={target[selected]} onChange={e=>setTarget(prev=>({...prev,[selected]:e.target.value}))}>
      {SURFACE_TARGETS[selected].map(t=><option key={t.id} value={t.id}>{t.id} · {t.label}</option>)}
     </select></label>
    <div className="stage-dual-measure">
     <label>ΔX (cm)<input type="number" step=".1" value={dx} onChange={e=>setDx(e.target.value)} placeholder="observasi"/></label>
     <label>ΔY (cm)<input type="number" step=".1" value={dy} onChange={e=>setDy(e.target.value)} placeholder="observasi"/></label>
     <button type="button" onClick={addSample}>Simpan titik</button>
    </div>
    <div className="stage-dual-metrics">
     <span>Sampel <b>{qa.count}/5</b></span>
     <span>RMSE <b>{qa.rmseCm??'—'} cm</b></span>
     <span>P95 <b>{qa.p95Cm??'—'} cm</b></span>
     <span>Maks <b>{qa.maximumCm??'—'} cm</b></span>
    </div>
    <label>Nama pemeriksa
     <input type="text" value={proof?.signature===signature(selected)?proof.reviewer:''}
      onChange={e=>updateProof(p=>({...p,reviewer:e.target.value.slice(0,120),completedAt:null}))}
      placeholder="pemeriksa fisik"/></label>
    {([
     ['fixedOptics','Posisi kamera, lensa dan rig tetap selama pengukuran'],
     ['blackoutObserved','Blackout sungguh memadamkan cahaya pada perangkat'],
     ['noUnsafeSpill','Cahaya tidak menyentuh wajah/mata/penonton; oklusi telah diperiksa']
    ] as const).map(([field,label])=><label key={field} className="stage-dual-check">
     <input type="checkbox" checked={proof?.signature===signature(selected)?proof.checklist[field]:false}
      onChange={e=>updateProof(p=>({...p,checklist:{...p.checklist,[field]:e.target.checked},
       completedAt:null}))}/>{label}</label>)}
    <button type="button" onClick={signOff}>Selesaikan QA manual</button>
    <p>Hasil: <b>{qa.status}</b>. {qa.missing.join(' ')}</p>
   </div>
   <button type="button" onClick={exportReport}><Download size={14}/> Ekspor kedua QA JSON</button>
  </div>
  <p className="stage-dual-status" role="status">{message}</p>
  <p className="stage-dual-limit">Kalibrasi BODY memakai homografi kamera-ke-proyektor 2D sebagai pendekatan awal. Kain/celana dan permukaan kaki bergerak dalam kedalaman 3D; hasil belum mengikuti deformasi permukaan secara akurat. Semua ambang galat sementara dan tidak memicu deploy Production.</p>
 </section>;
}
