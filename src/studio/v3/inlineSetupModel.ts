import type {FootprintsInputStatus} from './sourceSwitchModel.ts';

export type InlineSetupAction='source'|'webcam'|'phone'|'body'|'tracking'|'calibrate'|'projector'|null;
export type InlineSetupSeverity='idle'|'busy'|'warning'|'ok';
export type InlineSetupHint={
 id:string;title:string;description:string;action:InlineSetupAction;
 actionLabel:string|null;severity:InlineSetupSeverity;
};
/** S6.8.3: derive exactly one next action from current device/frame/identity/floor state.
 * This is a UI guide, not a physical-projector approval or alternate tracking gate. */
export function inlineSetupHint(input:{
 source:FootprintsInputStatus;
 cameraOn:boolean;cameraBusy:boolean;cameraError:string;bodySelected:boolean;
 videoReady:boolean;frameFresh:boolean;
 performerCount:1|2;visibleCount:number;identityAmbiguous:boolean;identityMatchedFrame:boolean;
 floorCalibrated:boolean;floorConfirmed:boolean;cameraMatched:boolean;
}):InlineSetupHint{
 const hint=(id:string,title:string,description:string,
  action:InlineSetupAction,actionLabel:string|null,severity:InlineSetupSeverity):InlineSetupHint=>
  ({id,title,description,action,actionLabel,severity});
 const {source,cameraOn,cameraBusy,cameraError,bodySelected,videoReady,
  frameFresh,performerCount,visibleCount,identityAmbiguous,identityMatchedFrame,
  floorCalibrated,floorConfirmed,cameraMatched}=input;
 if(source.selection==='video'||source.selection==='simulator')
  return hint('lab','Sumber eksperimen','Video dan simulasi memakai Lab terpisah. Kembali ke sumber live untuk tracking kamera.','source','Ganti sumber','idle');
 if(source.selection===null)
  return hint('source','Pilih sumber gerak','Hubungkan webcam atau kamera HP. Semua pengaturan visual Footprints tetap tersedia.','source','Pilih sumber','idle');
 if(source.phase==='error'||cameraError&&source.selection==='webcam')
  return hint('error','Periksa sambungan kamera',source.message||cameraError,
   source.selection==='phone'?'phone':'webcam',
   source.selection==='phone'?'Buka pairing HP':'Coba webcam lagi','warning');
 if(source.phase==='connecting'||cameraBusy)
  return hint('connecting','Menghubungkan kamera','Periksa permintaan izin dari browser atau sambungan perangkat.','source','Lihat sumber','busy');
 if(source.selection==='phone'&&source.phase==='pairing')
  return hint('pairing','Menunggu kamera HP','Scan QR pada panel Kamera HP. Tutup panel kapan saja; koneksi yang aktif tetap berjalan.','phone','Buka pairing HP','busy');
 if(!cameraOn)
  return hint('offline','Kamera belum aktif','Aktifkan kembali input yang dipilih. Projector tetap dalam pemeriksaan terpisah.',
   source.selection==='phone'?'phone':'webcam',
   source.selection==='phone'?'Hubungkan HP':'Aktifkan webcam','warning');
 if(!videoReady)
  return hint('frame','Menunggu gambar kamera','Periksa posisi perangkat dan tunggu gambar pertama muncul.','source','Periksa sumber','busy');
 if(!bodySelected)
  return hint('body','Aktifkan pembacaan tubuh','Kamera tersambung. Gunakan mode Body untuk membaca kaki.','body','Aktifkan Body','warning');
 if(!frameFresh)
  return hint('pose','Kaki belum terbaca','Berdiri dalam bingkai kamera, pastikan bagian pinggang hingga telapak terlihat.','tracking','Periksa Tracking','warning');
 if(identityAmbiguous||!identityMatchedFrame)
  return hint('identity','Identitas performer belum stabil','Jaga jarak antarperformer dan tunggu identitas cocok dengan frame terbaru.','tracking','Periksa Tracking','warning');
 if(visibleCount<performerCount)
  return hint('performers','Performer belum lengkap',
   'Terbaca '+visibleCount+' dari '+performerCount+' performer. Atur posisi di depan kamera.',
   'tracking','Periksa Tracking','warning');
 if(!floorCalibrated)
  return hint('floor','Tandai bidang lantai','Tentukan empat sudut lantai pada monitor kamera agar lintasan kaki masuk ke FLOOR.','calibrate','Tandai 4 titik','warning');
 if(!cameraMatched)
  return hint('source-mismatch','Kalibrasi perlu diperiksa','Sumber atau resolusi kamera berubah. Terapkan ulang empat titik lantai.','calibrate','Kalibrasi ulang','warning');
 if(!floorConfirmed)
  return hint('floor-confirm','Konfirmasi bidang lantai','Empat titik sudah tersimpan. Cocokkan urutannya lalu konfirmasi sebelum membaca kontak kaki.','calibrate','Periksa 4 titik','warning');
 return hint('preview','Preview gerak siap','BODY dan FLOOR memakai data kamera yang sama. Periksa QA Projector sebelum mengirim output fisik.','projector','Periksa Projector','ok');
}
