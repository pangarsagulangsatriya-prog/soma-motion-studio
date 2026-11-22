import type {FootBrushPose,BrushPoint} from './FootBrushPoseAdapter.ts';

export type BrushGesture='hover'|'imprint'|'drag'|'pivot'|'lift';
export type FootBrushGestureEvent={
 id:string;actorId:string;foot:'left'|'right';kind:BrushGesture;
 sourceKey:string;epoch:number;atSourceMs:number;
 from?:FootBrushPose;pose:FootBrushPose;
 pivot?:'heel'|'toe';confidence:number;provenance:FootBrushPose['provenance'];
};
type Track={pose:FootBrushPose;moving:boolean;stillSince:number|null;
 traveled:number;lastImprint:number;contactEstimated:boolean};
const distance=(a:BrushPoint,b:BrushPoint)=>Math.hypot((a.x-b.x)*1600,(a.y-b.y)*900);
const angle=(a:number,b:number)=>Math.abs(Math.atan2(Math.sin(a-b),Math.cos(a-b)));
const key=(x:FootBrushPose)=>x.actorId+':'+x.foot;
/** Conservative image-space estimate. Does not infer real floor contact or foot pressure. */
export class FootContactGestureEngine {
 private tracks=new Map<string,Track>();
 private serial=0;
 reset(){this.tracks.clear();this.serial=0;}
 ingest(poses:readonly FootBrushPose[]):FootBrushGestureEvent[]{
  const out:FootBrushGestureEvent[]=[];
  const seen=new Set<string>();
  for(const p of poses){
   const k=key(p);seen.add(k);
   if(p.confidence<.55){this.tracks.delete(k);continue;}
   const old=this.tracks.get(k);
   const dt=old?p.atMs-old.pose.atMs:0;
   if(!old||old.pose.sourceKey!==p.sourceKey||old.pose.epoch!==p.epoch||
      old.pose.coordinateBasis!==p.coordinateBasis||dt<=0||dt>390||
      distance(old.pose.center,p.center)>370){
    this.tracks.set(k,{pose:p,moving:false,stillSince:null,traveled:0,
     lastImprint:-Infinity,contactEstimated:false});continue;
   }
   const moved=distance(old.pose.center,p.center);
   if(old.contactEstimated&&p.atMs-old.lastImprint>180)old.contactEstimated=false;
   const turning=p.headingRad!==undefined&&old.pose.headingRad!==undefined?
    angle(p.headingRad,old.pose.headingRad):0;
   const heelStable=p.heel&&old.pose.heel&&distance(p.heel,old.pose.heel)<5;
   const toeStable=p.toe&&old.pose.toe&&distance(p.toe,old.pose.toe)<5;
   const pivot=turning>.12&&moved<50?(heelStable?'heel':toeStable?'toe':undefined):undefined;
   let kind:BrushGesture|undefined;
   // Explicit simulated/demo input can depict a painted continuous walk.
   // Camera/video contact remains conservative: never paint aerial transit.
   const simulated=p.provenance==='simulated';
   const recentContact=old.contactEstimated&&p.atMs-old.lastImprint<=180;
   if(recentContact&&pivot)kind='pivot';
   else if((simulated||recentContact)&&moved>3.7&&moved<110)kind='drag';
   else if(moved>3.7){
    old.moving=true;old.stillSince=null;old.traveled+=Math.min(110,moved);
    old.contactEstimated=false;
   }else if(old.moving){
    old.stillSince??=p.atMs;
    if(p.atMs-old.stillSince>=170&&old.traveled>=28&&p.atMs-old.lastImprint>=620){
     kind='imprint';old.lastImprint=p.atMs;old.moving=false;
     old.traveled=0;old.stillSince=null;old.contactEstimated=true;
    }
   }
   if(kind)out.push({
    id:p.sourceKey+':'+p.epoch+':'+k+':'+p.atMs+':'+(++this.serial),
    actorId:p.actorId,foot:p.foot,kind,sourceKey:p.sourceKey,epoch:p.epoch,
    atSourceMs:p.atMs,from:old.pose,pose:p,...(pivot?{pivot}:{}),
    confidence:Math.min(old.pose.confidence,p.confidence),provenance:p.provenance
   });
   old.pose=p;
  }
  for(const k of this.tracks.keys())if(!seen.has(k))this.tracks.delete(k);
  return out;
 }
}
