import type {ProjectionState} from './model';
export const OUTPUT_TIMEOUT=2800;
export type ProjectionControl=Omit<ProjectionState,'image'>;
export class ProjectionLink{
 readonly id=Array.from(crypto.getRandomValues(new Uint32Array(4)),n=>n.toString(16).padStart(8,'0')).join('');private channel:BroadcastChannel|null=null;private child:Window|null=null;private inFlight:number|null=null;private sequence=0;private lastControl=0;
 lastSeen=0;receivedFrames=0;renderer='';error='';outputInfo:{width:number;height:number;viewportWidth:number;viewportHeight:number;dpr:number;fps:number;p95Ms:number;frames:number;samples:number}|null=null;
 private ack=(event:MessageEvent)=>{if(event.origin!==location.origin||event.source!==this.child||event.data?.session!==this.id)return;if(event.data.type==='frame-ack'&&event.data.sequence===this.inFlight){this.inFlight=null;this.receivedFrames++;}};
 start(){if(this.channel)return;try{this.channel=new BroadcastChannel(`soma-body-projection-${this.id}`);this.channel.onmessage=e=>{const m=e.data;if(m?.session!==this.id)return;if(m.type==='hello'){this.inFlight=null;this.lastSeen=Date.now();}if(m.type==='heartbeat'){this.lastSeen=Date.now();this.renderer=String(m.renderer??'').slice(0,60);if(m.info&&['width','height','viewportWidth','viewportHeight','dpr','fps','p95Ms','frames','samples'].every(k=>Number.isFinite(m.info[k])&&m.info[k]>=0))this.outputInfo=m.info;}if(m.type==='closed')this.lastSeen=0;};window.addEventListener('message',this.ack);}catch{this.error='Komunikasi output belum tersedia pada browser ini.';}}
 open(){this.start();if(!this.channel)return false;const url=new URL('/',location.origin);url.searchParams.set('bodyProjection',this.id);this.child=window.open(url.toString(),`soma-body-${this.id}`,'popup,width=1280,height=720');this.inFlight=null;this.lastSeen=0;this.error=this.child?'':'Pop-up diblokir. Izinkan pop-up SOMA, lalu buka output lagi.';return !!this.child;}
 get opened(){return !!this.child&&!this.child.closed;}
 get connected(){return this.opened&&Date.now()-this.lastSeen<OUTPUT_TIMEOUT;}
 send(state:ProjectionState,now:number){
  if(!this.opened)return;
  if(now-this.lastControl>90){const {image:_,...control}=state;this.channel?.postMessage({type:'control',session:this.id,control});this.lastControl=now;}
  if(!this.connected||this.inFlight!==null||!state.image)return;
  const image=state.image,data=image.mask.data.slice(),sequence=++this.sequence;this.inFlight=sequence;
  try{this.child!.postMessage({type:'mask',session:this.id,sequence,width:image.mask.width,height:image.mask.height,aspect:image.aspect,time:image.time,rawBounds:image.rawBounds,bounds:image.bounds,processed:!!image.processed,buffer:data.buffer},location.origin,[data.buffer]);}catch{this.inFlight=null;this.error='Kirim siluet gagal. Buka ulang output.';}
 }
 closeOutput(){this.channel?.postMessage({type:'shutdown',session:this.id});this.child?.close();this.child=null;this.lastSeen=0;this.inFlight=null;}
 dispose(){this.closeOutput();this.channel?.close();this.channel=null;window.removeEventListener('message',this.ack);}
}
