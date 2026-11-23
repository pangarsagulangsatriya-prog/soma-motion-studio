import {actorChannel,type ActorChannel} from './ActorPaletteResolver.ts';
import {stableInkSourceIdentity} from './ObservedMotionInkEngine.ts';
import type {FootBrushPose} from './FootBrushPoseAdapter.ts';

export type PathPoint={x:number;y:number};
export type PathEvidence='supported-step'|'estimated-ground-projection';
export type PathMotionBasis='dual-foot-coherent'|'estimated-support'|'held'|'single-foot';
export type ActorPathObservation={
 actorId:ActorChannel;sourceKey:string;clipStableId:string;epoch:number;
 timeMs:number;point:PathPoint;confidence:number;evidence:PathEvidence;
 provenance:FootBrushPose['provenance'];supportFoot?:'left'|'right';
 footEvent:'none'|'pivot';motionBasis?:PathMotionBasis;
};
type Foot='left'|'right';
type Last={sourceKey:string;epoch:number;timeMs:number;point:PathPoint;
 midpoint:PathPoint;feet:Partial<Record<Foot,PathPoint>>;
 supportFoot?:Foot;velocity:PathPoint};
const length=(a:PathPoint,b:PathPoint)=>Math.hypot(a.x-b.x,a.y-b.y);
const delta=(a:PathPoint,b:PathPoint):PathPoint=>({x:a.x-b.x,y:a.y-b.y});
const add=(a:PathPoint,b:PathPoint):PathPoint=>({x:a.x+b.x,y:a.y+b.y});
const multiply=(p:PathPoint,k:number):PathPoint=>({x:p.x*k,y:p.y*k});
const average=(a:PathPoint,b:PathPoint,weight=.5):PathPoint=>({
 x:a.x*weight+b.x*(1-weight),y:a.y*weight+b.y*(1-weight)});
const limit=(p:PathPoint,max:number):PathPoint=>{
 const d=Math.hypot(p.x,p.y);return d<=max?p:multiply(p,max/d);
};
const norm=(p:FootBrushPose):PathPoint=>({
 x:p.center.x*1600,y:p.center.y*900});
/**
 * Two actor observations from 4 feet. A moving (swinging) foot must not pull
 * the actor path sideways. Two feet travelling together may carry the actor.
 *
 * A 2D camera offers estimated stance only: ground contact is NOT verified,
 * so the evidence remains estimated-ground-projection, not supported-step.
 * No camera-to-floor homography is applied without an explicit calibration.
 */
export class PathObservationRouter{
 private last=new Map<ActorChannel,Last>();
 reset(){this.last.clear();}
 ingest(poses:readonly FootBrushPose[]):ActorPathObservation[]{
  const grouped=new Map<ActorChannel,Partial<Record<Foot,FootBrushPose>>>();
  const invalid=new Set<ActorChannel>();
  for(const p of poses){
   const actor=actorChannel(p.actorId);
   if(!Number.isFinite(p.center.x)||!Number.isFinite(p.center.y)||
      !Number.isFinite(p.confidence)||p.confidence<.55||
      p.center.x<0||p.center.x>1||p.center.y<0||p.center.y>1)continue;
   const g=grouped.get(actor)??{};
   if(g[p.foot])invalid.add(actor);
   else g[p.foot]=p;
   grouped.set(actor,g);
  }
  const result:ActorPathObservation[]=[];
  for(const actor of ['A','B'] as const){
   if(invalid.has(actor))continue;
   const pair=grouped.get(actor);if(!pair)continue;
   const left=pair.left,right=pair.right,one=left??right;if(!one)continue;
   if(left&&right&&(left.atMs!==right.atMs||left.sourceKey!==right.sourceKey||
      left.epoch!==right.epoch||left.coordinateBasis!==right.coordinateBasis))continue;
   const previous=this.last.get(actor);
   const dt=previous?one.atMs-previous.timeMs:0;
   const continuous=!!previous&&previous.sourceKey===one.sourceKey&&
    previous.epoch===one.epoch&&dt>0&&dt<=(one.sourceKey.startsWith('video:')?900:500);
   const feet:Last['feet']={};
   if(left)feet.left=norm(left);
   if(right)feet.right=norm(right);
   const midpoint=left&&right?
    average(feet.left!,feet.right!,left.confidence/(left.confidence+right.confidence)):
    feet[left?'left':'right']!;
   let point={...midpoint};
   let supportFoot:Foot|undefined;
   let basis:PathMotionBasis='held';
   if(continuous&&previous){
    const old=previous;
    const previousL=old.feet.left,previousR=old.feet.right;
    const dMid=delta(midpoint,old.midpoint);
    const dl=feet.left&&previousL?delta(feet.left,previousL):null;
    const dr=feet.right&&previousR?delta(feet.right,previousR):null;
    const mL=dl?length(dl,{x:0,y:0}):Infinity;
    const mR=dr?length(dr,{x:0,y:0}):Infinity;
    // Severe displacement is reported to ActorPathTracker so it can CUT,
    // never silently interpolate across an identity swap or teleport.
    const jumpGate=Math.min(190,30+dt*.22);
    if(dl&&dr&&length(dMid,{x:0,y:0})>jumpGate&&
       mL>jumpGate*.7&&mR>jumpGate*.7&&
       (dl.x*dr.x+dl.y*dr.y)/(mL*mR)>.6){
     point=midpoint;
    }else{
     let movement:PathPoint={x:0,y:0};
     if(dl&&dr){
      const similar=mL>3&&mR>3&&
       (dl.x*dr.x+dl.y*dr.y)/(mL*mR)>.70&&
       Math.max(mL,mR)/Math.max(1,Math.min(mL,mR))<3.2;
      const leftGround=mL<=Math.max(8,mR*.37)&&mR>=10;
      const rightGround=mR<=Math.max(8,mL*.37)&&mL>=10;
      if(similar){
       movement=multiply(dMid,.80);basis='dual-foot-coherent';
      }else if(leftGround!==rightGround){
       supportFoot=leftGround?'left':'right';
       const planted=leftGround?dl:dr;
       const switched=!!old.supportFoot&&old.supportFoot!==supportFoot;
       // Keep the same center when the supporting foot switches: use
       // relative displacement, not the absolute new sole coordinate.
       movement=add(multiply(planted,.70),
        multiply(limit(dMid,40),switched?.24:.08));
       basis='estimated-support';
      }else if(mL<5&&mR<5){
       movement=multiply(dMid,.25);basis='held';
      }else{
       // Opposing/crossing feet are likely pivot, swing or detector jitter.
       // A path must not trace their average motion in arbitrary directions.
       movement=multiply(dMid,.08);basis='held';
      }
     }else if(dl||dr){
      const visibleDelta=dl??dr!;
      // One foot alone is insufficient to establish actor movement.
      // Use tiny, bounded changes, rather than following a swinging foot.
      movement=multiply(limit(visibleDelta,8),.12);basis='single-foot';
      supportFoot=dl?'left':'right';
     }else{
      basis='held';
     }
     const maxStep=Math.min(52,10+dt*.10);
     const limited=limit(movement,maxStep);
     point=add(old.point,limited);
     if(length(limited,{x:0,y:0})<1.2)point={...old.point};
    }
   }
   // Preserve source/epoch even for a discontinuous frame so the tracker
   // can issue a measurable CUT with its own reason.
   const velocity=continuous&&previous?multiply(delta(point,previous.point),
    1000/Math.max(1,dt)):{x:0,y:0};
   this.last.set(actor,{sourceKey:one.sourceKey,epoch:one.epoch,timeMs:one.atMs,
    point,midpoint,feet,supportFoot,velocity});
   result.push({actorId:actor,sourceKey:one.sourceKey,
    clipStableId:stableInkSourceIdentity(one.sourceKey),epoch:one.epoch,
    timeMs:one.atMs,point,
    confidence:Math.min(...[left,right].filter(Boolean).map(p=>p!.confidence)),
    evidence:'estimated-ground-projection',provenance:one.provenance,
    ...(supportFoot?{supportFoot}:{}),footEvent:'none',motionBasis:basis});
  }
  return result;
 }
}
