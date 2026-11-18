import type {ExperimentalFrame} from './experimentSourceModel.ts';
import type {FootprintConfig} from '../../footprints/StudioFootprints.tsx';
import {floorRasterPoint} from '../../footprints/simulator/floorCanvas.ts';
import {drawPuppetScene} from '../../footprints/simulator/draw3d.ts';
import {drawSkeletonBodies,replaySkeletonDiagnosticPreview} from '../../stage/fullBodySkeleton.ts';
import type {MotionVisualFrame} from '../../stage/actorMotionStateBuffer.ts';
import {paintIndependentBodyMasks,type BodyMaskPresentation} from '../../stage/persistentBodyMaskEngine.ts';

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
   {labels:actor.tentative?false:[actor.label],colors:[actor.color]});
  ctx.restore();
 }
 // A second body may have valid raw landmarks while its identity is still
 // reacquiring. Draw that *unassigned* observation in neutral grey rather than
 // blanking the whole performer. Avoid duplicate rasters near cached bodies.
 const latest=frame.snapshot,age=latest?frame.timeMs-latest.atMs:Infinity;
 if(latest&&age>=0&&age<=185){
  const center=(pose:readonly {x:number;y:number}[])=>{
   const hip=pose[23],shoulder=pose[11];
   return hip&&shoulder&&[hip.x,hip.y,shoulder.x,shoulder.y].every(Number.isFinite)?
    {x:(hip.x+shoulder.x)/2,y:(hip.y+shoulder.y)/2}:null;
  };
  const raw=latest.rawPoses.flatMap((pose,index)=>{
   if(pose.length!==33)return [];
   const assigned=!latest.ambiguous&&latest.actorStates.find(a=>
    a.presence==='visible'&&a.rawIndex===index);
   if(assigned&&motion.actors.some(actor=>
    actor.id===assigned.id&&!actor.tentative))return [];
   const point=center(pose);
   const duplicate=point&&motion.actors.some(actor=>{
    const old=center(actor.pose);
    return old&&Math.hypot(old.x-point.x,old.y-point.y)<.12;
   });
   return duplicate?[]:[pose];
  }).slice(0,2);
  if(raw.length){
   ctx.save();ctx.globalAlpha=.55;
   drawSkeletonBodies(ctx,raw,rect,
    {labels:false,colors:['#9daaa4','#9daaa4']});
   ctx.restore();
  }
 }
}
export function paintExperimentCamera(canvas:HTMLCanvasElement,frame:ExperimentalFrame,
 skeleton=true,motion?:MotionVisualFrame,masks?:BodyMaskPresentation){
 // Decoder-not-ready must not clear the last presented video raster.
 if(frame.kind==='video'&&(!frame.video||!frame.ready||
    frame.video.readyState<2||!frame.video.videoWidth||!frame.video.videoHeight))return;
 const ctx=context(canvas,768,432);if(!ctx)return;
 if(frame.kind==='video'){
  const v=frame.video!;
  const scale=Math.min(768/v.videoWidth,432/v.videoHeight);
  const w=scale*v.videoWidth,h=scale*v.videoHeight;
  try{ctx.drawImage(v,(768-w)/2,(432-h)/2,w,h);}catch{/* decoder switched */ }
  if(masks?.actors.length)
   paintIndependentBodyMasks(ctx,masks,
    {x:(768-w)/2,y:(432-h)/2,width:w,height:h},skeleton?.20:.42);
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
 skeleton=true,motion?:MotionVisualFrame,masks?:BodyMaskPresentation,
 cleanBodyOutput=false){
 // A momentary decoder gap must not black-flash the previous BODY preview.
 if(frame.kind==='video'&&!frame.ready)return;
 const w=640,h=360,ctx=context(canvas,w,h);if(!ctx)return;
 if(frame.kind==='simulator'){
  // BODY preview zooms toward the virtual legs; INPUT retains the full stage view.
  const closeOrbit={...frame.orbit,distanceM:Math.max(5.7,frame.orbit.distanceM*.62)};
  drawPuppetScene(ctx,w,h,frame.session.floor,closeOrbit,frame.performers,
   frame.performers.length,frame.session.events,null,false);
  return;
 }
 const snapshot=frame.snapshot;
 if(!frame.ready)return;
 // S0.6.5: clean BODY raster can only draw actor-owned, bridge-approved
 // masks. Unassigned raw poses and buffered tentative skeletons may remain
 // visible in INPUT diagnostics but cannot leak into this output channel.
 if(cleanBodyOutput){
  if(masks?.actors.length){
   paintIndependentBodyMasks(ctx,masks,{x:0,y:0,width:w,height:h},1);
   if(skeleton&&motion){
    const safeIds=new Set(masks.actors.filter(a=>!a.tentative).map(a=>a.id));
    for(const actor of motion.actors){
     // A motion sample may be visually tentative between AI measurements;
     // the separately approved A/B mask provides the ID gate here.
     if(!safeIds.has(actor.id)||actor.ageMs>260)continue;
     ctx.save();ctx.globalAlpha=actor.opacity*.65;
     const actorColor=actor.id==='A'?'#dbe9ca':'#80d1da';
     drawSkeletonBodies(ctx,[actor.pose],{x:0,y:0,width:w,height:h},
      {labels:[`ACTOR ${actor.id}`],colors:[actorColor]});
     ctx.restore();
    }
   }
  }
  return;
 }
 // Independent pose-guided A/B masks persist and move under optical flow.
 // The pixels below remain software preview only, not live projector output.
 if(masks?.actors.length)
  paintIndependentBodyMasks(ctx,masks,{x:0,y:0,width:w,height:h},
   skeleton?.40:1);
 // Software preview still renders the last measured A/B poses when a
 // React snapshot briefly clears during video/worker handover.
 if(skeleton&&motion){
  drawBufferedBodies(ctx,{x:0,y:0,width:w,height:h},motion,frame);
  return;
 }
 if(!snapshot&&!motion?.actors.length)return;
 if(!skeleton&&masks?.actors.length)return;
 if(skeleton){
  if(!snapshot)return;
  const preview=replaySkeletonDiagnosticPreview(snapshot,frame.timeMs,frame.previousSnapshot);
  const rect={x:0,y:0,width:w,height:h};
  ctx.save();ctx.globalAlpha=preview.opacity;
  drawSkeletonBodies(ctx,preview.poses,rect,
   {labels:preview.labels,colors:preview.colors});
  ctx.restore();
  return;
 }
 // Skeleton OFF must use the SAME per-actor optical-flow positions as the
 // main BODY skeleton. Never regress to the QA-gated measured-only snapshots.
 const people=motion?.actors.length?
  motion.actors.map(a=>({id:a.id,landmarks:a.pose,opacity:a.opacity,
   tentative:a.tentative??false})):
  (snapshot?.people??[]).map(a=>({id:a.id,landmarks:a.landmarks,
   opacity:1,tentative:false}));
 for(const person of people){
  const points=person.landmarks;
  if(points.length<33)continue;
  if(![23,24,25,26,27,28,29,30,31,32].every(i=>
   points[i]&&Number.isFinite(points[i].x)&&Number.isFinite(points[i].y)&&
   (points[i].visibility??0)>=.52))continue;
  const color=person.tentative?'#9daaa4':
   person.id==='A'?'#deead4':'#9ed8d1';
  ctx.save();ctx.globalAlpha=person.opacity;ctx.lineCap='round';ctx.lineJoin='round';ctx.strokeStyle=color;
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
