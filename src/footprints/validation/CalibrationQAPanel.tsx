import {Download,FlaskConical,Play,Square,Trash2} from 'lucide-react';
import {CALIBRATION_QA_TARGETS,summarizeCalibrationQA,type CalibrationQASample} from './CalibrationQA.ts';

type Props={
 activeIndex:number|null;contextKey:string;samples:CalibrationQASample[];
 ready:boolean;outputLive:boolean;message:string;
 onBegin:()=>void;onCancel:()=>void;onClear:()=>void;onExport:()=>void;
};
const cm=(n:number|null)=>n===null?'–':n.toFixed(2)+' cm';
export function CalibrationQAPanel({activeIndex,contextKey,samples,ready,outputLive,message,
 onBegin,onCancel,onClear,onExport}:Props){
 const summary=summarizeCalibrationQA(samples,contextKey);
 const active=activeIndex!==null;
 const target=active?CALIBRATION_QA_TARGETS[activeIndex]:null;
 return <section className="live-floor-qa" aria-label="S5.6.3 QA kalibrasi kamera proyektor">
  <div className="live-floor-heading"><FlaskConical size={15}/> 01B / CAMERA–PROJECTOR QA</div>
  <p>Lima silang muncul satu per satu di bagian dalam lantai. Klik <strong>pusat cahaya silang yang benar-benar terlihat</strong> pada gambar kamera mentah di atas. Empat sudut yang dipakai untuk kalibrasi tidak dihitung ulang sebagai bukti akurasi.</p>
  <div className="live-floor-qa-measures" aria-live="polite">
   <span><b>{summary.count} / {summary.required}</b><small>Titik diperiksa</small></span>
   <span><b>{cm(summary.rmseCm)}</b><small>RMSE posisi</small></span>
   <span><b>{cm(summary.p95Cm)}</b><small>P95 sampel</small></span>
   <span><b>{cm(summary.maximumCm)}</b><small>Galat terbesar</small></span>
  </div>
  <p className="live-floor-qa-hint">{active?
   'Target '+target?.id+' · '+target?.label+'. Pastikan Projector → Live menampilkan silang ini, lalu klik pusatnya pada kamera.':
   summary.count===summary.required?
    summary.status==='within-provisional-target'?
     'Lima titik terisi dan berada dalam ambang kerja sementara. Lanjutkan pengukuran fisik sebelum produksi.':
     'Lima titik terisi; galat perlu diperiksa dan kalibrasi disesuaikan.':
    'Mulai setelah kalibrasi empat sudut kamera diterapkan dan jendela output proyektor tersambung.'}</p>
  {active&&!outputLive&&<p className="live-floor-qa-warning">Aktifkan Live pada panel Projection, pastikan titik uji terlihat di lantai. Jangan klik sebelum cahaya benar-benar tampak.</p>}
  <div className="live-floor-tools">
   {!active?<button type="button" disabled={!ready} onClick={onBegin}><Play size={14}/> {summary.count?'Ukur ulang 5 titik':'Mulai uji 5 titik'}</button>:
    <button type="button" onClick={onCancel}><Square size={14}/> Batalkan / Blackout</button>}
   <button type="button" disabled={!summary.count||active} onClick={onExport}><Download size={14}/> Laporan QA JSON</button>
   <button type="button" disabled={!summary.count||active} onClick={onClear}><Trash2 size={14}/> Hapus QA</button>
  </div>
  {!!summary.count&&<div className="live-floor-qa-points" aria-label="Kesalahan lima titik">
   {CALIBRATION_QA_TARGETS.map((target)=>{
    const s=samples.find(s=>s.contextKey===contextKey&&s.targetId===target.id);
    return <span key={target.id}><b>{target.id}</b><small>{target.label}</small><em>{s?cm(s.errorCm):'Belum'}</em></span>;
   })}
  </div>}
  <p className="live-floor-qa-note">Ambang kerja sementara: RMSE ≤ 8 cm, P95 ≤ 15 cm. Status ini berasal dari klik operator dan tetap perlu diperiksa lewat ukuran fisik serta rekaman kaki–cahaya. Perubahan kamera, ukuran lantai, atau kalibrasi proyektor menghapus pengukuran QA lama.</p>
  <p className="live-floor-qa-status" role="status">{message}</p>
 </section>;
}
