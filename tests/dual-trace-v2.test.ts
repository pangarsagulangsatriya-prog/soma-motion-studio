import {test} from 'node:test';
import assert from 'node:assert/strict';
import {DEFAULT_DUAL_TRACE_PALETTE,dualTraceLayerOrder} from '../src/footprints/dual-trace/DualTraceV2Renderer.ts';
import {MotionBrushDynamics} from '../src/footprints/dual-trace/MotionBrushDynamics.ts';
import {mapUpperAnchorsToStage} from '../src/footprints/dual-trace/UpperStageAnchorMapper.ts';
import type {PathEvent} from '../src/footprints/lines/v3/ActorPathTracker.ts';

const path=(kind:PathEvent['kind'],x:number,y:number,t:number,turnRad?:number):PathEvent=>({
 kind,point:{x,y},timeMs:t,actorId:'A',strokeId:'stroke-test',
 sourceKey:'video:qa:0:2',clipStableId:'video:qa',epoch:0,
 confidence:.96,provenance:'video-estimate',
 ...(turnRad!==undefined?{turnRad}:{})
});
test('DTV2-03: front layer order switches deterministically',()=>{
 assert.deepEqual(dualTraceLayerOrder('foot-on-top'),['upper','path','footprint']);
 assert.deepEqual(dualTraceLayerOrder('upper-on-top'),['footprint','path','upper']);
});
test('DTV2-04: A/B palettes separate path, footprints and upper',()=>{
 assert.notEqual(DEFAULT_DUAL_TRACE_PALETTE.A.path,DEFAULT_DUAL_TRACE_PALETTE.A.footprint);
 assert.notEqual(DEFAULT_DUAL_TRACE_PALETTE.A.upper,DEFAULT_DUAL_TRACE_PALETTE.A.footprint);
 assert.notEqual(DEFAULT_DUAL_TRACE_PALETTE.B.path,DEFAULT_DUAL_TRACE_PALETTE.B.footprint);
 assert.notEqual(DEFAULT_DUAL_TRACE_PALETTE.A.path,DEFAULT_DUAL_TRACE_PALETTE.B.path);
});
test('DTV2-07: brush width is bounded, deterministic and does not grow while stopped',()=>{
 const input=[path('START',100,200,1000),path('ADD',120,200,1070),
  path('TURN',132,210,1150,.9),path('STOP',132,210,1300)];
 const one=new MotionBrushDynamics(),two=new MotionBrushDynamics();
 const a=input.map(x=>one.weight(x,true)),b=input.map(x=>two.weight(x,true));
 assert.deepEqual(a,b);
 assert.ok(a.every(x=>x>=.72&&x<=1.23));
 assert.equal(one.weight(path('STOP',132,210,1400),true),a.at(-1));
 assert.equal(one.weight(path('CUT',132,210,1500),true),1);
 assert.equal(one.weight(path('START',142,210,1600),true),1);
});
test('DTV2-06: calibrated upper anchors follow the actor floor anchor',()=>{
 const upper={actorId:'A' as const,channel:'head' as const,pointPx:{x:800,y:160},
  sourceKey:'video:qa:0:2',clipStableId:'video:qa',epoch:0,timeMs:1000,
  confidence:.9,basis:'observed-2d' as const};
 const pts=Array.from({length:33},()=>({x:.5,y:.5,z:0,visibility:.99}));
 pts[23]={x:.48,y:.72,z:0,visibility:.9};
 pts[24]={x:.52,y:.72,z:0,visibility:.9};
 const frame={actorId:'A' as const,source:'video' as const,sourceKey:upper.sourceKey,
  epoch:0,timeMs:1000,identityConfidence:.98,landmarks:pts,coordinateBasis:'image-2d' as const};
 const observation={actorId:'A' as const,sourceKey:upper.sourceKey,clipStableId:upper.clipStableId,
  epoch:0,timeMs:1000,point:{x:440,y:670},confidence:.9,
  evidence:'estimated-ground-projection' as const,provenance:'video-estimate' as const};
 const anchored=mapUpperAnchorsToStage([upper],[frame],[observation],true);
 assert.equal(anchored.length,1);
 assert.ok(Math.abs(anchored[0].pointPx.x-440)<2);
 assert.ok(anchored[0].pointPx.y<670);
 assert.deepEqual(mapUpperAnchorsToStage([upper],[frame],[observation],false),[upper]);
 assert.equal(mapUpperAnchorsToStage([upper],[frame],[],true).length,0);
});
test('DTV2-01: production compositor has no independent white upper background',async()=>{
 const {readFileSync}=await import('node:fs');
 const source=readFileSync('src/footprints/dual-trace/DualTraceV2Renderer.ts','utf8');
 const stage=readFileSync('src/studio/v3/LineTrailsV3.tsx','utf8');
 assert.match(source,/ctx\.fillStyle=opts\.blackout\?'#000000':'#F7F6F2'/);
 assert.match(source,/source-in/);
 assert.match(stage,/v2\.paint\(ctx,/);
 assert.match(stage,/if\(!off\)out\.drawImage\(c,0,0\)/);
});
