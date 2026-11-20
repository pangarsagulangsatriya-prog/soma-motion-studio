import test from 'node:test';
import assert from 'node:assert/strict';
import {collectLiquidImprints,liquidSeed,LIQUID_LIMIT,liquidOutputAuthorized}
 from '../src/footprints/materials/liquidImprintTimeline.ts';
import type {FloorInteractionEvent} from '../src/footprints/scenes/FloorInteractionEngine.ts';

const base={
 source:'video' as const,confidence:.9,basis:'image-2d' as const,
 radius:.03,speed:0,verified:true
};
const touch=(id:number,atMs:number,actorId='A',
 foot:'left'|'right'='left',x=.5,y=.5):FloorInteractionEvent=>({
 ...base,kind:'contact',actorId,foot,x,y,atMs,
 headingRad:1.57,id:'contact-'+id,originEventId:'landing-'+id
});
const movement=(id:number,atMs:number,kind:'slide'|'pivot'|'release',
 foot:'left'|'right'='left',actorId='A',x=.5,y=.5,headingRad=1.57):FloorInteractionEvent=>({
 ...base,verified:false,kind,actorId,foot,x,y,headingRad,atMs,
 id:'motion-'+id
});

test('GPU-02: only verified contact creates an authentic imprint',()=>{
 const a=touch(1,100);
 const presence={...a,id:'p',kind:'presence' as const,verified:false,foot:undefined};
 const unverified={...touch(2,120),verified:false};
 const anonymous={...touch(3,140,'unassigned-1'),verified:true};
 const items=collectLiquidImprints([presence,unverified,anonymous,a],500);
 assert.equal(items.length,1);
 assert.equal(items[0].foot,'left');
 assert.equal(items[0].actorId,'A');
 assert.ok(items[0].opacity>0);
 assert.equal(liquidOutputAuthorized(),false);
});

test('GPU-02: six verified landings yield exactly six stamps, stationary heartbeats add none',()=>{
 const landings=Array.from({length:6},(_,i)=>touch(i+1,200+i*80,i%2?'B':'A',i%2?'right':'left',.1+i*.14,.3+i%2*.2));
 const pulses=Array.from({length:12},(_,i)=>({...landings[i%6],id:'pulse-'+i,
  originEventId:undefined,kind:'presence' as const,verified:false,atMs:750+i}));
 const once=collectLiquidImprints([...landings,...pulses],900);
 assert.equal(once.length,6);
 assert.equal(new Set(once.map(x=>x.id)).size,6);
 const twice=collectLiquidImprints([...landings,...landings,...pulses],900);
 assert.deepEqual(twice,once);
 assert.deepEqual(once.map(x=>x.actorId),['A','B','A','B','A','B']);
});

test('GPU-02: slide and pivot deform the active sole, do not create duplicate stamps',()=>{
 const contact=touch(1,100);
 const slide=movement(1,170,'slide','left','A',.56,.53);
 const pivot=movement(2,190,'pivot','left','A',.5,.5,2.10);
 const a=collectLiquidImprints([contact,slide],230);
 assert.equal(a.length,1);assert.equal(a[0].deformation.mode,'slide');
 const b=collectLiquidImprints([contact,slide,pivot],230);
 assert.equal(b.length,1);assert.equal(b[0].deformation.mode,'pivot');
 assert.equal(a[0].id,b[0].id);
});

test('GPU-02: release produces toe-off and ends active motion tracking',()=>{
 const contact=touch(1,100);
 const release=movement(1,200,'release');
 const after=movement(2,210,'slide','left','A',.75,.5);
 const stamps=collectLiquidImprints([contact,release,after],245);
 assert.equal(stamps.length,1);
 assert.equal(stamps[0].deformation.mode,'toe-off');
 const old=collectLiquidImprints([contact,release,after],15000);
 assert.equal(old.length,0);
});

test('GPU-02: A/B and left/right remain separate through overlapping positions',()=>{
 const events=[
  touch(1,100,'A','left',.5,.5),
  touch(2,110,'B','right',.5,.5),
  touch(3,120,'B','left',.5,.5),
  touch(4,130,'A','right',.5,.5)
 ];
 const stamps=collectLiquidImprints(events,250);
 assert.equal(stamps.length,4);
 assert.equal(new Set(stamps.map(s=>s.id)).size,4);
 assert.equal(new Set(stamps.map(s=>s.actorId+':'+s.foot)).size,4);
});

test('GPU-02: bounded history, stable pigment seeds, expiry and invalid clocks',()=>{
 const all=Array.from({length:56},(_,i)=>touch(i,100+i*9));
 const stamps=collectLiquidImprints(all,700,{limit:999,lifeMs:9000});
 assert.equal(stamps.length,LIQUID_LIMIT);
 assert.equal(stamps[0].id.includes('landing-24'),true);
 assert.equal(collectLiquidImprints(all,-1).length,0);
 assert.equal(collectLiquidImprints(all,100000).length,0);
 assert.equal(liquidSeed('A:left'),liquidSeed('A:left'));
 assert.notEqual(liquidSeed('A:left'),liquidSeed('B:right'));
 assert.ok(stamps.every(x=>x.opacity>=0&&x.opacity<=1));
});
