/** Source status for live and experiment inputs. Physical output remains separately gated. */
export type FootprintsInputChoice='webcam'|'phone'|'video'|'simulator';
export type FootprintsInputPhase='idle'|'connecting'|'pairing'|'ready'|'error'|'experiment';
export type FootprintsInputStatus={
 selection:FootprintsInputChoice|null;phase:FootprintsInputPhase;
 message:string;
};
export const SOURCE_CHOICES=[
 {id:'webcam',label:'Webcam laptop',description:'Live · kamera komputer',kind:'live'},
 {id:'phone',label:'Hubungkan kamera',description:'USB · HDMI · OBS · HP / QR',kind:'live'},
 {id:'video',label:'Video MP4',description:'Input lokal · Pose/Gait 2D',kind:'experiment'},
 {id:'simulator',label:'Simulasi 3D',description:'Input sintetis · floor virtual',kind:'experiment'}
] as const;
export const SOURCE_LABELS:Record<FootprintsInputChoice,string>={
 webcam:'Webcam laptop',phone:'Hubungkan kamera',video:'Video MP4',simulator:'Simulasi 3D'
};
export function deriveFootprintsInputStatus(input:{
 selection:FootprintsInputChoice|null;cameraOn:boolean;cameraBusy:boolean;
 cameraError:string;phoneActive:boolean;switchBusy:boolean;switchError:string;
}):FootprintsInputStatus{
 const {selection,cameraOn,cameraBusy,cameraError,phoneActive,switchBusy,switchError}=input;
 // Camera failures and camera busy states must not leak into MP4 / 3D sessions.
 if(switchError||((selection==='webcam'||selection==='phone')&&cameraError&&!cameraOn))
  return {selection,phase:'error',message:switchError||cameraError};
 if(switchBusy||((selection==='webcam'||selection==='phone')&&cameraBusy))
  return {selection,phase:'connecting',message:'Menyiapkan '+(selection?SOURCE_LABELS[selection]:'sumber')+'…'};
 if(selection==='phone'){
  return {selection,phase:phoneActive&&cameraOn?'ready':'pairing',
   message:phoneActive&&cameraOn?'Input kamera horizontal 16:9. Periksa pembacaan kaki.':
   'Pilih kamera USB/HDMI/virtual atau sambungkan HP lewat QR.'};
 }
 if(selection==='webcam'){
  return {selection,phase:cameraOn?'ready':'idle',message:cameraOn?'Webcam tersambung.':'Webcam belum aktif.'};
 }
 if(selection==='video'||selection==='simulator')
  return {selection,phase:'experiment',message:selection==='video'?'MP4 · analisis lokal, output fisik terkunci.':'Simulasi 3D · preview sintetis, output fisik terkunci.'};
 return {selection:null,phase:'idle',message:'Pilih sumber gerak.'};
}
export function requiresSourceRecheck(previous:FootprintsInputChoice|null,next:FootprintsInputChoice){
 return previous!==next;
}
export function canStartSourceSwitch(input:{busy:boolean;from:FootprintsInputChoice|null;to:FootprintsInputChoice}){
 return !input.busy&&input.from!==input.to;
}
