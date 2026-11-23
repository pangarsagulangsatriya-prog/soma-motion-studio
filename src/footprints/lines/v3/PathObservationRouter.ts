import {actorChannel,type ActorChannel} from './ActorPaletteResolver.ts';
import {stableInkSourceIdentity} from './ObservedMotionInkEngine.ts';
import type {FootBrushPose} from './FootBrushPoseAdapter.ts';

export type PathPoint={x:number;y:number};
export type PathEvidence='supported-step'|'estimated-ground-projection';
export type ActorPathObservation={
 actorId:ActorChannel;sourceKey:string;clipStableId:string;epoch:number;
 timeMs:number;point:PathPoint;confidence:number;evidence:PathEvidence;
 provenance:FootBrushPose['provenance'];supportFoot?:'left'|'right';
 footEvent:'none'|'pivot';
};
type Last={sourceKey:string;epoch:number;timeMs:number;point:PathPoint;
 feet:Partial<Record<'left'|'right',PathPoint>>;velocity:PathPoint};
const length=(a:PathPoint,b:PathPoint)=>Math.hypot(a.x-b.x,a.y-b.y);
const lerp=(a:number,b:number,k:number)=>a+(b-a)*k;
const bounded=(from:PathPoint,to:PathPoint,max:number):PathPoint=>{
 const d=length(from,to),t=d>max?max/d:1;
 return {x:lerp(from.x,to.x,t),y:lerp(from.y,to.y,t)};
};
/** Converts four actor-foot observations into max two cautious actor-centred points. */
export class PathObservationRouter{
 private last=new Map<ActorChannel,Last>();
 reset(){this.last.clear();}
 ingest(poses:readonly FootBrushPose[]):ActorPathObservation[]{
  const grouped=new Map<ActorChannel,Partial<Record<'left'|'right',FootBrushPose>>>();
  const invalid=new Set<ActorChannel>();
  for(const p of poses){
   const actor=actorChannel(p.actorId);
   if(!Number.isFinite(p.center.x)||!Number.isFinite(p.center.y)||
      p.confidence<.55||p.center.x<0||p.center.x>1||p.center.y<0||p.center.y>1)
    continue;
   const g=grouped.get(actor)??{};
   if(g[p.foot])invalid.add(actor);
   else g[p.foot]=p;
   grouped.set(actor,g);
  }
  const output:ActorPathObservation[]=[];
  for(const actor of ['A','B'] as const){
   if(invalid.has(actor))continue;
   const group=grouped.get(actor);if(!group)continue;
   const left=group.left,right=group.right;
   const one=left??right;if(!one)continue;
   if(left&&right&&(left.atMs!==right.atMs||left.sourceKey!==right.sourceKey||
      left.epoch!==right.epoch||left.coordinateBasis!==right.coordinateBasis))continue;
   const previous=this.last.get(actor);
   const same=!!previous&&previous.sourceKey===one.sourceKey&&
    previous.epoch===one.epoch&&one.atMs>previous.timeMs&&
    one.atMs-previous.timeMs<=390;
   const feet:Last['feet']={};
   if(left)feet.left={x:left.center.x*1600,y:left.center.y*900};
   if(right)feet.right={x:right.center.x*1600,y:right.center.y*900};
   let estimate:PathPoint;
   if(left&&right){
    const a=feet.left!,b=feet.right!,sum=left.confidence+right.confidence;
    estimate={x:(a.x*left.confidence+b.x*right.confidence)/sum,
      y:(a.y*left.confidence+b.y*right.confidence)/sum};
   }else{
    const side=left?'left':'right';
    const observed=feet[side]!;
    // Continue from the same foot's displacement rather than snapping
    // from actor center onto a newly visible support foot.
    const oldFoot=same?previous?.feet[side]:undefined;
    const dt=same?one.atMs-previous!.timeMs:0;
    estimate=oldFoot?{
      x:previous!.point.x+(observed.x-oldFoot.x),
      y:previous!.point.y+(observed.y-oldFoot.y)
    }:same?{
      x:previous!.point.x+previous!.velocity.x*Math.min(100,dt)/1000,
      y:previous!.point.y+previous!.velocity.y*Math.min(100,dt)/1000
    }:observed;
   }
   let point=estimate;
   if(same){
    const dt=one.atMs-previous!.timeMs;
    const maxStep=Math.min(180,25+1.2*dt);
    // Large jumps remain detectable to the tracker's teleport gate.
    const distance=length(previous!.point,estimate);
    if(distance<maxStep){
      const smooth=distance<3?.22:.72;
      point={x:lerp(previous!.point.x,estimate.x,smooth),
        y:lerp(previous!.point.y,estimate.y,smooth)};
    }
   }
   const dt=same?(one.atMs-previous!.timeMs)/1000:0;
   const velocity=dt>0?{
    x:(point.x-previous!.point.x)/dt,y:(point.y-previous!.point.y)/dt
   }:{x:0,y:0};
   this.last.set(actor,{sourceKey:one.sourceKey,epoch:one.epoch,timeMs:one.atMs,
     point,feet,velocity});
   output.push({actorId:actor,sourceKey:one.sourceKey,
    clipStableId:stableInkSourceIdentity(one.sourceKey),epoch:one.epoch,
    timeMs:one.atMs,point,confidence:Math.min(...[left,right].filter(Boolean).map(x=>x!.confidence)),
    evidence:'estimated-ground-projection',provenance:one.provenance,
    supportFoot:left&&!right?'left':right&&!left?'right':undefined,
    footEvent:'none'});
  }
  return output;
 }
}
