import test from 'node:test';
import assert from 'node:assert/strict';
import {F3PunchEngine} from '../src/f3/F3PunchEngine.ts';
import {F3FramingController,f3Crop,f3SmoothCrop} from '../src/f3/F3FramingController.ts';
import {F3SessionMachine} from '../src/f3/F3SessionMachine.ts';
import {F3CameraRegistry} from '../src/f3/F3CameraRegistry.ts';
import {F3PhotoStore} from '../src/f3/F3PhotoStore.ts';
import {drawF3Stage,makeF3StageFrame,f3PhotoTileRects} from '../src/f3/F3StageRenderer.ts';
import type {F3MotionFrame,F3Landmark} from '../src/f3/F3Types.ts';
const point=(x:number,y:number):F3Landmark=>({x,y,z:0,visibility:1});
function hand(x:number,y:number,fist=true,pinch=false):F3Landmark[]{
 const a=Array.from({length:21},()=>point(x,y));
 a[0]=point(x,y);for(const id of [5,9,13,17])a[id]=point(x+.015,y-.04);
 for(const id of [8,12,16,20])a[id]=point(x+(fist?.018:.18),y+(fist?-.037:-.15));
 a[4]=pinch?point(a[8].x+.005,a[8].y):point(x-.11,y-.13);
 return a;
}
function frame(id:number,rightX=.7,rightY=.54,opts:{fist?:boolean;pinch?:boolean;otherX?:number;fresh?:boolean}={}):F3MotionFrame{
 const pose=Array.from({length:33},()=>point(.5,.5));
 pose[11]=point(.4,.4);pose[12]=point(.6,.4);
 pose[13]=point(.34,.51);pose[14]=point(.68,.51);
 pose[15]=point(opts.otherX??.35,.54);pose[16]=point(rightX,rightY);
 return {frameId:id,timestamp:id*100,videoTime:id/15,pose,hands:[hand(rightX,rightY,opts.fist!==false,!!opts.pinch)],fresh:opts.fresh!==false,confidence:1};
}
test('F3 Straight: preparation -> impact -> neutral rearm, one event per punch',()=>{
 const e=new F3PunchEngine();
 assert.equal(e.step(frame(1),1000,true).kind,'prepared');
 const first=e.step(frame(2,.90,.54),1200,true);
 assert.equal(first.kind,'capture');
 assert.match(first.eventId??'',/^straight-2/);
 assert.equal(e.step(frame(2,.90,.54),1200,true).kind,'idle','replayed frame ignored');
 assert.equal(e.step(frame(3,.98,.54),1250,true).kind,'cooldown');
 assert.equal(e.step(frame(4),2100,true).kind,'idle');
 assert.equal(e.step(frame(5),2200,true).kind,'prepared');
 assert.equal(e.step(frame(6,.90,.54),2400,true).kind,'capture');
});
test('F3 negative gesture: open-hand wave, moving both arms, pinch zoom and stale data cannot capture',()=>{
 const a=new F3PunchEngine();
 assert.equal(a.step(frame(1,.7,.54,{fist:false}),1000,true).kind,'invalid');
 assert.notEqual(a.step(frame(2,.9,.54,{fist:false}),1200,true).kind,'capture');
 const b=new F3PunchEngine();
 b.step(frame(1),1000,true);
 assert.notEqual(b.step(frame(2,.9,.54,{otherX:.15}),1200,true).kind,'capture');
 const c=new F3PunchEngine();
 assert.equal(c.step(frame(1,.7,.54,{pinch:true}),1000,true).kind,'resize');
 assert.notEqual(c.step(frame(2,.9,.54,{pinch:true}),1200,true).kind,'capture');
 const d=new F3PunchEngine();
 assert.equal(d.step(frame(1,.7,.54,{fresh:false}),1000,true).kind,'invalid');
});
test('F3 Uppercut: vertical punch accepted, sideways displacement rejected',()=>{
 const e=new F3PunchEngine();e.setPreset('uppercut');
 assert.equal(e.step(frame(1,.7,.64),1000,true).kind,'prepared');
 assert.equal(e.step(frame(2,.7,.42),1170,true).kind,'capture');
 const f=new F3PunchEngine();f.setPreset('uppercut');f.step(frame(1,.7,.64),1000,true);
 assert.notEqual(f.step(frame(2,.91,.62),1190,true).kind,'capture');
});
test('F3 crop keeps 2:1 stage separate from zoom of B and avoids out-of-bounds JPEG',()=>{
 const a=f3Crop(1920,1080,.6,1.36);
 assert.ok(a.x>=0&&a.y>=0&&a.width+a.x<=1920&&a.height+a.y<=1080);
 assert.ok(Math.abs(a.width/a.height-1.36)<.01);
 const b=f3Crop(640,1080,.22,1.36,{x:.95,y:.95});
 assert.ok(b.x>=0&&b.y>=0&&b.width+b.x<=640&&b.height+b.y<=1080);
});
test('F3 session gate: view switching cannot arm; consent revoke, A/B stale and 4/4 block',()=>{
 const s=new F3SessionMachine();
 s.setDevices(true,true);
 assert.equal(s.arm(true,true),false);
 s.setVerified(true);s.setConsent(true);
 assert.equal(s.arm(true,true),true);
 assert.equal(s.begin('impact-1',true,true,true),true);
 assert.equal(s.begin('impact-1',true,true,true),false);
 s.complete(3);s.readyAgain();
 assert.equal(s.begin('impact-2',true,false,true),false);
 s.setDevices(false,true);
 assert.equal(s.state,'BLOCKED');
 assert.equal(s.arm(false,true),false);
 s.setDevices(true,true);assert.equal(s.arm(true,true),true);
 s.complete(4);assert.equal(s.state,'COMPLETE');
 assert.equal(s.begin('impact-3',true,true,false),false);
 s.setConsent(false);assert.equal(s.state,'DISARMED');
});
test('F3 role registry never silently swaps A and B or approves stale/duplicated sources',()=>{
 const r=new F3CameraRegistry();
 assert.equal(r.bothReady(1000),false);
 assert.equal(r.status('A').role,'A');assert.equal(r.status('B').role,'B');
 assert.notEqual(r.status('A'),r.status('B'));
});

test('F3 composites actor A behind B and photos, while JPEG remains B-only',async()=>{
 const crop={x:130,y:40,width:640,height:470};
 const videoA={readyState:4,videoWidth:1920,videoHeight:1080,srcObject:null} as HTMLVideoElement;
 const videoB={readyState:4,videoWidth:1280,videoHeight:720,srcObject:null} as HTMLVideoElement;
 const calls:unknown[][]=[];
 const ctx={
  canvas:{width:1600,height:800},
  save(){},restore(){},fillRect(){},strokeRect(){},beginPath(){},arc(){},fill(){},stroke(){},
  fillText(){},moveTo(){},lineTo(){},
  drawImage(...args:unknown[]){calls.push(args);}
 } as unknown as CanvasRenderingContext2D;
 const frame=makeF3StageFrame({sourceId:'B-fixture',frameId:7,timestamp:345,crop,slots:[null,null,null,null],state:'LIVE'});
 drawF3Stage(ctx,frame,videoA,videoB);
 const actorCall=calls.find(c=>c[0]===videoA);
 const previewCall=calls.find(c=>c[0]===videoB);
 assert.ok(actorCall,'Camera A must be rendered into the Stage View canvas');
 assert.ok(previewCall,'Camera B must remain in the Stage View canvas');
 assert.deepEqual(actorCall!.slice(-4),[0,0,1600,800],'A covers the entire background');
 assert.ok(calls.indexOf(actorCall!)<calls.indexOf(previewCall!),'A must be behind B');
 const blackout=makeF3StageFrame({sourceId:'B-fixture',frameId:8,timestamp:346,crop,
  slots:[null,null,null,null],state:'BLACKOUT'});
 const count=calls.length;
 drawF3Stage(ctx,blackout,videoA,videoB);
 assert.equal(calls.length,count,'Blackout must not reveal either camera');
 assert.ok(previewCall);
 assert.deepEqual(previewCall!.slice(1,5),[crop.x,crop.y,crop.width,crop.height]);
 let captureCall:unknown[]=[];
 const original=globalThis.document;
 globalThis.document={
  createElement(name:string){
   assert.equal(name,'canvas');
   return {width:0,height:0,
    getContext(){return {drawImage(...args:unknown[]){captureCall=args;}};},
    toBlob(cb:(b:Blob)=>void){cb(new Blob(['F3 pixel B'],{type:'image/jpeg'}));}
   };
  }
 } as unknown as Document;
 const store=new F3PhotoStore();
 try{
  const photo=await store.capture({video:videoB,crop,cameraId:'B-fixture',frameId:7,sourceTimestamp:345,
   preset:'manual',consent:true,eventId:'B-fixture-event-1',fresh:true});
  assert.equal(photo.cameraId,'B-fixture');
  assert.equal(photo.frameId,7);
  assert.deepEqual(captureCall.slice(1,5),previewCall!.slice(1,5));
  await assert.rejects(store.capture({video:videoB,crop,cameraId:'B-fixture',frameId:7,sourceTimestamp:345,
   preset:'manual',consent:true,eventId:'B-fixture-event-1',fresh:true}),/Satu gerakan/);
 }finally{globalThis.document=original;store.revokeAll();}
});

test('F3 camera registry drops stale getUserMedia response after a newer source was selected',async()=>{
 const original=Object.getOwnPropertyDescriptor(globalThis,'navigator');
 const queued=new Map<string,(value:unknown)=>void>();
 const makeTrack=()=>({readyState:'live',stopped:false,
  addEventListener(){},stop(){this.stopped=true;this.readyState='ended';}});
 const oldTrack=makeTrack(),newTrack=makeTrack();
 const oldStream={active:true,getTracks:()=>[oldTrack],getVideoTracks:()=>[oldTrack]};
 const newStream={active:true,getTracks:()=>[newTrack],getVideoTracks:()=>[newTrack]};
 Object.defineProperty(globalThis,'navigator',{configurable:true,value:{mediaDevices:{
  getUserMedia:(options:{video:{deviceId:{exact:string}}})=>new Promise(resolve=>queued.set(options.video.deviceId.exact,resolve))
 }}});
 const video={srcObject:null,muted:true,playsInline:true,readyState:0,videoWidth:0,videoHeight:0,
  pause(){},removeAttribute(){},play:async()=>{}} as unknown as HTMLVideoElement;
 const registry=new F3CameraRegistry();registry.attach('B',video);
 try{
  const first=registry.connectDevice('B','camera-1');
  const second=registry.connectDevice('B','camera-2');
  queued.get('camera-2')?.(newStream);await second;
  queued.get('camera-1')?.(oldStream);await first;
  assert.equal(registry.status('B').id,'camera-2');
  assert.equal(video.srcObject,newStream);
  assert.equal(oldTrack.stopped,true,'obsolete camera must stop');
  assert.equal(newTrack.stopped,false,'latest camera must stay active');
 }finally{
  registry.dispose();
  if(original)Object.defineProperty(globalThis,'navigator',original);
  else Reflect.deleteProperty(globalThis,'navigator');
 }
});

test('F3 revocation during asynchronous JPEG encoding blocks photo commit',async()=>{
 const original=globalThis.document;
 let finish:(blob:Blob)=>void=()=>{};
 globalThis.document={createElement(){return {width:0,height:0,
  getContext(){return {drawImage(){}};},
  toBlob(callback:(blob:Blob)=>void){finish=callback;}
 };}} as unknown as Document;
 const video={videoWidth:640,videoHeight:480,srcObject:null} as HTMLVideoElement;
 const store=new F3PhotoStore();let valid=true;
 try{
  const started=store.capture({
   video,crop:{x:0,y:0,width:300,height:200},cameraId:'B',frameId:1,
   sourceTimestamp:123,preset:'manual',consent:true,eventId:'revoked-1',
   fresh:true,stillValid:()=>valid
  });
  valid=false;finish(new Blob(['jpeg'],{type:'image/jpeg'}));
  await assert.rejects(started,/Consent dicabut|Kamera B terputus/);
  assert.equal(store.count,0);
 }finally{store.revokeAll();globalThis.document=original;}
});


test('F3 V3: two-wrist body zoom works without finger pinch and holds while lost',()=>{
 const f=new F3FramingController();
 const pose=(id:number,shoulder:number,arm:number):F3MotionFrame=>{
  const framePose=Array.from({length:33},()=>point(.5,.5));
  framePose[11]=point(.5-shoulder/2,.4);
  framePose[12]=point(.5+shoulder/2,.4);
  framePose[15]=point(.5-shoulder*arm,.48);
  framePose[16]=point(.5+shoulder*arm,.48);
  return {frameId:id,timestamp:id*100,videoTime:id/30,pose:framePose,hands:[],fresh:true,confidence:1};
 };
 assert.equal(f.step(pose(1,.2,1),1000),.6);
 const moved=f.step(pose(2,.2,1.6),1100);
 assert.ok(moved<.6,'both wrists extending zoom into B with pose only');
 assert.equal(f.resizing,true);
 const held=f.step({...pose(3,.2,1.6),fresh:false},1200);
 assert.equal(held,moved,'lost frame holds crop rather than resetting it');
 const another=new F3FramingController();
 assert.equal(another.step(pose(1,.2,1),1000),.6);
 assert.equal(another.step(pose(2,.13,1),1120),.6,
  'actor moving farther with same arm-to-shoulder ratio must not zoom');
});
test('F3 V3: unilateral hand movement does not start body zoom',()=>{
 const f=new F3FramingController();
 assert.equal(f.step(frame(1,.7,.54,{otherX:.35}),1000),.6);
 assert.equal(f.step(frame(2,.92,.54,{otherX:.35}),1150),.6);
 assert.equal(f.resizing,false);
});

test('F3 V3.1: 2x2 photo slots are near-square, centered and stay inside the left column',()=>{
 const rects=f3PhotoTileRects(1600,800);
 assert.equal(rects.length,4);
 for(const r of rects){
  assert.ok(Math.abs(r.width/r.height-1)<.12,'photo tile must be close to square');
  assert.ok(r.x>=0&&r.y>=0&&r.x+r.width<480&&r.y+r.height<=800);
 }
 assert.ok(rects[0].y>50,'photo grid vertically centered, not stretching full stage height');
 assert.ok(Math.abs(rects[0].width-rects[2].width)<.001);
 assert.ok(rects[1].x>rects[0].x+rects[0].width);
 assert.ok(rects[2].y>rects[0].y+rects[0].height);
});
test('F3 V3.1: smooth ROI approaches target, stays in frame and never jumps on source change',()=>{
 const first={x:320,y:110,width:1100,height:800};
 const next={x:450,y:200,width:750,height:550};
 const a=f3SmoothCrop(first,next,16,1920,1080);
 assert.ok(a.width<first.width&&a.width>next.width,'crop interpolates');
 assert.ok(a.x>first.x&&a.x<next.x);
 const b=f3SmoothCrop(a,next,16,1920,1080);
 assert.ok(b.width<a.width&&b.width>next.width);
 for(const r of [a,b])assert.ok(r.x>=0&&r.y>=0&&r.x+r.width<=1920&&r.y+r.height<=1080);
 assert.deepEqual(f3SmoothCrop(null,next,16,1920,1080),next,'new source bypasses prior crop');
});
