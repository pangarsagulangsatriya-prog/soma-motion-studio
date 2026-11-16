import {useEffect,useMemo,useState} from 'react';
import {Download,FlaskConical,LockKeyhole,Trash2} from 'lucide-react';
import {download} from '../../engine/recording.ts';
import './physical-acceptance.css';
import type {FootstepEvent,FootSide} from '../spatial/events.ts';
import type {FloorSpace} from '../spatial/coordinates.ts';
import type {CalibrationQASample,CalibrationQASummary} from './CalibrationQA.ts';
import {addMovementEvidence,addPhotonEvidence,annotatePhysicalContact,
 assessPhysicalAcceptance,capturePhysicalTrial,exportPhysicalAcceptance,markPhysicalReview,
 removePhysicalContact,removeMovementEvidence,removePhotonEvidence,
 requiredMovementCases,type MovementCase,type PhysicalChecklist,type PhysicalTrial} from './PhysicalAcceptance.ts';

type Props={
 floor:FloorSpace;events:FootstepEvent[];performerCount:1|2;contextKey:string;
 calibrationQA:CalibrationQASummary|null;calibrationSamples:CalibrationQASample[];
 cameraConfirmed:boolean;projectorVerified:boolean;onBlackout:()=>void;
 onUnsavedChange:(value:boolean)=>void;
};
const metric=(n:number|null,unit='')=>n===null?'—':n.toFixed(2)+unit;
const MOVEMENT_LABELS:Record<MovementCase,string>={
 'normal-walk':'Walking biasa','slow-low-step':'Langkah rendah/lambat',
 pivot:'Pivot (tanpa kontak baru)',slide:'Slide/drag (tanpa kontak baru)',
 crossing:'Dua aktor berpapasan'};
const checkboxLabels:Record<keyof PhysicalChecklist,string>={
 floorMarkersMeasured:'Marker/titik pijakan diukur dengan pita ukur',
 fixedCameraAndProjector:'Kamera, proyektor dan ukuran lantai tetap selama take',
 footAndProjectionInSameVideo:'Video eksternal memperlihatkan kaki dan cahaya proyektor dalam satu gambar',
 blackoutAndReconnectionChecked:'Blackout serta perubahan koneksi diuji di perangkat fisik'
};
const performerIds=(n:1|2)=>n===1?['performer-1']:['A','B'];
export function PhysicalAcceptancePanel({floor,events,performerCount,contextKey,
 calibrationQA,calibrationSamples,cameraConfirmed,projectorVerified,onBlackout,onUnsavedChange}:Props){
 const [trial,setTrial]=useState<PhysicalTrial|null>(null);
 useEffect(()=>{onUnsavedChange(!!trial);},[trial,onUnsavedChange]);
 const [video,setVideo]=useState(''),[duration,setDuration]=useState(''),[fps,setFps]=useState('120');
 const [who,setWho]=useState('performer-1'),[foot,setFoot]=useState<FootSide>('left');
 const [frame,setFrame]=useState(''),[x,setX]=useState(''),[y,setY]=useState('');
 const [match,setMatch]=useState(''),[movement,setMovement]=useState<MovementCase>('normal-walk');
 const [notes,setNotes]=useState('');
 const [seqKind,setSeqKind]=useState<MovementCase>('normal-walk'),[seqWho,setSeqWho]=useState('performer-1');
 const [seqFrame,setSeqFrame]=useState(''),[seqNote,setSeqNote]=useState('');
 const [lightContact,setLightContact]=useState(''),[lightFrames,setLightFrames]=useState('');
 const [removeContactId,setRemoveContactId]=useState('');
 const [removeSequenceIndex,setRemoveSequenceIndex]=useState('');
 const [removeLightId,setRemoveLightId]=useState('');
 const [reviewer,setReviewer]=useState(''),[reviewNote,setReviewNote]=useState('');
 const [message,setMessage]=useState('Rekam satu take panggung dan bekukan event sebelum membandingkannya dengan video.');
 const assessment=useMemo(()=>assessPhysicalAcceptance(trial,contextKey,calibrationQA),
  [trial,contextKey,calibrationQA]);
 const summary=assessment.summary;
 const permitted=performerIds(trial?.performerCount??performerCount);
 const selectedWho=permitted.includes(who)?who:permitted[0];
 const selectedSeqWho=permitted.includes(seqWho)?seqWho:permitted[0];
 const matchedIds=new Set(trial?.physicalContacts.map(c=>c.matchedEventId).filter(Boolean));
 const matchingEvents=(trial?.contacts??[]).filter(e=>e.performerId===selectedWho&&e.foot===foot&&!matchedIds.has(e.id));
 const knownMatches=(trial?.physicalContacts??[]).filter(e=>!!e.matchedEventId);
 const change=(fn:()=>void)=>{try{fn();}catch(e){setMessage(e instanceof Error?e.message:'Catatan tidak valid.');}};
 const snapshot=()=>change(()=>{
  if(!cameraConfirmed||!projectorVerified||!contextKey)
   throw Error('Kalibrasikan dan setujui kamera/proyektor sebelum membekukan take.');
  if(trial&&!window.confirm('Ganti snapshot yang sudah dianotasi? Hasil lama akan hilang.'))return;
  const fresh=capturePhysicalTrial(floor,events,performerCount,contextKey,
   video,Number(duration),Number(fps));
  onBlackout();setTrial(fresh);setMessage('Snapshot terkunci: '+fresh.contacts.length+
   ' event kamera. Semua pijakan dalam video perlu diberi anotasi.');
 });
 const addContact=()=>change(()=>{
  if(!trial)throw Error('Bekukan take terlebih dahulu.');
  const ref=match||null;
  const updated=annotatePhysicalContact(trial,{performerId:selectedWho,foot,
   videoFrame:Number(frame),referenceM:{xM:Number(x),yM:Number(y)},
   matchedEventId:ref,movement,note:notes});
  setTrial(updated);setFrame('');setX('');setY('');setMatch('');setNotes('');
  setMessage('Pijakan nyata ke-'+updated.physicalContacts.length+' dicatat dari video dan ukuran lantai.');
 });
 const addSeq=()=>change(()=>{
  if(!trial)throw Error('Bekukan take terlebih dahulu.');
  setTrial(addMovementEvidence(trial,seqKind,Number(seqFrame),
   seqKind==='crossing'?'both':selectedSeqWho,seqNote));
  setSeqNote('');setSeqFrame('');setMessage('Peristiwa gerak '+MOVEMENT_LABELS[seqKind]+' tercatat.');
 });
 const addPhoton=()=>change(()=>{
  if(!trial)throw Error('Bekukan take terlebih dahulu.');
  const updated=addPhotonEvidence(trial,lightContact,Number(lightFrames));
  setTrial(updated);setLightFrames('');setLightContact('');
  setMessage('Selisih kaki mendarat hingga cahaya tercatat dari video yang sama.');
 });
 const finish=(checked:boolean)=>change(()=>{
  if(!trial)throw Error('Bekukan take terlebih dahulu.');
  setTrial(markPhysicalReview(trial,checked,reviewer,reviewNote));
  setMessage(checked?'Review ditutup. Event yang tidak dipasangkan dihitung sebagai jejak palsu.':
   'Review dibuka lagi untuk koreksi anotasi.');
 });
 const exportReport=()=>{
  if(!trial)return;
  const report={...exportPhysicalAcceptance(trial,contextKey,calibrationQA),
   calibrationSamples:calibrationSamples.filter(s=>s.contextKey===contextKey)};
  download(new Blob([JSON.stringify(report,null,2)],{type:'application/json'}),
   'SOMA-S5-6-4-physical-acceptance.json');
  onUnsavedChange(false);
  setMessage('Laporan fisik dan evaluasi ambang kerja diekspor. Simpan bersama video asli.');
 };
 const canAnnotate=!!trial&&!trial.reviewComplete;
 return <section className="stage-accept" aria-label="S5.6.4 Physical Stage Validation & Acceptance">
  <div className="live-floor-heading"><FlaskConical size={16}/> 04 / PHYSICAL STAGE ACCEPTANCE</div>
  <p>Bandingkan <b>satu take yang sama</b>: video nyata, semua pijakan yang terlihat, kontak kamera, lima titik kalibrasi dan waktu kaki menyentuh lantai hingga cahaya terlihat. Pengukuran datang dari operator, bukan hasil sintesis.</p>
  <div className="stage-accept-group">
   <b>1 · Bekukan take dan event kamera</b>
   <div className="stage-accept-fields">
    <label>Referensi video eksternal<input value={video} onChange={e=>setVideo(e.target.value)}
     placeholder="nama_take_01_120fps.mp4"/></label>
    <label>Durasi take (detik)<input type="number" min="5" max="3600" step="0.1"
     value={duration} onChange={e=>setDuration(e.target.value)} placeholder="contoh 120"/></label>
    <label>FPS video nyata<input type="number" min="24" max="1000" step="1"
     value={fps} onChange={e=>setFps(e.target.value)}/></label>
   </div>
   <button type="button" disabled={!cameraConfirmed||!projectorVerified||!contextKey}
    onClick={snapshot}><LockKeyhole size={14}/> Bekukan sesi & Blackout</button>
   {trial&&<p>Snapshot: <b>{trial.contacts.length}</b> kontak kamera · {trial.performerCount} performer · {trial.videoReference} · {trial.durationSeconds} detik · {trial.videoFps} fps.</p>}
  </div>
  {trial&&<>
   <div className="stage-accept-group">
    <b>2 · Tandai SETIAP pijakan nyata dari video</b>
    <p>Isikan frame touchdown dan koordinat dari marker/pita ukur. Cocokkan dengan satu event kamera yang benar-benar bersesuaian. Pilih “Tidak tercetak” untuk pijakan yang hilang. Event kamera yang tak terpasang dihitung sebagai kontak palsu setelah pemeriksa menutup review.</p>
    <div className="stage-accept-fields">
     <label>Performer<select value={selectedWho} disabled={!canAnnotate} onChange={e=>{setWho(e.target.value);setMatch('');}}>
      {permitted.map(id=><option value={id} key={id}>{id}</option>)}</select></label>
     <label>Kaki<select value={foot} disabled={!canAnnotate} onChange={e=>{setFoot(e.target.value as FootSide);setMatch('');}}>
      <option value="left">Kiri</option><option value="right">Kanan</option></select></label>
     <label>Frame touchdown<input type="number" min="0" step="1" value={frame}
      disabled={!canAnnotate} onChange={e=>setFrame(e.target.value)} placeholder="contoh 240"/></label>
     <label>Koordinat X (m)<input type="number" step=".01" min="0" max={floor.widthM}
      disabled={!canAnnotate} value={x} onChange={e=>setX(e.target.value)}/></label>
     <label>Koordinat Y (m)<input type="number" step=".01" min="0" max={floor.depthM}
      disabled={!canAnnotate} value={y} onChange={e=>setY(e.target.value)}/></label>
     <label>Jenis langkah<select disabled={!canAnnotate} value={movement}
      onChange={e=>setMovement(e.target.value as MovementCase)}>
       {requiredMovementCases(trial.performerCount).map(k=><option key={k} value={k}>{MOVEMENT_LABELS[k]}</option>)}
      </select></label>
    </div>
    <label>Pasangan event kamera<select disabled={!canAnnotate} value={match} onChange={e=>setMatch(e.target.value)}>
     <option value="">Tidak tercetak / missed contact</option>
     {matchingEvents.map(e=><option value={e.id} key={e.id}>#{e.id} · t={Math.round(e.timestampMs)} ms · X {e.positionM.xM.toFixed(2)} · Y {e.positionM.yM.toFixed(2)}</option>)}
    </select></label>
    <label>Catatan pijakan<input disabled={!canAnnotate} value={notes} onChange={e=>setNotes(e.target.value)}
     placeholder="marker F2, video jelas, kaki kiri"/></label>
    <button type="button" disabled={!canAnnotate||frame.trim()===''||x.trim()===''||y.trim()===''} onClick={addContact}>Tambah pijakan fisik</button>
    <p>{trial.physicalContacts.length} pijakan sudah ditandai; {trial.physicalContacts.filter(x=>x.matchedEventId).length} berpasangan, {trial.physicalContacts.filter(x=>!x.matchedEventId).length} tidak tercetak.</p>
    <div className="stage-accept-fields">
     <label>Koreksi anotasi pijakan<select disabled={!canAnnotate} value={removeContactId} onChange={e=>setRemoveContactId(e.target.value)}>
      <option value="">Pilih anotasi untuk dihapus</option>
      {trial.physicalContacts.map(c=><option key={c.id} value={c.id}>{c.id} · {c.performerId} {c.foot} · frame {c.videoFrame} · {c.matchedEventId??'missed'}</option>)}
     </select></label>
     <button type="button" disabled={!canAnnotate||!removeContactId} onClick={()=>change(()=>{
      setTrial(removePhysicalContact(trial,removeContactId));setRemoveContactId('');
      setMessage('Anotasi pijakan dihapus; latensi terkait ikut dibersihkan.');
     })}><Trash2 size={14}/> Koreksi pijakan</button>
    </div>
   </div>
   <div className="stage-accept-group">
    <b>3 · Bukti gerak dari video</b>
    <p>Catat frame nyata saat berjalan biasa, langkah rendah, pivot, slide dan, untuk dua performer, saat berpapasan. Pivot dan slide dapat terjadi tanpa kontak baru.</p>
    <div className="stage-accept-fields">
     <label>Gerakan<select value={seqKind} disabled={!canAnnotate}
      onChange={e=>setSeqKind(e.target.value as MovementCase)}>
      {requiredMovementCases(trial.performerCount).map(k=><option key={k} value={k}>{MOVEMENT_LABELS[k]}</option>)}</select></label>
     <label>Performer<select value={seqKind==='crossing'?'both':selectedSeqWho} disabled={!canAnnotate||seqKind==='crossing'} onChange={e=>setSeqWho(e.target.value)}>
       {seqKind==='crossing'?<option value="both">Keduanya</option>:permitted.map(k=><option key={k}>{k}</option>)}
      </select></label>
     <label>Frame video<input type="number" min="0" step="1" value={seqFrame} disabled={!canAnnotate}
      onChange={e=>setSeqFrame(e.target.value)}/></label>
    </div>
    <label>Yang terlihat<input value={seqNote} disabled={!canAnnotate} onChange={e=>setSeqNote(e.target.value)}
     placeholder="mis. tumit tetap saat pivot; tidak ada jejak tambahan"/></label>
    <button type="button" disabled={!canAnnotate||!seqFrame.trim()||!seqNote.trim()} onClick={addSeq}>Tambah kejadian video</button>
    <div className="stage-accept-chips">{requiredMovementCases(trial.performerCount).map(k=>
     <span key={k}>{MOVEMENT_LABELS[k]} · {trial.sequences.filter(s=>s.kind===k).length}</span>)}</div>
    <div className="stage-accept-fields">
     <label>Koreksi kejadian gerak<select disabled={!canAnnotate} value={removeSequenceIndex}
      onChange={e=>setRemoveSequenceIndex(e.target.value)}>
      <option value="">Pilih kejadian untuk dihapus</option>
      {trial.sequences.map((s,i)=><option key={i} value={String(i)}>{MOVEMENT_LABELS[s.kind]} · frame {s.videoFrame}</option>)}
     </select></label>
     <button type="button" disabled={!canAnnotate||removeSequenceIndex===''} onClick={()=>change(()=>{
      setTrial(removeMovementEvidence(trial,Number(removeSequenceIndex)));setRemoveSequenceIndex('');
      setMessage('Catatan gerak dikoreksi.');
     })}><Trash2 size={14}/> Koreksi gerak</button>
    </div>
   </div>
   <div className="stage-accept-group">
    <b>4 · Latensi kaki → cahaya</b>
    <p>Untuk setiap pijakan berpasangan, hitung selisih frame dari touchdown hingga cahaya tampak dalam satu video yang sama. Satu pijakan dihitung sekali.</p>
    <div className="stage-accept-fields">
     <label>Pijakan berpasangan<select value={lightContact} disabled={!canAnnotate} onChange={e=>setLightContact(e.target.value)}>
      <option value="">Pilih pijakan</option>
      {knownMatches.filter(c=>!trial.photons.some(p=>p.physicalContactId===c.id)).map(c=>
       <option key={c.id} value={c.id}>{c.id} · {c.performerId} {c.foot} · frame {c.videoFrame}</option>)}
     </select></label>
     <label>Selisih frame kaki–cahaya<input type="number" min="0" step="1" value={lightFrames}
      disabled={!canAnnotate} onChange={e=>setLightFrames(e.target.value)}/></label>
    </div>
    <button type="button" disabled={!canAnnotate||!lightContact||lightFrames.trim()===''} onClick={addPhoton}>Catat latensi fisik</button>
    <p>{trial.photons.length} sampel latensi fisik.</p>
    <div className="stage-accept-fields">
     <label>Koreksi latensi<select disabled={!canAnnotate} value={removeLightId} onChange={e=>setRemoveLightId(e.target.value)}>
      <option value="">Pilih pengukuran untuk dihapus</option>
      {trial.photons.map(p=><option key={p.id} value={p.id}>{p.physicalContactId} · {p.latencyMs} ms</option>)}
     </select></label>
     <button type="button" disabled={!canAnnotate||!removeLightId} onClick={()=>change(()=>{
      setTrial(removePhotonEvidence(trial,removeLightId));setRemoveLightId('');setMessage('Pengukuran latensi dikoreksi.');
     })}><Trash2 size={14}/> Koreksi latensi</button>
    </div>
   </div>
   <div className="stage-accept-group">
    <b>5 · Checklist dan pemeriksa</b>
    {Object.entries(checkboxLabels).map(([key,label])=>
     <label className="stage-accept-check" key={key}>
      <input type="checkbox" checked={trial.checklist[key as keyof PhysicalChecklist]}
       onChange={e=>setTrial({...trial,reviewComplete:false,checklist:{...trial.checklist,[key]:e.target.checked}})}/>
      {label}</label>)}
    <label>Pemeriksa rekaman<input value={reviewer} onChange={e=>{setReviewer(e.target.value);if(trial.reviewComplete)setTrial({...trial,reviewComplete:false});}}
     placeholder="nama operator / peninjau"/></label>
    <label>Catatan pemeriksaan<textarea value={reviewNote} rows={2}
     onChange={e=>setReviewNote(e.target.value)} placeholder="kondisi panggung, kegagalan, rekaman pendukung"/></label>
    <label className="stage-accept-check"><input type="checkbox" checked={trial.reviewComplete}
     onChange={e=>finish(e.target.checked)}/>
     Saya sudah meninjau seluruh event kamera dan pijakan dalam video ini. Semua event yang tidak dipasangkan saya periksa sebagai kontak palsu.</label>
   </div>
   <div className="stage-accept-group">
    <b>6 · Hasil & keputusan sementara</b>
    <div className="stage-accept-metrics">
     <span><b>{summary?.matched??0}</b><small>True positive</small></span>
     <span><b>{trial.reviewComplete?summary?.falseContacts??0:'—'}</b><small>False positive*</small></span>
     <span><b>{summary?.missedContacts??0}</b><small>Missed contact</small></span>
     <span><b>{trial.reviewComplete?metric(summary?.precision??null):'—'}</b><small>Precision*</small></span>
     <span><b>{metric(summary?.recall??null)}</b><small>Recall</small></span>
     <span><b>{metric(summary?.errorCm.p95??null,' cm')}</b><small>Posisi P95</small></span>
     <span><b>{metric(summary?.lightMs.p95??null,' ms')}</b><small>Kaki → cahaya P95</small></span>
     <span><b>{trial.reviewComplete?metric(summary?.falseContactsPerMinute??null):'—'}</b><small>False / menit*</small></span>
    </div>
    <p>*False positive baru layak dilaporkan setelah pemeriksa menutup review seluruh rekaman.</p>
    <p>Status: <strong>{assessment.status==='meets-provisional-gates'?'Memenuhi ambang kerja sementara':
      assessment.status==='needs-adjustment'?'Perlu perbaikan':'Bukti belum lengkap'}</strong>.
     QA proyektor: {calibrationQA?.count??0}/5 titik; hasil proyeksi fisik tetap perlu diperiksa di panggung.</p>
    {!!assessment.missing.length&&<div className="stage-accept-findings"><b>Masih diperlukan</b>
     {assessment.missing.map((reason,i)=><p key={i}>{reason}</p>)}</div>}
    {!!assessment.failed.length&&<div className="stage-accept-findings"><b>Melewati ambang kerja</b>
     {assessment.failed.map((reason,i)=><p key={i}>{reason}</p>)}</div>}
    <button type="button" onClick={exportReport}><Download size={14}/> Ekspor laporan fisik & penerimaan JSON</button>
   </div>
   <button type="button" className="stage-accept-clear" onClick={()=>{
    if(!window.confirm('Hapus snapshot dan seluruh anotasi lokal? Ekspor hasil terlebih dahulu.'))return;
    setTrial(null);setMessage('Snapshot dan anotasi dibersihkan.');
   }}><Trash2 size={14}/> Hapus snapshot</button>
  </>}
  <p className="stage-accept-status" role="status">{message}</p>
 </section>;
}
