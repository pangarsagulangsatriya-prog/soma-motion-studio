import test from 'node:test';
import assert from 'node:assert/strict';
import {POSE_LANDMARK_COUNT,POSE_CONNECTIONS,SKELETON_COLORS,
 skeletonGeometry,replaySkeletonsCurrent,drawSkeletonBodies}
 from '../src/stage/fullBodySkeleton.ts';
import type {Landmark} from '../src/engine/types.ts';

const pose=(offset=0):Landmark[]=>
 Array.from({length:33},(_,i)=>({
  x:.1+offset+(i%5)*.04,y:.12+Math.floor(i/5)*.08,
  z:0,visibility:.92
 }));

test('S6.8.8.1 full MediaPipe pose exposes 33 joints and all limb connections',()=>{
 const joints=skeletonGeometry(pose());
 assert.equal(POSE_LANDMARK_COUNT,33);
 assert.equal(joints.joints.length,33);
 assert.equal(joints.bones.length,POSE_CONNECTIONS.length);
 for(const [a,b] of [[11,13],[13,15],[15,19],[12,14],[14,16],
   [23,25],[25,27],[27,31],[24,26],[26,28],[28,32]]){
  assert.ok(joints.bones.some(edge=>edge.from===a&&edge.to===b),
   `missing joint connection ${a}-${b}`);
 }
});

test('S6.8.8.1 reject missing/invalid joints, draw uncertain edges as uncertain',()=>{
 const p=pose();
 p[15].visibility=.3;
 p[16].visibility=.1;
 p[27].x=NaN;
 p[32].y=-.1;
 const data=skeletonGeometry(p);
 assert.equal(data.joints.length,30);
 assert.ok(data.joints.find(j=>j.index===15&&j.level==='uncertain'));
 assert.ok(!data.joints.some(j=>j.index===16||j.index===27||j.index===32));
 assert.ok(data.bones.some(b=>b.from===13&&b.to===15&&b.level==='uncertain'));
 assert.ok(!data.bones.some(b=>b.from===14&&b.to===16));
 assert.ok(!data.bones.some(b=>b.from===25&&b.to===27));
 assert.equal(skeletonGeometry(p.slice(0,32)).joints.length,0);
});

test('S6.8.8.1 unverified raw MP4 poses remain visible independently of gated gait identities',()=>{
 const p1=pose(),p2=pose(.2);
 const raw={atMs:2000,rawPoses:[p1,p2]};
 assert.equal(replaySkeletonsCurrent(raw,2050).length,2);
 assert.equal(replaySkeletonsCurrent(raw,2500).length,0);
 assert.equal(replaySkeletonsCurrent({...raw,atMs:NaN},2050).length,0);
 assert.equal(replaySkeletonsCurrent({atMs:2000},2000).length,0);
 assert.deepEqual(replaySkeletonsCurrent({atMs:2000,rawPoses:[...raw.rawPoses,p1]},2000),
  [p1,p2]);
 assert.notEqual(SKELETON_COLORS[0],SKELETON_COLORS[1]);
});

test('S6.8.8.1 renderer paints two raw bodies with 33 joints each and no phantom segment',()=>{
 const calls={arc:0,stroke:0,dash:0,text:0,save:0,restore:0};
 const ctx={
  save:()=>{calls.save++;},restore:()=>{calls.restore++;},
  beginPath:()=>{},arc:()=>{calls.arc++;},moveTo:()=>{},lineTo:()=>{},
  fill:()=>{},stroke:()=>{calls.stroke++;},fillText:()=>{calls.text++;},
  setLineDash:()=>{calls.dash++;},lineCap:'round',lineJoin:'round',
  strokeStyle:'',fillStyle:'',globalAlpha:1,lineWidth:1,font:'',textBaseline:''
 } as unknown as CanvasRenderingContext2D;
 assert.equal(drawSkeletonBodies(ctx,[pose(),pose(.2)],{x:0,y:0,width:640,height:360}),2);
 assert.equal(calls.arc,66);
 assert.equal(calls.stroke,POSE_CONNECTIONS.length*2);
 assert.equal(calls.text,2);
 assert.equal(calls.save,calls.restore);
 const before=calls.arc;
 assert.equal(drawSkeletonBodies(ctx,[pose()],{x:0,y:0,width:0,height:360}),0);
 assert.equal(calls.arc,before);
});
