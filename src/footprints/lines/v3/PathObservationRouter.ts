import {cameraGroundToFloor,floorToUV,stageUVToRawCamera,type CameraFloorCalibration} from '../../spatial/coordinates.ts';
import {actorChannel,type ActorChannel} from './ActorPaletteResolver.ts';
import {stableInkSourceIdentity} from './ObservedMotionInkEngine.ts';
import type {FootBrushPose} from './FootBrushPoseAdapter.ts';
import {estimateAmbiguousCenterMovement,accumulateSmallMovement} from './TrajectoryFusion.ts';

export type PathPoint={x:number;y:number};
export type PathEvidence='supported-step'|'estimated-ground-projection';
export type PathMotionBasis='dual-foot-coherent'|'estimated-support'|'held'|'single-foot'|
 'dual-foot-and-hip'|'one-foot-hip-assisted'|'hip-short-gap';
export type PathStanceHint={actorId:string;foot:'left'|'right';
 kind:'contact'|'swing'|'pivot';atMs:number;confidence:number;
 basis:'video-2d-estimate'};
export type ActorPathObservation={
 actorId:ActorChannel;sourceKey:string;clipStableId:string;epoch:number;
 timeMs:number;point:PathPoint;confidence:number;evidence:PathEvidence;
 provenance:FootBrushPose['provenance'];supportFoot?:'left'|'right';
 footEvent:'none'|'pivot';motionBasis?:PathMotionBasis;
};
type Foot='left'|'right';
type Last={sourceKey:string;epoch:number;timeMs:number;point:PathPoint;
 midpoint:PathPoint;feet:Partial<Record<Foot,PathPoint>>;
 supportFoot?:Foot;velocity:PathPoint;residual:PathPoint};
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
 private spatialSignature='';
 reset(){this.last.clear();}
 ingest(poses:readonly FootBrushPose[],hints:readonly PathStanceHint[]=[],spatial?:{
  calibration:CameraFloorCalibration;videoAspect:number;calibrationId:string;
 }):ActorPathObservation[]{
  // A changed physical camera plane starts new strokes, never joins two spaces.
  const signature=spatial?spatial.calibrationId:'image-2d';
  if(signature!==this.spatialSignature){this.reset();this.spatialSignature=signature;}
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
   // Ignore old estimated contact once the same foot reports swing.
   const recent=new Map<Foot,PathStanceHint>();
   for(const hint of hints){
    if(actorChannel(hint.actorId)!==actor||hint.basis!=='video-2d-estimate'||
       hint.confidence<.65||one.atMs-hint.atMs>220||
       hint.atMs>one.atMs+50)continue;
    const prior=recent.get(hint.foot);
    if(!prior||hint.atMs>prior.atMs)recent.set(hint.foot,hint);
   }
   const hinted=[...recent.values()].filter(h=>h.kind!=='swing'&&
     (h.foot==='left'?!!left:!!right))
    .sort((a,b)=>b.atMs-a.atMs||b.confidence-a.confidence)[0];
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
   let residual:PathPoint={x:0,y:0};
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
    const jumpGate=Math.min(260,75+dt*.26);
    if(dl&&dr&&length(dMid,{x:0,y:0})>jumpGate&&
       mL>jumpGate*.7&&mR>jumpGate*.7&&
       (dl.x*dr.x+dl.y*dr.y)/(mL*mR)>.6){
     point=midpoint;
    }else{
     let movement:PathPoint={x:0,y:0};
     if(dl&&dr){
      const similar=mL>.8&&mR>.8&&
       (dl.x*dr.x+dl.y*dr.y)/(mL*mR)>.70&&
       Math.max(mL,mR)/Math.max(1,Math.min(mL,mR))<3.2;
      const leftGround=mL<=Math.max(8,mR*.37)&&mR>=10;
      const rightGround=mR<=Math.max(8,mL*.37)&&mL>=10;
      if(hinted){
       supportFoot=hinted.foot;
       const planted=supportFoot==='left'?dl:dr;
       const switched=!!old.supportFoot&&old.supportFoot!==supportFoot;
       movement=add(multiply(planted,.70),
        multiply(limit(dMid,40),switched?.24:.10));
       basis='estimated-support';
      }else if(similar){
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
       // Weak, ambiguous dual-foot evidence: use bounded CENTER displacement,
       // rather than discarding 92% of every moving frame indefinitely.
       movement=estimateAmbiguousCenterMovement(dMid,dl,dr,dt);
       basis='held';
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
     // Retain coherent subpixel motion: a series of <1.2px increments must
     // eventually move the path, while opposing jitter cancels naturally.
     const combined=accumulateSmallMovement(limited,old.residual,1.2);
     residual=combined.residual;
     point=add(old.point,combined.delta);
    }
   }
   // A confirmed floor profile maps the estimated support position to metres,
   // then to the canonical 1600 × 900 stage. This is still a 2D estimated
   // ground position; it does not prove physical pressure or 3D head depth.
   // Never clamp an out-of-bounds actor to the picture edge.
   if(spatial){
    const support=hinted?.foot==='left'?left?.center:
     hinted?.foot==='right'?right?.center:
     supportFoot==='left'?left?.center:
     supportFoot==='right'?right?.center:undefined;
    const imagePoint=support??{x:midpoint.x/1600,y:midpoint.y/900};
    const cameraUV=stageUVToRawCamera(imagePoint,spatial.videoAspect);
    const ground=cameraUV?cameraGroundToFloor(spatial.calibration,{
     cameraUV,phase:'stance',confidence:one.confidence
    }):null;
    if(ground){
     const floorUV=floorToUV(spatial.calibration.floor,ground);
     point={x:floorUV.x*1600,y:floorUV.y*900};
     basis='estimated-support';
    }else{
     // Outside calibrated floor or impossible video fit: do not stamp an
     // arbitrary image coordinate into the metric-floor drawing.
     this.last.delete(actor);
     continue;
    }
   }
   // Preserve source/epoch even for a discontinuous frame so the tracker
   // can issue a measurable CUT with its own reason.
   const velocity=continuous&&previous?multiply(delta(point,previous.point),
    1000/Math.max(1,dt)):{x:0,y:0};
   this.last.set(actor,{sourceKey:one.sourceKey,epoch:one.epoch,timeMs:one.atMs,
    point,midpoint,feet,supportFoot,velocity,residual});
   result.push({actorId:actor,sourceKey:one.sourceKey+(spatial?'|floor:'+spatial.calibrationId:''),
    clipStableId:stableInkSourceIdentity(one.sourceKey),epoch:one.epoch,
    timeMs:one.atMs,point,
    confidence:Math.min(...[left,right].filter(Boolean).map(p=>p!.confidence)),
    evidence:'estimated-ground-projection',provenance:one.provenance,
    ...(supportFoot?{supportFoot}:{}),
    footEvent:hinted?.kind==='pivot'&&supportFoot===hinted.foot&&hinted.confidence>=.8?
      'pivot':'none',motionBasis:basis});
  }
  return result;
 }
}
