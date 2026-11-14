import {useEffect,useRef,useState,type CSSProperties} from 'react';
import {Camera,BookOpen,Download,RotateCcw,Trash2} from 'lucide-react';
import {Range} from '../components';
import type {PhotoArchive} from './usePhotoArchive';
import type {CameraCue} from './useCameraCue';
import {CameraCueControls} from './CameraFrame';
import './photos.css';
export function PhotoWall({archive:a,clean}:{archive:PhotoArchive;clean:boolean}){
 const root=useRef<HTMLDivElement>(null),[box,setBox]=useState(64);
 useEffect(()=>{const node=root.current?.parentElement;if(!node)return;const resize=()=>{const {width,height}=node.getBoundingClientRect();setBox(Math.max(1,Math.min((height-80-a.options.gap*3)/4,width*.22,180)*a.options.size));};resize();const ro=new ResizeObserver(resize);ro.observe(node);return()=>ro.disconnect();},[a.options.gap,a.options.size]);
 const count=a.photos.filter(Boolean).length;const show=a.options.visible&&(count>0||a.enabled);
 return <div ref={root} className={`photo-wall ${show?'visible':''}`} style={{'--photo-size':`${box}px`,'--photo-gap':`${a.options.gap}px`} as CSSProperties} aria-label="Empat foto arsip" aria-hidden={!show}>
  {a.photos.map((photo,i)=><div key={i} className={`photo-cell ${photo?'filled':'empty'} ${a.flash===i?'captured':''} ${a.replacement===i?'replacement':''} ${!photo&&clean&&!a.options.empty?'hide-empty':''}`}>
   {photo?<img src={photo.url} alt={`Foto arsip ${i+1}`} draggable={false}/>:<span className="photo-empty-number">0{i+1}</span>}
   {photo&&<span className="photo-number">0{i+1}{!photo.saved?' · BELUM DISIMPAN':''}</span>}
  </div>)}
 </div>;
}
export function PhotoPanel({archive:a,cameraReady,cameraBusy=false,onCamera,cue}:{cue?:CameraCue;cameraBusy?:boolean;archive:PhotoArchive;cameraReady:boolean;onCamera:()=>void}){
 const count=a.photos.filter(Boolean).length,full=count===4&&a.replacement===null;
 const statusMessage=!a.loaded?'Memuat arsip foto…':a.busy?'Menyimpan foto…':!cameraReady?'Kamera belum siap.':full?'Arsip penuh · 4/4':cue?.frame.open?'Bingkai aktif. Atur dengan telapak, lalu pukul.':cue?.listening?'Ucapkan “kamera” untuk membuka bingkai.':a.message;
 return <div className="photo-panel">
  {cue&&<CameraCueControls cue={cue} ready={cameraReady&&!full&&!a.busy}/>}
  <p>Foto mengisi empat kotak di kiri kanvas. Teks, visual, dan suara tetap berjalan pada sesi yang sama.</p>
  <div className="photo-status" role="status"><span>{statusMessage}</span><b>{count}/4</b>{a.enabled&&a.progress>0&&<progress value={a.progress} max={1} aria-label="Persiapan potret"/>}</div>
  <div className="photo-main-actions"><button className="primary-button" disabled={!a.loaded||a.busy||!cameraReady||full} onClick={()=>void a.capture()}><Camera size={16}/>{a.busy?'Menyimpan…':a.replacement!==null?`Jepret pengganti ${a.replacement+1}`:'Jepret sekarang'}</button>{!cameraReady&&<button className="outline-button" disabled={cameraBusy} onClick={onCamera}>{cameraBusy?'Memuat kamera…':'Mulai kamera'}</button>}</div>
  <details className="photo-legacy"><summary>Cara sebelumnya: telapak + jepitan</summary><label className="check-field"><input type="checkbox" checked={a.enabled} onChange={e=>{if(e.target.checked){cue?.close();cue?.setVoiceEnabled(false);}a.changeEnabled(e.target.checked);}}/>Aktifkan gestur potret · Hands</label><p className="fine-print">Rentangkan dua telapak selama 0,8 detik, lalu jepit satu tangan. Pilihan ini mematikan perintah suara. Tombol Jepret juga bekerja saat kamera Body atau Face aktif.</p></details>
  {a.replacement!==null&&<button className="outline-button small" onClick={()=>a.selectReplacement(null)} disabled={a.busy}>Batalkan penggantian foto {a.replacement+1}</button>}
  <div className="photo-manager">{a.photos.map((photo,i)=><article key={i} aria-label={`Kelola foto ${i+1}`} className={a.replacement===i?'selected':''}>
   <div className="photo-preview">{photo?<img src={photo.url} alt={`Pratinjau foto ${i+1}`}/>:<span>0{i+1}<small>Kosong</small></span>}</div>
   <div className="photo-meta"><b>Foto {i+1}</b><small>{photo?`${photo.width} × ${photo.height} · ${photo.saved?'tersimpan':'belum tersimpan'}`:'Menunggu jepretan'}</small></div>
   {photo&&<div className="photo-item-actions"><button disabled={a.busy} onClick={()=>a.selectReplacement(i)} aria-pressed={a.replacement===i}>Ganti {i+1}</button><button onClick={()=>a.download(i)} aria-label={`Unduh foto ${i+1}`}><Download size={15}/></button><button disabled={a.busy} onClick={()=>void a.remove(i)} aria-label={`Hapus foto ${i+1}`}><Trash2 size={15}/></button>{!photo.saved&&<button disabled={a.busy} onClick={()=>void a.retry(i)}>Simpan ulang</button>}</div>}
  </article>)}</div>
  {a.undo&&<button className="outline-button small" disabled={a.busy} onClick={()=>void a.restore()}><RotateCcw size={14}/>Urungkan perubahan foto {a.undo.slot+1}</button>}
  <details className="photo-settings"><summary>Tampilan & gestur</summary>
   <label className="check-field"><input type="checkbox" checked={a.options.visible} onChange={e=>a.setOptions(o=>({...o,visible:e.target.checked}))}/>Tampilkan arsip di kanvas</label>
   <label className="check-field"><input type="checkbox" checked={a.options.empty} onChange={e=>a.setOptions(o=>({...o,empty:e.target.checked}))}/>Tampilkan kotak kosong di Clean</label>
   <Range label="Ukuran foto" min={.55} max={1} step={.05} value={a.options.size} onChange={size=>a.setOptions(o=>({...o,size}))}/>
   <Range label="Jarak foto" min={0} max={20} step={1} value={a.options.gap} display={`${a.options.gap} px`} onChange={gap=>a.setOptions(o=>({...o,gap}))}/>
   <Range label="Tahan telapak" min={.4} max={2} step={.1} value={a.options.dwell} display={`${a.options.dwell.toFixed(1)} s`} onChange={dwell=>a.setOptions(o=>({...o,dwell}))}/>
   <label className="check-field"><input type="checkbox" checked={a.options.sound} onChange={e=>void a.changeSound(e.target.checked)}/>Bunyi rana pelan</label>
   <p className="fine-print">Bunyi rana tidak masuk rekaman audio SOMA. Tombol Mute ikut membisukannya.</p>
  </details>
  <p className="fine-print">Foto mengikuti pilihan Cermin. Pukulan mengambil isi bingkai persegi; tombol Jepret sekarang mengambil seluruh gambar kamera. Foto tersimpan di browser ini, terpisah dari preset dan rekaman. Penghapusan data situs ikut menghapus foto. Unduh untuk membuat salinan.</p>
  <a className="outline-button" href={import.meta.env.BASE_URL+"soma-manual.html#foto"} target="_blank" rel="noreferrer"><BookOpen size={16}/>Panduan potret & gestur</a>
 </div>;
}
