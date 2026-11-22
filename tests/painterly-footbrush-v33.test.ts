import {test} from 'node:test';
import assert from 'node:assert/strict';
import {adaptFootBrushFrame} from '../src/footprints/lines/v3/FootBrushPoseAdapter.ts';
import {FootContactGestureEngine} from '../src/footprints/lines/v3/FootContactGestureEngine.ts';
import {buildFootBrushDabs} from '../src/footprints/lines/v3/FootBrushGeometryBuilder.ts';
import type {FootV3Sample} from '../src/footprints/lines/v3/FootPositionResolver.ts';
const sample=(x:number,t:number,foot:'left'|'right'='left'):FootV3Sample=>({
 sessionId:'test',generation:0,source:'video',actorId:'A',foot,x,y:.5,
 atMs:t,confidence:.96,coordinateBasis:'image-2d',
 anchor:'heel-toe-center',headingRad:0,
 heel:{x:x-.015,y:.52},toe:{x:x+.015,y:.48}
});
test('pose adapter rejects duplicate frame, invalid coordinates and resets epoch on seek',()=>{
 const a=adaptFootBrushFrame([sample(.3,100)],'video:test',100);
 assert.equal(a.poses.length,1);
 assert.equal(a.poses[0].provenance,'video-estimate');
 assert.equal(adaptFootBrushFrame([sample(.4,100)],'video:test',100,a.state).poses.length,0);
 const b=adaptFootBrushFrame([sample(.4,50)],'video:test',50,a.state);
 assert.equal(b.cut,true);assert.equal(b.poses[0].epoch,a.poses[0].epoch+1);
 const bad={...sample(.4,70),x:NaN};
 assert.equal(adaptFootBrushFrame([bad],'video:test',70,b.state).poses.length,0);
});
test('stable step creates one estimated imprint, no repetitive stamp while still',()=>{
 const engine=new FootContactGestureEngine();
 let state={lastFrameMs:-1,epoch:0,sourceKey:''},marks=0;
 for(const [t,x] of [[1000,.2],[1050,.22],[1100,.25],[1150,.28],[1200,.3],
 [1250,.3],[1300,.3],[1350,.3],[1450,.3],[1500,.3]]){
  const v=adaptFootBrushFrame([sample(x,t)],'video:test',t,state);state=v.state;
  marks+=engine.ingest(v.poses).filter(e=>e.kind==='imprint').length;
 }
 assert.equal(marks,1);
});
test('drag produces continuous dabs without centerline and stable seed',()=>{
 const a=adaptFootBrushFrame([sample(.3,100)],'video:test',100).poses[0];
 const b=adaptFootBrushFrame([sample(.33,130)],'video:test',130).poses[0];
 const d=buildFootBrushDabs(a,b,'drag');
 assert.ok(d.length>2);assert.ok(d.every(p=>p.kind==='drag'));
 assert.deepEqual(d,buildFootBrushDabs(a,b,'drag'));
});
test('pivot samples arc around a stable heel despite stationary center',()=>{
 const a=adaptFootBrushFrame([sample(.3,100)],'video:test',100).poses[0];
 const b={...a,atMs:130,headingRad:Math.PI/3,
  heel:a.heel,center:a.center};
 const d=buildFootBrushDabs(a,b,'pivot',{pivot:'heel'});
 assert.ok(d.length>3);
 assert.notDeepEqual(d[0].center,d.at(-1)?.center);
});
test('source and identity cuts refuse to bridge old brush strokes',()=>{
 const a=adaptFootBrushFrame([sample(.3,100)],'video:test',100).poses[0];
 const b={...a,sourceKey:'video:other',atMs:130,center:{x:.4,y:.5}};
 assert.equal(buildFootBrushDabs(a,b,'drag').length,0);
 assert.equal(buildFootBrushDabs(a,{...b,sourceKey:a.sourceKey,epoch:99},'drag').length,0);
 assert.equal(buildFootBrushDabs(a,{...b,sourceKey:a.sourceKey,actorId:'B'},'drag').length,0);
});
