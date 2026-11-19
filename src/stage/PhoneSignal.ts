/** S6.1: dependency-free, end-to-end encrypted WebRTC camera transport.
 * SDP is exchanged explicitly in the MVP. No video/SDP is uploaded to SOMA.
 */
export type PhoneSignal={type:'offer'|'answer';sdp:string};
export const PHONE_CAMERA_PATH='/?phoneCamera=1';
export const ICE_SERVERS:RTCConfiguration={iceServers:[
 {urls:'stun:stun.l.google.com:19302'}
]};
export function parsePhoneSignal(text:string,expected:PhoneSignal['type']):PhoneSignal{
 if(text.length>100000)throw new Error('Kode koneksi terlalu besar.');
 let parsed:unknown;
 try{
  const raw=text.trim();
  const source=raw.startsWith('{')?raw:
   atob(raw.replace(/-/g,'+').replace(/_/g,'/'));
  parsed=JSON.parse(source);
 }catch{throw new Error('Kode WebRTC belum valid. Salin seluruh kode koneksi.');}
 const data=parsed as Partial<PhoneSignal>|null;
 if(!data||data.type!==expected||typeof data.sdp!=='string'||
  data.sdp.length<40||data.sdp.length>90000||
  !data.sdp.startsWith('v=0'))throw new Error('Jenis/format kode koneksi tidak cocok.');
 return {type:expected,sdp:data.sdp};
}
export function encodePhoneSignal(desc:RTCSessionDescriptionInit):string{
 if(!desc.sdp||!desc.type||!['offer','answer'].includes(desc.type))
  throw new Error('Deskripsi WebRTC belum tersedia.');
 const json=JSON.stringify({type:desc.type,sdp:desc.sdp});
 return btoa(json).replace(/\+/g,'-').replace(/\//g,'_').replace(/=+$/,'');
}
export async function collectPhoneIce(pc:RTCPeerConnection,timeoutMs=12000):Promise<void>{
 if(pc.iceGatheringState==='complete')return;
 await new Promise<void>((resolve,reject)=>{
  let settled=false;
  const cleanup=()=>{pc.removeEventListener('icegatheringstatechange',check);
   pc.removeEventListener('connectionstatechange',closed);clearTimeout(timeout);};
  const finish=(error?:Error)=>{if(settled)return;settled=true;cleanup();error?reject(error):resolve();};
  const check=()=>{if(pc.iceGatheringState==='complete')finish();};
  const closed=()=>{if(pc.connectionState==='closed'||pc.connectionState==='failed')
   finish(new Error('Sesi koneksi ditutup sebelum selesai.'));};
  const timeout=setTimeout(()=>finish(new Error(
   'Pengumpulan alamat WebRTC terlalu lama. Periksa jaringan lalu ulangi pairing.')),timeoutMs);
  pc.addEventListener('icegatheringstatechange',check);
  pc.addEventListener('connectionstatechange',closed);
  check();
 });
}
/** The manual camera page must stay under a static-host base path (e.g.
 * GitHub Pages /soma-motion-studio/). Vercel continues using root '/'.
 */
export const phoneCameraUrl=(origin:string,basePath='/')=>{
 const base=new URL(basePath,origin);
 const url=new URL(base.toString());
 url.searchParams.set('phoneCamera','1');
 url.hash='';
 return url.toString();
};
