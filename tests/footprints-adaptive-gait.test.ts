import test from 'node:test';
import assert from 'node:assert/strict';
import {emptyFrame,type Landmark,type MotionFrame} from '../src/engine/types.ts';
import {GaitAnalyzer} from '../src/footprints/gait-analysis/index.ts';
import {defaultFloorSpace,type CameraFloorCalibration} from '../src/footprints/spatial/coordinates.ts';
import {LiveFloorTrackingEngine,type CameraBinding} from '../src/footprints/live/LiveFloorTrackingEngine.ts';

type PoseOptions={footX?:number;footY?:number;hipX?:number;hipY?:number;heading?:number};
function frameAt(t:number,o:PoseOptions={}):MotionFrame{
 const f=emptyFrame('camera');f.time=t;f.source='camera';f.tracked=true;f.quality=.99;
 const p=Array.from({length:33},()=>({x:.5,y:.5,z:0,visibility:.99})) as Landmark[];
 const hx=o.hipX??0,hy=o.hipY??0,cx=o.footX??.435,cy=o.footY??.82;
 const angle=o.heading??0,dx=.03*Math.cos(angle),dy=.03*Math.sin(angle);
 p[23]={x:.41+hx,y:.45+hy,z:0,visibility:.99};
 p[24]={x:.59+hx,y:.45+hy,z:0,visibility:.99};
 p[27]={x:cx-.01,y:cy-.03,z:0,visibility:.99};
 p[29]={x:cx-dx/2,y:cy-dy/2,z:0,visibility:.99};
 p[31]={x:cx+dx/2,y:cy+dy/2,z:0,visibility:.99};
 p[28]={x:.58,y:.78,z:0,visibility:.99};
 p[30]={x:.58,y:.81,z:0,visibility:.99};
 p[32]={x:.61,y:.81,z:0,visibility:.99};
 f.pose=p;return f;
}
const observe=(g:GaitAnalyzer,t:number,opts:PoseOptions={})=>
 g.observe(frameAt(t,opts),0,t,16/9);
function planted(){
 const g=new GaitAnalyzer();
 assert.equal(observe(g,0)?.stamp,false);
 assert.equal(observe(g,130)?.stamp,true);
 return g;
}
test('initial stance still produces exactly one debounced contact',()=>{
 const g=planted();
 for(const t of [200,280,370,460,550,650]){
  const m=observe(g,t);
  assert.equal(m?.phase,'stance');
  assert.equal(m?.stamp,false);
  assert.equal(m?.motionKind,'hold');
 }
});
test('planted pivot changes foot heading without stamping a new landing',()=>{
 const g=planted();
 const frames=[
  observe(g,200,{heading:1.2}),
  observe(g,270,{heading:1.3}),
  observe(g,360,{heading:1.4}),
  observe(g,470,{heading:1.4})
 ];
 assert.ok(frames.some(m=>m?.motionKind==='pivot'),JSON.stringify(frames.map(x=>x?.motionKind)));
 assert.equal(frames.filter(m=>m?.stamp).length,0);
 assert.ok(frames.every(m=>m?.phase==='stance'));
});
test('hip bend and translation over an unmoving foot do not invent swing or step',()=>{
 const g=planted();
 const frames=[
  observe(g,200,{hipY:.10}),
  observe(g,280,{hipY:.10,hipX:.08}),
  observe(g,370,{hipY:.10,hipX:.12}),
  observe(g,460,{hipY:.05,hipX:.07}),
  observe(g,560,{hipY:0,hipX:0})
 ];
 assert.ok(frames.every(m=>m?.phase==='stance'),JSON.stringify(frames.map(m=>m?.phase)));
 assert.equal(frames.filter(m=>m?.stamp).length,0);
 assert.ok(frames.every(m=>m?.motionKind!=='slide'));
});
test('low-elevation slow slide stays in stance and emits no duplicate sole contact',()=>{
 const g=planted();
 const frames=[
  observe(g,230,{footX:.45}),
  observe(g,340,{footX:.465}),
  observe(g,450,{footX:.48}),
  observe(g,560,{footX:.49}),
  observe(g,670,{footX:.49})
 ];
 assert.ok(frames.some(m=>m?.motionKind==='slide'),JSON.stringify(frames.map(m=>m?.motionKind)));
 assert.equal(frames.filter(m=>m?.stamp).length,0);
 assert.ok(frames.every(m=>m?.phase==='stance'));
});
test('subtle slow foot lift can lead to exactly one new contact after landing',()=>{
 const g=planted();
 const marks=[
  observe(g,220,{footY:.792}),
  observe(g,300,{footY:.79}),
  observe(g,385,{footY:.82}),
  observe(g,470,{footY:.82}),
  observe(g,600,{footY:.82}),
  observe(g,730,{footY:.82})
 ];
 assert.ok(marks.some(m=>m?.phase==='swing'),JSON.stringify(marks.map(m=>m?.phase)));
 assert.equal(marks.filter(m=>m?.stamp).length,1);
 assert.equal(marks.at(-1)?.phase,'stance');
});
test('invalid foot visibility or 500ms tracking gap resets without stitching old steps',()=>{
 const g=planted();
 const hidden=frameAt(200);hidden.pose[31].visibility=0;
 assert.equal(g.observe(hidden,0,200,16/9),null);
 const regained=observe(g,260);
 assert.equal(regained?.join,false);
 assert.equal(regained?.stamp,false);
 assert.equal(observe(g,390)?.stamp,true);
 const delayed=observe(g,1000,{footX:.49});
 assert.equal(delayed?.join,false);
 assert.equal(delayed?.stamp,false);
});
test('slow slide builds a metric MOVE event only after sufficient real floor displacement',()=>{
 const floor=defaultFloorSpace(8,6),binding:CameraBinding={
  trackId:'adaptive',deviceId:'cam',width:1280,height:720
 };
 const calibration:CameraFloorCalibration={
  schema:'soma.footprints.camera-floor',version:1,floor,
  cameraQuad:[{x:.1,y:.1},{x:.9,y:.1},{x:.9,y:.9},{x:.1,y:.9}]
 };
 const engine=new LiveFloorTrackingEngine();engine.configure(calibration,binding);engine.confirm(true);
 const sample=(t:number,x:number,stamp:boolean,motionKind:'hold'|'slide'='hold')=>({
  x,y:.5,t,side:0,heading:0,phase:'stance' as const,
  stamp,join:false,confidence:.93,relativeSpeed:motionKind==='slide'?.11:0,motionKind
 });
 const contact=engine.ingest(sample(120,.5,true),0,16/9,binding);
 assert.equal(contact.length,1);assert.equal(contact[0].kind,'contact');
 assert.equal(engine.ingest(sample(200,.505,false,'slide'),0,16/9,binding).length,0);
 assert.equal(engine.ingest(sample(280,.508,false,'slide'),0,16/9,binding).length,0);
 const moved=engine.ingest(sample(360,.515,false,'slide'),0,16/9,binding);
 assert.equal(moved.length,1);
 assert.equal(moved[0].kind,'move');
 assert.equal(engine.status.contacts,1);
 assert.equal(engine.status.footMotions[0].motion,'slide');
 assert.equal(engine.ingest(sample(460,.516,false,'slide'),0,16/9,binding).length,0);
 assert.equal(engine.status.events,2);
 assert.equal(engine.session?.events.filter(e=>e.kind==='contact').length,1);
});
