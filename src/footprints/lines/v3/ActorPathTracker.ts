import type {ActorChannel} from './ActorPaletteResolver.ts';
import type {ActorPathObservation,PathPoint} from './PathObservationRouter.ts';
export type PathEventKind='START'|'ADD'|'TURN'|'STOP'|'CUT';
export type PathEvent={
 kind:PathEventKind;actorId:ActorChannel;strokeId:string;
 timeMs:number;point:PathPoint;sourceKey:string;clipStableId:string;
 epoch:number;confidence:number;provenance:ActorPathObservation['provenance'];
 turnRad?:number;reason?:string;
 footEvent?:ActorPathObservation['footEvent'];
 motionBasis?:ActorPathObservation['motionBasis'];
};
type State={strokeId:string;last:ActorPathObservation;lastMoveAt:number;
 lastPoint:PathPoint;lastDirection?:number;stopped:boolean;lastMotionAt:number};
const dist=(a:PathPoint,b:PathPoint)=>Math.hypot(a.x-b.x,a.y-b.y);
const angle=(a:number,b:number)=>Math.atan2(Math.sin(b-a),Math.cos(b-a));
const gapLimit=(sourceKey:string)=>sourceKey.startsWith('video:')?900:500;
const stepLimit=(dt:number)=>Math.min(220,42+dt*.30);
export class ActorPathTracker{
 private tracks=new Map<ActorChannel,State>();
 private nextId=0;
 private cuts=new Map<string,number>();
 get activeCount(){return this.tracks.size;}
 get cutDiagnostics(){return Object.fromEntries(this.cuts);}
 private countCut(reason:string){this.cuts.set(reason,(this.cuts.get(reason)??0)+1);}
 cutAll(reason:string):PathEvent[]{
  const events=[...this.tracks.entries()].map(([actor,state]):PathEvent=>({
   kind:'CUT',actorId:actor,strokeId:state.strokeId,timeMs:state.last.timeMs,
   point:state.lastPoint,sourceKey:state.last.sourceKey,
   clipStableId:state.last.clipStableId,epoch:state.last.epoch,
   confidence:state.last.confidence,provenance:state.last.provenance,reason
  }));
  this.tracks.clear();if(events.length)this.countCut(reason);return events;
 }
 ingest(observations:readonly ActorPathObservation[],timeMs:number):PathEvent[]{
  const events:PathEvent[]=[];
  const seen=new Set<ActorChannel>();
  for(const obs of observations){
   if(!Number.isFinite(obs.timeMs)||!Number.isFinite(obs.point.x)||
      !Number.isFinite(obs.point.y)||obs.confidence<.55)continue;
   const actor=obs.actorId;seen.add(actor);
   let old=this.tracks.get(actor);
   if(old){
    const dt=obs.timeMs-old.last.timeMs;
    const jump=dist(old.last.point,obs.point);
    let reason='';
    if(obs.sourceKey!==old.last.sourceKey||obs.epoch!==old.last.epoch)reason='source-switch';
    else if(dt<=0)reason='clock-reversal';
    else if(dt>gapLimit(obs.sourceKey))reason='gap';
    else if(jump>stepLimit(dt))reason='teleport';
    else if(dt>390&&jump>5){
     // MP4 inference can skip frames. Bridge only a directionally consistent
     // short span; never invent a sharp bend during the unknown interval.
     const dx=obs.point.x-old.lastPoint.x,dy=obs.point.y-old.lastPoint.y;
     const direction=Math.atan2(dy,dx);
     if(old.lastDirection===undefined||
        Math.abs(angle(old.lastDirection,direction))>Math.PI/4||
        jump>dt*.21)reason='uncertain-gap';
    }
    if(reason){
     events.push({...this.event('CUT',actor,old,old.last.timeMs),reason});
     this.countCut(reason);
     this.tracks.delete(actor);old=undefined;
     // Never produce a synthetic line from the old position to the new point.
     if(reason==='teleport')continue;
    }
   }
   if(!old){
    const state:State={strokeId:actor+'-'+(++this.nextId)+'-'+Math.round(obs.timeMs),
      last:obs,lastMoveAt:obs.timeMs,lastPoint:obs.point,stopped:false,
      lastMotionAt:obs.timeMs};
    this.tracks.set(actor,state);
    events.push(this.event('START',actor,state,obs.timeMs));
    continue;
   }
   const rawMove=dist(old.last.point,obs.point);
   // Small consistent displacements still count as motion even before
   // they accumulate enough to create an ADD/TURN knot.
   if(rawMove>=.7)old.lastMotionAt=obs.timeMs;
   const d=dist(old.lastPoint,obs.point);
   old.last=obs;
   if(d<4){
    if(!old.stopped&&obs.timeMs-Math.max(old.lastMoveAt,old.lastMotionAt)>=300){
     old.stopped=true;events.push(this.event('STOP',actor,old,obs.timeMs));
    }
    continue;
   }
   const direction=Math.atan2(obs.point.y-old.lastPoint.y,obs.point.x-old.lastPoint.x);
   const turn=old.lastDirection===undefined?0:angle(old.lastDirection,direction);
   old.lastDirection=direction;old.lastPoint=obs.point;
   old.lastMoveAt=obs.timeMs;old.lastMotionAt=obs.timeMs;old.stopped=false;
   events.push({...this.event(Math.abs(turn)>Math.PI/15?'TURN':'ADD',actor,old,obs.timeMs),
    ...(Math.abs(turn)>Math.PI/15?{turnRad:turn}:{})});
  }
  for(const [actor,state] of [...this.tracks.entries()]){
   if(!seen.has(actor)&&timeMs-state.last.timeMs>gapLimit(state.last.sourceKey)){
    events.push({...this.event('CUT',actor,state,timeMs),reason:'missing-feet'});
    this.countCut('missing-feet');this.tracks.delete(actor);
   }
  }
  return events;
 }
 private event(kind:PathEventKind,actorId:ActorChannel,state:State,timeMs:number):PathEvent{
  const o=state.last;
  return {kind,actorId,strokeId:state.strokeId,timeMs,point:state.lastPoint,
   sourceKey:o.sourceKey,clipStableId:o.clipStableId,epoch:o.epoch,
   confidence:o.confidence,provenance:o.provenance,
   footEvent:o.footEvent,motionBasis:o.motionBasis};
 }
}
