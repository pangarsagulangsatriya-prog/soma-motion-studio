import type {MotionFrame} from '../../engine/types.ts';
import type {MultiPoseStatus} from '../live/MultiPoseGaitRouter.ts';
import type {LiveFloorTrackingEngine} from '../live/LiveFloorTrackingEngine.ts';
import {cameraGroundToFloor,floorToUV,type FloorSpace}
 from '../spatial/coordinates.ts';
import type {ExperimentalFrame} from '../../studio/v3/experimentSourceModel.ts';
import {paintAuthenticFootprint} from './authenticFootGeometry.ts';
import {FloorInteractionEngine,type FloorInteractionSource,type FloorObservation}
 from './FloorInteractionEngine.ts';

type PosePoint={x:number;y:number;visibility?:number};
const validPoint=(p:PosePoint|undefined)=>p&&Number.isFinite(p.x)&&Number.isFinite(p.y)&&
 p.x>=0&&p.x<=1&&p.y>=0&&p.y<=1&&(p.visibility??1)>=.42;
const clamp=(x:number)=>Math.min(1,Math.max(0,x));
/** Bottom of the body in normalized image coordinates; never measured contact. */
export function posePresencePoint(pose:readonly PosePoint[]):{x:number;y:number;confidence:number}|null{
 for(const [a,b] of [[27,28],[29,30],[23,24],[11,12]]){
  const left=pose[a],right=pose[b];
  if(validPoint(left)&&validPoint(right))
   return {x:clamp((left.x+right.x)/2),y:clamp((left.y+right.y)/2),
    confidence:Math.min(left.visibility??1,right.visibility??1)};
 }
 return null;
}
function ingestPose(engine:FloorInteractionEngine,pose:readonly PosePoint[],
 source:FloorInteractionSource,actorId:string,atMs:number,
 coordinates:(p:{x:number;y:number;confidence:number})=>{x:number;y:number;basis:FloorObservation['basis']}){
 const point=posePresencePoint(pose);if(!point)return;
 const uv=coordinates(point);
 engine.observe({source,actorId,x:uv.x,y:uv.y,
  confidence:point.confidence,atMs,basis:uv.basis});
}
export function feedLiveFloorInteractions(engine:FloorInteractionEngine,input:{
 source:'camera'|'phone';frame:MotionFrame;
 identity:MultiPoseStatus;previewIdentity?:MultiPoseStatus;performerCount:1|2;tracker:LiveFloorTrackingEngine;
 cameraMatched:boolean;videoAspect:number;nowMs:number;
}){
 const {source,frame,identity,performerCount,tracker,cameraMatched,nowMs}=input;
 const preview=input.previewIdentity??identity;
 if(engine.activeSource!==source||(performerCount===1&&!frame.tracked)||frame.source!=='camera'||
  nowMs-frame.time<0||nowMs-frame.time>450)return;
 const coordinates=(p:{x:number;y:number;confidence:number})=>{
  if(cameraMatched&&tracker.calibrationData){
   const raw={x:p.x,y:p.y};
   // This transformation is only a visual XY anchor, never a foot-contact
   // estimate. The source of contact is exclusively LiveFloorTrackingEngine.
   const mapped=raw?cameraGroundToFloor(tracker.calibrationData,{
    cameraUV:raw,phase:'stance',confidence:Math.max(.55,p.confidence)}):null;
   if(mapped){
    const uv=floorToUV(tracker.calibrationData.floor,mapped);
    return {...uv,basis:'calibrated-estimate' as const};
   }
  }
  return {x:p.x,y:p.y,basis:'presence-only' as const};
 };
 const idsValid=performerCount===2&&!identity.ambiguous&&identity.observedFrameTime===frame.time;
 const previewIdsValid=performerCount===2&&!preview.ambiguous&&preview.observedFrameTime===frame.time;
 // Preview may expose one observed actor without granting calibrated contact.
 const visualIdentity=idsValid?identity:preview;
 const visualIdsValid=idsValid||previewIdsValid;
 engine.keepActors(source,performerCount===1?['performer-1']:visualIdsValid?
  (['A','B'] as const).filter(id=>visualIdentity.poseIndices[id]!==null):
  (frame.poses??[]).slice(0,2).map((_,i)=>'unassigned-'+i));
 if(performerCount===1){
  if(frame.pose.length)ingestPose(engine,frame.pose,source,'performer-1',frame.time,coordinates);
 }else if(visualIdsValid){
  for(const id of ['A','B'] as const){
   const i=visualIdentity.poseIndices[id];
   if(i!==null&&frame.poses?.[i])
    ingestPose(engine,frame.poses[i],source,id,frame.time,coordinates);
  }
 }else{
  // Presence remains interactive when the two identities are uncertain.
  // These anonymous positions never enter contact or A/B projector stamps.
  for(const [i,pose] of (frame.poses??[]).slice(0,2).entries())
   ingestPose(engine,pose,source,'unassigned-'+i,frame.time,
    p=>({x:p.x,y:p.y,basis:'presence-only'}));
 }
 if(!tracker.isConfirmed||!cameraMatched||
  performerCount===2&&!idsValid)return;
 const visibleActors:Set<string>=performerCount===1?new Set(['performer-1']):
  new Set(identity.visible.filter(id=>identity.poseIndices[id]!==null));
 for(const e of tracker.session?.events??[]){
  if(e.source!=='camera'||e.confidence<.55||
   !visibleActors.has(e.performerId)||
   e.timestampMs>frame.time+70||e.timestampMs<nowMs-450)continue;
  const uv=floorToUV(tracker.floor!,e.positionM);
  if(e.kind==='contact'){
   engine.contact({source,eventId:`${tracker.sessionEpoch}:${e.id}`,actorId:e.performerId,foot:e.foot,
    x:uv.x,y:uv.y,confidence:e.confidence,atMs:e.timestampMs,
    basis:'calibrated-estimate',verified:true,headingRad:e.headingRad});
  }else if(e.kind==='move'||e.kind==='release'){
   engine.motionPhase({source,eventId:e.id,actorId:e.performerId,foot:e.foot,
    kind:e.kind==='move'?'slide':'release',
    x:uv.x,y:uv.y,confidence:e.confidence,atMs:e.timestampMs,
    basis:'calibrated-estimate',headingRad:e.headingRad});
  }
 }
}
export function feedVideoFloorInteractions(engine:FloorInteractionEngine,
 frame:Extract<ExperimentalFrame,{kind:'video'}>){
 if(engine.activeSource!=='video'||!frame.ready||frame.video?.seeking)return;
 const s=frame.snapshot,at=frame.timeMs;
 if(!s||at<s.atMs-70||at-s.atMs>500)return;
 engine.keepActors('video',s.ambiguous||s.people.length===0?
  s.rawPoses.slice(0,2).map((_,i)=>'unassigned-'+i):
  s.people.slice(0,2).map(person=>person.id));
 if(s.ambiguous||s.people.length===0){
  for(const [i,pose] of s.rawPoses.slice(0,2).entries())
   ingestPose(engine,pose,'video','unassigned-'+i,s.atMs,
    p=>({x:p.x,y:p.y,basis:'image-2d'}));
 }else{
  for(const person of s.people.slice(0,2))
   ingestPose(engine,person.landmarks,'video',person.id,s.atMs,
    p=>({x:p.x,y:p.y,basis:'image-2d'}));
 }
 if(s.ambiguous)return;
 const visibleActors=new Set(s.people.slice(0,2).map(person=>person.id));
 for(const e of s.events){
  if(e.confidence<.55||!visibleActors.has(e.performer)||
   e.atMs>at+70||e.atMs<s.atMs-1500)continue;
  if(e.kind==='contact'){
   engine.contact({source:'video',eventId:e.id,actorId:e.performer,
    foot:e.foot,x:clamp(e.x),y:clamp(e.y),atMs:e.atMs,
    confidence:e.confidence,basis:'image-2d',verified:true,headingRad:e.headingRad});
  }else if(e.kind==='slide'||e.kind==='pivot'||e.kind==='swing'){
   engine.motionPhase({source:'video',eventId:e.id,actorId:e.performer,
    foot:e.foot,kind:e.kind==='swing'?'release':e.kind,
    x:clamp(e.x),y:clamp(e.y),atMs:e.atMs,
    confidence:e.confidence,basis:'image-2d',headingRad:e.headingRad});
  }
 }
}
export function feedSimulatorFloorInteractions(engine:FloorInteractionEngine,
 frame:Extract<ExperimentalFrame,{kind:'simulator'}>){
 if(engine.activeSource!=='simulator')return;
 engine.keepActors('simulator',frame.performers.slice(0,2).map(p=>p.id));
 const floor:FloorSpace=frame.session.floor;
 for(const performer of frame.performers.slice(0,2)){
  const x=(performer.left.positionM.xM+performer.right.positionM.xM)/2;
  const y=(performer.left.positionM.yM+performer.right.positionM.yM)/2;
  const uv=floorToUV(floor,{xM:x,yM:y});
  engine.observe({source:'simulator',actorId:performer.id,
   x:uv.x,y:uv.y,confidence:1,atMs:frame.timeMs,basis:'simulated'});
 }
 for(const e of frame.session.events){
  if(e.timestampMs>frame.timeMs)continue;
  const uv=floorToUV(floor,e.positionM);
  if(e.kind==='contact'){
   engine.contact({source:'simulator',eventId:e.id,actorId:e.performerId,
    foot:e.foot,x:uv.x,y:uv.y,confidence:e.confidence,atMs:e.timestampMs,
    basis:'simulated',verified:true,headingRad:e.headingRad});
  }else if(e.kind==='move'||e.kind==='release'){
   engine.motionPhase({source:'simulator',eventId:e.id,actorId:e.performerId,
    foot:e.foot,kind:e.kind==='move'?'slide':'release',
    x:uv.x,y:uv.y,confidence:e.confidence,atMs:e.timestampMs,
    basis:'simulated',headingRad:e.headingRad});
  }
 }
}
export function feedTouchFloorInteraction(engine:FloorInteractionEngine,input:{
 kind:'down'|'move'|'up';pointerId:number;x:number;y:number;atMs:number;
}){
 if(engine.activeSource!=='touch'||!Number.isInteger(input.pointerId)||
  !Number.isFinite(input.x)||!Number.isFinite(input.y))return;
 const actorId='pointer-'+input.pointerId,base={
  source:'touch' as const,actorId,x:clamp(input.x),y:clamp(input.y),
  confidence:1,atMs:input.atMs,basis:'simulated' as const
 };
 if(input.kind==='down'){
  engine.observe(base);
  engine.contact({...base,eventId:actorId+':'+input.atMs,
   foot:input.pointerId%2===0?'right':'left',kind:'touch',verified:true});
 }else if(input.kind==='move')engine.observe(base);
 else engine.release(base);
}
/** Software overlay only: every input source draws through the same preview.
 * Uses authentic left/right 5-toe foot geometry and real heading when known.
 * Original FloorSession canvas and all hardware output remain unchanged. */
export function paintFloorInteractionOverlay(canvas:HTMLCanvasElement,
 engine:FloorInteractionEngine,atMs:number,lifeMs=8000){
 const w=1280,h=720;
 if(canvas.width!==w)canvas.width=w;
 if(canvas.height!==h)canvas.height=h;
 const ctx=canvas.getContext('2d');if(!ctx)return;
 ctx.clearRect(0,0,w,h);
 for(const e of engine.recent){
  const age=atMs-e.atMs;
  if(age<0||age>lifeMs)continue;
  if(e.kind==='release'||e.kind==='slide'||e.kind==='pivot')continue;
  const stamp=e.kind==='contact'||e.kind==='touch';
  const expiry=stamp?lifeMs:650;
  if(age>expiry)continue;
  const alpha=Math.max(0,1-age/expiry);
  const x=e.x*w,y=e.y*h;
  const rgb=e.actorId==='B'||e.actorId.includes('2')?'133,218,228':
   e.actorId.startsWith('unassigned')?'186,190,189':'203,229,175';
  ctx.save();
  ctx.strokeStyle='rgb('+rgb+')';ctx.fillStyle='rgb('+rgb+')';
  if(stamp){
   const heading=typeof e.headingRad==='number'&&Number.isFinite(e.headingRad)?Math.PI/2-e.headingRad:0;
   paintAuthenticFootprint(ctx,{
    x,y,side:e.foot??'left',headingRad:heading,
    widthPx:36,lengthPx:82,alpha:.72*alpha,color:'rgb('+rgb+')'
   });
  }else{
   ctx.globalAlpha=.32*alpha;
   const radius=e.kind==='movement'?26:37;
   ctx.lineWidth=4;ctx.beginPath();ctx.arc(x,y,radius+age/45,0,Math.PI*2);ctx.stroke();
   ctx.beginPath();ctx.arc(x,y,5,0,Math.PI*2);ctx.fill();
  }
  ctx.restore();
 }
}
