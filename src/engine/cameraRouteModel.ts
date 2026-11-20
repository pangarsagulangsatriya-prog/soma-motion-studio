/** Camera source intent must not be confused with a physical USB cable.
 * Browsers only see videoinput devices made available by the operating system. */
export type CameraIntent='phone'|'other';
export type CameraLike=Pick<MediaDeviceInfo,'deviceId'|'label'>;

/** Labels are hints for selection only, never proof of the underlying cable. */
export function looksLikePhoneWebcam(label:string):boolean{
 return /iphone|continuity camera|android|pixel .*camera|droidcam|iriun|epoccam|camo camera|reincubate camo|ivcam|phone webcam/i.test(label);
}
export function looksLikeBuiltInCamera(label:string):boolean{
 return /facetime(?: hd)? camera|built-in (?:isight|camera)|integrated (?:camera|webcam)|macbook .*camera/i.test(label);
}
export function preferredCameraDevice(devices:readonly CameraLike[],intent:CameraIntent,storedId='',storedLabel=''):string{
 const valid=devices.filter(x=>!!x.deviceId);
 if(!valid.length)return '';
 // Restore an explicitly selected device. A phone never silently falls back
 // to a built-in FaceTime camera when the expected cable/Continuity device vanishes.
 const match=valid.find(x=>x.deviceId===storedId);
 if(match&&!(intent==='phone'&&looksLikeBuiltInCamera(match.label)))return match.deviceId;
 const labelMatch=storedLabel&&valid.find(x=>x.label===storedLabel&&
  !(intent==='phone'&&looksLikeBuiltInCamera(x.label)));
 if(labelMatch)return labelMatch.deviceId;
 if(intent==='phone'){
  const likely=valid.filter(x=>looksLikePhoneWebcam(x.label));
  return likely.length===1?likely[0].deviceId:'';
 }
 return valid.length===1?valid[0].deviceId:'';
}
export function prioritizedCameraDevices<T extends CameraLike>(devices:readonly T[],intent:CameraIntent):T[]{
 return [...devices].sort((a,b)=>{
  if(intent==='phone'){
   const priority=(x:T)=>looksLikePhoneWebcam(x.label)?0:looksLikeBuiltInCamera(x.label)?2:1;
   if(priority(a)!==priority(b))return priority(a)-priority(b);
  }
  return a.label.localeCompare(b.label,'id',{sensitivity:'base'});
 });
}
export const cameraPathHelp=(intent:CameraIntent)=>intent==='phone'?
 'iPhone: aktifkan Continuity Camera dan percayai Mac. Android: pilih USB → Webcam pada HP jika tersedia. Kabel saja tidak otomatis menyalurkan video.':
 'Webcam/DSLR/HDMI/OBS/NDI perlu muncul sebagai kamera di macOS sebelum bisa dipilih SOMA.';
