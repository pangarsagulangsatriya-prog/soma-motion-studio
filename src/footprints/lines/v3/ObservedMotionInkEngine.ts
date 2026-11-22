import type {FootBrushPose,BrushPoint} from './FootBrushPoseAdapter.ts';

export type InkMotionKind='observed-motion'|'pivot';
export type InkSegmentEvent={
 id:string;sourceKey:string;sourceIdentity:string;epoch:number;
 actorId:string;foot:'left'|'right';coordinateBasis:FootBrushPose['coordinateBasis'];
 from:FootBrushPose;to:FootBrushPose;fromMs:number;toMs:number;
 kind:InkMotionKind;pivot?:'heel'|'toe';startsStroke:boolean;
 confidence:number;provenance:FootBrushPose['provenance'];
};
const dist=(a:BrushPoint,b:BrushPoint)=>
 Math.hypot((a.x-b.x)*1600,(a.y-b.y)*900);
const angleDelta=(a:number,b:number)=>Math.atan2(Math.sin(b-a),Math.cos(b-a));
const trackKey=(p:FootBrushPose)=>p.actorId+':'+p.foot;
/** MP4 key includes segment and performer count. They must not enter replay dedup. */
export function stableInkSourceIdentity(sourceKey:string):string{
 if(!sourceKey.startsWith('video:'))return sourceKey;
 const parts=sourceKey.split(':');
 return parts.length>=4?parts.slice(0,-2).join(':'):sourceKey;
}
const safe=(p:FootBrushPose)=>
 Number.isFinite(p.center.x)&&Number.isFinite(p.center.y)&&
 p.center.x>=0&&p.center.x<=1&&p.center.y>=0&&p.center.y<=1&&
 Number.isFinite(p.atMs)&&p.confidence>=.55;
/** Does not infer ground contact or physical pressure from 2D gait. */
export class ObservedMotionInkEngine{
 private tracks=new Map<string,FootBrushPose>();
 private strokes=new Set<string>();
 cutMotionSegment(_reason='cut'){this.tracks.clear();this.strokes.clear();}
 reset(){this.cutMotionSegment('reset');}
 ingest(poses:readonly FootBrushPose[]):InkSegmentEvent[]{
  const events:InkSegmentEvent[]=[];
  const seen=new Set<string>();
  for(const p of poses){
   const key=trackKey(p);seen.add(key);
   if(!safe(p)){this.tracks.delete(key);this.strokes.delete(key);continue;}
   const prev=this.tracks.get(key);
   this.tracks.set(key,p);
   if(!prev)continue;
   const dt=p.atMs-prev.atMs;
   if(dt<=0||dt>390||p.sourceKey!==prev.sourceKey||
    p.epoch!==prev.epoch||p.coordinateBasis!==prev.coordinateBasis||
    prev.provenance!==p.provenance){
    this.strokes.delete(key);continue;
   }
   const displacement=dist(prev.center,p.center);
   // Do not bridge a teleport. Limit jump relative to elapsed frame time.
   if(displacement>Math.min(180,25+1.2*dt)){
    this.strokes.delete(key);continue;
   }
   const rotation=prev.headingRad===undefined||p.headingRad===undefined?0:
    angleDelta(prev.headingRad,p.headingRad);
   let pivot:'heel'|'toe'|undefined;
   if(Math.abs(rotation)>.085&&displacement<45){
    if(prev.heel&&p.heel&&dist(prev.heel,p.heel)<9)pivot='heel';
    else if(prev.toe&&p.toe&&dist(prev.toe,p.toe)<9)pivot='toe';
   }
   if(displacement<1.6&&!pivot)continue;
   const kind:InkMotionKind=pivot?'pivot':'observed-motion';
   const id=[stableInkSourceIdentity(p.sourceKey),p.actorId,p.foot,
    prev.atMs.toFixed(2),p.atMs.toFixed(2),kind].join('|');
   events.push({id,sourceKey:p.sourceKey,sourceIdentity:stableInkSourceIdentity(p.sourceKey),
    epoch:p.epoch,actorId:p.actorId,foot:p.foot,coordinateBasis:p.coordinateBasis,
    from:prev,to:p,fromMs:prev.atMs,toMs:p.atMs,kind,
    ...(pivot?{pivot}:{}),startsStroke:!this.strokes.has(key),
    confidence:Math.min(prev.confidence,p.confidence),provenance:p.provenance});
   this.strokes.add(key);
  }
  for(const key of [...this.tracks.keys()])
   if(!seen.has(key)){this.tracks.delete(key);this.strokes.delete(key);}
  return events;
 }
}
