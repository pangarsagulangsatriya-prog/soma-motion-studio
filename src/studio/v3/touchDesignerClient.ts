import {TD_BRIDGE_INTERVAL_MS,TD_BRIDGE_SCHEMA,TD_BRIDGE_VERSION,TD_BRIDGE_MAX_BYTES,
 buildTdState,normalizeTdEndpoint,tdNewEvents,type TdSnapshot,type TdPacket,type TdControl} from './touchDesignerProtocol.ts';

export type TdConnectionStatus='idle'|'connecting'|'connected'|'streaming'|'error'|'disconnected';
export type TdBridgeStatus={status:TdConnectionStatus;message:string;sentEvents:number;fps:number};
export type TdSocket=Pick<WebSocket,'readyState'|'bufferedAmount'|'send'|'close'|'onopen'|'onmessage'|'onerror'|'onclose'>;
export type TdSocketFactory=(url:string)=>TdSocket;
const INITIAL:TdBridgeStatus={status:'idle',message:'Belum terhubung',sentEvents:0,fps:0};
const OPEN=1,MAX_BUFFERED=64_000;
const MAX_SENT_IDS=1500;
export class TouchDesignerClient{
 private socket:TdSocket|null=null;
 private sessionId='';private nonce='';private seq=0;private generation=-1;private sampleSession='';
 private sent=new Set<string>();private sentOrder:string[]=[];
 private current:TdBridgeStatus={...INITIAL};private streaming=false;private lastStateMs=0;
 private lastHeartbeatMs=0;private latestSource:string|null=null;
 private handshakeTimer:ReturnType<typeof setTimeout>|null=null;
 private countWindow=0;private countFrames=0;
 private onUpdate:(status:TdBridgeStatus)=>void;
 private socketFactory:TdSocketFactory;
 constructor(onUpdate:(status:TdBridgeStatus)=>void,
  socketFactory:TdSocketFactory=(url)=>new WebSocket(url)){this.onUpdate=onUpdate;this.socketFactory=socketFactory;}
 get status(){return {...this.current};}
 private notify(status:TdConnectionStatus,message:string,extra:Partial<TdBridgeStatus>={}){
  this.current={...this.current,status,message,...extra};this.onUpdate({...this.current});
 }
 private send(packet:TdPacket):boolean{
  if(this.socket?.readyState!==OPEN||this.socket.bufferedAmount>MAX_BUFFERED)return false;
  const data=JSON.stringify(packet);
  if(data.length>TD_BRIDGE_MAX_BYTES)return false;
  try{this.socket.send(data);return true;}catch{return false;}
 }
 private header(){return {schema:TD_BRIDGE_SCHEMA,version:TD_BRIDGE_VERSION,sessionId:this.sessionId,generation:Math.max(0,this.generation),seq:++this.seq};}
 connect(address:string,token:string){
  const endpoint=normalizeTdEndpoint(address);
  if(!endpoint){this.notify('error','Gunakan alamat lokal, misalnya 127.0.0.1:8765.');return false;}
  if(!/^[A-Za-z0-9_-]{12,128}$/.test(token.trim())){
   this.notify('error','Masukkan kode sesi dari TouchDesigner (minimal 12 karakter).');return false;
  }
  this.disconnect(false);
  this.streaming=false;this.seq=0;this.generation=-1;this.sampleSession='';this.sent.clear();this.sentOrder=[];
  this.current={...INITIAL};this.sessionId='soma-'+crypto.randomUUID();this.nonce=crypto.randomUUID();
  let socket:TdSocket;
  try{socket=this.socketFactory(endpoint)}catch{this.notify('error','Gagal membuka WebSocket. Periksa alamat dan izin jaringan lokal.');return false;}
  this.socket=socket;this.notify('connecting','Menghubungkan ke TouchDesigner…');
  socket.onopen=()=>{
   if(this.socket!==socket)return;
   const hello={schema:TD_BRIDGE_SCHEMA,version:TD_BRIDGE_VERSION,type:'hello' as const,
    sessionId:this.sessionId,nonce:this.nonce,token:token.trim()};
   if(!this.send(hello)){this.fail('Gagal mengirim handshake TouchDesigner.');return;}
  };
  socket.onmessage=(event)=>{
   if(this.socket!==socket||typeof event.data!=='string'||event.data.length>2048)return;
   try{
    const data=JSON.parse(event.data) as Record<string,unknown>;
    if(data.schema!==TD_BRIDGE_SCHEMA||data.version!==TD_BRIDGE_VERSION||
     data.type!=='hello-ack'||data.sessionId!==this.sessionId||data.nonce!==this.nonce)return;
    if(this.current.status==='connecting'){
     this.clearHandshake();this.notify('connected','Terhubung. Data belum dikirim.');
    }
   }catch{/* Ignore untrusted packets */}
  };
  socket.onerror=()=>{if(this.socket===socket)this.fail('WebSocket gagal. Pastikan TD Web Server DAT aktif dan izin jaringan lokal diberikan.');};
  socket.onclose=()=>{if(this.socket===socket)this.fail('Koneksi TouchDesigner terputus. Buka kembali secara manual.');};
  this.handshakeTimer=setTimeout(()=>{
   if(this.socket===socket&&this.current.status==='connecting')this.fail('Tidak ada balasan handshake dari TD dalam 5 detik.');
  },5000);
  return true;
 }
 private clearHandshake(){if(this.handshakeTimer!==null)clearTimeout(this.handshakeTimer);this.handshakeTimer=null;}
 private fail(message:string){
  this.clearHandshake();this.streaming=false;
  const sock=this.socket;this.socket=null;
  if(sock){sock.onclose=null;sock.onerror=null;sock.onmessage=null;sock.onopen=null;try{sock.close();}catch{}}
  this.notify('error',message,{fps:0});
 }
 private control(action:TdControl['action'],cue?:{index:number;label:string}){
  return this.send({...this.header(),type:'control',action,...(cue?{cue}:{})});
 }
 start(snapshot:TdSnapshot){
  if(this.current.status!=='connected'||!snapshot.ready||!snapshot.source){
   this.notify(this.current.status,'Sumber Track belum siap. Periksa kamera atau MP4.');return false;
  }
  this.streaming=true;this.generation=snapshot.generation;this.sampleSession=snapshot.sessionId;
  this.latestSource=snapshot.source;this.sent.clear();this.sentOrder=[];
  this.seedEvents(snapshot);this.control('reset');
  this.notify('streaming','Mengirim data gerak. Proyektor TD tetap memerlukan izin operator.');
  return true;
 }
 private seedEvents(snapshot:TdSnapshot){
  for(const e of snapshot.events){this.sent.add(e.eventId);this.sentOrder.push(e.eventId);}
  while(this.sentOrder.length>MAX_SENT_IDS)this.sent.delete(this.sentOrder.shift()!);
 }
 tick(snapshot:TdSnapshot){
  if(!this.socket||this.socket.readyState!==OPEN||!['connected','streaming'].includes(this.current.status))return;
  const now=performance.now();
  if(now-this.lastHeartbeatMs>=500){this.send({...this.header(),type:'heartbeat',atMs:now});this.lastHeartbeatMs=now;}
  if(!this.streaming)return;
  if(!snapshot.ready||!snapshot.source||!snapshot.sessionId){
   this.control('reset');this.streaming=false;this.notify('connected','Sumber berhenti. Data ditahan; aktifkan ulang setelah siap.',{fps:0});return;
  }
  if(this.generation!==snapshot.generation||this.sampleSession!==snapshot.sessionId||
   this.latestSource!==snapshot.source){
   this.generation=snapshot.generation;this.sampleSession=snapshot.sessionId;
   this.latestSource=snapshot.source;this.sent.clear();this.sentOrder=[];this.seedEvents(snapshot);
   this.control('reset');
   this.streaming=false;this.notify('connected','Sumber berubah. Periksa identitas lalu tekan Mulai Kirim lagi.',{fps:0});return;
  }
  // Never enqueue stale frames or events across an overwhelmed browser socket.
  if(this.socket.bufferedAmount>MAX_BUFFERED){this.control('reset');this.streaming=false;
   this.notify('connected','Sambungan lambat. Data dihentikan; periksa TD lalu mulai kembali.',{fps:0});return;}
  const state=buildTdState(snapshot,0);
  if(!state)return;
  // State first: the TD receiver requires a current source frame before accepting real contact triggers.
  const stateSent=this.send({...state,...this.header(),type:'state'});
  if(!stateSent){this.control('reset');this.streaming=false;
   this.notify('connected','State gagal terkirim. Periksa koneksi dan mulai ulang.',{fps:0});return;}
  const events=tdNewEvents(snapshot,this.sent);
  for(const event of events){
   const ok=this.send({...this.header(),type:'event',event});
   if(!ok){this.control('reset');this.streaming=false;this.notify('connected','Pengiriman event terganggu. Periksa TD, lalu mulai kembali.',{fps:0});return;}
   this.sent.add(event.eventId);this.sentOrder.push(event.eventId);
  }
  while(this.sentOrder.length>MAX_SENT_IDS)this.sent.delete(this.sentOrder.shift()!);
  this.countFrames++;this.current.sentEvents+=events.length;
  if(now-this.countWindow>=1000){this.current.fps=this.countFrames*1000/Math.max(1,now-this.countWindow);
   this.countFrames=0;this.countWindow=now;this.onUpdate({...this.current});}
  this.lastStateMs=now;
 }
 testTrigger(){
  if(!['connected','streaming'].includes(this.current.status))return false;
  const header=this.header();
  const now=performance.now();
  return this.send({...header,type:'event',test:true,event:{
   schema:'soma.foot-motion-event',version:2,eventId:`test:${header.seq}:${crypto.randomUUID()}`,
   originEventId:`test-${header.seq}`,sessionId:header.sessionId,generation:header.generation,
   actorId:'A',foot:'left',kind:'contact',source:'simulator',x:.5,y:.5,
   atMs:now,speed:0,confidence:1,verified:true,verification:'simulated',coordinateBasis:'simulated'
  }});
 }
 cue(index:number,label:string){if(this.streaming)this.control('cue',{index,label:label.slice(0,44)});}
 blackout(){
  if(this.socket?.readyState===OPEN)this.control('blackout');
  this.streaming=false;
  if(this.current.status==='streaming')this.notify('connected','BLACKOUT dikirim. Kirim data kembali secara manual.',{fps:0});
 }
 stop(){if(this.streaming||this.current.status==='connected')this.control('stop');
  this.streaming=false;if(this.current.status==='streaming')this.notify('connected','Pengiriman dihentikan.',{fps:0});}
 disconnect(notify=true){
  this.clearHandshake();if(this.socket?.readyState===OPEN){this.control('blackout');this.control('stop');}
  const socket=this.socket;this.socket=null;this.streaming=false;
  if(socket){socket.onclose=null;socket.onerror=null;socket.onmessage=null;socket.onopen=null;try{socket.close();}catch{}}
  if(notify)this.notify('disconnected','Terputus. Koneksi tidak dilanjutkan otomatis.',{fps:0});
 }
 dispose(){this.disconnect(false);}
}
export const touchDesignerTickMs=TD_BRIDGE_INTERVAL_MS;
