import {validFootMotionEvent,type FootMotionEventV2} from '../scenes/FootMotionEventV2.ts';
import type {FloorInteractionEngine,FloorFootObservation} from '../scenes/FloorInteractionEngine.ts';

export const TD_SCHEMA='soma.td-bridge';
export type BridgeContext={ready:boolean;calibrationKey:string;floor:{widthM:number;depthM:number}|null;cue:{index:number;label:string}};
export type BridgeStatus={phase:'disconnected'|'connecting'|'connected'|'streaming'|'error';message:string;hz:number;events:number;ready:boolean};
type Socket=Pick<WebSocket,'readyState'|'bufferedAmount'|'send'|'close'|'onopen'|'onmessage'|'onclose'|'onerror'>;
const coordinateSpace=(basis:string)=>basis==='calibrated-estimate'?'floor-uv':basis==='simulated'?'simulated-floor-uv':'image-uv';
export function localBridgeUrl(input:string){
 const url=new URL(input.includes('://')?input:'ws://'+input);
 if(!['ws:','wss:'].includes(url.protocol)||!['localhost','127.0.0.1','[::1]'].includes(url.hostname)||url.username||url.password||url.search||url.hash)
  throw Error('Gunakan alamat lokal ws://127.0.0.1:8765.');
 return url.href;
}
/** One connection, no replay queue. Receiver must separately arm its own output. */
export class TouchDesignerBridge{
 private socket:Socket|null=null;
 private listeners=new Set<()=>void>();
 private state:BridgeStatus={phase:'disconnected',message:'Belum terhubung',hz:0,events:0,ready:false};
 private engine:FloorInteractionEngine|null=null;
 private context:BridgeContext={ready:false,calibrationKey:'',floor:null,cue:{index:0,label:''}};
 private unsubscribe:(()=>void)|null=null;
 private connectionId='';private seq=0;private sessionId='';private generation=0;
 private connectedAt=0;private lastAck=0;private lastHeartbeat=0;private lastState=0;
 private rateAt=0;private stateCount=0;private eventCount=0;private cueKey='';private calibrationKey='';
 private seen=new Set<string>();private sampleTimes=new Map<string,{atMs:number;receivedAt:number}>();
 private phases=new Map<string,{event:FootMotionEventV2;receivedAt:number}>();
 private testSerial=0;
 private makeSocket:(url:string)=>Socket;
 private now:()=>number;
 constructor(makeSocket:(url:string)=>Socket=url=>new WebSocket(url),now:()=>number=()=>performance.now()){this.makeSocket=makeSocket;this.now=now;}
 subscribe=(listener:()=>void)=>{this.listeners.add(listener);return()=>{this.listeners.delete(listener);};};
 getSnapshot=()=>this.state;
 private status(patch:Partial<BridgeStatus>){this.state={...this.state,...patch};for(const listener of this.listeners)listener();}
 attach(engine:FloorInteractionEngine){
  this.unsubscribe?.();this.engine=engine;
  this.syncSession();
  this.unsubscribe=engine.subscribe(event=>{
   if(!event){this.syncSession();return;}
   if(!this.context.ready||this.state.phase!=='streaming'||!validFootMotionEvent(event))return;
   // Only newly produced events; existing bus history is never replayed on start.
   if(event.actorId.startsWith('unassigned-')||event.foot==='unknown'||!['contact','slide','pivot','release','lift'].includes(event.kind))return;
   if(this.seen.has(event.eventId)||event.kind==='contact'&&!event.verified)return;
   this.seen.add(event.eventId);if(this.seen.size>4096)this.seen.delete(this.seen.values().next().value!);
   this.phases.set(event.actorId+':'+event.foot,{event,receivedAt:this.now()});
   if(this.send('event',{event,coordinateSpace:coordinateSpace(event.coordinateBasis),test:event.source==='simulator'||event.source==='touch'}))this.eventCount++;
  });
 }
 private syncSession(){
  if(!this.engine)return;
  if(this.sessionId===this.engine.currentSessionId&&this.generation===this.engine.generation)return;
  this.sessionId=this.engine.currentSessionId;this.generation=this.engine.generation;
  this.seen.clear();this.sampleTimes.clear();this.phases.clear();
  if(this.state.phase==='streaming'){this.send('control',{action:'reset',reason:'source-generation'});this.stop();}
 }
 connect(address:string,token:string){
  this.disconnect();
  try{
   const url=localBridgeUrl(address);
   if(token.trim().length<12)throw Error('Salin kode pairing dari penerima TouchDesigner (minimal 12 karakter).');
   this.connectionId=globalThis.crypto.randomUUID();this.seq=0;
   this.connectedAt=this.now();this.lastAck=this.connectedAt;this.lastHeartbeat=0;
   this.status({phase:'connecting',message:'Menghubungkan…',hz:0,events:0});
   const socket=this.makeSocket(url);this.socket=socket;
   socket.onopen=()=>{
    if(this.socket!==socket)return;
    this.send('hello',{token:token.trim(),origin:typeof location==='undefined'?'test':location.origin});
   };
   socket.onmessage=message=>{
    if(this.socket!==socket||typeof message.data!=='string'||message.data.length>16384)return;
    try{
     const packet=JSON.parse(message.data);
     if(packet.schema!==TD_SCHEMA||packet.version!==1||packet.connectionId!==this.connectionId)return;
     if(packet.type==='hello-ack'&&this.state.phase==='connecting'){
      this.lastAck=this.now();this.status({phase:'connected',message:'Terhubung · data berhenti'});
     }else if(packet.type==='heartbeat-ack'&&Number.isSafeInteger(packet.ackSeq)&&packet.ackSeq>0&&packet.ackSeq<=this.seq){this.lastAck=this.now();}
     else if(packet.type==='error')this.fail('Penerima menolak koneksi atau paket. Periksa kode pairing.');
    }catch{/* Malformed responses never activate the sender. */}
   };
   socket.onclose=()=>{if(this.socket===socket){this.socket=null;this.status({phase:'disconnected',message:'Terputus · hubungkan ulang',hz:0});}};
   socket.onerror=()=>{if(this.socket===socket)this.fail('Koneksi gagal. Jalankan receiver dan izinkan akses jaringan lokal di browser.');};
  }catch(error){this.fail(error instanceof Error?error.message:String(error));}
 }
 private send(type:string,data:Record<string,unknown>={}){
  if(!this.socket||this.socket.readyState!==1)return false;
  if(this.socket.bufferedAmount>65536){this.fail('Koneksi tertahan · pengiriman dihentikan');return false;}
  try{
   this.socket.send(JSON.stringify({schema:TD_SCHEMA,version:1,type,connectionId:this.connectionId,
    sessionId:this.sessionId,generation:this.generation,seq:++this.seq,atMs:this.now(),...data}));
   return true;
  }catch{this.fail('Pengiriman gagal · hubungkan ulang');return false;}
 }
 private fail(message:string){
  const socket=this.socket;this.socket=null;socket?.close();
  this.status({phase:'error',message,hz:0});
 }
 start(){
  if(this.state.phase!=='connected'||!this.state.ready)return false;
  this.seen.clear();this.phases.clear();this.eventCount=0;this.stateCount=0;this.rateAt=this.now();this.lastState=-Infinity;
  if(!this.send('control',{action:'start'}))return false;
  this.status({phase:'streaming',message:'Mengirim data · output TD dikendalikan terpisah'});return true;
 }
 stop(action:'stop'|'blackout'='stop'){
  if(['connected','streaming'].includes(this.state.phase)){
   this.send('control',{action});
   if(this.state.phase!=='error')this.status({phase:'connected',message:action==='blackout'?'Blackout · data berhenti':'Terhubung · data berhenti',hz:0});
  }
  this.phases.clear();
 }
 test(){
  if(!['connected','streaming'].includes(this.state.phase))return;
  this.send('event',{test:true,coordinateSpace:'simulated-floor-uv',event:{
   eventId:'test-'+this.connectionId+'-'+(++this.testSerial),actorId:'A',foot:'left',kind:'contact',
   x:.5,y:.5,confidence:1,source:'touch',coordinateBasis:'simulated',verification:'simulated',verified:true,
   atMs:this.now(),sessionId:this.sessionId,generation:this.generation
  }});
 }
 tick(context:BridgeContext){
  this.context=context;this.syncSession();const now=this.now();
  const ready=context.ready&&!!this.engine?.activeSource;
  if(ready!==this.state.ready)this.status({ready});
  if(this.calibrationKey!==context.calibrationKey){
   this.calibrationKey=context.calibrationKey;
   if(this.state.phase==='streaming'){this.send('control',{action:'reset',reason:'calibration'});this.stop();}
   this.sampleTimes.clear();this.phases.clear();
  }
  if(this.state.phase==='connecting'&&now-this.connectedAt>5000){this.fail('Tidak ada jawaban receiver. Periksa alamat dan kode pairing.');return;}
  if(!['connected','streaming'].includes(this.state.phase))return;
  if(now-this.lastAck>1500){this.fail('Receiver tidak menjawab · pengiriman dihentikan');return;}
  if(now-this.lastHeartbeat>=500){this.lastHeartbeat=now;this.send('heartbeat');}
  if(!ready&&this.state.phase==='streaming'){this.send('control',{action:'reset',reason:'source-unavailable'});this.stop();}
  const cue=JSON.stringify(context.cue);
  if(cue!==this.cueKey){this.cueKey=cue;this.send('control',{action:'cue',cue:context.cue});}
  if(this.state.phase!=='streaming'||now-this.lastState<50)return;
  this.lastState=now;
  const engine=this.engine!;
  const observed=engine.feet;
  const visible=new Set(engine.snapshot.actors);
  const actors=Array.from(visible).slice(0,2).map(id=>{
   const uncertain=id.startsWith('unassigned-');
   const feet={left:null as ReturnType<TouchDesignerBridge['foot']>,right:null as ReturnType<TouchDesignerBridge['foot']>};
   if(!uncertain)for(const side of ['left','right'] as const){
    const sample=observed.find(o=>o.actorId===id&&o.foot===side);
    if(sample)feet[side]=this.foot(sample,now);
   }
   const confidence=Math.max(feet.left?.confidence??0,feet.right?.confidence??0);
   return {id,tracking:uncertain?'identity-uncertain':confidence>0?'visible':'lost',confidence,feet};
  });
  if(this.send('state',{source:engine.activeSource,mode:['video','simulator','touch'].includes(engine.activeSource??'')?'rehearsal':'live',
   coordinateSpace:'per-foot',floor:context.floor,actors,sourceFresh:ready}))this.stateCount++;
  if(now-this.rateAt>=1000){
   this.status({hz:Math.round(this.stateCount*1000/(now-this.rateAt)),events:this.eventCount});
   this.rateAt=now;this.stateCount=0;
  }
 }
 private foot(sample:FloorFootObservation,now:number){
  const key=sample.actorId+':'+sample.foot;
  let clock=this.sampleTimes.get(key);
  if(!clock||clock.atMs!==sample.atMs){clock={atMs:sample.atMs,receivedAt:now};this.sampleTimes.set(key,clock);}
  if(now-clock.receivedAt>600)return null;
  const phase=this.phases.get(key);
  return {x:sample.x,y:sample.y,confidence:sample.confidence,atMs:sample.atMs,
   coordinateSpace:coordinateSpace(sample.basis),coordinateBasis:sample.basis,
   status:phase&&now-phase.receivedAt<=600?phase.event.kind:null,
   headingRad:sample.headingRad??null};
 }
 disconnect(){
  this.stop();const socket=this.socket;this.socket=null;socket?.close();
  this.status({phase:'disconnected',message:'Belum terhubung',hz:0});
 }
 dispose(){this.disconnect();this.unsubscribe?.();this.unsubscribe=null;}
}
