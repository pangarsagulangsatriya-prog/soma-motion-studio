import {test} from 'node:test';
import assert from 'node:assert/strict';
import type {Landmark} from '../src/engine/types.ts';
import type {ReplayAnalysisSnapshot} from '../src/stage/VideoPoseGaitEngine.ts';
import type {V3Input,V3InputOptions} from '../src/footprints/lines/v3/SourceFrameNormalizer.ts';
import {dualTracePoseFrames} from '../src/footprints/dual-trace/DualTracePoseFrameBus.ts';
import {upperGestureAnchors} from '../src/footprints/dual-trace/UpperGestureAnchorAdapter.ts';
import {UpperGestureStrokeTracker} from '../src/footprints/dual-trace/UpperGestureStrokeTracker.ts';

function pose(cx=.3,cy=.42):Landmark[]{
 const p=Array.from({length:33},()=>({x:.5,y:.5,z:0,visibility:.99}));
 p[0]={x:cx,y:cy-.14,z:0,visibility:.99};
 p[7]={x:cx-.035,y:cy-.12,z:0,visibility:.95};
 p[8]={x:cx+.035,y:cy-.12,z:0,visibility:.95};
 p[11]={x:cx-.075,y:cy,z:0,visibility:.99};
 p[12]={x:cx+.075,y:cy,z:0,visibility:.99};
 return p;
}
const input=(atMs:number):V3Input=>({
 source:'video',sourceKey:'video:qa:0:2',frameMs:atMs,presentationMs:atMs,
 ready:true,paused:false,seeking:false,samples:[],status:'MP4 · 4 kaki terbaca'
});
const options=(atMs:number,a:Landmark[],b:Landmark[],ambiguous=false):
 Pick<V3InputOptions,'experiment'|'live'|'status'|'performers'>=>({
 experiment:{kind:'video',snapshot:{
  atMs,segment:0,ambiguous,
  people:[{id:'A',landmarks:a,confidence:.96},{id:'B',landmarks:b,confidence:.95}]
 } as unknown as ReplayAnalysisSnapshot,ready:true,video:null,timeMs:atMs,name:'qa',
 clip:null},
 live:null,performers:2,status:{} as V3InputOptions['status']
});
test('one approved MP4 snapshot feeds both actors and both upper channels',()=>{
 const o=options(1000,pose(),pose(.72,.51));
 const frames=dualTracePoseFrames(input(1000),o);
 assert.deepEqual(frames.map(x=>x.actorId),['A','B']);
 assert.equal(frames[0].timeMs,1000);
 assert.equal(frames[0].sourceKey,input(1000).sourceKey);
 const anchors=frames.flatMap(frame=>upperGestureAnchors(frame));
 assert.equal(anchors.length,4);
 assert.deepEqual(anchors.map(x=>x.channel),['shoulder','head','shoulder','head']);
 assert.equal(anchors[0].actorId,'A');
 assert.equal(anchors[2].actorId,'B');
});
test('stale, ambiguous, foot-only, and paused frames produce no upper marks',()=>{
 const o=options(1000,pose(),pose(.7),false);
 assert.equal(dualTracePoseFrames(input(1100),o).length,0);
 assert.equal(dualTracePoseFrames({...input(1000),paused:true},o).length,0);
 assert.equal(dualTracePoseFrames({...input(1000),source:'demo'},o).length,0);
 assert.equal(dualTracePoseFrames(input(1000),options(1000,pose(),pose(),true)).length,0);
});
test('head movement changes head anchor; shoulder movement stays independent',()=>{
 const a=upperGestureAnchors({
  actorId:'A',source:'video',sourceKey:'video:qa:0:2',epoch:0,timeMs:1000,
  identityConfidence:.95,landmarks:pose(),coordinateBasis:'image-2d'
 },1.35);
 const p=pose();p[7].x+=.06;p[8].x+=.06;
 const b=upperGestureAnchors({
  actorId:'A',source:'video',sourceKey:'video:qa:0:2',epoch:0,timeMs:1033,
  identityConfidence:.95,landmarks:p,coordinateBasis:'image-2d'
 },1.35);
 const c=(channel:string,items:typeof a)=>items.find(x=>x.channel===channel)!;
 assert.equal(c('shoulder',a).pointPx.x,c('shoulder',b).pointPx.x);
 assert.ok(c('head',b).pointPx.x-c('head',a).pointPx.x>100);
});
test('head uses nose fallback; shoulder missing never creates fake head',()=>{
 const p=pose();p[7].visibility=0;p[8].visibility=0;
 const frame={actorId:'A' as const,source:'video' as const,
  sourceKey:'video:qa:0:2',epoch:0,timeMs:1000,
  identityConfidence:.95,landmarks:p,coordinateBasis:'image-2d' as const};
 const a=upperGestureAnchors(frame);
 assert.equal(a.find(v=>v.channel==='head')?.basis,'estimated-head');
 p[11].visibility=0;assert.equal(upperGestureAnchors(frame).length,0);
});
test('standing still and jitter never add paint, seek cuts without bridge',()=>{
 const tracker=new UpperGestureStrokeTracker(),p=pose();
 let adds=0,starts=0;
 for(let i=0;i<50;i++){
  const a=upperGestureAnchors({actorId:'A',source:'video',sourceKey:'video:qa:0:2',
   epoch:0,timeMs:1000+i*100,identityConfidence:.96,landmarks:p,
   coordinateBasis:'image-2d'});
  const ev=tracker.ingest(a,1000+i*100);
  adds+=ev.filter(x=>x.kind==='ADD'||x.kind==='TURN').length;
  starts+=ev.filter(x=>x.kind==='START').length;
 }
 assert.equal(starts,2);assert.equal(adds,0);
 assert.equal(tracker.activeCount,2);
 const cuts=tracker.cutAll('seek');
 assert.equal(cuts.length,2);
 assert.ok(cuts.every(x=>x.reason==='seek'));
 assert.equal(tracker.activeCount,0);
});
test('two actors crossing retain four independent channel identity keys',()=>{
 const tr=new UpperGestureStrokeTracker();
 for(let i=0;i<18;i++){
  const t=1000+i*66;
  const list=[['A',.2+.025*i],['B',.8-.025*i]] as const;
  const anchors=list.flatMap(([actor,cx])=>
   upperGestureAnchors({actorId:actor,source:'video',sourceKey:'video:crossing:0:2',
    epoch:0,timeMs:t,identityConfidence:.96,landmarks:pose(cx,.42),
    coordinateBasis:'image-2d'}));
  tr.ingest(anchors,t);
 }
 assert.equal(tr.activeCount,4);
 assert.equal(new Set(tr.cutAll('end').map(x=>x.strokeId)).size,4);
});

test('live two-person poseIndices identify A/B without assuming raw index 0 is A',()=>{
 const a=pose(.28,.39),b=pose(.73,.49);
 const inputLive:V3Input={...input(2000),source:'phone',
  sourceKey:'track:phone:session:2'};
 const opts:Pick<V3InputOptions,'experiment'|'live'|'status'|'performers'>={
  experiment:null,performers:2,
  live:{time:2000,tracked:true,source:'camera',quality:.41,
   pose:a,poses:[b,a]} as unknown as V3InputOptions['live'],
  status:{ambiguous:false,observedFrameTime:2000,
   poseIndices:{A:1,B:0}} as V3InputOptions['status']
 };
 const frames=dualTracePoseFrames(inputLive,opts);
 assert.deepEqual(frames.map(x=>x.actorId),['A','B']);
 assert.equal(frames[0].landmarks[11].x,a[11].x);
 assert.equal(frames[1].landmarks[11].x,b[11].x);
 const low=pose();low[11].visibility=0;low[12].visibility=0;
 assert.equal(upperGestureAnchors({...frames[0],landmarks:low}).length,0);
});
