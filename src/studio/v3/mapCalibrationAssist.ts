import {correspondence,homography,identityQuad,transform,validQuad,type Point,type Quad} from '../../projection/geometry.ts';
import {stageUVToRawCamera} from '../../footprints/spatial/coordinates.ts';
import type {V3Input} from '../../footprints/lines/v3/SourceFrameNormalizer.ts';
import {FOOT_LENGTH_M,FOOT_WIDTH_M} from '../../footprints/scenes/authenticFootGeometry.ts';

export type AssistActor='A'|'B';
export type AssistOrigin='detected-estimate'|'video-estimate'|'virtual-floor'|'synthetic-test';
export type AssistPhase='contact-estimate'|'position-estimate'|'virtual'|'test';
export type FootAssistEvent={
 id:string;sourceKey:string;frameMs:number;atMs:number;actorId:AssistActor;
 foot:'left'|'right';sourceUV?:Point;floorUV?:Point;confidence:number;
 headingRad:number;origin:AssistOrigin;phase:AssistPhase;
};
export type AssistProjection={sourceUV:Point|null;floorUV:Point;outputUV:Point};
export type AssistTransform={cameraQuad:Quad;sourceQuad:Quad;outputQuad:Quad};
const inUnit=(p:Point|null|undefined):p is Point=>!!p&&
 Number.isFinite(p.x)&&Number.isFinite(p.y)&&p.x>=-1e-7&&p.y>=-1e-7&&p.x<=1+1e-7&&p.y<=1+1e-7;
const clamp=(v:number)=>Math.min(1,Math.max(0,v));
const actor=(raw:string):AssistActor=>raw==='B'||raw==='performer-2'?'B':'A';
export const assistColors:Record<AssistActor,string>={A:'#E84B32',B:'#202226'};

/** An image-space foot is a position estimate, never a measured pressure event. */
export function assistFromTrajectory(input:V3Input,nowMs:number,videoAspect:number):FootAssistEvent[]{
 if(!input.ready||input.paused||input.seeking||input.frameMs<0)return [];
 if(input.source!=='simulator'&&(!Number.isFinite(videoAspect)||videoAspect<=0))return [];
 const events:FootAssistEvent[]=[];
 for(const foot of input.samples){
  if(foot.confidence<.55||!Number.isFinite(foot.x)||!Number.isFinite(foot.y))continue;
  const side=foot.foot,actorId=actor(foot.actorId);
  const hint=input.supportHints?.filter(h=>actor(h.actorId)===actorId&&h.foot===side&&
   Math.abs(input.frameMs-h.atMs)<=220).sort((a,b)=>b.atMs-a.atMs)[0];
  if(hint?.kind==='swing')continue;
  const virtual=input.source==='simulator';
  const raw=virtual?null:stageUVToRawCamera({x:foot.x,y:foot.y},videoAspect);
  const floorUV=virtual?{x:foot.x,y:foot.y}:null;
  if(virtual?!inUnit(floorUV):!inUnit(raw))continue;
  const phase:AssistPhase=virtual?'virtual':
   hint?.kind==='contact'?'contact-estimate':'position-estimate';
  const origin:AssistOrigin=virtual?'virtual-floor':
   input.source==='video'?'video-estimate':'detected-estimate';
  events.push({id:input.sourceKey+':'+input.frameMs+':'+actorId+':'+side,
   sourceKey:input.sourceKey,frameMs:input.frameMs,atMs:nowMs,actorId,foot:side,
   ...(raw?{sourceUV:raw}:{}),...(floorUV?{floorUV}:{}),
   confidence:foot.confidence,headingRad:foot.headingRad??0,origin,phase});
 }
 return events;
}

/** Work in canonical floor UV once, then use sourceQuad -> outputQuad once.
 * This exactly matches paintMapWarp and avoids the common double-homography.
 */
export function projectAssistEvent(event:FootAssistEvent,geometry:AssistTransform):AssistProjection|null{
 try{
  if(!validQuad(geometry.cameraQuad)||!validQuad(geometry.sourceQuad)||!validQuad(geometry.outputQuad))return null;
  const floor=event.floorUV??(event.sourceUV?
   transform(correspondence(geometry.cameraQuad,identityQuad()),event.sourceUV):null);
  if(!inUnit(floor))return null;
  const floorUV={x:clamp(floor.x),y:clamp(floor.y)};
  const output=transform(correspondence(geometry.sourceQuad,geometry.outputQuad),floorUV);
  if(!inUnit(output))return null;
  const source=event.sourceUV??(event.origin==='synthetic-test'?
   transform(homography(geometry.cameraQuad),floorUV):null);
  return {floorUV,outputUV:{x:clamp(output.x),y:clamp(output.y)},
   sourceUV:inUnit(source)?{x:clamp(source.x),y:clamp(source.y)}:null};
 }catch{return null;}
}
export function syntheticAssistTest(nowMs:number,sourceKey='synthetic'):FootAssistEvent[]{
 const positions:[number,number,AssistActor,'left'|'right'][]=[
  [.28,.74,'A','left'],[.48,.72,'A','right'],[.5,.44,'A','left'],
  [.72,.5,'B','right'],[.48,.23,'B','left']
 ];
 return positions.map(([x,y,actorId,foot],i)=>({
  id:sourceKey+':test:'+i,sourceKey,frameMs:nowMs,atMs:nowMs,
  actorId,foot,floorUV:{x,y},confidence:1,headingRad:0,
  origin:'synthetic-test' as const,phase:'test' as const
 }));
}
export function mergeAssistBuffer(prev:readonly FootAssistEvent[],next:readonly FootAssistEvent[],
 nowMs:number,windowMs=5000,limit=144):FootAssistEvent[]{
 const current=prev.filter(x=>x.atMs>=nowMs-windowMs&&x.atMs<=nowMs+50);
 const seen=new Set(current.map(x=>x.id));
 for(const x of next)if(!seen.has(x.id)){current.push(x);seen.add(x.id);}
 return current.slice(-limit);
}
export function assistSourceReset(previous:string,next:string):boolean{
 return previous!==next;
}

/** Nominal sole dimensions for the metric stage diagram, not measured shoe size. */
export function metricAssistFootSize(pixelsPerMeter:number){
 const scale=Number.isFinite(pixelsPerMeter)&&pixelsPerMeter>0?pixelsPerMeter:0;
 return {widthPx:FOOT_WIDTH_M*scale,lengthPx:FOOT_LENGTH_M*scale};
}
