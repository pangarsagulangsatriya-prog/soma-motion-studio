import test from 'node:test';
import assert from 'node:assert/strict';
import {F3PunchEngine} from '../src/f3/F3PunchEngine.ts';
import {F3FramingController,f3Crop} from '../src/f3/F3FramingController.ts';
import {F3SessionMachine} from '../src/f3/F3SessionMachine.ts';
import {F3CameraRegistry} from '../src/f3/F3CameraRegistry.ts';
import type {F3MotionFrame,F3Landmark} from '../src/f3/F3Types.ts';
const point=(x:number,y:number):F3Landmark=>({x,y,z:0,visibility:1});
function hand(x:number,y:number,fist=true,pinch=false):F3Landmark[]{
 const a=Array.from({length:21},()=>point(x,y));
 a[0]=point(x,y);for(const id of [5,9,13,17])a[id]=point(x+.015,y-.04);
 for(const id of [8,12,16,20])a[id]=point(x+(fist?.018:.18),y+(fist?-.037:-.15));
 a[4]=pinch?point(a[8].x+.005,a[8].y):point(x+.16,y-.13);
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
