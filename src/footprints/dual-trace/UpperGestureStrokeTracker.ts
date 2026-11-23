import type {PathEvent,PathEventKind} from '../lines/v3/ActorPathTracker.ts';
import type {UpperChannel,UpperGestureAnchor} from './UpperGestureAnchorAdapter.ts';
import type {DualActor} from './DualTracePoseFrameBus.ts';

export type UpperGestureEvent=PathEvent&{channel:UpperChannel};
type Track={
 id:string;last:UpperGestureAnchor;point:{x:number;y:number};
 lastDraw:{x:number;y:number};lastMoveAt:number;stopped:boolean;
 direction?:number;
};
const distance=(a:{x:number;y:number},b:{x:number;y:number})=>
 Math.hypot(a.x-b.x,a.y-b.y);
const bearing=(a:number,b:number)=>Math.atan2(Math.sin(a-b),Math.cos(a-b));
const key=(actor:DualActor,channel:UpperChannel)=>actor+':'+channel;
const grace=(sourceKey:string)=>sourceKey.startsWith('video:')?900:550;
export class UpperGestureStrokeTracker{
 private tracks=new Map<string,Track>();
 private serial=0;
 get activeCount(){return this.tracks.size;}
 private event(kind:PathEventKind,track:Track,channel:UpperChannel,
   timeMs:number,reason?:string):UpperGestureEvent{
  const a=track.last;
  return {kind,actorId:a.actorId,channel,strokeId:track.id,
   sourceKey:a.sourceKey,clipStableId:a.clipStableId,epoch:a.epoch,
   timeMs,point:{...track.lastDraw},confidence:a.confidence,
   provenance:a.sourceKey.startsWith('video:')?'video-estimate':'detected-estimate',
   ...(reason?{reason}:{})};
 }
 cutAll(reason:string):UpperGestureEvent[]{
  const events=[...this.tracks.values()].map(track=>
   this.event('CUT',track,track.last.channel,track.last.timeMs,reason));
  this.tracks.clear();return events;
 }
 ingest(anchors:readonly UpperGestureAnchor[],timeMs:number,
 smoothing=.42):UpperGestureEvent[]{
  const events:UpperGestureEvent[]=[];
  const seen=new Set<string>(),k=Math.min(.88,Math.max(.16,1-smoothing));
  for(const a of anchors){
   if(a.confidence<.55||!Number.isFinite(a.pointPx.x)||
      !Number.isFinite(a.pointPx.y))continue;
   const id=key(a.actorId,a.channel);
   if(seen.has(id))continue;
   seen.add(id);
   let t=this.tracks.get(id);
   if(t){
    const dt=a.timeMs-t.last.timeMs;
    const dist=distance(t.point,a.pointPx);
    let reason='';
    if(a.sourceKey!==t.last.sourceKey||a.epoch!==t.last.epoch)
     reason='source-switch';
    else if(dt<=0)reason='clock-reversal';
    else if(dt>grace(a.sourceKey))reason='gap';
    else if(dist>Math.min(220,40+dt*.38))reason='teleport';
    if(reason){
     events.push(this.event('CUT',t,a.channel,t.last.timeMs,reason));
     this.tracks.delete(id);t=undefined;
     if(reason==='teleport')continue;
    }
   }
   if(!t){
    const track:Track={id:id+':'+(++this.serial)+':'+Math.round(a.timeMs),
     last:a,point:{...a.pointPx},lastDraw:{...a.pointPx},
     lastMoveAt:a.timeMs,stopped:false};
    this.tracks.set(id,track);
    events.push(this.event('START',track,a.channel,a.timeMs));continue;
   }
   const p={x:t.point.x+(a.pointPx.x-t.point.x)*k,
    y:t.point.y+(a.pointPx.y-t.point.y)*k};
   t.last=a;t.point=p;
   const threshold=a.channel==='head'?4:5;
   if(distance(t.lastDraw,p)<threshold){
    if(!t.stopped&&a.timeMs-t.lastMoveAt>=240){
     t.stopped=true;events.push(this.event('STOP',t,a.channel,a.timeMs));
    }
    continue;
   }
   const theta=Math.atan2(p.y-t.lastDraw.y,p.x-t.lastDraw.x);
   const turn=t.direction===undefined?0:bearing(theta,t.direction);
   t.direction=theta;t.lastDraw=p;t.lastMoveAt=a.timeMs;t.stopped=false;
   events.push({...this.event(Math.abs(turn)>.24?'TURN':'ADD',t,a.channel,a.timeMs),
    ...(Math.abs(turn)>.24?{turnRad:turn}:{})});
  }
  for(const [id,t] of [...this.tracks]){
   if(!seen.has(id)&&timeMs-t.last.timeMs>grace(t.last.sourceKey)){
    events.push(this.event('CUT',t,t.last.channel,timeMs,'landmark-lost'));
    this.tracks.delete(id);
   }
  }
  return events;
 }
}
