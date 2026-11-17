/** S6.8.1: one authoritative source selection for Footprints.
 * MP4 and 3D still launch their own Labs until S6.8.4 integrates the data pipelines. */
export type FootprintsInputChoice='webcam'|'phone'|'video'|'simulator';
export type FootprintsInputPhase='idle'|'connecting'|'pairing'|'ready'|'error'|'lab';
export type FootprintsInputStatus={
 selection:FootprintsInputChoice|null;phase:FootprintsInputPhase;
 message:string;
};
export const SOURCE_CHOICES=[
 {id:'webcam',label:'Webcam laptop',description:'Live · kamera komputer',kind:'live'},
 {id:'phone',label:'Kamera HP',description:'Live · pairing QR/WebRTC',kind:'live'},
 {id:'video',label:'Video MP4',description:'Buka Video Motion Lab',kind:'lab'},
 {id:'simulator',label:'Simulasi 3D',description:'Buka 3D Direct Puppet',kind:'lab'}
] as const;
export const SOURCE_LABELS:Record<FootprintsInputChoice,string>={
 webcam:'Webcam laptop',phone:'Kamera HP',video:'Video MP4',simulator:'Simulasi 3D'
};
export function deriveFootprintsInputStatus(input:{
 selection:FootprintsInputChoice|null;cameraOn:boolean;cameraBusy:boolean;
 cameraError:string;phoneActive:boolean;switchBusy:boolean;switchError:string;
}):FootprintsInputStatus{
 const {selection,cameraOn,cameraBusy,cameraError,phoneActive,switchBusy,switchError}=input;
 if(switchError||cameraError&&selection==='webcam'&&!cameraOn)
  return {selection,phase:'error',message:switchError||cameraError};
 if(switchBusy||cameraBusy)
  return {selection,phase:'connecting',message:'Menyiapkan '+(selection?SOURCE_LABELS[selection]:'sumber')+'…'};
 if(selection==='phone'){
  return {selection,phase:phoneActive&&cameraOn?'ready':'pairing',
   message:phoneActive&&cameraOn?'Video HP tersambung. Periksa pembacaan kaki.':
   'Scan QR atau gunakan kode pairing untuk menyambungkan HP.'};
 }
 if(selection==='webcam'){
  return {selection,phase:cameraOn?'ready':'idle',message:cameraOn?'Webcam tersambung.':'Webcam belum aktif.'};
 }
 if(selection==='video'||selection==='simulator')
  return {selection,phase:'lab',message:'Mode eksperimen terpisah; preview Footprints live belum memakai sumber ini.'};
 return {selection:null,phase:'idle',message:'Pilih sumber gerak.'};
}
export function requiresSourceRecheck(previous:FootprintsInputChoice|null,next:FootprintsInputChoice){
 return previous!==next;
}
export function canStartSourceSwitch(input:{busy:boolean;from:FootprintsInputChoice|null;to:FootprintsInputChoice}){
 return !input.busy&&input.from!==input.to;
}
