import test from 'node:test';
import assert from 'node:assert/strict';
import {deformationAt,shortestAngle,warpFootPoint,warpedToeRadius}
 from '../src/footprints/scenes/dynamicFootDeformation.ts';
import {paintAuthenticFootprint} from '../src/footprints/scenes/authenticFootGeometry.ts';
import {FloorInteractionEngine,floorEventCanStamp,floorEventPhysicalOutputAuthorized}
 from '../src/footprints/scenes/FloorInteractionEngine.ts';
import {footMotionCanStamp} from '../src/footprints/scenes/FootMotionEventV2.ts';
import {FootstepEventEngine,createFloorSession}
 from '../src/footprints/spatial/events.ts';
import {defaultFloorSpace} from '../src/footprints/spatial/coordinates.ts';
import {paintFloorCanvas} from '../src/footprints/simulator/floorCanvas.ts';
import {feedLiveFloorInteractions} from '../src/footprints/scenes/interactionAdapters.ts';
import type {MotionFrame} from '../src/engine/types.ts';
import type {MultiPoseStatus} from '../src/footprints/live/MultiPoseGaitRouter.ts';
import type {LiveFloorTrackingEngine} from '../src/footprints/live/LiveFloorTrackingEngine.ts';

const anchor={x:.45,y:.55,headingRad:0,atMs:100};
test('GEO-01B: heel settles; toe-off requires actual release evidence',()=>{
 assert.equal(deformationAt(anchor,100).mode,'heel-strike');
 assert.ok(deformationAt(anchor,180).amount<deformationAt(anchor,100).amount);
 assert.equal(deformationAt(anchor,350).mode,'stance');
 assert.equal(deformationAt(anchor,500).mode,'stance');
 assert.equal(deformationAt(anchor,510,{kind:'release',atMs:500,x:.45,y:.55}).mode,'toe-off');
 assert.equal(deformationAt(anchor,990,{kind:'release',atMs:500,x:.45,y:.55}).mode,'stance');
});
test('GEO-01B: move deforms existing sole; pivot uses shortest angular delta',()=>{
 const slide=deformationAt(anchor,230,{kind:'slide',atMs:200,x:.50,y:.58});
 assert.equal(slide.mode,'slide');
 assert.ok(slide.amount>0&&slide.amount<=1);
 assert.ok(slide.travelX!>0);
 const pivot=deformationAt(anchor,250,{kind:'pivot',atMs:200,
  x:.45,y:.55,headingRad:.47});
 assert.equal(pivot.mode,'pivot');
 const warped=warpFootPoint(.23,.75,pivot);
 assert.notDeepEqual(warped,[.23,.75]);
 assert.ok(Math.abs(shortestAngle(-Math.PI+.05-(Math.PI-.05))-.1)<1e-8);
 assert.equal(deformationAt(anchor,1100,{kind:'pivot',atMs:200,
  x:.45,y:.55,headingRad:.47}).mode,'stance');
});
test('GEO-01B: heel roll, toe engagement, directional shear stay bounded',()=>{
 const heelStrike={mode:'heel-strike' as const,amount:1};
 const toeOff={mode:'toe-off' as const,amount:1};
 assert.ok(Math.abs(warpFootPoint(.4,-.4,heelStrike)[0])<.4);
 assert.ok(Math.abs(warpFootPoint(.3,.7,toeOff)[0])<.3);
 const toe=warpedToeRadius(.1,.12,-.7,heelStrike);
 assert.ok(toe.rx<.1&&toe.ry<.12);
 assert.notDeepEqual(warpFootPoint(.2,.7,{mode:'slide',amount:1,
  travelX:1,travelY:0}),[.2,.7]);
 const invalid=warpFootPoint(.2,.7,{mode:'pivot',amount:Infinity,pivotRad:Infinity});
 assert.ok(invalid.every(Number.isFinite));
});
test('GEO-01B: motion events never become new contact stamps or grant light',()=>{
 const engine=new FloorInteractionEngine();
 engine.reset('video');
 const base={source:'video' as const,actorId:'A',foot:'right' as const,
  x:.45,y:.55,confidence:.92,basis:'image-2d' as const};
 assert.equal(engine.motion({...base,kind:'slide',eventId:'orphan',atMs:100}),null);
 const contact=engine.contact({...base,verified:true,eventId:'landing',atMs:110,headingRad:0});
 assert.ok(contact&&floorEventCanStamp(contact));
 const slide=engine.motion({...base,kind:'slide',eventId:'motion-1',atMs:180,x:.48});
 assert.ok(slide&&!floorEventCanStamp(slide));
 assert.equal(engine.motion({...base,kind:'slide',eventId:'motion-1',atMs:180,x:.48}),null);
 const pivot=engine.motion({...base,kind:'pivot',eventId:'motion-2',atMs:200,headingRad:.4});
 assert.ok(pivot);
 const release=engine.motion({...base,kind:'release',eventId:'lift',atMs:280});
 assert.ok(release);
 assert.equal(engine.motion({...base,kind:'slide',eventId:'late',atMs:290}),null);
 assert.deepEqual([engine.snapshot.counts.contact,engine.snapshot.counts.slide,
  engine.snapshot.counts.pivot,engine.snapshot.counts.release],[1,1,1,1]);
 assert.equal(engine.canonicalRecent.filter(footMotionCanStamp).length,1);
 assert.equal(floorEventPhysicalOutputAuthorized(contact),false);
 assert.equal(floorEventPhysicalOutputAuthorized(pivot),false);
});
test('GEO-01B: slow grounded rotation accumulates to a move, no duplicate contact',()=>{
 const engine=new FootstepEventEngine(defaultFloorSpace(),.05);
 const base={performerId:'A',foot:'left' as const,timestampMs:100,
  phase:'stance' as const,positionM:{xM:1,yM:1},
  headingRad:0,source:'simulation' as const,positionBasis:'simulated' as const,
  confidence:1};
 assert.equal(engine.observe(base)[0].kind,'contact');
 for(let i=1;i<=3;i++){
  const events=engine.observe({...base,timestampMs:100+i*80,headingRad:i*.07});
  assert.equal(events.length,i===3?1:0);
  if(i===3)assert.equal(events[0].kind,'move');
 }
 const after=engine.observe({...base,timestampMs:420,headingRad:.22});
 assert.equal(after.length,0);
 const lift=engine.observe({...base,phase:'swing',positionM:null,timestampMs:500});
 assert.equal(lift.length,1);
 assert.equal(lift[0].kind,'release');
});
test('GEO-01B: raster still paints one sole when a planted foot slides and pivots',()=>{
 const calls:string[]=[];
 const ctx={
  globalAlpha:1,fillStyle:'',strokeStyle:'',lineWidth:1,
  setTransform:()=>calls.push('transform'),fillRect:()=>calls.push('clear'),
  save:()=>calls.push('save'),restore:()=>calls.push('restore'),
  translate:()=>calls.push('translate'),rotate:()=>calls.push('rotate'),
  scale:()=>calls.push('scale'),beginPath:()=>calls.push('begin'),
  moveTo:()=>calls.push('moveTo'),lineTo:()=>calls.push('lineTo'),
  quadraticCurveTo:()=>calls.push('curve'),closePath:()=>calls.push('close'),
  fill:()=>calls.push('fill'),stroke:()=>calls.push('stroke'),
  setLineDash:()=>calls.push('dash'),ellipse:()=>calls.push('toe')
 } as unknown as CanvasRenderingContext2D;
 const canvas={width:0,height:0,getContext:()=>ctx} as unknown as HTMLCanvasElement;
 const floor=defaultFloorSpace();
 const events=[
  {id:'c',performerId:'A',foot:'left' as const,kind:'contact' as const,
   timestampMs:100,positionM:{xM:1,yM:1},headingRad:0,
   source:'simulation' as const,positionBasis:'simulated' as const,confidence:1},
  {id:'m',performerId:'A',foot:'left' as const,kind:'move' as const,
   timestampMs:200,positionM:{xM:1.2,yM:1},headingRad:.4,
   source:'simulation' as const,positionBasis:'simulated' as const,confidence:1}
 ];
 paintFloorCanvas(canvas,createFloorSession(floor,events),{maxTimeMs:240});
 assert.equal(calls.filter(x=>x==='toe').length,5);
 assert.equal(canvas.width,1280);
 assert.equal(canvas.height,720);
 assert.ok(calls.includes('curve'));
});
test('GEO-01B: painter changes toe coordinates without canvas state leaks',()=>{
 let toes:number[][]=[];
 const ctx={
  globalAlpha:1,fillStyle:'',strokeStyle:'',lineWidth:1,
  save:()=>{},restore:()=>{},translate:()=>{},rotate:()=>{},scale:()=>{},
  beginPath:()=>{},moveTo:()=>{},quadraticCurveTo:()=>{},closePath:()=>{},
  fill:()=>{},stroke:()=>{},setLineDash:()=>{},
  ellipse:(x:number,y:number,rx:number,ry:number)=>toes.push([x,y,rx,ry])
 } as unknown as CanvasRenderingContext2D;
 paintAuthenticFootprint(ctx,{x:0,y:0,side:'right',widthPx:25,lengthPx:60});
 const first=toes;
 toes=[];
 paintAuthenticFootprint(ctx,{x:0,y:0,side:'right',widthPx:25,lengthPx:60,
  deformation:{mode:'toe-off',amount:.9}});
 assert.equal(toes.length,5);
 assert.notDeepEqual(toes,first);
});

test('GEO-01B: camera gait clock is rebased and small calibrated slides stay non-stamping',()=>{
 const engine=new FloorInteractionEngine();
 engine.reset('camera');
 const floor=defaultFloorSpace();
 const pose=Array.from({length:33},()=>({x:.5,y:.8,visibility:1}));
 const frame={source:'camera',tracked:true,time:10000,pose} as unknown as MotionFrame;
 const tracker={
  isConfirmed:true,calibrationData:null,floor,sessionEpoch:2,
  session:{events:[{
   id:'foot-1',kind:'contact',source:'camera',performerId:'performer-1',
   foot:'left',timestampMs:480,positionM:{xM:1,yM:1},
   headingRad:0,confidence:.9
  }]},
  status:{lastSeenMs:500,footMotions:[{
   performerId:'performer-1',foot:'left',motion:'slide',confidence:.9,
   atMs:500,positionM:{xM:1.05,yM:1},headingRad:0
  }]}
 } as unknown as LiveFloorTrackingEngine;
 feedLiveFloorInteractions(engine,{
  source:'camera',frame,identity:{} as MultiPoseStatus,
  performerCount:1,tracker,cameraMatched:true,videoAspect:16/9,nowMs:10050
 });
 const contact=engine.recent.find(e=>e.kind==='contact');
 const slide=engine.recent.find(e=>e.kind==='slide');
 assert.ok(contact&&slide);
 assert.equal(contact.atMs,10030);
 assert.equal(slide.atMs,10050);
 assert.equal(engine.snapshot.counts.contact,1);
 assert.equal(floorEventCanStamp(slide),false);
 const deformed=deformationAt({x:contact.x,y:contact.y,
  headingRad:contact.headingRad,atMs:contact.atMs},10070,{
   kind:'slide',atMs:slide.atMs,x:slide.x,y:slide.y
  });
 assert.equal(deformed.mode,'slide');
});
