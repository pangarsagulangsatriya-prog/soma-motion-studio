import type {FootV3Sample} from './FootPositionResolver.ts';

export type BrushPoint={x:number;y:number};
export type FootBrushPose={
 actorId:string;foot:'left'|'right';sourceKey:string;epoch:number;
 atMs:number;coordinateBasis:FootV3Sample['coordinateBasis'];
 center:BrushPoint;heel?:BrushPoint;toe?:BrushPoint;ankle?:BrushPoint;
 headingRad?:number;confidence:number;
 provenance:'detected-estimate'|'video-estimate'|'simulated';
};
export type PoseAdapterState={lastFrameMs:number;epoch:number;sourceKey:string};
const valid=(p:BrushPoint|undefined):p is BrushPoint=>
 !!p&&Number.isFinite(p.x)&&Number.isFinite(p.y)&&p.x>=0&&p.x<=1&&p.y>=0&&p.y<=1;
const heading=(heel:BrushPoint,toe:BrushPoint)=>
 Math.atan2((toe.x-heel.x)*16,(heel.y-toe.y)*9);
/** Adapter never fabricates landmarks, contact or physical pressure. */
export function adaptFootBrushFrame(samples:readonly FootV3Sample[],sourceKey:string,
 frameMs:number,previous:PoseAdapterState={lastFrameMs:-1,epoch:0,sourceKey:''}):
 {poses:FootBrushPose[];state:PoseAdapterState;cut:boolean}{
 const sourceChange=previous.sourceKey!==sourceKey;
 const seek=previous.lastFrameMs>=0&&frameMs<previous.lastFrameMs;
 const cut=sourceChange||seek;
 const state={sourceKey,epoch:previous.epoch+(cut?1:0),lastFrameMs:frameMs};
 if(!Number.isFinite(frameMs)||frameMs<0||(!cut&&frameMs===previous.lastFrameMs))
  return {poses:[],state:previous,cut:false};
 const seen=new Set<string>();
 const poses:FootBrushPose[]=[];
 for(const sample of samples){
  const k=sample.actorId+':'+sample.foot;
  if(seen.has(k)||!valid(sample)||!Number.isFinite(sample.confidence)||sample.confidence<.55)continue;
  seen.add(k);
  const heel=valid(sample.heel)?sample.heel:undefined;
  const toe=valid(sample.toe)?sample.toe:undefined;
  const ankle=valid(sample.ankle)?sample.ankle:undefined;
  // The historic SOMA heading uses an aspect-corrected heel/toe vector.
  const headingRad=heel&&toe&&Math.hypot(toe.x-heel.x,toe.y-heel.y)>.005?
   heading(heel,toe):Number.isFinite(sample.headingRad)&&sample.anchor!=='ankle-fallback'?
   sample.headingRad:undefined;
  poses.push({actorId:sample.actorId,foot:sample.foot,sourceKey,epoch:state.epoch,
   atMs:frameMs,coordinateBasis:sample.coordinateBasis,
   center:{x:sample.x,y:sample.y},...(heel?{heel}:{}),...(toe?{toe}:{}),
   ...(ankle?{ankle}:{}),...(headingRad===undefined?{}:{headingRad}),
   confidence:sample.confidence,
   provenance:sample.source==='simulator'?'simulated':
    sample.source==='video'?'video-estimate':'detected-estimate'});
 }
 return {poses,state,cut};
}
