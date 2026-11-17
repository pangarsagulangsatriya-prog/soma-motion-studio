import test from 'node:test';
import assert from 'node:assert/strict';
import type {Landmark} from '../src/engine/types.ts';
import type {ReplayOverlayPerson} from '../src/stage/VideoPoseGaitEngine.ts';
import type {ReplayGaitEvent} from '../src/stage/videoGaitAnalysis.ts';
import type {TemporalActorSample,TemporalJoint,TemporalFrame} from '../src/stage/temporalJointIntelligence.ts';
import {MotionSemanticsEngine,motionSemanticsCsv,semanticEventCounts,SEMANTIC_MAX_EVENTS}
 from '../src/stage/motionSemantics.ts';

const actor=(id:'A'|'B',confidence=.94):ReplayOverlayPerson=>({
 id,confidence,landmarks:Array.from({length:33},():Landmark=>({x:.5,y:.5,z:0,visibility:confidence}))
});
const joint=(index:number,x:number,y:number,speed=.1,vx=0,vy=0):TemporalJoint=>({
 index,x,y,z:0,smoothX:x,smoothY:y,smoothZ:0,vx,vy,vz:0,
 ax:null,ay:null,az:null,speed,acceleration:null,visibility:.96
});
type Options={reach?:boolean;bendAngle?:number;angle?:number;still?:boolean;visibility?:number};
function sample(id:'A'|'B',options:Options={}):TemporalActorSample{
 const v=options.still?.01:.11;
 const orientation=options.angle??0;
 const theta=orientation*Math.PI/180;
 const arr=[
  joint(11,.4,.3,v),joint(12,.4+.2*Math.cos(theta),.3+.2*Math.sin(theta),v),
  joint(23,.4,.5,v),joint(24,.6,.5,v),
  joint(15,options.reach?.76:.48,.3,v,options.reach?.12:0,0),
  joint(16,.59,.36,v),joint(27,.43,.8,v),joint(28,.57,.8,v),
  joint(13,.45,.32,v),joint(14,.55,.32,v),
  joint(25,.43,.65,v),joint(26,.57,.65,v)
 ];
 if(options.visibility!==undefined)arr.forEach(j=>{j.visibility=options.visibility!;});
 return {id,presence:'visible',joints:arr,
  angles:[{joint:13,name:'Siku kiri',degrees:options.bendAngle??160},
   {joint:14,name:'Siku kanan',degrees:170},
   {joint:25,name:'Lutut kiri',degrees:170},
   {joint:26,name:'Lutut kanan',degrees:170}]};
}
function frame(atMs:number,optsA:Options={},optsB:Options|null=null):TemporalFrame{
 return {atMs,actors:[sample('A',optsA),optsB?sample('B',optsB):
  {id:'B',presence:'occluded',joints:[],angles:[]}]};
}
const gait=(kind:'contact'|'swing'|'pivot'|'slide',atMs:number,
 performer:'A'|'B'='A'):ReplayGaitEvent=>({
 id:'gait:'+atMs+':'+kind,atMs,performer,foot:'left',kind,confidence:.91,
 x:.48,y:.82,headingRad:0,basis:'video-2d-estimate'
});
test('S6.8.8.6 Contact, Swing, Pivot reuse measured gait transitions without duplicates',()=>{
 const engine=new MotionSemanticsEngine();
 const events=engine.observe(frame(100),[actor('A')],
  [gait('contact',100),gait('swing',100),gait('pivot',100),gait('slide',100)],1);
 assert.deepEqual(events.map(e=>e.kind),['contact','swing','pivot']);
 assert.ok(events.every(e=>e.source==='gait-2d-estimate'&&e.durationMs===0));
 assert.ok(events.every(e=>e.confidence===.91));
 assert.equal(engine.count,3);
 assert.deepEqual(semanticEventCounts(events),{
  contact:1,swing:1,pivot:1,reach:0,bend:0,turn:0,hold:0
 });
});
test('S6.8.8.6 Reach requires outward wrist velocity and two consistent samples',()=>{
 const engine=new MotionSemanticsEngine();
 const first=engine.observe(frame(0,{reach:true}),[actor('A')],[],2);
 assert.equal(first.length,0);
 const second=engine.observe(frame(100,{reach:true}),[actor('A')],[],2);
 assert.equal(second.filter(e=>e.kind==='reach').length,1);
 const reach=second.find(e=>e.kind==='reach')!;
 assert.equal(reach.side,'left');
 assert.ok(reach.value>=1.35);
 assert.equal(reach.durationMs,100);
 assert.match(reach.evidence,/Ekstensi tangan/);
 assert.equal(engine.observe(frame(200,{reach:true}),[actor('A')],[],2)
  .filter(e=>e.kind==='reach').length,0);
 engine.observe(frame(300),[actor('A')],[],2); // release
 engine.observe(frame(900,{reach:true}),[actor('A')],[],2);
 assert.equal(engine.observe(frame(1000,{reach:true}),[actor('A')],[],2)
  .filter(e=>e.kind==='reach').length,1);
});
test('S6.8.8.6 Bend belongs to an individual limb and follows changing 2D angle',()=>{
 const engine=new MotionSemanticsEngine();
 engine.observe(frame(0,{bendAngle:160}),[actor('A')],[],3);
 engine.observe(frame(100,{bendAngle:120}),[actor('A')],[],3);
 const events=engine.observe(frame(200,{bendAngle:100}),[actor('A')],[],3);
 const bend=events.filter(e=>e.kind==='bend');
 assert.equal(bend.length,1);
 assert.equal(bend[0].side,'left-arm');
 assert.ok(bend[0].value>48);
 assert.ok(bend[0].confidence>=.9);
});
test('S6.8.8.6 Turn detects image-plane shoulder axis rotation, not metric yaw',()=>{
 const engine=new MotionSemanticsEngine();
 engine.observe(frame(0,{angle:0}),[actor('A')],[],4);
 assert.equal(engine.observe(frame(100,{angle:8}),[actor('A')],[],4).length,0);
 const changes=engine.observe(frame(200,{angle:16}),[actor('A')],[],4);
 const turn=changes.find(e=>e.kind==='turn');
 assert.ok(turn);
 assert.equal(turn.side,'body');
 assert.ok(turn.value>=35);
 assert.match(turn.unit,/sumbu bahu 2D/);
});
test('S6.8.8.6 Hold is one rising-edge event after sustained stillness',()=>{
 const engine=new MotionSemanticsEngine();
 let holds=0;
 for(let atMs=0;atMs<=1500;atMs+=100){
  const changes=engine.observe(frame(atMs,{still:true}),[actor('A')],[],5);
  if(atMs<650)assert.ok(!changes.some(e=>e.kind==='hold'));
  holds+=changes.filter(e=>e.kind==='hold').length;
 }
 assert.equal(holds,1);
 const hold=engine.history.find(e=>e.kind==='hold')!;
 assert.ok(hold.durationMs>=650);
 assert.ok(hold.value<=.035);
});
test('S6.8.8.6 noisy unchanging joints do not fire Reach Bend or Turn',()=>{
 const engine=new MotionSemanticsEngine();
 for(let atMs=0;atMs<650;atMs+=100){
  engine.observe(frame(atMs,{bendAngle:100,angle:0,still:false}),[actor('A')],[],6);
 }
 assert.equal(engine.history.length,0);
});
test('S6.8.8.6 A keeps events while B disappears and B cache resets on identity loss',()=>{
 const engine=new MotionSemanticsEngine();
 engine.observe(frame(0,{reach:true},{reach:true}),[actor('A'),actor('B')],[],7);
 let ev=engine.observe(frame(100,{reach:true},{reach:true}),[actor('A'),actor('B')],[],7);
 assert.deepEqual(ev.filter(e=>e.kind==='reach').map(e=>e.actor),['A','B']);
 // B is unapproved; A's already active movement is preserved.
 ev=engine.observe(frame(200,{reach:true}),[actor('A')],[],7);
 assert.equal(ev.length,0);
 engine.observe(frame(300),[actor('A')],[],7);
 engine.observe(frame(800,{reach:true},{reach:true}),[actor('A'),actor('B')],[],7);
 ev=engine.observe(frame(900,{reach:true},{reach:true}),[actor('A'),actor('B')],[],7);
 assert.deepEqual(ev.filter(e=>e.kind==='reach').map(e=>e.actor),['A','B']);
});
test('S6.8.8.6 absent or low-confidence actor cannot produce semantic events',()=>{
 const engine=new MotionSemanticsEngine();
 engine.observe(frame(0,{reach:true},{reach:true}),[],[],9);
 assert.equal(engine.observe(frame(100,{reach:true},{reach:true}),[],[],9).length,0);
 engine.observe(frame(200,{reach:true}),[actor('A',.4)],[],9);
 assert.equal(engine.observe(frame(300,{reach:true}),[actor('A',.4)],[],9).length,0);
 const high=engine.observe(frame(400,{reach:true}),[actor('A')],[],9);
 assert.equal(high.length,0);
 assert.ok(engine.observe(frame(500,{reach:true}),[actor('A')],[],9)
  .some(e=>e.kind==='reach'));
});
test('S6.8.8.6 resets across seek and large discontinuities; no phantom transitions',()=>{
 const engine=new MotionSemanticsEngine();
 engine.observe(frame(0,{reach:true}),[actor('A')],[],10);
 engine.observe(frame(100,{reach:true}),[actor('A')],[],10);
 engine.observe(frame(900,{reach:true}),[actor('A')],[],10);
 assert.ok(!engine.history.some(e=>e.atMs===900));
 engine.reset();
 assert.equal(engine.history.length,0);
 assert.equal(engine.statuses.length,0);
 assert.equal(engine.observe(frame(200,{reach:true}),[actor('A')],[],11).length,0);
 assert.throws(()=>engine.observe(frame(200),[actor('A')],[],11),/Timestamp/);
});
test('S6.8.8.6 bounded events and CSV expose evidence, measurement and 2D source',()=>{
 const engine=new MotionSemanticsEngine();
 for(let i=0;i<SEMANTIC_MAX_EVENTS/3+16;i++)
  engine.observe(frame(i*100),[actor('A')],[gait('contact',i*100),gait('swing',i*100),gait('pivot',i*100)],12);
 assert.equal(engine.history.length,SEMANTIC_MAX_EVENTS);
 const csv=motionSemanticsCsv(engine.history.slice(-2));
 assert.match(csv,/video_ms,segment,actor,kind,side,confidence,duration_ms,value,threshold,unit,evidence,source/);
 assert.match(csv,/gait-2d-estimate/);
 assert.ok(csv.split('\r\n').length>=3);
});
