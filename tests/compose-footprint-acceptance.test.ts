import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import type {MotionFrame,Landmark} from '../src/engine/types.ts';
import {GaitAnalyzer} from '../src/footprints/gait-analysis/index.ts';
import {FootstepEventEngine} from '../src/footprints/spatial/events.ts';
import {defaultFloorSpace,floorToUV} from '../src/footprints/spatial/coordinates.ts';
import {FloorInteractionEngine,floorEventPhysicalOutputAuthorized} from '../src/footprints/scenes/FloorInteractionEngine.ts';
import {footMotionAuthorizesPhysicalOutput,validFootMotionEvent} from '../src/footprints/scenes/FootMotionEventV2.ts';
import {collectTimelineEvents,emptyTimelineCapture,reconstructTimelineFootprints} from '../src/studio/v3/composerEventTimelineModel.ts';
import {composerLiquidDemoEvents,composerLiquidTrackEvents} from '../src/studio/v3/composerLiquidAdapter.ts';
import {collectLiquidImprints,liquidOutputAuthorized} from '../src/footprints/materials/liquidImprintTimeline.ts';
import {COMPOSE_STEER_MACROS,COMPOSE_VISUAL_STYLES,deriveComposeProvenance,footprintSpriteDimensions,sanitizeSteeringState} from '../src/footprints/materials/composeVisualStyles.ts';
import {footprintOutline,footprintToes} from '../src/footprints/scenes/authenticFootGeometry.ts';
import {feedVideoFloorInteractions} from '../src/footprints/scenes/interactionAdapters.ts';
import type {ExperimentalFrame} from '../src/studio/v3/experimentSourceModel.ts';

const FLOOR=defaultFloorSpace(4,3);
const ASPECT=16/9;

function makePose(opts:{
 pelvisX?:number;pelvisY?:number;
 leftCenter?:{x:number;y:number};leftHeadingRad?:number;leftVis?:number;
 rightCenter?:{x:number;y:number};rightHeadingRad?:number;rightVis?:number;
}):Landmark[]{
 const pose:Landmark[]=Array.from({length:33},()=>({x:.5,y:.5,z:0,visibility:.95}));
 const px=opts.pelvisX??.5,py=opts.pelvisY??.42;
 pose[23]={x:px-.06,y:py,z:0,visibility:.96};
 pose[24]={x:px+.06,y:py,z:0,visibility:.96};
 pose[11]={x:px-.07,y:py-.18,z:0,visibility:.96};
 pose[12]={x:px+.07,y:py-.18,z:0,visibility:.96};
 const placeFoot=(side:0|1,center:{x:number;y:number},headingRad:number,vis:number)=>{
  const halfLen=.032;
  const dx=Math.cos(headingRad)*halfLen;
  const dy=Math.sin(headingRad)*(halfLen*(16/9));
  pose[27+side]={x:center.x-dx*.4,y:center.y-.025,z:0,visibility:vis};
  pose[29+side]={x:center.x-dx,y:center.y-dy,z:0,visibility:vis};
  pose[31+side]={x:center.x+dx,y:center.y+dy,z:0,visibility:vis};
 };
 placeFoot(0,opts.leftCenter??{x:px-.05,y:.78},opts.leftHeadingRad??0,opts.leftVis??.95);
 placeFoot(1,opts.rightCenter??{x:px+.05,y:.78},opts.rightHeadingRad??0,opts.rightVis??.95);
 return pose;
}

function makeFrame(time:number,pose:Landmark[]):MotionFrame{
 return {
  source:'camera',tracked:true,time,
  pose,poses:[pose],
  energy:.2,spread:.2,x:.5,y:.5,vx:0,vy:0,hands:0,presence:1
 } as unknown as MotionFrame;
}

function angleDiffDeg(aRad:number,bRad:number){
 const diff=Math.atan2(Math.sin(aRad-bRad),Math.cos(aRad-bRad));
 return Math.abs(diff*180/Math.PI);
}

test('S01: Stationary foot for 10s emits exactly 1 contact stamp and 0 duplicates',()=>{
 const gait=new GaitAnalyzer();
 const bus=new FloorInteractionEngine();
 bus.reset('camera');
 let stamps=0;
 let capture=emptyTimelineCapture(bus.currentSessionId);
 for(let t=0;t<=10000;t+=50){
  const pose=makePose({leftCenter:{x:.44,y:.78},leftHeadingRad:0.15});
  const s=gait.observe(makeFrame(t,pose),0,t,ASPECT);
  if(s?.stamp){
   stamps++;
   bus.contact({source:'camera',eventId:'s01-'+t,actorId:'A',foot:'left',
    x:s.x,y:s.y,confidence:s.confidence,atMs:t,basis:'calibrated-estimate',
    verified:true,headingRad:s.heading});
  }
  capture=collectTimelineEvents(capture,bus.canonicalRecent,bus.currentSessionId,t);
 }
 assert.equal(stamps,1,'Stationary foot over 10s must produce exactly 1 initial contact');
 const liquidEvents=composerLiquidTrackEvents(capture,10000,'live',12000);
 const imprints=collectLiquidImprints(liquidEvents,10000,{lifeMs:12000});
 assert.equal(imprints.length,1);
 assert.equal(imprints[0].orientationKnown,true);
});

test('S02: Forward walk 6 alternating steps preserves count, side, and real heading end-to-end',()=>{
 const engine=new FootstepEventEngine(FLOOR);
 const bus=new FloorInteractionEngine();
 bus.reset('camera');
 let capture=emptyTimelineCapture(bus.currentSessionId);
 const expectedHeading=0.32;
 let t=100;
 const planted:{left:{xM:number;yM:number}|null;right:{xM:number;yM:number}|null}={left:null,right:null};
 for(let step=0;step<6;step++){
  const foot=step%2===0?'left':'right';
  const other=foot==='left'?'right':'left';
  const pos={xM:0.7+step*0.45,yM:foot==='left'?1.35:1.65};
  // Keep supporting foot observed (<450ms cadence) while active foot swings & releases prior stance
  if(planted[other]){
   engine.observe({performerId:'A',foot:other,timestampMs:t,phase:'stance',positionM:planted[other],
    headingRad:expectedHeading,source:'camera',positionBasis:'calibrated-estimate',confidence:.94});
  }
  const swingEvs=engine.observe({performerId:'A',foot,timestampMs:t,phase:'swing',positionM:null,
   headingRad:expectedHeading,source:'camera',positionBasis:'calibrated-estimate',confidence:.93});
  for(const e of swingEvs){
   if(e.kind==='release'){
    const uv=floorToUV(FLOOR,e.positionM);
    bus.motionPhase({source:'camera',eventId:e.id,actorId:e.performerId,foot:e.foot,kind:'release',
     x:uv.x,y:uv.y,confidence:e.confidence,atMs:e.timestampMs,
     basis:'calibrated-estimate',headingRad:e.headingRad});
   }
  }
  capture=collectTimelineEvents(capture,bus.canonicalRecent,bus.currentSessionId,t);
  t+=180;
  if(planted[other]){
   engine.observe({performerId:'A',foot:other,timestampMs:t,phase:'stance',positionM:planted[other],
    headingRad:expectedHeading,source:'camera',positionBasis:'calibrated-estimate',confidence:.94});
  }
  const evs=engine.observe({performerId:'A',foot,timestampMs:t,phase:'stance',positionM:pos,
   headingRad:expectedHeading,source:'camera',positionBasis:'calibrated-estimate',confidence:.94});
  planted[foot]=pos;
  for(const e of evs){
   if(e.kind==='contact'){
    const uv=floorToUV(FLOOR,e.positionM);
    bus.contact({source:'camera',eventId:e.id,actorId:e.performerId,foot:e.foot,
     x:uv.x,y:uv.y,confidence:e.confidence,atMs:e.timestampMs,
     basis:'calibrated-estimate',verified:true,headingRad:e.headingRad});
   }
  }
  capture=collectTimelineEvents(capture,bus.canonicalRecent,bus.currentSessionId,t);
  t+=280;
 }
 const liquidEvents=composerLiquidTrackEvents(capture,t,'live',10000);
 const imprints=collectLiquidImprints(liquidEvents,t,{lifeMs:10000});
 assert.equal(imprints.length,6);
 assert.deepEqual(imprints.map(i=>i.foot),['left','right','left','right','left','right']);
 for(const imp of imprints){
  assert.equal(imp.orientationKnown,true);
  assert.ok(angleDiffDeg(imp.headingRad,expectedHeading)<0.5);
 }
 // Also verify Timeline Replay reconstructs true headingDeg (never hardcoded 0)
 const replay=reconstructTimelineFootprints(capture,t);
 assert.equal(replay.imprints.length,6);
 assert.ok(Math.abs(replay.imprints[0].headingDeg-expectedHeading*180/Math.PI)<0.5);
});

test('S03: Backward walk keeps heel-to-toe foot heading instead of body travel direction',()=>{
 const gait=new GaitAnalyzer();
 const footFacing=0; // Foot toes still point right (+X) while body walks backward (-X)
 const landedHeadings:number[]=[];
 let t=0;
 // Initial planted stance at x=0.65, y=0.78 facing +X
 for(let i=0;i<6;i++){
  t+=50;
  const s=gait.observe(makeFrame(t,makePose({pelvisX:.65,leftCenter:{x:.61,y:.78},leftHeadingRad:footFacing})),0,t,ASPECT);
  if(s?.stamp)landedHeadings.push(s.heading);
 }
 // Lift and swing backward (-X) from x=0.61 -> x=0.41 while toes remain pointing +X
 for(let i=1;i<=5;i++){
  t+=50;
  const px=0.65-i*0.04;
  gait.observe(makeFrame(t,makePose({pelvisX:px,leftCenter:{x:px-.04,y:.64},leftHeadingRad:footFacing})),0,t,ASPECT);
 }
 // Plant foot at new backward position still facing +X (0 rad)
 for(let i=0;i<8;i++){
  t+=50;
  const s=gait.observe(makeFrame(t,makePose({pelvisX:.45,leftCenter:{x:.41,y:.78},leftHeadingRad:footFacing})),0,t,ASPECT);
  if(s?.stamp)landedHeadings.push(s.heading);
 }
 assert.equal(landedHeadings.length,2,'Backward walk must land cleanly on second step');
 assert.ok(angleDiffDeg(landedHeadings[1],footFacing)<2.0,
  `Expected heel-to-toe heading near 0°, got ${(landedHeadings[1]*180/Math.PI).toFixed(2)}°`);
});

test('S04: Lateral steps map accurately to calibrated floor X/Y coordinates',()=>{
 const engine=new FootstepEventEngine(FLOOR);
 const bus=new FloorInteractionEngine();
 bus.reset('camera');
 let capture=emptyTimelineCapture(bus.currentSessionId);
 const lateralPoints=[{xM:1.0,yM:1.5},{xM:1.6,yM:1.5},{xM:2.2,yM:1.5},{xM:2.8,yM:1.5}];
 let t=100;
 for(let i=0;i<lateralPoints.length;i++){
  const foot=i%2===0?'left':'right';
  const pos=lateralPoints[i];
  engine.observe({performerId:'A',foot,timestampMs:t,phase:'swing',positionM:null,
   headingRad:-Math.PI/2,source:'camera',positionBasis:'calibrated-estimate',confidence:.92});
  t+=150;
  const [ev]=engine.observe({performerId:'A',foot,timestampMs:t,phase:'stance',positionM:pos,
   headingRad:-Math.PI/2,source:'camera',positionBasis:'calibrated-estimate',confidence:.92});
  const uv=floorToUV(FLOOR,ev.positionM);
  bus.contact({source:'camera',eventId:ev.id,actorId:'A',foot,x:uv.x,y:uv.y,
   confidence:ev.confidence,atMs:t,basis:'calibrated-estimate',verified:true,headingRad:ev.headingRad});
  capture=collectTimelineEvents(capture,bus.canonicalRecent,bus.currentSessionId,t);
  t+=200;
 }
 const imprints=collectLiquidImprints(composerLiquidTrackEvents(capture,t,'live',10000),t,{lifeMs:10000});
 assert.equal(imprints.length,4);
 for(let i=0;i<4;i++){
  const expectedUv=floorToUV(FLOOR,lateralPoints[i]);
  assert.ok(Math.abs(imprints[i].x-expectedUv.x)<1e-6);
  assert.ok(Math.abs(imprints[i].y-expectedUv.y)<1e-6);
  assert.ok(angleDiffDeg(imprints[i].headingRad,-Math.PI/2)<0.5);
 }
});

test('S05: 90° and 180° turns match turned foot heel-to-toe heading within < 2°',()=>{
 const targets=[Math.PI/2,Math.PI];
 for(const targetHeading of targets){
  const gait=new GaitAnalyzer();
  let t=0;
  let capturedHeading:number|null=null;
  // Establish fresh landing facing targetHeading
  for(let i=0;i<8;i++){
   t+=50;
   const s=gait.observe(makeFrame(t,makePose({
    pelvisX:.5,leftCenter:{x:.46,y:.78},leftHeadingRad:targetHeading
   })),0,t,ASPECT);
   if(s?.stamp)capturedHeading=s.heading;
  }
  assert.notEqual(capturedHeading,null);
  assert.ok(angleDiffDeg(capturedHeading!,targetHeading)<2.0,
   `Turn target ${(targetHeading*180/Math.PI).toFixed(1)}° deviated by ${angleDiffDeg(capturedHeading!,targetHeading).toFixed(2)}°`);
 }
});

test('S06: Pivot on supporting foot emits 0 new contact stamps and forwards pivot phase to active imprint',()=>{
 const gait=new GaitAnalyzer();
 const bus=new FloorInteractionEngine();
 bus.reset('camera');
 let capture=emptyTimelineCapture(bus.currentSessionId);
 let t=0;
 let contacts=0;
 let sawPivot=false;
 // Plant foot at heading 0
 for(let i=0;i<6;i++){
  t+=50;
  const s=gait.observe(makeFrame(t,makePose({leftCenter:{x:.45,y:.78},leftHeadingRad:0})),0,t,ASPECT);
  if(s?.stamp){
   contacts++;
   bus.contact({source:'camera',eventId:'pivot-base',actorId:'A',foot:'left',
    x:s.x,y:s.y,confidence:s.confidence,atMs:t,basis:'calibrated-estimate',verified:true,headingRad:s.heading});
  }
  capture=collectTimelineEvents(capture,bus.canonicalRecent,bus.currentSessionId,t);
 }
 // Rotate foot in place by +0.65 rad (~37°) without lifting
 for(let i=1;i<=6;i++){
  t+=50;
  const h=0.12*i;
  const s=gait.observe(makeFrame(t,makePose({leftCenter:{x:.45,y:.78},leftHeadingRad:h})),0,t,ASPECT);
  if(s?.stamp)contacts++;
  if(s?.motionKind==='pivot'){
   sawPivot=true;
   bus.motionPhase({source:'camera',eventId:'pivot-phase-'+i,actorId:'A',foot:'left',kind:'pivot',
    x:s.x,y:s.y,confidence:s.confidence,atMs:t,basis:'calibrated-estimate',headingRad:s.heading});
  }
  capture=collectTimelineEvents(capture,bus.canonicalRecent,bus.currentSessionId,t);
 }
 assert.equal(contacts,1,'Pivot must never mint a second contact stamp');
 assert.equal(sawPivot,true,'GaitAnalyzer must classify planted rotation as pivot');
 const imprints=collectLiquidImprints(composerLiquidTrackEvents(capture,t,'live',10000),t,{lifeMs:10000});
 assert.equal(imprints.length,1);
 assert.equal(imprints[0].deformation.mode,'pivot');
});

test('S07: Slide/drag forwards slide phase without fabricating extra contact stamps',()=>{
 const bus=new FloorInteractionEngine();
 bus.reset('video');
 let capture=emptyTimelineCapture(bus.currentSessionId);
 const contactEv=bus.contact({source:'video',eventId:'slide-c1',actorId:'A',foot:'right',
  x:.40,y:.60,confidence:.91,atMs:100,basis:'image-2d',verified:true,headingRad:.25});
 assert.ok(contactEv);
 const slideEv=bus.motionPhase({source:'video',eventId:'slide-m1',actorId:'A',foot:'right',kind:'slide',
  x:.46,y:.61,confidence:.90,atMs:240,basis:'image-2d',headingRad:.28});
 assert.ok(slideEv);
 assert.equal(slideEv.verified,false,'Slide phase must never carry verified contact status');
 capture=collectTimelineEvents(capture,bus.canonicalRecent,bus.currentSessionId,240);
 const imprints=collectLiquidImprints(composerLiquidTrackEvents(capture,280,'live',10000),280,{lifeMs:10000});
 assert.equal(imprints.length,1,'Slide must deform existing sole, not mint a second stamp');
 assert.equal(imprints[0].deformation.mode,'slide');
 assert.ok(Math.hypot(imprints[0].deformation.travelX??0,imprints[0].deformation.travelY??0)>0.1);
});

test('S08: Rapid stop-start is debounced with zero duplicated contact IDs',()=>{
 const bus=new FloorInteractionEngine();
 bus.reset('camera');
 // Repeated emission of same origin eventId must deduplicate
 const first=bus.contact({source:'camera',eventId:'rapid-1',actorId:'A',foot:'left',
  x:.5,y:.5,confidence:.9,atMs:1000,basis:'calibrated-estimate',verified:true,headingRad:.1});
 const dup=bus.contact({source:'camera',eventId:'rapid-1',actorId:'A',foot:'left',
  x:.5,y:.5,confidence:.9,atMs:1040,basis:'calibrated-estimate',verified:true,headingRad:.1});
 assert.ok(first);
 assert.equal(dup,null);
 // GaitAnalyzer debounce rejects sub-threshold landmark jitter while planted
 const gait=new GaitAnalyzer();
 let stamps=0;
 for(let t=0;t<=600;t+=40){
  const jitterY=t===280?.772:.78; // sub-threshold 0.8% noise, not a real lift
  const s=gait.observe(makeFrame(t,makePose({leftCenter:{x:.45,y:jitterY},leftHeadingRad:0})),0,t,ASPECT);
  if(s?.stamp)stamps++;
 }
 assert.equal(stamps,1);
});

test('S09: Two performers crossing keep A/B isolated and block stamps when identity is ambiguous',()=>{
 const bus=new FloorInteractionEngine();
 bus.reset('video');
 const poseA=makePose({pelvisX:.35});
 const poseB=makePose({pelvisX:.65});
 // Clean frame: A and B separated -> both stamps accepted with distinct actorIds
 const cleanFrame:Extract<ExperimentalFrame,{kind:'video'}>={
  kind:'video',ready:true,timeMs:400,video:null,
  snapshot:{
   atMs:400,ambiguous:false,rawPoses:[poseA,poseB],
   people:[{id:'A',landmarks:poseA},{id:'B',landmarks:poseB}],
   events:[
    {id:'v-a1',performer:'A',foot:'left',kind:'contact',x:.35,y:.78,atMs:380,confidence:.92,headingRad:.2},
    {id:'v-b1',performer:'B',foot:'right',kind:'contact',x:.65,y:.78,atMs:390,confidence:.91,headingRad:-.2}
   ]
  }
 } as unknown as Extract<ExperimentalFrame,{kind:'video'}>;
 feedVideoFloorInteractions(bus,cleanFrame);
 // Crossing frame: ambiguous=true -> must NOT stamp either performer
 const crossingFrame:Extract<ExperimentalFrame,{kind:'video'}>={
  kind:'video',ready:true,timeMs:520,video:null,
  snapshot:{
   atMs:520,ambiguous:true,rawPoses:[poseA,poseB],
   people:[{id:'A',landmarks:poseA},{id:'B',landmarks:poseB}],
   events:[
    {id:'v-cross-a',performer:'A',foot:'right',kind:'contact',x:.50,y:.78,atMs:510,confidence:.95,headingRad:0},
    {id:'v-cross-b',performer:'B',foot:'left',kind:'contact',x:.50,y:.78,atMs:515,confidence:.95,headingRad:0}
   ]
  }
 } as unknown as Extract<ExperimentalFrame,{kind:'video'}>;
 feedVideoFloorInteractions(bus,crossingFrame);
 const contacts=bus.recent.filter(e=>e.kind==='contact');
 assert.equal(contacts.length,2,'Ambiguous crossing frame must emit 0 stamps');
 assert.deepEqual(contacts.map(c=>c.actorId),['A','B']);
});

test('S10: Foot occluded 0.5-2s emits 0 fabricated stamps and recovers cleanly',()=>{
 const gait=new GaitAnalyzer();
 let stamps=0;
 let t=0;
 // Initial stable stance
 for(let i=0;i<6;i++){
  t+=50;
  const s=gait.observe(makeFrame(t,makePose({leftCenter:{x:.45,y:.78},leftVis:.95})),0,t,ASPECT);
  if(s?.stamp)stamps++;
 }
 assert.equal(stamps,1);
 // Occluded for 1200ms (low visibility 0.2 < 0.55)
 for(let i=0;i<24;i++){
  t+=50;
  const s=gait.observe(makeFrame(t,makePose({leftCenter:{x:.45,y:.78},leftVis:.20})),0,t,ASPECT);
  assert.equal(s,null,'Occluded landmarks must return null, never fabricate a stamp');
 }
 assert.equal(stamps,1,'Zero stamps during occlusion');
 // Recovery after occlusion when performer steps to a new position
 for(let i=0;i<6;i++){
  t+=50;
  const s=gait.observe(makeFrame(t,makePose({leftCenter:{x:.52,y:.78},leftVis:.94,leftHeadingRad:.4})),0,t,ASPECT);
  if(s?.stamp)stamps++;
 }
 assert.equal(stamps,2,'Clean recovery produces a single verified stamp after visibility returns');
});

test('S11: Session/camera disconnect & reset invalidates stale capture without leaking old stamps',()=>{
 const bus=new FloorInteractionEngine();
 bus.reset('camera');
 const s1=bus.currentSessionId;
 bus.contact({source:'camera',eventId:'old-1',actorId:'A',foot:'left',
  x:.3,y:.5,confidence:.9,atMs:100,basis:'calibrated-estimate',verified:true,headingRad:.1});
 let capture=collectTimelineEvents(emptyTimelineCapture(s1),bus.canonicalRecent,s1,100);
 assert.equal(capture.events.length,1);
 // Simulate camera reconnect / resolution change -> bus.reset increments epoch/sessionId
 bus.reset('camera');
 const s2=bus.currentSessionId;
 assert.notEqual(s2,s1);
 capture=collectTimelineEvents(capture,bus.canonicalRecent,s2,200);
 assert.equal(capture.events.length,0,'New session epoch must drop stale pre-disconnect stamps');
});

test('S12: Mode transitions Demo -> Camera -> Video -> Simulator -> Demo never leak events or authorize hardware output',()=>{
 const bus=new FloorInteractionEngine();
 // 1. Demo events never authorize hardware output
 const demoEvs=composerLiquidDemoEvents('pivot',500,100);
 assert.ok(demoEvs.length>=1);
 assert.equal(liquidOutputAuthorized(),false);

 // 2. Switch across camera -> video -> simulator; wrong-source writes are rejected
 bus.reset('camera');
 assert.equal(bus.contact({source:'video',eventId:'leak-v',actorId:'A',foot:'left',
  x:.5,y:.5,confidence:.9,atMs:100,basis:'image-2d',verified:true}),null);
 const camContact=bus.contact({source:'camera',eventId:'c1',actorId:'A',foot:'left',
  x:.4,y:.5,confidence:.9,atMs:100,basis:'calibrated-estimate',verified:true,headingRad:.3});
 assert.ok(camContact);
 assert.equal(floorEventPhysicalOutputAuthorized(camContact),false);
 const canon=bus.canonicalRecent[0];
 assert.equal(validFootMotionEvent(canon),true);
 assert.equal(footMotionAuthorizesPhysicalOutput(canon),false);

 // 3. Transition to video clears camera events
 bus.reset('video');
 assert.equal(bus.recent.length,0);
 assert.ok(bus.contact({source:'video',eventId:'v1',actorId:'A',foot:'right',
  x:.6,y:.5,confidence:.88,atMs:200,basis:'image-2d',verified:true,headingRad:-.4}));
 assert.equal(bus.recent.every(e=>e.source==='video'),true);

 // 4. Transition to simulator clears video events
 bus.reset('simulator');
 assert.equal(bus.recent.length,0);
 assert.ok(bus.contact({source:'simulator',eventId:'sim1',actorId:'B',foot:'left',
  x:.5,y:.6,confidence:1,atMs:300,basis:'simulated',verified:true,headingRad:.5}));
 assert.equal(bus.recent.every(e=>e.source==='simulator'),true);
});

test('Geometry, Style Library, Live Steering & No-Ellipse invariants hold',()=>{
 // 1. Footprint sprite scaling preserves anatomical aspect ratio and grows monotonically
 const small=footprintSpriteDimensions(16);
 const mid=footprintSpriteDimensions(42);
 const large=footprintSpriteDimensions(88);
 assert.ok(small.lengthPx<mid.lengthPx&&mid.lengthPx<large.lengthPx);
 assert.ok(small.widthPx<mid.widthPx&&mid.widthPx<large.widthPx);
 const nominalRatio=(0.095/0.26)*1.42;
 assert.ok(Math.abs(mid.widthPx/mid.lengthPx-nominalRatio)<0.03);

 // 2. Authentic foot anatomy: 5 distinct toes and mirrored left/right symmetry
 const leftToes=footprintToes('left'),rightToes=footprintToes('right');
 assert.equal(leftToes.length,5);
 assert.equal(rightToes.length,5);
 assert.ok(Math.abs(leftToes[0].x+rightToes[0].x)<1e-9,'Left and right toes must mirror symmetrically');
 assert.equal(footprintOutline('left').length,footprintOutline('right').length);

 // 3. Creative-coding visual style library: 6 distinct styles, valid indices, macros & clamped steering
 assert.equal(COMPOSE_VISUAL_STYLES.length,6);
 assert.deepEqual(COMPOSE_VISUAL_STYLES.map(s=>s.index),[0,1,2,3,4,5]);
 assert.equal(COMPOSE_STEER_MACROS.length,4);
 const sanitized=sanitizeSteeringState({
  styleId:'neon-flux',flow:4.5,turbulence:-2,glow:Number.NaN,hueShift:3,pulseRate:.75
 });
 assert.equal(sanitized.styleId,'neon-flux');
 assert.equal(sanitized.flow,1);
 assert.equal(sanitized.turbulence,0);
 assert.equal(sanitized.glow,0);
 assert.equal(sanitized.hueShift,.5);
 assert.equal(sanitized.pulseRate,.75);

 // 4. Provenance truthfulness
 assert.equal(deriveComposeProvenance({liquidMode:'demo',experimentSource:'simulator',cameraOn:true,floorReady:true}).label,'DEMO SINTETIK');
 assert.equal(deriveComposeProvenance({liquidMode:'track',experimentSource:'video',cameraOn:false,floorReady:false}).label,'VIDEO ESTIMATE');
 assert.equal(deriveComposeProvenance({liquidMode:'track',experimentSource:'simulator',cameraOn:false,floorReady:false}).label,'SIMULASI 3D');
 assert.equal(deriveComposeProvenance({liquidMode:'track',experimentSource:null,cameraOn:true,floorReady:true}).label,'LIVE DETECTED');
 assert.equal(deriveComposeProvenance({liquidMode:'track',experimentSource:null,cameraOn:false,floorReady:false}).label,'MENUNGGU TRACK');

 // 5. Zero oval/ellipse footprint fallback & zero MAT-03 jargon in operator UI
 const composerSrc=readFileSync(new URL('../src/studio/v3/SurfaceComposer.tsx',import.meta.url),'utf8');
 const adapterSrc=readFileSync(new URL('../src/footprints/scenes/interactionAdapters.ts',import.meta.url),'utf8');
 assert.equal(composerSrc.includes('.ellipse('),false,'SurfaceComposer must never fall back to oval ellipse footprints');
 assert.equal(adapterSrc.includes('.ellipse('),false,'interactionAdapters must never fall back to oval ellipse footprints');
 assert.equal(/>[^<]*MAT-03[^<]*</.test(composerSrc),false,'Visible MAT-03 jargon must not appear in operator Compose UI');
});
