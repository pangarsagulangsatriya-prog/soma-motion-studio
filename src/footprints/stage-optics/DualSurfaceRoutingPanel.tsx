import {useEffect,useRef,useState,useSyncExternalStore,type RefObject} from 'react';
import {Download,Monitor,ShieldAlert,Square,Target} from 'lucide-react';
import type {Projection} from '../../projection/useProjection.ts';
import {download} from '../../engine/recording.ts';
import {STAGE_BLACKOUT_EVENT} from './StageBlackout.ts';
import {ProjectorWysiwygPreview} from './ProjectorWysiwygPreview.tsx';
import {type PreviewView} from './projectorWysiwygModel.ts';
import {shouldLatchProjectionBlackout} from '../../studio/v3/safeProjectionPreflight.ts';
import {startSetupBench,readSetupStart,finishSetupBench,FIRST_SETUP_TARGET_MS}
 from '../../studio/v3/safeProjectionBench.ts';
import {loadStageOutputDrafts,saveStageOutputDraft,stableStageEquipmentKey,
 matchingStageOutputDraft,type StageOutputDraft} from '../../studio/v3/stageOutputDraftProfiles.ts';
import {SURFACE_TARGETS,stageSurfaceSignature,stageSurfaceReport,
 assessSurfaceProof,emptySurfaceProof,recordSurfaceSample,validateStageSurfacePlan,
 type StageSurface,type StageSurfacePlan,type SurfaceProof,type StageOutputContext}
 from './DualSurfaceCalibration.ts';
import {
 DUAL_SURFACE_IDS,STAGE_HARDWARE_ENABLED,
 getDualSurfacePorts,getDualSurfaceState,getDualSurfaceTestCanvases,
 patchDualSurfaceState,subscribeDualSurface,syncDualSurfaceRuntime,
 urgentBlackoutDualSurface,blackoutAllDualSurfaces,
 type RequestedMode,type StageRouteInput
} from './DualSurfaceSessionStore.ts';
import './dual-surface-routing.css';
import {MapFourCornerEditor} from '../../studio/v3/MapFourCornerEditor.tsx';
import {diagnosticNinePointGrid} from './floorNinePointGrid.ts';

export type {StageRouteInput};

const ids=DUAL_SURFACE_IDS;
type Requested=RequestedMode;

type Props={
 frameRef:RefObject<StageRouteInput|null>;
 bodyCanvas:RefObject<HTMLCanvasElement|null>;
 floorCanvas:RefObject<HTMLCanvasElement|null>;
 legacyProjection:Projection;experimentLocked?:boolean;
};

const labels:{[K in StageSurface]:string}={body:'BODY · proyeksi tubuh',floor:'FLOOR · proyeksi lantai'};

function detectDisplayStatus():{extended:boolean|null;label:string}{
 if(typeof window==='undefined'||!('screen' in window))
  return {extended:null,label:'Deteksi layar tidak tersedia di browser ini. Buka output → pindahkan ke layar proyektor → tekan F untuk fullscreen.'};
 const scr=window.screen as Screen&{isExtended?:boolean};
 if(typeof scr.isExtended==='boolean'){
  return scr.isExtended
   ?{extended:true,label:'Layar ganda terdeteksi. Klik Buka output → geser ke layar proyektor → tekan F untuk fullscreen.'}
   :{extended:false,label:'Hanya 1 layar terdeteksi. Sambungkan proyektor (mode Extended), lalu klik Buka output dan tekan F.'};
 }
 return {extended:null,label:'Deteksi layar otomatis tidak didukung browser ini. Klik Buka output → pindahkan ke proyektor → tekan F.'};
}

export function DualSurfaceRoutingPanel({frameRef,bodyCanvas,floorCanvas,legacyProjection,experimentLocked=false}:Props){
 // Keep shouldLatchProjectionBlackout referenced here and enforced in DualSurfaceSessionStore.
 void shouldLatchProjectionBlackout;
 const session=useSyncExternalStore(subscribeDualSurface,getDualSurfaceState,getDualSurfaceState);
 const ports=getDualSurfacePorts();
 const testCanvasesRef=useRef<Record<StageSurface,HTMLCanvasElement>|null>(getDualSurfaceTestCanvases());
 testCanvasesRef.current=getDualSurfaceTestCanvases();
 const legacyRef=useRef(legacyProjection);legacyRef.current=legacyProjection;

 const {plans,proofs,requested,epoch,target,selected,message,devices,operatorConfirm,previewView}=session;

 const setPlans=(updater:Record<StageSurface,StageSurfacePlan>|((prev:Record<StageSurface,StageSurfacePlan>)=>Record<StageSurface,StageSurfacePlan>))=>{
  const next=typeof updater==='function'?updater(getDualSurfaceState().plans):updater;
  patchDualSurfaceState({plans:next});
 };
 const setProofs=(updater:Record<StageSurface,SurfaceProof|null>|((prev:Record<StageSurface,SurfaceProof|null>)=>Record<StageSurface,SurfaceProof|null>))=>{
  const next=typeof updater==='function'?updater(getDualSurfaceState().proofs):updater;
  patchDualSurfaceState({proofs:next});
 };
 const setRequested=(updater:Record<StageSurface,Requested>|((prev:Record<StageSurface,Requested>)=>Record<StageSurface,Requested>))=>{
  const next=typeof updater==='function'?updater(getDualSurfaceState().requested):updater;
  patchDualSurfaceState({requested:next});
 };
 const setArmed=(updater:Record<StageSurface,boolean>|((prev:Record<StageSurface,boolean>)=>Record<StageSurface,boolean>))=>{
  const next=typeof updater==='function'?updater(getDualSurfaceState().armed):updater;
  patchDualSurfaceState({armed:next});
 };
 const setEpoch=(updater:Record<StageSurface,number>|((prev:Record<StageSurface,number>)=>Record<StageSurface,number>))=>{
  const next=typeof updater==='function'?updater(getDualSurfaceState().epoch):updater;
  patchDualSurfaceState({epoch:next});
 };
 const setTarget=(updater:Record<StageSurface,string>|((prev:Record<StageSurface,string>)=>Record<StageSurface,string>))=>{
  const next=typeof updater==='function'?updater(getDualSurfaceState().target):updater;
  patchDualSurfaceState({target:next});
 };
 const setSelected=(next:StageSurface)=>patchDualSurfaceState({selected:next});
 const setMessage=(next:string)=>patchDualSurfaceState({message:next});
 const setOperatorConfirm=(next:boolean)=>patchDualSurfaceState({operatorConfirm:next});
 const setPreviewView=(next:PreviewView)=>patchDualSurfaceState({previewView:next});

 const [dx,setDx]=useState(''),[dy,setDy]=useState('');
 const [savedDrafts,setSavedDrafts]=useState<StageOutputDraft[]>(()=>{
  try{return loadStageOutputDrafts(localStorage);}catch{return [];}
 });
 const [draftName,setDraftName]=useState('Panggung Utama');
 const [draftId,setDraftId]=useState('');
 const [benchObserved,setBenchObserved]=useState(false);
 const [benchNotes,setBenchNotes]=useState('');
 const [benchResult,setBenchResult]=useState('');
 const [displayInfo,setDisplayInfo]=useState(detectDisplayStatus);

 useEffect(()=>{
  syncDualSurfaceRuntime({frameRef,bodyCanvas,floorCanvas,legacyProjection,experimentLocked});
 },[frameRef,bodyCanvas,floorCanvas,legacyProjection,experimentLocked]);

 useEffect(()=>{
  const refresh=()=>setDisplayInfo(detectDisplayStatus());
  window.addEventListener('resize',refresh);
  return()=>window.removeEventListener('resize',refresh);
 },[]);

 const context=(id:StageSurface,plan=plans[id],output=devices[id]):StageOutputContext=>{
  const stage=frameRef.current;
  return {cameraBinding:stage?.cameraKey??null,floorContext:stage?.floorKey??null,
   windowSession:epoch[id]>0?ports[id].id+':'+epoch[id]:'',
   viewport:output.viewport};
 };
 const signature=(id:StageSurface)=>stageSurfaceSignature(plans[id],context(id));
 const assessment=(id:StageSurface)=>assessSurfaceProof(plans[id],signature(id),proofs[id]);

 const urgentBlackout=(id:StageSurface)=>{
  urgentBlackoutDualSurface(id);
 };
 const editPlan=(id:StageSurface,fn:(p:StageSurfacePlan)=>StageSurfacePlan)=>{
  try{
   const next=validateStageSurfacePlan(fn(getDualSurfaceState().plans[id]));
   urgentBlackout(id);
   setPlans(prev=>({...prev,[id]:next}));
   setRequested(prev=>({...prev,[id]:'blackout'}));
   setArmed(prev=>({...prev,[id]:false}));
   setMessage('Kalibrasi '+id.toUpperCase()+' diperbarui. Output kembali ke Blackout hingga uji fisik selesai.');
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
  legacyRef.current.closeOutput();
  ids.forEach(urgentBlackout);
  setRequested({body:'blackout',floor:'blackout'});
  setArmed({body:false,floor:false});
  if(ports[id].opened&&!ports[id].connected)ports[id].closeOutput();
  const opened=ports[id].open(id);
  if(opened){
   setEpoch(prev=>({...prev,[id]:prev[id]+1}));
   setProofs(prev=>({...prev,[id]:null}));
   setMessage('Jendela '+id.toUpperCase()+' dibuka dalam Blackout. Pindahkan ke layar proyektor lalu tekan F.');
  }else setMessage(ports[id].error||'Browser memblokir jendela proyeksi.');
 };
 const close=(id:StageSurface)=>{
  urgentBlackout(id);
  ports[id].closeOutput();
  setRequested(prev=>({...prev,[id]:'blackout'}));
  setArmed(prev=>({...prev,[id]:false}));
  setMessage('Output '+id.toUpperCase()+' ditutup.');
 };
 const allBlackout=()=>{
  ids.forEach(urgentBlackout);
  blackoutAllDualSurfaces('Dua output diperintah Blackout. Periksa cahaya proyektor secara fisik.');
 };
 useEffect(()=>{
  const external=()=>allBlackout();
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
  setMessage(mode==='test'?'Uji optik '+id.toUpperCase()+' dimulai dengan gambar terbatas.':
   mode==='live'?'Live '+id.toUpperCase()+' diminta; engine tetap memeriksa frame dan QA pada setiap kiriman.':
    'Blackout '+id.toUpperCase()+' aktif.');
 };
 const ensureProof=():SurfaceProof|null=>{
  const sig=signature(selected);
  if(!sig){setMessage('Hubungkan output '+selected.toUpperCase()+' dan pastikan kamera/lantai terkalibrasi.');return null;}
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
 const saveOutputDraft=()=>{
  const key=stableStageEquipmentKey(frameRef.current?.cameraKey??null,
   frameRef.current?.floorKey??null);
  if(!key){setMessage('Aktifkan kamera, mask dan profil lantai sebelum menyimpan draf optik.');return;}
  const name=draftName.trim().slice(0,100);
  if(!name){setMessage('Isi nama profil output.');return;}
  const existing=savedDrafts.find(p=>p.id===draftId);
  const id=existing?.id??('output-'+Date.now().toString(36)+'-'+Math.random().toString(36).slice(2));
  try{
   const next=saveStageOutputDraft(localStorage,{
    schema:'soma.stage-output-draft',version:1,id,name,
    equipmentKey:key,updatedAt:new Date().toISOString(),
    plans:{body:plans.body,floor:plans.floor}
   });
   setSavedDrafts(next);setDraftId(id);
   setMessage('Draf optik tersimpan lokal. QA dan izin fisik tidak ikut disimpan.');
  }catch(e){setMessage(e instanceof Error?e.message:'Gagal menyimpan draf output.');}
 };
 const applyOutputDraft=()=>{
  const draft=savedDrafts.find(p=>p.id===draftId);
  const key=stableStageEquipmentKey(frameRef.current?.cameraKey??null,
   frameRef.current?.floorKey??null);
  if(!draft||!matchingStageOutputDraft(draft,key)){
   setMessage('Profil tidak cocok dengan kamera, resolusi, performer atau kalibrasi lantai.');
   return;
  }
  ids.forEach(urgentBlackout);
  const next={body:draft.plans.body,floor:draft.plans.floor};
  setPlans(next);setProofs({body:null,floor:null});
  setRequested({body:'blackout',floor:'blackout'});
  setArmed({body:false,floor:false});
  setDraftName(draft.name);
  setMessage('Draf BODY/FLOOR dimuat. Keduanya BLACKOUT. Ulangi QA lima titik.');
 };
 const removeOutputDraft=()=>{
  if(!draftId)return;
  try{
   const remaining=savedDrafts.filter(d=>d.id!==draftId);
   localStorage.setItem('soma-stage-output-drafts-v1',JSON.stringify(remaining));
   setSavedDrafts(remaining);setDraftId('');
   setMessage('Profil lokal dihapus. Kalibrasi aktif tidak berubah.');
  }catch{setMessage('Penyimpanan lokal tidak tersedia.');}
 };
 const beginBench=()=>{
  try{
   const started=startSetupBench(sessionStorage,Date.now(),true);
   setBenchObserved(false);setBenchResult('');
   setMessage(started?'Timer setup pertama dimulai. Ikuti persiapan proyeksi hingga efek terlihat.':
    'Browser tidak menyediakan penyimpanan sesi untuk timer.');
  }catch{setMessage('Timer sesi tidak tersedia.');}
 };
 const recordBench=()=>{
  try{
   if(devices.floor.mode!=='live'||assessment('floor').status!=='within-provisional-target')
    throw Error('Output FLOOR harus LIVE dan QA lima titik lulus.');
   const record=finishSetupBench({
    startStore:sessionStorage,resultsStore:localStorage,now:Date.now(),
    softwareLive:true,operatorObserved:benchObserved,notes:benchNotes
   });
   setBenchResult(
    Math.floor(record.elapsedMs/60000)+':'+Math.floor(record.elapsedMs%60000/1000).toString().padStart(2,'0')+
    (record.passedTarget?' · Target <10 menit: tercapai menurut laporan operator.':
     ' · Target <10 menit: belum tercapai.'));
   setMessage('Hasil UAT tersimpan lokal. Ini laporan operator, bukan pengukuran cahaya otomatis.');
  }catch(e){setMessage(e instanceof Error?e.message:'Uji setup belum bisa dicatat.');}
 };
 const exportReport=()=>{
  const result={schema:'soma.footprints.dual-surface-report',version:1,
   files:ids.map(id=>stageSurfaceReport(plans[id],proofs[id],context(id))),
   exportedAt:new Date().toISOString(),
   releaseApproved:false};
  download(new Blob([JSON.stringify(result,null,2)],{type:'application/json'}),
   'SOMA-S5-7-4-dual-surface-calibration.json');
 };

 const activePlan=plans[selected],proof=proofs[selected],qa=assessment(selected);
 const qaBadge=qa.status==='within-provisional-target'?'Lulus sementara ('+qa.count+'/5)':
  qa.status==='needs-adjustment'?'Perlu koreksi ('+qa.count+'/5)':'Belum lengkap ('+qa.count+'/5)';

 return <section className="stage-dual" aria-label="Kalibrasi dan Output Proyektor">
  <div className="stage-dual-top">
   <div className="live-floor-heading"><Monitor size={15}/> Kalibrasi &amp; Output Proyektor</div>
   <div className="stage-dual-surface-tabs" role="group" aria-label="Pilih bidang kalibrasi">
    <button type="button" aria-pressed={selected==='floor'} onClick={()=>{setSelected('floor');setDx('');setDy('');}}>FLOOR</button>
    <button type="button" aria-pressed={selected==='body'} onClick={()=>{setSelected('body');setDx('');setDy('');}}>BODY</button>
   </div>
  </div>
  {!STAGE_HARDWARE_ENABLED&&<p className="stage-dual-banner" role="status"><b>Output fisik terkunci di Production.</b> Preview lokal tetap aktif; aktifkan hardware hanya dengan <code>VITE_SOMA_STAGE_OUTPUTS=enabled</code> dan pengawasan operator.</p>}
  {experimentLocked&&<p className="stage-dual-banner" role="status"><b>Mode Preview ({experimentLocked?'MP4 / Simulasi 3D':''})</b> · Kalibrasi 4 sudut dan WYSIWYG aktif untuk latihan lokal; output proyektor fisik terkunci hingga sumber kamera aktif.</p>}

  <div className="stage-dual-workbench">
   <div className="stage-dual-canvas-col">
    <div className="stage-dual-calibration">
     <div className="stage-dual-cal-controls">
      <label>Bidang<select value={selected} onChange={e=>{setSelected(e.target.value as StageSurface);setDx('');setDy('');}}>
       <option value="floor">FLOOR</option><option value="body">BODY</option>
      </select></label>
      <label>Kecerahan · {Math.round(activePlan.brightness*100)}%
       <input type="range" min="0" max=".6" step=".02" value={activePlan.brightness}
        onChange={e=>editPlan(selected,p=>({...p,brightness:Number(e.target.value)}))}/></label>
      <label>Resolusi<select value={activePlan.resolution}
       onChange={e=>editPlan(selected,p=>({...p,resolution:e.target.value as '720p'|'1080p'}))}>
       <option value="720p">720p</option><option value="1080p">1080p</option>
      </select></label>
     </div>
     <MapFourCornerEditor key={selected} sourceQuad={activePlan.sourceQuad}
      projectorQuad={activePlan.projectorQuad}
      onCommit={(group,quad)=>editPlan(selected,p=>({...p,[group]:quad}))}/>
     <div className="stage-dual-advanced-row">
      {selected==='floor'&&<details className="stage-dual-grid-qa">
       <summary>Grid homografi 3 × 3 (9 titik)</summary>
       {(()=>{const grid=diagnosticNinePointGrid(activePlan.sourceQuad,activePlan.projectorQuad);
        return <div>
         <p role="status">Model homografi: {grid.valid?'konsisten':'perlu diperbaiki'} · {grid.samples.length} titik.</p>
         <div className="stage-dual-grid-points" aria-label="Grid kalibrasi model">
          {grid.samples.map(s=><span key={s.id} title={'Projector U '+s.projector.x.toFixed(3)+' V '+s.projector.y.toFixed(3)}>
           {s.id} · {s.projector.x.toFixed(2)}, {s.projector.y.toFixed(2)}
          </span>)}
         </div>
         <small>{grid.reason} Data ini tidak menghitung selisih optik dalam sentimeter.</small>
        </div>;
       })()}
      </details>}
      <details>
       <summary>Advanced · angka presisi empat titik</summary>
       <p>Urutan: kiri atas, kanan atas, kanan bawah, kiri bawah (0–1). Ulangi uji fisik jika proyektor bergeser.</p>
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
     </div>
    </div>

    <section className="stage-wysiwyg" aria-label="Preview proyektor WYSIWYG">
     <div className="stage-wysiwyg-head">
      <div><b>Preview Proyektor (WYSIWYG)</b>
       <small>Transformasi kalibrasi sama dengan jendela output</small>
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
       testCanvases={testCanvasesRef} viewport={devices[id].viewport}/>)}
     </div>
    </section>
   </div>

   <div className="stage-dual-control-col">
    <div className="stage-dual-display-hint" data-extended={String(displayInfo.extended)} role="status">
     <span>{displayInfo.label}</span>
    </div>

    <label className="stage-dual-check">
     <input type="checkbox" disabled={!STAGE_HARDWARE_ENABLED||experimentLocked} checked={operatorConfirm}
      onChange={e=>{setOperatorConfirm(e.target.checked);if(!e.target.checked)allBlackout();}}/>
     Operator mengawasi area proyeksi, menghindari sorot mata/wajah, dan siap mematikan proyektor fisik
    </label>

    <div className="stage-dual-perform-quick" role="group" aria-label="Keluaran FLOOR setelah QA">
     <div>
      <b>KELUARAN FLOOR</b>
      <small>{!STAGE_HARDWARE_ENABLED?'Build Production: output fisik terkunci.':
       experimentLocked?'Sumber eksperimen: preview software saja.':
       !devices.floor.connected?'Buka output FLOOR dan pindahkan ke layar proyektor (tekan F).':
       assessment('floor').status!=='within-provisional-target'?
        'Lengkapi QA fisik 5 titik di bawah sebelum LIVE.':
        devices.floor.mode==='live'?'Sinyal LIVE aktif; pantau cahaya fisik.':
        'QA 5 titik tercatat; siap diaktifkan ke proyektor.'}</small>
     </div>
     <div className="stage-dual-quick-actions">
      <button type="button" className="stage-dual-perform-go"
       disabled={devices.floor.mode!=='live'&&
        (!STAGE_HARDWARE_ENABLED||experimentLocked||!operatorConfirm||
         !devices.floor.connected||assessment('floor').status!=='within-provisional-target')}
       onClick={()=>changeMode('floor',devices.floor.mode==='live'?'blackout':'live')}>
       {devices.floor.mode==='live'?'Hentikan FLOOR':'Aktifkan FLOOR'}
      </button>
      <button type="button" className="stage-dual-emergency" onClick={allBlackout}
       title="Kirim Blackout ke kedua output BODY dan FLOOR">
       <Square size={14}/> Blackout Output
      </button>
     </div>
    </div>

    <div className="stage-dual-outputs">
     {ids.map(id=>{
      const s=devices[id],a=assessment(id);
      return <div className="stage-dual-output" key={id} data-selected={selected===id}>
       <div className="stage-dual-output-head">
        <b>{labels[id]}</b>
        <span className="stage-dual-output-mode" data-mode={s.mode}>{s.mode.toUpperCase()}</span>
       </div>
       <p>{s.opened?(s.connected?'Jendela terhubung':'Menunggu jendela output…'):'Jendela belum dibuka'} · QA {a.count}/5</p>
       <div className="stage-dual-buttons">
        <button type="button" disabled={!STAGE_HARDWARE_ENABLED||experimentLocked||!operatorConfirm||s.connected}
          onClick={()=>open(id)}>{s.opened&&!s.connected?'Pulihkan output':'Buka output'}</button>
        <button type="button" disabled={!s.opened} onClick={()=>close(id)}>Tutup</button>
        <button type="button" disabled={!STAGE_HARDWARE_ENABLED||experimentLocked||!s.connected||!operatorConfirm}
         onClick={()=>changeMode(id,'test')}><Target size={13}/> Pola uji</button>
        <button type="button" disabled={!STAGE_HARDWARE_ENABLED||experimentLocked||!s.connected||!operatorConfirm||a.status!=='within-provisional-target'}
         onClick={()=>changeMode(id,'live')}>LIVE</button>
       </div>
       <small>{s.reason}</small>
      </div>;
     })}
    </div>

    <details className="stage-dual-qa-disclosure">
     <summary><ShieldAlert size={14}/> QA Fisik 5 Titik · {selected.toUpperCase()} <span>{qaBadge}</span></summary>
     <div className="stage-dual-qa">
      <p>Catat ΔX dan ΔY (cm) dari tanda fisik di panggung. Sistem tidak mengukur foton secara otomatis.</p>
      <label>Titik uji ({selected.toUpperCase()})
       <select value={target[selected]} onChange={e=>setTarget(prev=>({...prev,[selected]:e.target.value}))}>
        {SURFACE_TARGETS[selected].map(t=><option key={t.id} value={t.id}>{t.id} · {t.label}</option>)}
       </select></label>
      <div className="stage-dual-measure">
       <label>ΔX (cm)<input type="number" step=".1" value={dx} onChange={e=>setDx(e.target.value)} placeholder="0.0"/></label>
       <label>ΔY (cm)<input type="number" step=".1" value={dy} onChange={e=>setDy(e.target.value)} placeholder="0.0"/></label>
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
        placeholder="nama pemeriksa fisik"/></label>
      {([
       ['fixedOptics','Posisi kamera, lensa dan rig tetap selama pengukuran'],
       ['blackoutObserved','Blackout sungguh memadamkan cahaya pada perangkat'],
       ['noUnsafeSpill','Cahaya tidak menyentuh wajah/mata/penonton; oklusi telah diperiksa']
      ] as const).map(([field,label])=><label key={field} className="stage-dual-check">
       <input type="checkbox" checked={proof?.signature===signature(selected)?proof.checklist[field]:false}
        onChange={e=>updateProof(p=>({...p,checklist:{...p.checklist,[field]:e.target.checked},
         completedAt:null}))}/>{label}</label>)}
      <div className="stage-dual-qa-actions">
       <button type="button" onClick={signOff}>Selesaikan QA manual</button>
       <button type="button" onClick={exportReport}><Download size={14}/> Ekspor QA JSON</button>
      </div>
      <p>Status: <b>{qa.status}</b>. {qa.missing.join(' ')}</p>
     </div>
    </details>

    <details className="stage-dual-profile">
     <summary>Profil proyektor tersimpan ({savedDrafts.length})</summary>
     <p>Menyimpan geometri BODY/FLOOR untuk kamera dan lantai yang sama. QA 5 titik dan izin LIVE selalu diulang.</p>
     <label>Nama profil
      <input value={draftName} maxLength={100} onChange={e=>setDraftName(e.target.value)}/>
     </label>
     <button type="button" onClick={saveOutputDraft}>Simpan draf output</button>
     <label>Profil lokal
      <select value={draftId} onChange={e=>{
       setDraftId(e.target.value);
       const p=savedDrafts.find(q=>q.id===e.target.value);
       if(p)setDraftName(p.name);
      }}>
       <option value="">Pilih profil</option>
       {savedDrafts.map(p=><option key={p.id} value={p.id}>{p.name}</option>)}
      </select>
     </label>
     <div className="stage-dual-buttons">
      <button type="button" onClick={applyOutputDraft} disabled={!draftId}>Muat profil (QA ulang)</button>
      <button type="button" onClick={removeOutputDraft} disabled={!draftId}>Hapus</button>
     </div>
    </details>

    <details className="stage-dual-setup-uat">
     <summary>Uji setup panggung (&lt;10 menit)</summary>
     <p>Catat waktu setup hanya setelah operator melihat efek pada lantai fisik.</p>
     <div className="stage-dual-setup-elapsed">
      {(()=>{const started=readSetupStart(sessionStorage,Date.now());
       if(started===null)return 'Timer belum dimulai';
       const total=Math.floor((Date.now()-started)/1000);
       return 'Waktu '+Math.floor(total/60).toString().padStart(2,'0')+':'+
        (total%60).toString().padStart(2,'0')+' / target '+(FIRST_SETUP_TARGET_MS/60000)+' menit';
      })()}
     </div>
     <button type="button" onClick={beginBench} disabled={devices.floor.mode==='live'}>
      Mulai uji setup baru
     </button>
     <label className="stage-dual-setup-check">
      <input type="checkbox" checked={benchObserved}
       onChange={e=>setBenchObserved(e.target.checked)}/>
      Efek FLOOR terlihat sesuai di lantai fisik dan Blackout nyata sudah diuji
     </label>
     <label>Catatan uji
      <input maxLength={180} value={benchNotes} onChange={e=>setBenchNotes(e.target.value)}
       placeholder="Kamera, proyektor, ruangan, hambatan"/>
     </label>
     <button type="button" disabled={!benchObserved||devices.floor.mode!=='live'||
      assessment('floor').status!=='within-provisional-target'} onClick={recordBench}>
      Catat hasil uji fisik
     </button>
     {benchResult&&<p role="status">{benchResult}</p>}
    </details>

    <p className="stage-dual-status" role="status">{message}</p>
    <p className="stage-dual-limit">Kalibrasi memakai homografi 2D. Periksa area cahaya dan blackout fisik secara langsung sebelum pertunjukan.</p>
   </div>
  </div>
 </section>;
}
