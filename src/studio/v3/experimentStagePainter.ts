import type {ExperimentalFrame} from './experimentSourceModel.ts';
import type {FootprintConfig} from '../../footprints/StudioFootprints.tsx';
import {floorRasterPoint} from '../../footprints/simulator/floorCanvas.ts';
import {drawPuppetScene} from '../../footprints/simulator/draw3d.ts';
import {drawSkeletonBodies,replaySkeletonDiagnosticPreview} from '../../stage/fullBodySkeleton.ts';
import type {MotionVisualFrame} from '../../stage/actorMotionStateBuffer.ts';

function context(canvas:HTMLCanvasElement,w:number,h:number){
 if(canvas.width!==w)canvas.width=w;
 if(canvas.height!==h)canvas.height=h;
 const ctx=canvas.getContext('2d');
 if(!ctx)return null;
 ctx.setTransform(1,0,0,1,0,0);
 ctx.fillStyle='#040806';ctx.fillRect(0,0,w,h);
 return ctx;
}
/**
 * Render predicted/interpolated landmarks for DIAGNOSTIC software preview only.
 * Never export these coordinates to contact detection or physical projector.
 */
function drawBufferedBodies(ctx:CanvasRenderingContext2D,rect:{x:number;y:number;width:number;height:number},
 motion:MotionVisualFrame,frame:Extract<ExperimentalFrame,{kind:'video'}>){
 for(const actor of motion.actors){
  ctx.save();ctx.globalAlpha=actor.opacity;
  drawSkeletonBodies(ctx,[actor.pose],rect,
   {labels:[actor.label],colors:[actor.color]});
  ctx.restore();
 }
 // Uncertain A/B must never receive a misleading performer label.
 // Show neutral raw detections briefly when identity is held at crossing.
 const latest=frame.snapshot,age=latest?frame.timeMs-latest.atMs:Infinity;
 if(motion.actors.length===0&&latest&&age>=0&&age<=130&&
   (latest.ambiguous||latest.rawPoses.length>0)){
  const raw=latest.rawPoses.filter(p=>p.length===33).slice(0,2);
  if(raw.length){
   ctx.save();ctx.globalAlpha=.42;
   drawSkeletonBodies(ctx,raw,rect,
    {labels:false,colors:['#82968a','#82968a']});
   ctx.restore();
  }
 }
}
export function paintExperimentCamera(canvas:HTMLCanvasElement,frame:ExperimentalFrame,
 skeleton=true,motion?:MotionVisualFrame){
 const ctx=context(canvas,768,432);if(!ctx)return;
 if(frame.kind==='video'){
  const v=frame.video;
  if(!v||!frame.ready||v.readyState<2||!v.videoWidth||!v.videoHeight)return;
  const scale=Math.min(768/v.videoWidth,432/v.videoHeight);
  const w=scale*v.videoWidth,h=scale*v.videoHeight;
  try{ctx.drawImage(v,(768-w)/2,(432-h)/2,w,h);}catch{/* decoder switched */ }
  if(skeleton&&motion){
   drawBufferedBodies(ctx,{x:(768-w)/2,y:(432-h)/2,width:w,height:h},motion,frame);
  }else if(skeleton&&frame.snapshot){
   const preview=replaySkeletonDiagnosticPreview(frame.snapshot,frame.timeMs,frame.previousSnapshot);
   const rect={x:(768-w)/2,y:(432-h)/2,width:w,height:h};
   ctx.save();ctx.globalAlpha=preview.opacity;
   drawSkeletonBodies(ctx,preview.poses,rect,
    {labels:preview.labels,colors:preview.colors});
   ctx.restore();
  }
  return;
 }
 drawPuppetScene(ctx,768,432,frame.session.floor,frame.orbit,frame.performers,
  frame.performers.length,frame.session.events,null,true);
}
export function paintExperimentBody(canvas:HTMLCanvasElement,frame:ExperimentalFrame,
 skeleton=true,motion?:MotionVisualFrame){
 const w=640,h=360,ctx=context(canvas,w,h);if(!ctx)return;
 if(frame.kind==='simulator'){
  // BODY preview zooms toward the virtual legs; INPUT retains the full stage view.
  const closeOrbit={...frame.orbit,distanceM:Math.max(5.7,frame.orbit.distanceM*.62)};
  drawPuppetScene(ctx,w,h,frame.session.floor,closeOrbit,frame.performers,
   frame.performers.length,frame.session.events,null,false);
  return;
 }
 const snapshot=frame.snapshot;
 if(!snapshot||!frame.ready)return;
 if(skeleton&&motion){
  drawBufferedBodies(ctx,{x:0,y:0,width:w,height:h},motion,frame);
  return;
 }
 if(skeleton){
  const preview=replaySkeletonDiagnosticPreview(snapshot,frame.timeMs,frame.previousSnapshot);
  const rect={x:0,y:0,width:w,height:h};
  ctx.save();ctx.globalAlpha=preview.opacity;
  drawSkeletonBodies(ctx,preview.poses,rect,
   {labels:preview.labels,colors:preview.colors});
  ctx.restore();
  return;
 }
 for(const person of snapshot.people){
  const points=person.landmarks;
  if(points.length<33)continue;
  if(![23,24,25,26,27,28,29,30,31,32].every(i=>
   points[i]&&Number.isFinite(points[i].x)&&Number.isFinite(points[i].y)&&
   (points[i].visibility??0)>=.52))continue;
  const color=person.id==='A'?'#deead4':'#9ed8d1';
  ctx.save();ctx.lineCap='round';ctx.lineJoin='round';ctx.strokeStyle=color;
  const hipWidth=Math.hypot((points[23].x-points[24].x)*w,(points[23].y-points[24].y)*h);
  ctx.lineWidth=Math.max(8,Math.min(32,hipWidth*.4));
  for(const ids of [[23,25,27,29,31],[24,26,28,30,32]]){
   ctx.beginPath();ids.forEach((idx,j)=>{
    const p=points[idx];if(j)ctx.lineTo(p.x*w,p.y*h);else ctx.moveTo(p.x*w,p.y*h);
   });ctx.stroke();
  }
  ctx.restore();
 }
}
export function paintExperimentFloor(canvas:HTMLCanvasElement,frame:ExperimentalFrame,
 config:Pick<FootprintConfig,'style'|'size'|'colors'|'life'>){
 const w=1280,h=720,ctx=context(canvas,w,h);if(!ctx)return;
 // The video frame has image-relative coordinates; no metric floor conversion is claimed.
 ctx.strokeStyle='rgba(177,208,171,.10)';ctx.lineWidth=1;
 for(let i=1;i<10;i++){ctx.beginPath();ctx.moveTo(w*i/10,0);ctx.lineTo(w*i/10,h);ctx.stroke();}
 for(let i=1;i<6;i++){ctx.beginPath();ctx.moveTo(0,h*i/6);ctx.lineTo(w,h*i/6);ctx.stroke();}
 const isVideo=frame.kind==='video';
 const events=isVideo?frame.snapshot?.events??[]:frame.session.events;
 const lifeMs=Math.max(900,Math.min(60000,config.life*1000));
 const last=new Map<string,{x:number;y:number}>();
 for(const event of events){
  const at=isVideo?(event as {atMs:number}).atMs:
   (event as {timestampMs:number}).timestampMs;
  if(at>frame.timeMs||!Number.isFinite(at))continue;
  if(isVideo&&frame.timeMs-at>lifeMs)continue;
  const id=isVideo?(event as {performer:string}).performer:
   (event as {performerId:string}).performerId;
  const foot=event.foot;
  const key=id+':'+foot;
  const pt=isVideo?{x:(event as {x:number}).x*w,y:(event as {y:number}).y*h}:
   floorRasterPoint(frame.session.floor,
    (event as {positionM:{xM:number;yM:number}}).positionM,w,h);
  if(!Number.isFinite(pt.x)||!Number.isFinite(pt.y)||pt.x<0||pt.y<0||pt.x>w||pt.y>h)continue;
  const isContact=event.kind==='contact';
  const alpha=isVideo?Math.max(.1,1-(frame.timeMs-at)/lifeMs):.95;
  const color=foot==='left'?config.colors.left:config.colors.right;
  const lastPt=last.get(key);
  if(config.style==='Garis'&&lastPt){
   ctx.save();ctx.globalAlpha=alpha;ctx.strokeStyle=color;ctx.lineWidth=Math.max(1,config.size/7);
   ctx.beginPath();ctx.moveTo(lastPt.x,lastPt.y);ctx.lineTo(pt.x,pt.y);ctx.stroke();ctx.restore();
  }
  if(event.kind==='swing'||event.kind==='release')continue;
  last.set(key,pt);
  if(!isContact&&config.style!=='Garis')continue;
  ctx.save();ctx.globalAlpha=alpha;ctx.fillStyle=color;ctx.strokeStyle=color;
  ctx.translate(pt.x,pt.y);
  const theta=Number.isFinite(event.headingRad)?event.headingRad:0;
  ctx.rotate(Math.PI/2-theta);
  const size=Math.max(5,Math.min(60,config.size));
  if(config.style==='Titik'){
   ctx.beginPath();ctx.arc(0,0,Math.max(3,size*.14),0,Math.PI*2);ctx.fill();
  }else if(config.style==='Garis'){
   ctx.lineWidth=Math.max(2,size/5);ctx.beginPath();ctx.moveTo(0,-size*.55);
   ctx.lineTo(0,size*.55);ctx.stroke();
  }else{
   ctx.beginPath();ctx.ellipse(0,0,size*.32,size*.65,-.15,0,Math.PI*2);
   ctx.fill();
   if(config.style==='Campuran')for(let i=0;i<5;i++){
    ctx.beginPath();ctx.arc((i-2)*size*.115,-size*.75-size*.08*Math.abs(i-2),
     Math.max(1.5,size*.065),0,Math.PI*2);ctx.fill();
   }
  }
  ctx.restore();
 }
}
