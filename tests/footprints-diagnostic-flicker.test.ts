import {test} from 'node:test';
import assert from 'node:assert/strict';
import {replaySkeletonDiagnosticPreview,replaySkeletonPresentation}
 from '../src/stage/fullBodySkeleton.ts';
import type {Landmark} from '../src/engine/types.ts';

const make=(x:number):Landmark[]=>Array.from({length:33},()=>({x,y:.5,z:0,visibility:.95}));
const sample={atMs:1000,rawPoses:[make(.25)],actorStates:[{
 id:'A' as const,presence:'visible',rawIndex:0
}]};
test('last observed pose stays in software preview during 12 FPS worker stalls',()=>{
 assert.equal(replaySkeletonPresentation(sample,1320).poses.length,0);
 const preview=replaySkeletonDiagnosticPreview(sample,1320);
 assert.equal(preview.poses.length,1);
 assert.equal(preview.held,true);
 assert.ok(preview.opacity>0&&preview.opacity<1);
 assert.equal(preview.poses[0][0].x,.25);
});
test('preview hold fades, expires and clears instantly on backward seek',()=>{
 assert.equal(replaySkeletonDiagnosticPreview(sample,1200).opacity,1);
 const middle=replaySkeletonDiagnosticPreview(sample,1570);
 assert.ok(middle.opacity>0&&middle.opacity<1);
 assert.equal(replaySkeletonDiagnosticPreview(sample,1851).poses.length,0);
 assert.equal(replaySkeletonDiagnosticPreview(sample,900).poses.length,0);
});
test('missing poses remain blank, held visual does not produce gait events',()=>{
 const noPose={...sample,rawPoses:[]};
 assert.equal(replaySkeletonDiagnosticPreview(noPose,1050).poses.length,0);
 const held=replaySkeletonDiagnosticPreview(sample,1540);
 assert.equal(held.labels[0],'ACTOR A');
 assert.ok(!('events' in held));
});
