import {test} from 'node:test';
import assert from 'node:assert/strict';
import {PainterlyImpressionEngine,lifetimeOpacity} from '../src/footprints/lines/v3/PainterlyImpressionEngine.ts';
import {DEFAULT_PAINTERLY_SETTINGS,paintPainterlyCanvas} from '../src/footprints/lines/v3/PainterlyCanvasRenderer.ts';
import {DualFootTrajectoryEngine} from '../src/footprints/lines/v3/DualFootTrajectoryEngine.ts';
import {DEFAULT_V3_SETTINGS} from '../src/footprints/lines/v3/TrajectoryRenderer.ts';
import type {FootV3Sample} from '../src/footprints/lines/v3/FootPositionResolver.ts';
import type {FootMotionEventV2} from '../src/footprints/scenes/FootMotionEventV2.ts';
const sample=(foot:'left'|'right',x:number,atMs:number,actorId='A'):FootV3Sample=>({
 sessionId:'scene',generation:0,source:'video',actorId,foot,
 x,y:.6,atMs,confidence:.98,coordinateBasis:'image-2d',
 anchor:'heel-toe-center',headingRad:0
});
const pair=(x:number,t:number)=>[sample('left',x,t),sample('right',.75,t)];
const event=(id:string,foot:'left'|'right',atMs:number):FootMotionEventV2=>({
 schema:'soma.foot-motion-event',version:2,
 eventId:id,originEventId:id,sessionId:'s',generation:0,
 actorId:'A',foot,kind:'contact',source:'video',x:.35,y:.6,
 atMs,speed:0,confidence:.92,verified:true,
 verification:'video-estimate',coordinateBasis:'image-2d'
});
test('Sumi V3.4 is the visible default; legacy lifetime remains configurable',()=>{
 const p=DEFAULT_PAINTERLY_SETTINGS;
 assert.equal(p.painterlyEngine,'path-first-v35');
 assert.equal(p.pathWeightPx,26);
 assert.equal(p.pathMaterial,'path-sumi');
 assert.equal(p.pathAccents,'subtle');
 assert.equal(p.sumiWeightPx,56);
 assert.equal(p.sumiMaterial,'sumi');
 assert.equal(p.sumiExpression,'bold');
 assert.equal(p.footprintLifeMs,6000);assert.equal(p.trailLifeMs,4000);
 assert.equal(p.footprintKeep,false);assert.equal(p.trailKeep,true);
 assert.equal(p.material,'ink');assert.equal(p.enabled,true);
 assert.equal(p.showSoles&&p.showTrails,true);
 assert.equal(DEFAULT_V3_SETTINGS.actorColors.A,'#E44F32');
 assert.equal(DEFAULT_V3_SETTINGS.actorColors.B,'#242424');
});
test('impression lifecycle 15% hold then smooth fade, exactly zero at its own expiry',()=>{
 assert.equal(lifetimeOpacity(1000,1000,8000),1);
 assert.equal(lifetimeOpacity(1000,2200,8000),1);
 assert.ok(lifetimeOpacity(1000,5000,8000)<1);
 assert.ok(lifetimeOpacity(1000,5000,8000)>0);
 assert.equal(lifetimeOpacity(1000,9000,8000),0);
 assert.equal(lifetimeOpacity(1000,9000,8000,true),1);
 assert.equal(lifetimeOpacity(1000,5000,4000),0);
});
test('contacts produce one stamp per valid event and reject invalid/duplicate events',()=>{
 const e=new PainterlyImpressionEngine();e.ensureSource('video:clip1');
 e.ingestContacts([event('one','left',1000),event('one','left',1000)],'video',1000);
 assert.equal(e.count,1);assert.equal(e.impressions[0].eventKind,'contact-event');
 assert.equal(e.impressions[0].provenance,'video-estimate');
 e.ingestContacts([{...event('two','left',1000),verified:false,
  verification:'unverified'}],'video',1000);
 e.ingestContacts([{...event('three','left',1000),coordinateBasis:'calibrated-estimate'}],
  'video',1000);
 e.ingestContacts([event('outdated','right',1000)],'video',5000);
 assert.equal(e.count,1);
});
test('live sole heads do not stamp each frame; stale head fades within 380 ms',()=>{
 const e=new PainterlyImpressionEngine();e.ensureSource('video:clip1');
 e.ingestFrame(pair(.20,1000),1000,'video');
 assert.equal(e.count,0);assert.equal(e.liveHeads(1000).length,2);
 for(let t=1033;t<1300;t+=33)e.ingestFrame(pair(.20,t),t,'video');
 assert.equal(e.count,0);
 assert.equal(e.liveHeads(1800).length,0);
});
test('estimated cap needs movement, settling time, distance and cooldown',()=>{
 const e=new PainterlyImpressionEngine();e.ensureSource('video:clip1');
 const samples=[[1000,.2],[1050,.22],[1100,.25],[1150,.28],[1200,.3],
  [1250,.3],[1300,.3],[1350,.3],[1450,.3]];
 for(const [t,x] of samples)e.ingestFrame([sample('left',x,t)],t,'video');
 assert.equal(e.count,1);
 assert.equal(e.impressions[0].eventKind,'estimated-step');
 assert.equal(e.impressions[0].provenance,'video-estimate');
 e.ingestFrame([sample('left',.3,1500)],1500,'video');
 assert.equal(e.count,1);
});
test('the next MP4 source or seek clears impressions, heads, identity and cooldown',()=>{
 const e=new PainterlyImpressionEngine();e.ensureSource('video:clip1');
 e.ingestContacts([event('one','left',1000)],'video',1000);
 assert.equal(e.count,1);
 e.ensureSource('video:clip2');
 assert.equal(e.count,0);assert.equal(e.headsCount,0);
 e.ingestFrame([sample('left',.2,2000)],2000,'video');
 e.ingestFrame([sample('left',.3,500)],500,'video');
 assert.equal(e.count,0);assert.equal(e.headsCount,1);
});
test('demo captures simulated stamps, independent actors/feet, bounded soak',()=>{
 const e=new PainterlyImpressionEngine();e.ensureSource('demo:v1');
 for(let i=0;i<20000;i++){
  const t=1000+i*33;
  e.ingestFrame([sample('left',.3+.08*Math.sin(i/15),t,'A'),
   sample('right',.65+.08*Math.cos(i/14),t,'B')],t,'demo');
 }
 assert.ok(e.count>0);assert.ok(e.count<=e.maxImpressions);
 assert.ok(e.impressions.every(s=>s.provenance==='simulated'));
 assert.ok(e.impressions.some(s=>s.actorId==='A'));
 assert.ok(e.impressions.some(s=>s.actorId==='B'));
});
test('material settings are visual only and blackout renders no stamps',()=>{
 const e=new PainterlyImpressionEngine();e.ensureSource('video');
 e.ingestContacts([event('one','left',1000)],'video',1000);
 const saved=JSON.stringify(e.impressions);
 const source=new DualFootTrajectoryEngine();
 let fillColor='';
 let painted=0;
 const ctx={
  canvas:{width:1600,height:900},
  save(){},restore(){},setTransform(){},clearRect(){},
  fillRect(){painted++},setLineDash(){},fillStyle:'',
  globalAlpha:1
 } as unknown as CanvasRenderingContext2D;
 paintPainterlyCanvas(ctx,source,e,DEFAULT_V3_SETTINGS,
  DEFAULT_PAINTERLY_SETTINGS,1100,true,true);
 assert.equal(painted,1);assert.equal(JSON.stringify(e.impressions),saved);
 assert.equal(fillColor,'');
});
