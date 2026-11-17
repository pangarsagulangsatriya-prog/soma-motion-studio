/**
 * S6.5.1 — pure, fail-closed setup gates.
 * This evaluates actual camera/tracking/archive state, never the selected tab.
 * Physical projector QA is intentionally outside this scope.
 */
export type GuideConditions={
 source:'laptop'|'phone'|'simulation';
 cameraOn:boolean;phoneActive:boolean;videoReady:boolean;
 calibrated:boolean;confirmed:boolean;cameraMatched:boolean;
 frameFresh:boolean;tracked:boolean;performers:1|2;
 identityStable:boolean;contactCount:number;
 archiveA:boolean;archiveB:boolean;skipArchive:boolean;
};
export type GuideGate={ready:boolean;reason:string};
export type GuideGates={input:GuideGate;tracking:GuideGate;stage:GuideGate;maxStep:0|1|2};
const yes=(message:string):GuideGate=>({ready:true,reason:message});
const no=(reason:string):GuideGate=>({ready:false,reason});
export function evaluateGuideGates(c:GuideConditions):GuideGates{
 const input=c.source==='simulation'?no('Simulasi 3D dibuka di Lab; untuk menyiapkan panggung, pilih kamera.')
  :!c.cameraOn||!c.videoReady?no(c.source==='phone'?'Hubungkan kamera HP hingga preview muncul.':'Aktifkan webcam hingga preview muncul.')
  :c.source==='phone'&&!c.phoneActive?no('Video HP belum dipakai sebagai sumber gerak.')
  :c.source==='laptop'&&c.phoneActive?no('Sumber masih kamera HP. Hubungkan kembali webcam laptop.')
  :yes('Video kamera tersambung.');
 const tracking=!input.ready?no('Selesaikan koneksi kamera.')
  :!c.calibrated?no('Tandai empat sudut lantai dan terapkan kalibrasi.')
  :!c.confirmed?no('Periksa lalu konfirmasi kalibrasi kamera–lantai.')
  :!c.cameraMatched?no('Kamera berubah. Kalibrasikan ulang dengan sumber terbaru.')
  :!c.frameFresh||!c.tracked?no('Tempatkan kaki dan pinggul di bingkai sampai pose terbaca.')
  :!c.identityStable?no(c.performers===2?'Identitas BODY A/B belum stabil; pisahkan kedua tubuh.':'Pose kaki belum terbaca stabil.')
  :c.contactCount<1?no('Lakukan satu pijakan untuk menguji event Contact.')
  :yes('Kontak kaki terbaca dari kamera yang terkalibrasi.');
 const stage=!tracking.ready?no('Selesaikan pemeriksaan tracking terlebih dahulu.')
  :!c.skipArchive&&(!c.archiveA||(c.performers===2&&!c.archiveB))?
   no(c.performers===2?'Pilih video arsip A dan B, atau lanjutkan tanpa arsip.':'Pilih video arsip A, atau lanjutkan tanpa arsip.')
  :yes(c.skipArchive?'Siap latihan tanpa arsip.':'Arsip siap untuk latihan.');
 return {input,tracking,stage,maxStep:!input.ready?0:!tracking.ready?1:2};
}
