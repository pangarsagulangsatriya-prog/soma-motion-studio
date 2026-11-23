import type {ActorChannel} from './ActorPaletteResolver.ts';
import type {ActorMotionFrame} from './ActorMotionFrameBuilder.ts';
import type {ActorPathObservation,PathPoint} from './PathObservationRouter.ts';

export type CoverageTraceSampleV24={
 actorId:ActorChannel;sourceKey:string;atMs:number;
 rawFootStage?:PathPoint;fused?:PathPoint;smoothed?:PathPoint;
 coordinateBasis:'image-2d'|'floor-estimate';
 feet:0|1|2;confidence:number;motionBasis?:string;
};
type Extents={minX:number;maxX:number;minY:number;maxY:number;count:number};
const bounds=(p:readonly PathPoint[]):Extents|null=>
 p.length?{minX:Math.min(...p.map(x=>x.x)),maxX:Math.max(...p.map(x=>x.x)),
 minY:Math.min(...p.map(x=>x.y)),maxY:Math.max(...p.map(x=>x.y)),count:p.length}:null;
/** Bounded, coordinate-labelled trace. No camera frames or faces are stored.
 * Raw and floor-calibrated ranges are never mixed in a coverage ratio.
 */
export class CoverageTraceRecorderV24{
 private traces:CoverageTraceSampleV24[]=[];
 reset(){this.traces=[];}
 capture(frames:readonly ActorMotionFrame[],
  original:readonly ActorPathObservation[],
  smoothed:readonly ActorPathObservation[],calibrated:boolean){
  for(const o of original){
   const frame=frames.find(f=>f.actorId===o.actorId&&f.timeMs===o.timeMs);
   const after=smoothed.find(f=>f.actorId===o.actorId&&f.timeMs===o.timeMs);
   const entry:CoverageTraceSampleV24={
    actorId:o.actorId,sourceKey:o.sourceKey,atMs:o.timeMs,
    coordinateBasis:calibrated?'floor-estimate':'image-2d',
    feet:frame?.feetCount??0,confidence:o.confidence,
    fused:{...o.point},
    ...(frame?.footImageAnchorPx?{rawFootStage:{...frame.footImageAnchorPx}}:{}),
    ...(after?{smoothed:{...after.point}}:{}),
    ...(o.motionBasis?{motionBasis:o.motionBasis}:{})
   };
   if(this.traces.some(p=>p.actorId===entry.actorId&&
    p.atMs===entry.atMs&&p.sourceKey===entry.sourceKey))continue;
   this.traces.push(entry);
  }
  if(this.traces.length>960)this.traces.splice(0,this.traces.length-960);
 }
 get samples(){return this.traces.map(x=>({...x,
  rawFootStage:x.rawFootStage?{...x.rawFootStage}:undefined,
  fused:x.fused?{...x.fused}:undefined,
  smoothed:x.smoothed?{...x.smoothed}:undefined}));}
 get summary(){
  return (['A','B'] as const).map(actor=>{
   const a=this.traces.filter(x=>x.actorId===actor);
   const raw=bounds(a.map(x=>x.rawFootStage).filter((p):p is PathPoint=>!!p));
   const fused=bounds(a.map(x=>x.fused).filter((p):p is PathPoint=>!!p));
   const filtered=bounds(a.map(x=>x.smoothed).filter((p):p is PathPoint=>!!p));
   return {actor,frames:a.length,rawImage:raw,fused,smoothed:filtered,
    coordinateBasis:a.at(-1)?.coordinateBasis??'image-2d'};
  });
 }
}
