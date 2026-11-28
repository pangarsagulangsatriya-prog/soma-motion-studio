export type F3SessionState='IDLE'|'CONNECTING'|'READY'|'REHEARSAL'|'ARMED'|'CAPTURING'|'REVIEW'|'COMPLETE'|'DISARMED'|'BLOCKED';
/** Viewport mode must never change shutter authorization. */
export class F3SessionMachine{
 state:F3SessionState='IDLE';
 consent=false;
 verified=false;
 private events=new Set<string>();
 private busy=false;
 setDevices(a:boolean,b:boolean){
  if(!a||!b){this.state='BLOCKED';this.busy=false;return;}
  if(this.state==='IDLE'||this.state==='CONNECTING'||this.state==='BLOCKED')
   this.state='READY';
 }
 setConsent(value:boolean){this.consent=value;if(!value)this.disarm();}
 setVerified(value:boolean){this.verified=value;if(!value)this.disarm();}
 startRehearsal(){this.state='REHEARSAL';}
 arm(aFresh:boolean,bFresh:boolean){
  if(!this.consent||!aFresh||!bFresh)return false;
  this.state='ARMED';return true;
 }
 disarm(){this.state='DISARMED';this.busy=false;}
 canCapture(aFresh:boolean,bFresh:boolean,slotAvailable:boolean){
  return this.state==='ARMED'&&this.consent&&aFresh&&bFresh&&slotAvailable&&!this.busy;
 }
 begin(eventId:string,aFresh:boolean,bFresh:boolean,slotAvailable:boolean){
  if(this.events.has(eventId)||!this.canCapture(aFresh,bFresh,slotAvailable))return false;
  this.busy=true;this.state='CAPTURING';this.events.add(eventId);return true;
 }
 complete(count:number){this.busy=false;this.state=count>=4?'COMPLETE':'REVIEW';}
 readyAgain(){if(this.state==='REVIEW'&&this.consent)this.state='ARMED';}
 failed(){this.busy=false;this.state='DISARMED';}
}
