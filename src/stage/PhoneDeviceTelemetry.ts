/** S6.1.2 — browser-only diagnostic snapshots for one remote camera session.
 * Never exposes SDP, ICE candidate IPs, auth tokens, images or recordings.
 * WebRTC counters reflect the browser transport, NOT optical foot-to-light latency.
 */
export type PhoneLinkMode='qr'|'manual';
export type PhoneLinkState='offline'|'connecting'|'connected'|'interrupted';
export type PhoneTransportSample={
 mode:PhoneLinkMode|null;state:PhoneLinkState;reported:boolean;
 sampledAtMs:number;framesDecoded:number|null;fps:number|null;
 bytesReceived:number|null;packetsReceived:number|null;packetsLost:number|null;
 jitterMs:number|null;rttMs:number|null;frameWidth:number|null;frameHeight:number|null;
 reason:string;
};
export const PHONE_DIAGNOSTIC_TTL_MS=3500;
const blank=():PhoneTransportSample=>({mode:null,state:'offline',reported:false,
 sampledAtMs:0,framesDecoded:null,fps:null,bytesReceived:null,
 packetsReceived:null,packetsLost:null,jitterMs:null,rttMs:null,
 frameWidth:null,frameHeight:null,reason:'Belum ada sambungan HP.'});
let activeOwner:string|null=null;
let current:PhoneTransportSample=blank();
const listeners=new Set<()=>void>();
const emit=()=>{for(const fn of listeners)fn();};
export function subscribePhoneTransport(fn:()=>void):()=>void{
 listeners.add(fn);return()=>{listeners.delete(fn);};
}
export function claimPhoneTransport(owner:string,mode:PhoneLinkMode){
 if(!owner||!['qr','manual'].includes(mode))throw Error('Sesi kamera HP tidak valid.');
 activeOwner=owner;
 current={...blank(),mode,state:'connecting',reported:true,
 sampledAtMs:performance.now(),reason:'Sedang memasangkan kamera HP.'};
 emit();
}
export function reportPhoneTransport(owner:string,patch:Partial<PhoneTransportSample>){
 if(!owner||owner!==activeOwner)return;
 const nextTime=patch.sampledAtMs??performance.now();
 if(!Number.isFinite(nextTime)||nextTime<current.sampledAtMs)return;
 current={...current,...patch,mode:current.mode,reported:true,sampledAtMs:nextTime};
 emit();
}
export function releasePhoneTransport(owner:string,reason='Sambungan HP dihentikan.'){
 if(!owner||owner!==activeOwner)return;
 activeOwner=null;
 current={...blank(),reason};
 emit();
}
export function readPhoneTransport(now=performance.now()):PhoneTransportSample{
 const snap={...current};
 if(snap.reported&&(!Number.isFinite(now)||now<snap.sampledAtMs||
  now-snap.sampledAtMs>PHONE_DIAGNOSTIC_TTL_MS))
  return {...snap,state:'interrupted',reason:'Telemetry WebRTC kedaluwarsa.'};
 return snap;
}
type InboundLike={
 type:string;kind?:string;mediaType?:string;framesDecoded?:number;
 framesPerSecond?:number;packetsReceived?:number;packetsLost?:number;
 jitter?:number;bytesReceived?:number;frameWidth?:number;frameHeight?:number;
 selected?:boolean;nominated?:boolean;state?:string;currentRoundTripTime?:number;
};
const nonnegative=(value:unknown)=>typeof value==='number'&&
 Number.isFinite(value)&&value>=0?value:null;
const whole=(value:unknown)=>{const n=nonnegative(value);return n===null?null:Math.round(n);};
/** Extract only quantitative safe fields from getStats() — no network identifiers. */
export function extractPhoneRtpStats(stats:Iterable<InboundLike>):
 Pick<PhoneTransportSample,'framesDecoded'|'fps'|'packetsReceived'|'packetsLost'|
 'bytesReceived'|'jitterMs'|'rttMs'|'frameWidth'|'frameHeight'>{
 let inbound:InboundLike|null=null,network:InboundLike|null=null;
 for(const s of stats){
  if(s.type==='inbound-rtp'&&(s.kind==='video'||s.mediaType==='video')&&
   (!inbound||(s.framesDecoded??0)>(inbound.framesDecoded??0)))inbound=s;
  if(s.type==='candidate-pair'&&(s.selected===true||
   (s.nominated===true&&s.state==='succeeded')))network=s;
 }
 const ms=(value:unknown)=>{const n=nonnegative(value);return n===null?null:Math.round(n*1000*10)/10;};
 return {framesDecoded:whole(inbound?.framesDecoded),fps:nonnegative(inbound?.framesPerSecond),
  packetsReceived:whole(inbound?.packetsReceived),packetsLost:whole(inbound?.packetsLost),
  bytesReceived:whole(inbound?.bytesReceived),jitterMs:ms(inbound?.jitter),
  rttMs:ms(network?.currentRoundTripTime),
  frameWidth:whole(inbound?.frameWidth),frameHeight:whole(inbound?.frameHeight)};
}
export async function samplePhonePeer(owner:string,pc:RTCPeerConnection,mode:PhoneLinkMode){
 if(pc.connectionState!=='connected'){
  reportPhoneTransport(owner,{state:pc.connectionState==='failed'?'interrupted':'connecting',
   reason:'Koneksi WebRTC: '+pc.connectionState});
  return;
 }
 try{
  const stats=await pc.getStats();
  const parsed=extractPhoneRtpStats(stats.values() as Iterable<InboundLike>);
  reportPhoneTransport(owner,{...parsed,state:'connected',
   reason:'Statistik penerimaan WebRTC di laptop.'});
 }catch{
  reportPhoneTransport(owner,{state:'interrupted',
   reason:'Statistik WebRTC tidak tersedia; periksa sambungan.'});
 }
}
