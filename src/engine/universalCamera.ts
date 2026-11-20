/** CAM-01: Every OS-exposed videoinput is handled by one registry.
 * HDMI capture cards, NDI/OBS virtual cameras and USB phone webcams are not
 * special browser transports. Never claim to know the physical cable type. */
export type CameraDeviceInfo={deviceId:string;label:string;kind:'videoinput'};
export type CameraCaptureProfile='wide-720'|'wide-480'|'compatible';

export function cameraDeviceLabel(device:Pick<CameraDeviceInfo,'label'>,index:number):string{
 return device.label.trim()||`Kamera ${index+1} · izinkan kamera untuk melihat nama`;
}
export function normalizeCameraDevices<T extends Pick<MediaDeviceInfo,'kind'|'deviceId'|'label'>>(devices:readonly T[]):T[]{
 const seen=new Set<string>();
 return devices.filter(d=>{
  if(d.kind!=='videoinput'||!d.deviceId||seen.has(d.deviceId))return false;
  seen.add(d.deviceId);return true;
 }).sort((a,b)=>a.label.localeCompare(b.label,'id',{sensitivity:'base'}));
}
export function captureProfiles(deviceId:string):Array<{name:CameraCaptureProfile;video:MediaTrackConstraints}>{
 if(!deviceId)throw Error('Pilih kamera dari daftar.');
 const device={exact:deviceId};
 return [
  {name:'wide-720',video:{deviceId:device,width:{ideal:1280,min:960},height:{ideal:720,min:540},aspectRatio:{ideal:16/9},frameRate:{ideal:30,max:30}}},
  {name:'wide-480',video:{deviceId:device,width:{ideal:854},height:{ideal:480},aspectRatio:{ideal:16/9},frameRate:{ideal:24,max:30}}},
  {name:'compatible',video:{deviceId:device}}
 ];
}
export function cameraErrorMessage(error:unknown):string{
 const e=error as {name?:string;message?:string};
 switch(e?.name){
 case 'NotAllowedError':case 'SecurityError':return 'Izin kamera ditolak. Aktifkan izin kamera di browser.';
 case 'NotFoundError':return 'Kamera tidak ditemukan. Periksa kabel, mode webcam, atau kamera virtual.';
 case 'NotReadableError':case 'AbortError':return 'Kamera sedang dipakai atau sinyal capture terputus. Periksa aplikasi dan kabel.';
 case 'OverconstrainedError':return 'Resolusi kamera tidak didukung. Pilih kamera lain atau periksa pengaturan capture.';
 default:return e?.message||'Kamera belum dapat dihubungkan.';
 }
}
/** Falls back only for unsupported constraints, never for denied permissions. */
export async function openUniversalCamera(media:Pick<MediaDevices,'getUserMedia'>,deviceId:string):
 Promise<{stream:MediaStream;profile:CameraCaptureProfile}>{
 let lastError:unknown=null;
 for(const profile of captureProfiles(deviceId)){
  try{
   const stream=await media.getUserMedia({audio:false,video:profile.video});
   const track=stream.getVideoTracks()[0];
   if(!track||track.readyState!=='live'){
    stream.getTracks().forEach(t=>t.stop());
    throw Error('Perangkat tidak mengirim frame video.');
   }
   return {stream,profile:profile.name};
  }catch(error){
   lastError=error;
   const name=(error as {name?:string})?.name;
   if(name!=='OverconstrainedError'&&name!=='TypeError')throw error;
  }
 }
 throw lastError??Error('Kamera gagal dibuka.');
}
