import {useMemo,useRef,useState} from 'react';
import {Download,FlaskConical,Activity,Trash2} from 'lucide-react';
import {download} from '../../engine/recording.ts';
import type {FootstepEvent} from '../spatial/events.ts';
import type {FloorSpace} from '../spatial/coordinates.ts';
import {StageValidationRecorder,type SoftwareMetrics,type StageObservation} from './StageValidationRecorder.ts';
import type {FloorRealtimeTimings} from '../live/FloorRealtimeDiagnostics.ts';
import type {ArtworkTransferWindow} from '../../projection/ArtworkTransferWindow.ts';
import './stage-validation.css';

const val=(n:number|null,unit='')=>n===null?'–':(Math.round(n*100)/100).toString()+unit;
const csvCell=(x:unknown)=>'"'+String(x??'').replace(/"/g,'""')+'"';
function downloadCSV(recorder:StageValidationRecorder){
 const header=['eventId','performer','foot','estimatedX_m','estimatedY_m','referenceX_m','referenceY_m','error_cm','note'];
 const rows=recorder.contacts.map(c=>[c.eventId,c.performerId,c.foot,c.estimatedM.xM,c.estimatedM.yM,
  c.referenceM.xM,c.referenceM.yM,c.errorCm,c.note]);
 download(new Blob([[header,...rows].map(r=>r.map(csvCell).join(',')).join('\r\n')],{type:'text/csv;charset=utf-8'}),
  'SOMA-S5-5-physical-contact-errors.csv');
}
export function StageValidationPanel({floor,events,software,realtime,outputAck}:{
 floor:FloorSpace;events:FootstepEvent[];software:SoftwareMetrics;
 realtime:FloorRealtimeTimings;outputAck:ArtworkTransferWindow['metrics']|null;
}){
 const recorder=useRef(new StageValidationRecorder(floor)).current;
 const [revision,setRevision]=useState(0),[selection,setSelection]=useState('');
 const [x,setX]=useState(''),[y,setY]=useState(''),[note,setNote]=useState('');
 const [frames,setFrames]=useState(''),[fps,setFps]=useState('120');
 const [kind,setKind]=useState<StageObservation['kind']>('missed-contact');
 const [who,setWho]=useState('A'),[observation,setObservation]=useState('');
 const [cameraSetup,setCameraSetup]=useState(''),[projectorSetup,setProjectorSetup]=useState('');
 const [lighting,setLighting]=useState(''),[remarks,setRemarks]=useState('');
 const [message,setMessage]=useState('Belum ada pengukuran panggung. Pilih event kontak dan ukur posisi pijakan nyata.');
 const recent=useMemo(()=>events.filter(e=>e.kind==='contact'&&e.source==='camera').slice(-40).reverse(),[events]);
 const current=recent.find(e=>e.id===selection)??recent[0];
 const summary=recorder.summary;
 const touch=()=>setRevision(v=>v+1);
 const addReference=()=>{
  try{
   if(!current)throw Error('Belum ada kontak kamera untuk dibandingkan.');
   if(x.trim()===''||y.trim()==='')throw Error('Isi kedua koordinat acuan yang diukur dengan pita ukur.');
   const row=recorder.addContact(current,{xM:Number(x),yM:Number(y)},note);
   setMessage('Sampel '+row.eventId+' tercatat · galat '+row.errorCm+' cm.');setX('');setY('');setNote('');touch();
  }catch(e){setMessage(e instanceof Error?e.message:'Pengukuran gagal.');}
 };
 const addLatency=()=>{
  try{
   if(!frames.trim()||!fps.trim())throw Error('Isi selisih frame dan FPS rekaman eksternal.');
   const row=recorder.addPhysicalLatency(Number(frames),Number(fps));
   setMessage('Latensi dari video satu bidang tercatat: '+row.latencyMs+' ms.');setFrames('');touch();
  }catch(e){setMessage(e instanceof Error?e.message:'Pengukuran latensi gagal.');}
 };
 const addObservation=()=>{
  try{
   recorder.addObservation(kind,who,observation);setMessage('Catatan pengamatan panggung tersimpan.');
   setObservation('');touch();
  }catch(e){setMessage(e instanceof Error?e.message:'Catatan gagal.');}
 };
 const exportReport=()=>{
  const report=recorder.report({cameraSetup,projectorSetup,lighting,remarks});
  download(new Blob([JSON.stringify({report,softwareAtExport:software,realtimeSoftwareAtExport:realtime,
   outputAckAtExport:outputAck},null,2)],{type:'application/json'}),
   'SOMA-S5-5-stage-validation-report.json');
 };
 const reset=()=>{
  if(!window.confirm('Bersihkan semua hasil ukur fisik pada sesi ini? Ekspor terlebih dahulu bila diperlukan.'))return;
  recorder.clear();touch();setMessage('Data validasi panggung dibersihkan.');
 };
 void revision;
 return <section className="live-floor-validation" aria-label="S5.5 pengukuran panggung">
  <div className="live-floor-heading"><FlaskConical size={16}/> 03 / PHYSICAL VALIDATION</div>
  <p className="live-floor-validation-intro">Masukkan hasil ukur di lantai. Angka galat dan latensi fisik hanya muncul dari pengukuran operator. Penghitungan browser ditampilkan terpisah.</p>
  <div className="live-floor-measures">
   <div><b>{summary.matchedContacts}</b><span>titik terukur</span></div>
   <div><b>{val(summary.errorCm.mean,' cm')}</b><span>galat rata-rata</span></div>
   <div><b>{val(summary.errorCm.p95,' cm')}</b><span>galat P95</span></div>
   <div><b>{val(summary.physicalLatencyMs.p95,' ms')}</b><span>latensi fisik P95</span></div>
  </div>
  <div className="live-floor-validate-group">
   <b>1 · Ukur galat posisi kaki</b>
   <p>Sesudah langkah terjadi, pilih event kamera lalu ukur koordinat pijakan sebenarnya dari titik nol lantai (downstage-left).</p>
   <label>Kontak kamera
    <select value={current?.id??''} onChange={e=>setSelection(e.target.value)}>
     {recent.length?recent.map(e=><option key={e.id} value={e.id}>{e.performerId} · {e.foot==='left'?'kiri':'kanan'} · #{e.id} · X {e.positionM.xM.toFixed(2)} / Y {e.positionM.yM.toFixed(2)} m</option>):<option value="">Belum ada event kontak</option>}
    </select>
   </label>
   <div className="live-floor-validate-row">
    <label>Acuan X (meter)<input type="number" min={0} max={floor.widthM} step=".01" placeholder="contoh 2.50" value={x} onChange={e=>setX(e.target.value)}/></label>
    <label>Acuan Y (meter)<input type="number" min={0} max={floor.depthM} step=".01" placeholder="contoh 3.20" value={y} onChange={e=>setY(e.target.value)}/></label>
   </div>
   <label>Catatan titik (opsional)<input value={note} onChange={e=>setNote(e.target.value)} placeholder="marker F3, kaki kiri"/></label>
   <button type="button" disabled={!current} onClick={addReference}>Catat galat kontak</button>
  </div>
  <div className="live-floor-validate-group">
   <b>2 · Latensi gerak → cahaya (video eksternal)</b>
   <p>Rekam kaki mendarat dan proyeksi menyala dalam <strong>satu frame video yang sama</strong>. Masukkan selisih nomor frame dan FPS rekaman; laptop tidak mengukur waktu foton secara otomatis.</p>
   <div className="live-floor-validate-row">
    <label>Selisih frame<input type="number" min="0" step="1" value={frames} onChange={e=>setFrames(e.target.value)} placeholder="misal 8"/></label>
    <label>FPS video<input type="number" min="24" step="1" value={fps} onChange={e=>setFps(e.target.value)} placeholder="120"/></label>
   </div>
   <button type="button" onClick={addLatency}>Catat latensi fisik</button>
  </div>
  <div className="live-floor-validate-group">
   <b>3 · Temuan saat dua tubuh berjalan</b>
   <div className="live-floor-validate-row">
    <label>Jenis<select value={kind} onChange={e=>setKind(e.target.value as StageObservation['kind'])}>
     <option value="missed-contact">Jejak yang tidak tercetak</option>
     <option value="false-contact">Jejak palsu</option>
     <option value="identity-mismatch">Identitas A/B tertukar</option>
     <option value="occlusion">Tubuh saling menutup</option>
     <option value="other">Lainnya</option>
    </select></label>
    <label>Performer<select value={who} onChange={e=>setWho(e.target.value)}>
     <option value="A">A</option><option value="B">B</option><option value="performer-1">Satu performer</option><option value="both">Keduanya</option>
    </select></label>
   </div>
   <label>Yang terlihat di panggung<textarea rows={2} value={observation} onChange={e=>setObservation(e.target.value)} placeholder="Mis. dua tubuh berpapasan, jejak A muncul di sisi B"/></label>
   <button type="button" onClick={addObservation}>Simpan temuan</button>
  </div>
  <div className="live-floor-validate-group">
   <b><Activity size={15}/> Telemetri browser — diagnostik software</b>
   <div className="live-floor-software">
    <span>Raster lantai diperbarui</span><strong>{val(software.fps,' FPS')}</strong>
    <span>Paint P95</span><strong>{val(software.renderP95Ms,' ms')}</strong>
    <span>Event kaki → raster P50/P95</span>
    <strong>{val(realtime.eventToRasterP50Ms,' ms')} / {val(realtime.eventToRasterP95Ms,' ms')}</strong>
    <span>Frame diserahkan → raster P95</span>
    <strong>{val(realtime.frameSubmitToRasterP95Ms,' ms')}</strong>
    <span>Sampel event → raster</span><strong>{realtime.paintSamples}</strong>
    <span>Pose inference P95</span><strong>{val(software.inferenceP95Ms,' ms')}</strong>
    <span>Camera pipeline P95</span><strong>{val(software.pipelineP95Ms,' ms')}</strong>
    <span>Output heartbeat FPS</span><strong>{val(software.outputFps,' FPS')}</strong>
    <span>Output render P95</span><strong>{val(software.outputP95Ms,' ms')}</strong>
    <span>Transfer bitmap → ACK P95</span>
    <strong>{val(outputAck?.bitmapAckP95Ms??null,' ms')}</strong>
    <span>Bitmap diterima</span><strong>{outputAck?.samples??0}</strong>
   </div>
   <p>Waktu mulai frame dihitung saat kamera menyerahkan gambar ke MediaPipe, bukan saat sensor mengekspos cahaya. Event → raster belum termasuk transfer browser/output, scanout, dan nyala proyektor. ACK hanya menunjukkan bitmap telah diterima dan ditangani jendela output; belum menjamin cahaya terlihat. Ukur gerak-ke-cahaya memakai video eksternal.</p>
  </div>
  <div className="live-floor-validate-group">
   <b>4 · Konteks alat dan ekspor</b>
   <label>Kamera / posisi<input value={cameraSetup} onChange={e=>setCameraSetup(e.target.value)} placeholder="model, ketinggian, arah"/></label>
   <label>Proyektor / posisi<input value={projectorSetup} onChange={e=>setProjectorSetup(e.target.value)} placeholder="model, jarak, resolusi"/></label>
   <label>Cahaya ruang<input value={lighting} onChange={e=>setLighting(e.target.value)} placeholder="terang / redup, sumber lampu"/></label>
   <label>Catatan uji<textarea rows={2} value={remarks} onChange={e=>setRemarks(e.target.value)}/></label>
   <div className="live-floor-validation-actions">
    <button type="button" onClick={exportReport}><Download size={15}/> Laporan JSON</button>
    <button type="button" disabled={!summary.matchedContacts} onClick={()=>downloadCSV(recorder)}>Galat CSV</button>
    <button type="button" onClick={reset}><Trash2 size={14}/> Hapus pengukuran</button>
   </div>
  </div>
  <p className="live-floor-validation-status" role="status">{message}</p>
 </section>;
}
