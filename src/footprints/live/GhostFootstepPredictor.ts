import {insideFloor,type FloorSpace} from '../spatial/coordinates.ts';
import {validateFootstepEvent,type FootSide,type FootstepEvent} from '../spatial/events.ts';

type Key=string;
const key=(id:string,side:FootSide)=>id+':'+side;
const dist=(a:FootstepEvent,b:FootstepEvent)=>
 Math.hypot(b.positionM.xM-a.positionM.xM,b.positionM.yM-a.positionM.yM);
/**
 * Short-lived *hypothetical* next step based on earlier REAL contacts and
 * swing phase. Nothing here detects an airborne sole touching the floor.
 *
 * Every prediction is ephemeral; never write it into FloorSession.events.
 * Low confidence is intentional: artistic possible next position, not
 * measured gait/physical forecast. Expires on landing, loss, or timeout.
 */
export class GhostFootstepPredictor{
 private contactHistory=new Map<string,FootstepEvent[]>();
 private ghosts=new Map<Key,FootstepEvent>();
 private lastSeen=new Map<Key,number>();
 readonly ttlMs=450;
 constructor(private readonly floor:FloorSpace){}
 reset(){this.contactHistory.clear();this.ghosts.clear();this.lastSeen.clear();}
 lose(performerId:string){
  for(const k of [...this.ghosts.keys()])if(k.startsWith(performerId+':')){
   this.ghosts.delete(k);this.lastSeen.delete(k);
  }
 }
 accept(events:FootstepEvent[]){
  for(const e of events){
   if(e.kind!=='contact')continue;
   const history=this.contactHistory.get(e.performerId)??[];
   history.push(e);
   if(history.length>6)history.shift();
   this.contactHistory.set(e.performerId,history);
   this.ghosts.delete(key(e.performerId,e.foot));
   this.lastSeen.delete(key(e.performerId,e.foot));
  }
 }
 swing(performerId:string,foot:FootSide,nowMs:number,confidence:number):FootstepEvent|null{
  if(!Number.isFinite(nowMs)||nowMs<0||confidence<.6)return null;
  const k=key(performerId,foot);
  const history=this.contactHistory.get(performerId)??[];
  if(history.length<2||history.at(-1)!.foot===foot){
   this.ghosts.delete(k);return null;
  }
  const last=history.at(-1)!,previous=history.at(-2)!;
  const stride=dist(previous,last);
  if(stride<.12||stride>1.8||nowMs-last.timestampMs>1400){
   this.ghosts.delete(k);return null;
  }
  // Extrapolate the last alternation, capped to a short range; do not
  // pretend to know where the moving foot will actually land.
  const length=Math.min(.7,stride*.7);
  const dx=(last.positionM.xM-previous.positionM.xM)/stride;
  const dy=(last.positionM.yM-previous.positionM.yM)/stride;
  const candidate={xM:last.positionM.xM+dx*length,yM:last.positionM.yM+dy*length};
  if(!insideFloor(this.floor,candidate)){this.ghosts.delete(k);return null;}
  const ghost=validateFootstepEvent({
   id:'ghost-'+performerId+'-'+foot+'-'+Math.round(nowMs),
   performerId,foot,kind:'prediction',timestampMs:Math.max(nowMs,last.timestampMs),
   positionM:candidate,headingRad:Math.atan2(dy,dx),
   source:'camera',positionBasis:'calibrated-estimate',
   confidence:Math.min(.38,confidence*.35),joinPrevious:false
  },this.floor);
  this.ghosts.set(k,ghost);this.lastSeen.set(k,nowMs);return ghost;
 }
 get(nowMs:number):FootstepEvent[]{
  for(const [k,t] of this.lastSeen)if(nowMs<t||nowMs-t>this.ttlMs){
   this.ghosts.delete(k);this.lastSeen.delete(k);
  }
  return [...this.ghosts.values()].sort((a,b)=>a.timestampMs-b.timestampMs);
 }
}
