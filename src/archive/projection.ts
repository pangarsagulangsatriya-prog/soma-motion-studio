import type {RenderState} from './types.ts';
type Message={type:'hello'|'heartbeat'|'state'|'closed';sessionId:string;sentAt:number;state?:RenderState};
export class ProjectionChannel{
 private channel:BroadcastChannel|null=null;private heartbeat:ReturnType<typeof setInterval>|null=null;lastSeen=0;opened=false;error='';
 constructor(readonly sessionId:string){}
 start(){if(this.channel)return;try{this.channel=new BroadcastChannel(`soma-archive-${this.sessionId}`);this.channel.onmessage=e=>{const m=e.data as Message;if(m.sessionId===this.sessionId&&(m.type==='hello'||m.type==='heartbeat'))this.lastSeen=Date.now();if(m.type==='closed')this.lastSeen=0;};}catch{this.error='Komunikasi antarjendela belum tersedia. Gunakan Clean di jendela ini.';}}
 open(){this.start();const url=new URL(location.href);url.search='';url.hash='';url.searchParams.set('projection',this.sessionId);const child=window.open(url.toString(),`soma-archive-${this.sessionId}`,'popup,width=1280,height=720');this.opened=!!child;if(!child)this.error='Pop-up diblokir. Izinkan pop-up untuk SOMA, atau gunakan Clean.';return !!child;}
 get connected(){return this.opened&&Date.now()-this.lastSeen<3500;}
 send(state:RenderState){this.channel?.postMessage({type:'state',sessionId:this.sessionId,sentAt:Date.now(),state} satisfies Message);}
 close(){this.channel?.close();this.channel=null;if(this.heartbeat)clearInterval(this.heartbeat);}
}
