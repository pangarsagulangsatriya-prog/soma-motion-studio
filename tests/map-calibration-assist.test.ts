import {test} from 'node:test';
import assert from 'node:assert/strict';
import {identityQuad,type Quad} from '../src/projection/geometry.ts';
import {assistFromTrajectory,projectAssistEvent,syntheticAssistTest,mergeAssistBuffer,metricAssistFootSize,
 type FootAssistEvent} from '../src/studio/v3/mapCalibrationAssist.ts';
import type {V3Input} from '../src/footprints/lines/v3/SourceFrameNormalizer.ts';
const rect=identityQuad();
const trapezoid:Quad=[{x:.2,y:.14},{x:.8,y:.2},{x:.92,y:.93},{x:.07,y:.92}];
const geom={cameraQuad:trapezoid,sourceQuad:rect,outputQuad:rect};
const event=(sourceUV:{x:number;y:number}):FootAssistEvent=>({
 id:'a-l',sourceKey:'live:1',frameMs:1000,atMs:1000,actorId:'A',
 foot:'left',sourceUV,confidence:.9,headingRad:0,origin:'detected-estimate',
 phase:'position-estimate'
});
const sample=(source:V3Input['source']='camera'):V3Input=>({
 source,sourceKey:'cam:1',frameMs:1000,presentationMs:1000,ready:true,
 paused:false,seeking:false,status:'test',
 samples:[{sessionId:'s',generation:0,source:source==='demo'?'camera':source,
  actorId:'performer-1',coordinateBasis:'image-2d',atMs:1000,
  foot:'left',anchor:'heel-toe-center',x:.4,y:.65,confidence:.95,
  headingRad:0}]
});
test('MCA-01: observed pose yields a 2D position estimate, not verified contact',()=>{
 const a=assistFromTrajectory(sample(),1050,16/9);
 assert.equal(a.length,1);
 assert.equal(a[0].actorId,'A');
 assert.equal(a[0].origin,'detected-estimate');
 assert.equal(a[0].phase,'position-estimate');
 assert.deepEqual(a[0].sourceUV,{x:.4,y:.65});
});
test('MCA-01: swing, stale, paused, seeking and low-confidence feet cannot stamp',()=>{
 const s=sample('video');
 s.supportHints=[{actorId:'performer-1',foot:'left',kind:'swing',atMs:1000,confidence:.98,basis:'video-2d-estimate'}];
 assert.equal(assistFromTrajectory(s,1050,16/9).length,0);
 s.supportHints=[];s.paused=true;assert.equal(assistFromTrajectory(s,1050,16/9).length,0);
 s.paused=false;s.seeking=true;assert.equal(assistFromTrajectory(s,1050,16/9).length,0);
 s.seeking=false;s.ready=false;assert.equal(assistFromTrajectory(s,1050,16/9).length,0);
 s.ready=true;s.samples[0].confidence=.45;
 assert.equal(assistFromTrajectory(s,1050,16/9).length,0);
});
test('MCA-02: camera quad maps back to floor, then to preview projector',()=>{
 const p=projectAssistEvent(event({x:.5,y:.55}),geom)!;
 assert.ok(p&&p.floorUV.x>0&&p.floorUV.x<1);
 assert.ok(p.outputUV.x>=0&&p.outputUV.x<=1);
 assert.ok(Math.abs(p.floorUV.x-p.outputUV.x)<1e-7);
 const q=projectAssistEvent(event({x:.5,y:.55}),{
  ...geom,outputQuad:[{x:.1,y:.1},{x:.9,y:.1},{x:.8,y:.9},{x:.2,y:.9}]
 })!;
 assert.notDeepEqual(q.outputUV,p.outputUV,'output draft must change mapped point');
});
test('MCA-02: crop sourceQuad used exactly once; calibrated outliers rejected',()=>{
 const e:FootAssistEvent={...event({x:.5,y:.5}),sourceUV:undefined,floorUV:{x:.5,y:.5}};
 const from:Quad=[{x:.2,y:.2},{x:.8,y:.2},{x:.8,y:.8},{x:.2,y:.8}];
 const to:Quad=[{x:.1,y:.1},{x:.9,y:.1},{x:.9,y:.9},{x:.1,y:.9}];
 const p=projectAssistEvent(e,{cameraQuad:rect,sourceQuad:from,outputQuad:to})!;
 assert.ok(Math.abs(p.outputUV.x-.5)<1e-8);
 assert.ok(Math.abs(p.outputUV.y-.5)<1e-8);
 assert.equal(projectAssistEvent({...e,floorUV:{x:1.2,y:.4}},geom),null);
 const wrong:Quad=[{x:.5,y:.5},{x:.5,y:.5},{x:.9,y:.9},{x:.1,y:.8}];
 assert.equal(projectAssistEvent(e,{cameraQuad:wrong,sourceQuad:rect,outputQuad:rect}),null);
});
test('MCA-03: synthetic five-point test never masquerades as camera detection',()=>{
 const t=syntheticAssistTest(2000,'synthetic:camera');
 assert.equal(t.length,5);assert.ok(t.every(x=>x.origin==='synthetic-test'&&x.phase==='test'));
 assert.equal(t.filter(x=>x.actorId==='A').length,3);
 const p=projectAssistEvent(t[0],geom);
 assert.ok(p?.sourceUV&&p.outputUV);
});
test('MCA-05: 4:3 letterbox is removed before raw-camera mapping',()=>{
 const a=assistFromTrajectory(sample(),1100,4/3)[0];
 assert.ok(a.sourceUV);
 assert.ok(Math.abs(a.sourceUV!.x-(.4-.125)/.75)<.001);
});
test('MCA-06: five-second ring buffer deduplicates frames and expires old evidence',()=>{
 const e=event({x:.4,y:.6});
 const once=mergeAssistBuffer([], [e,e],1100);
 assert.equal(once.length,1);
 const old=mergeAssistBuffer(once,[],6101);
 assert.equal(old.length,0);
});
test('MCA-04: assist has separate canvases and no projected output/write permission',async()=>{
 const {readFileSync}=await import('node:fs');
 const src=readFileSync('src/studio/v3/MapWysiwygWorkspace.tsx','utf8');
 assert.ok(src.includes('ref={assist.sourceCanvas}'));
 assert.ok(src.includes('ref={assist.outputCanvas}'));
 const hook=readFileSync('src/studio/v3/useMapCalibrationAssist.ts','utf8');
 assert.ok(!/syncDualSurfaceRuntime|patchDualSurfaceState|requestFullscreen\(/.test(hook));
 assert.ok(!/outputFloorRaster|StageRouteInput/.test(hook));
});

test('V7.2: nominal sole scales in meters, not in fixed screen pixels',()=>{
 const small=metricAssistFootSize(50),large=metricAssistFootSize(100);
 assert.equal(large.lengthPx,26);
 assert.equal(large.widthPx,9.5);
 assert.equal(large.lengthPx,small.lengthPx*2);
 assert.deepEqual(metricAssistFootSize(NaN),{widthPx:0,lengthPx:0});
});
