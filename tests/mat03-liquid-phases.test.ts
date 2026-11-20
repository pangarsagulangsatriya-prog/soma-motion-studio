import test from 'node:test';
import assert from 'node:assert/strict';
import {collectLiquidImprints} from '../src/footprints/materials/liquidImprintTimeline.ts';
import {liquidMaterialResponse,MATERIAL03_PHASES}
 from '../src/footprints/materials/liquidMaterialResponse.ts';
import {MATERIAL03_GLSL} from '../src/footprints/materials/liquidMaterialShader.ts';
import type {FloorInteractionEvent} from '../src/footprints/scenes/FloorInteractionEngine.ts';

const contact:FloorInteractionEvent={
 source:'simulator',basis:'simulated',verified:true,confidence:1,
 id:'contact',originEventId:'landing-1',kind:'contact',
 actorId:'A',foot:'left',x:.47,y:.5,headingRad:1.57,
 atMs:10000,speed:0,radius:.03
};
const signal=(kind:'slide'|'pivot'|'release',atMs=10050):FloorInteractionEvent=>({
 ...contact,id:'motion-'+kind,originEventId:undefined,
 verified:false,kind,atMs,
 x:kind==='slide'?.53:contact.x,y:kind==='slide'?.51:contact.y,
 headingRad:kind==='pivot'?2.3:contact.headingRad
});
const profile=(events:FloorInteractionEvent[],ms:number)=>{
 const impressions=collectLiquidImprints(events,ms);
 assert.equal(impressions.length,1);
 return liquidMaterialResponse(impressions[0]);
};
test('MAT-03: one material implements all four explicit verified-contact phases',()=>{
 assert.deepEqual(MATERIAL03_PHASES,['contact','slide','pivot','release']);
 const t=10130;
 const phases=[
  profile([contact],t),
  profile([contact,signal('slide')],t),
  profile([contact,signal('pivot')],t),
  profile([contact,signal('release')],t)
 ];
 assert.deepEqual(phases.map(x=>x.phase),MATERIAL03_PHASES);
 assert.deepEqual(phases.map(x=>x.phaseIndex),[0,2,3,4]);
 for(const x of phases)assert.ok(x.opacity>=0&&x.opacity<=1);
 assert.equal(phases[0].contactFill>0,true);
 assert.ok(phases[1].slideStrength>0);
 assert.ok(Math.abs(phases[1].slideX)>0);
 assert.ok(phases[2].pivotStrength>0);
 assert.ok(Math.abs(phases[2].pivotTwist)>.1);
 assert.equal(phases[3].released,true);
 assert.ok(phases[3].releaseProgress>=.25);
 assert.ok(phases[3].opacity<phases[0].opacity);
 assert.equal(phases[0].slideStrength,0);
 assert.equal(phases[1].pivotStrength,0);
 assert.equal(phases[2].releaseProgress,0);
});
test('MAT-03: contact fills once, then settles without repeated impressions',()=>{
 assert.equal(profile([contact],10001).phase,'contact');
 const fresh=profile([contact],10001);
 const older=profile([contact],10140);
 assert.ok(fresh.contactFill>older.contactFill);
 assert.equal(profile([contact],10400).phase,'settle');
 assert.equal(collectLiquidImprints([contact,contact],10400).length,1);
});
test('MAT-03: released foot remains a draining residue after toe-off shape settles',()=>{
 const events=[contact,signal('release')];
 const early=profile(events,10130);
 const late=profile(events,10700);
 assert.equal(early.phase,'release');
 assert.equal(late.phase,'release');
 assert.ok(late.releaseProgress>early.releaseProgress);
 assert.ok(late.opacity<early.opacity);
 assert.equal(profile(events,10800).released,true);
 assert.equal(collectLiquidImprints(events,22000).length,0);
});
test('MAT-03: orphan slide/pivot/release never makes a foot or grants hardware output',()=>{
 for(const kind of ['slide','pivot','release'] as const){
  assert.deepEqual(collectLiquidImprints([signal(kind)],10130),[]);
 }
 assert.deepEqual(collectLiquidImprints([{...contact,verified:false}],10130),[]);
});
test('MAT-03: shared shader contains directional streak, spiral, contact front, and pigment residue',()=>{
 for(const text of ['SLIDE','PIVOT','CONTACT','RELEASE','slideStrength','pivotStrength',
  'contactFill','releaseProgress','mat03Pigment']){
  assert.ok(MATERIAL03_GLSL.includes(text),text);
 }
 assert.ok(MATERIAL03_GLSL.includes('pigment*=residue'));
 assert.ok(MATERIAL03_GLSL.includes('pigment*=mix('));
});
