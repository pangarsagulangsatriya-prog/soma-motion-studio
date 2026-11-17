import test from 'node:test';
import assert from 'node:assert/strict';
import {
 TemporalJointAnalyzer,angle2D,temporalTraceCsv,
 TEMPORAL_WINDOW_FRAMES,TEMPORAL_MAX_GAP_MS,TEMPORAL_JOINT_NAMES
} from '../src/stage/temporalJointIntelligence.ts';
import type {Landmark} from '../src/engine/types.ts';
import type {VideoActorState,VideoActorAssignment} from '../src/stage/videoAutoActorTracker.ts';

const pose=(x=.2):Landmark[]=>
 Array.from({length:33},(_,index)=>({
  x,y:.18+Math.floor(index/5)*.09,z:.01*index,visibility:.92
 }));
const presence=(a:'visible'|'occluded'|'uncertain'|'lost'='visible',
 b:'not-detected'|'visible'|'occluded'|'lost'='not-detected'):VideoActorState[]=>[
 {id:'A',presence:a,rawIndex:a==='visible'?0:null,confidence:a==='visible'?.9:0,lastSeenAtMs:null},
 {id:'B',presence:b,rawIndex:b==='visible'?1:null,confidence:b==='visible'?.9:0,lastSeenAtMs:null}
];
const assignment=(id:'A'|'B',p:Landmark[]):VideoActorAssignment=>
 ({id,rawIndex:id==='A'?0:1,pose:p,confidence:.92});
const joint=(engine:TemporalJointAnalyzer,id:'A'|'B',index=15)=>{
 const f=engine.latest;return f?.actors.find(a=>a.id===id)?.joints.find(j=>j.index===index);
};

test('S6.8.8.3 observes each of 33 joints and starts without invented velocities',()=>{
 const temporal=new TemporalJointAnalyzer();
 const a=temporal.observe([assignment('A',pose(.2))],presence(),0);
 assert.equal(a.atMs,0);
 assert.equal(a.actors[0].joints.length,33);
 assert.equal(a.actors[1].joints.length,0);
 assert.equal(joint(temporal,'A')?.vx,null);
 assert.equal(joint(temporal,'A')?.acceleration,null);
 assert.equal(temporal.getTrace('A',15).length,1);
 assert.equal(TEMPORAL_JOINT_NAMES.length,33);
});

test('S6.8.8.3 EMA uses video timestamp, then velocity and acceleration derivatives',()=>{
 const temporal=new TemporalJointAnalyzer();
 temporal.observe([assignment('A',pose(.2))],presence(),0);
 temporal.observe([assignment('A',pose(.3))],presence(),100);
 const second=joint(temporal,'A')!;
 const alpha=1-Math.exp(-100/130);
 assert.ok(Math.abs(second.smoothX-(.2+.1*alpha))<1e-8);
 assert.ok(Math.abs(second.vx!-(.1*alpha/.1))<1e-8);
 assert.equal(second.ax,null);
 temporal.observe([assignment('A',pose(.5))],presence(),200);
 const third=joint(temporal,'A')!;
 assert.ok(third.vx!>second.vx!);
 assert.ok(third.ax!>0);
 assert.ok(third.speed!>0&&third.acceleration!>0);
 assert.ok(Math.abs(third.vy!)<1e-8);
 assert.equal(third.x,.5);
 assert.ok(third.smoothX<.5); // filtered, not replaced raw input
});

test('S6.8.8.3 calculates body joint angles from projected points',()=>{
 assert.ok(Math.abs(angle2D(
  {x:0,y:1,z:0},{x:0,y:0,z:0},{x:1,y:0,z:0})!-90)<1e-8);
 assert.equal(angle2D({x:0,y:0,z:0},{x:0,y:0,z:0},{x:1,y:1,z:0}),null);
 const p=pose(.3);
 p[11]={x:.3,y:.3,z:0,visibility:1};
 p[13]={x:.4,y:.3,z:0,visibility:1};
 p[15]={x:.4,y:.4,z:0,visibility:1};
 const temporal=new TemporalJointAnalyzer();
 temporal.observe([assignment('A',p)],presence(),10);
 const leftElbow=temporal.latest!.actors[0].angles.find(a=>a.joint===13);
 assert.ok(leftElbow);
 assert.ok(Math.abs(leftElbow.degrees-90)<1e-8);
 assert.ok(temporal.getTrace('A',13)[0].angleDeg!==null);
 assert.ok(temporal.getTrace('A',15)[0].angleDeg!==null);
 assert.equal(temporal.getTrace('A',0)[0].angleDeg,null);
});

test('S6.8.8.3 missing actor creates a gap and never extrapolates across occlusion',()=>{
 const temporal=new TemporalJointAnalyzer();
 temporal.observe([assignment('A',pose(.2)),assignment('B',pose(.7))],presence('visible','visible'),0);
 temporal.observe([assignment('A',pose(.25))],presence('visible','occluded'),100);
 assert.equal(temporal.getTrace('B',15)[1].x,null);
 assert.ok(temporal.getTrace('A',15)[1].vx!==null);
 temporal.observe([assignment('A',pose(.3)),assignment('B',pose(.8))],presence('visible','visible'),200);
 assert.equal(temporal.getTrace('B',15)[2].vx,null);
 assert.ok(temporal.getTrace('A',15)[2].vx!==null);
 assert.equal(temporal.getTrace('B',15)[2].x,.8);
});

test('S6.8.8.3 temporarily obscured wrist cannot inherit stale velocity or angle',()=>{
 const temporal=new TemporalJointAnalyzer();
 const first=pose(.2);
 first[11]={x:.3,y:.3,z:0,visibility:1};
 first[13]={x:.4,y:.3,z:0,visibility:1};
 first[15]={x:.4,y:.4,z:0,visibility:1};
 temporal.observe([assignment('A',first)],presence(),0);
 const hidden=first.map(p=>({...p}));
 hidden[13].visibility=.1;
 temporal.observe([assignment('A',hidden)],presence(),100);
 assert.equal(temporal.getTrace('A',13)[1].x,null);
 assert.equal(temporal.getTrace('A',13)[1].angleDeg,null);
 assert.equal(temporal.latest!.actors[0].angles.some(a=>a.joint===13),false);
 hidden[13]={x:.5,y:.3,z:0,visibility:1};
 temporal.observe([assignment('A',hidden)],presence(),200);
 assert.equal(temporal.getTrace('A',13)[2].vx,null);
});

test('S6.8.8.3 resets velocity across video gaps and rejects reversed timestamps',()=>{
 const temporal=new TemporalJointAnalyzer();
 temporal.observe([assignment('A',pose(.2))],presence(),0);
 temporal.observe([assignment('A',pose(.4))],presence(),100);
 temporal.observe([assignment('A',pose(.8))],presence(),100+TEMPORAL_MAX_GAP_MS+1);
 assert.equal(joint(temporal,'A')?.vx,null);
 assert.throws(()=>temporal.observe([],[],100),/Timestamp/);
 temporal.reset();
 assert.equal(temporal.frameCount,0);
 assert.deepEqual(temporal.getTrace('A',15),[]);
 temporal.observe([assignment('A',pose(.5))],presence(),10);
 assert.equal(joint(temporal,'A')?.vx,null);
});

test('S6.8.8.3 bounded history protects long rehearsal memory and copies are isolated',()=>{
 const temporal=new TemporalJointAnalyzer();
 for(let i=0;i<TEMPORAL_WINDOW_FRAMES+8;i++)
  temporal.observe([assignment('A',pose(.2))],presence(),i*100);
 assert.equal(temporal.frameCount,TEMPORAL_WINDOW_FRAMES);
 const window=temporal.window;
 assert.equal(window[0].atMs,800);
 window[0].actors[0].joints[0].x=123;
 assert.notEqual(temporal.window[0].actors[0].joints[0].x,123);
 const trace=temporal.getTrace('A',15);
 assert.equal(trace.length,TEMPORAL_WINDOW_FRAMES);
 assert.equal(trace[0].atMs,800);
});

test('S6.8.8.3 CSV preserves gaps and clearly names normalized units',()=>{
 const temporal=new TemporalJointAnalyzer();
 temporal.observe([assignment('A',pose(.2))],presence(),0);
 temporal.observe([],presence('occluded'),100);
 const csv=temporalTraceCsv(temporal.getTrace('A',15));
 assert.match(csv,/velocity_x_per_s/);
 assert.match(csv,/z_relative/);
 assert.match(csv,/^video_ms,x,y,z_relative/);
 assert.ok(csv.split('\r\n').some(row=>row.startsWith('100,,,,,')));
 assert.deepEqual(temporal.getTrace('B',99),[]);
});
