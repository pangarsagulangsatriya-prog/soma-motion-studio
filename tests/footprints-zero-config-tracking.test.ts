import {test} from 'node:test';
import assert from 'node:assert/strict';
import {duetSearchRegions,cropInferenceSize} from '../src/stage/duetPoseRescue.ts';
import type {Landmark} from '../src/engine/types.ts';
import {readFileSync} from 'node:fs';
function torso(x:number,y=.5):Landmark[]{
 const p:Landmark[]=Array.from({length:33},()=>({x,y,z:0,visibility:.95}));
 p[11]={x:x-.025,y:y-.1,z:0,visibility:.95};
 p[12]={x:x+.025,y:y-.1,z:0,visibility:.95};
 p[23]={x:x-.025,y:y+.1,z:0,visibility:.95};
 p[24]={x:x+.025,y:y+.1,z:0,visibility:.95};
 return p;
}
test('one actor right: automatic rescue searches left stage before rechecking middle',()=>{
 const r=duetSearchRegions([torso(.77)]);
 assert.equal(r.length,2);
 assert.equal(r[0].x,0);
 assert.ok(r[0].x+r[0].width>.3);
 assert.ok(r[0].height>.85);
});
test('one actor left: automatic rescue searches right stage',()=>{
 const r=duetSearchRegions([torso(.24)]);
 assert.ok(r[0].x>=.4);
 assert.ok(r[0].x+r[0].width>=.95);
});
test('missing both: boot scans left and right without manual actor selection',()=>{
 const r=duetSearchRegions([]);
 assert.equal(r.length,2);
 assert.equal(r[0].x,0);
 assert.ok(r[1].x>.4);
});
test('inferencing crop preserves source aspect ratio rather than stretching to portrait',()=>{
 for(const region of duetSearchRegions([torso(.75)])){
  const s=cropInferenceSize(640,360,region);
  const original=640*region.width/(360*region.height);
  assert.ok(Math.abs(s.width/s.height-original)<.007);
  assert.ok(Math.max(s.width,s.height)<=512);
 }
});
test('Tracking auto-starts muted looping MP4; technical knobs only in opt-in Lab',()=>{
 const ui=readFileSync(new URL('../src/studio/v3/FootprintsExperimentalSource.tsx',import.meta.url),'utf8');
 const worker=readFileSync(new URL('../src/stage/replayInferenceWorker.ts',import.meta.url),'utf8');
 const stage=readFileSync(new URL('../src/studio/v3/FootprintsStageWorkspace.tsx',import.meta.url),'utf8');
 assert.match(ui,/engine\.setPerformers\(performerCount\)/);
 assert.match(ui,/el\.play\(\)/);
 assert.match(ui,/playsInline muted loop preload/);
 assert.match(ui,/TRACKING OTOMATIS/);
 assert.match(ui,/showTechnicalLab&&<details className="fp-d4-performance"/);
 assert.match(ui,/kind==='simulator'\|\|showTechnicalLab/);
 assert.doesNotMatch(stage,/Motion Smooth ·/);
 assert.match(worker,/duetSearchRegions\(landmarks\)/);
 assert.match(worker,/cropInferenceSize\(bitmap\.width,bitmap\.height,region\)/);
 assert.match(worker,/RESCUE_INTERVAL_MS=360/);
});
