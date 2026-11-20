import test from 'node:test';
import assert from 'node:assert/strict';
import {FOOT_LENGTH_M,FOOT_WIDTH_M,footprintOutline,footprintToes,
 paintAuthenticFootprint} from '../src/footprints/scenes/authenticFootGeometry.ts';
import {FloorInteractionEngine,floorEventCanStamp,
 floorEventPhysicalOutputAuthorized} from '../src/footprints/scenes/FloorInteractionEngine.ts';

test('GEO-01: distinct mirrored left/right outlines with medial arch',()=>{
 const left=footprintOutline('left'),right=footprintOutline('right');
 assert.equal(left.length,right.length);
 assert.ok(left.length>=18);
 for(let i=0;i<left.length;i++){
  assert.equal(left[i][0],-right[i][0]);
  assert.equal(left[i][1],right[i][1]);
 }
 assert.equal(footprintToes('left').length,5);
 for(let i=0;i<5;i++){
  assert.equal(footprintToes('left')[i].x,-footprintToes('right')[i].x);
 }
 assert.ok(FOOT_LENGTH_M>FOOT_WIDTH_M*2);
});

test('GEO-01: one contact makes one verified sided stamp; presence stays unverified',()=>{
 const engine=new FloorInteractionEngine();
 engine.reset('video');
 const base={source:'video' as const,actorId:'A',x:.4,y:.5,atMs:100,
  confidence:.92,basis:'image-2d' as const};
 const presence=engine.observe(base);
 assert.ok(presence);
 assert.equal(floorEventCanStamp(presence),false);
 const contact=engine.contact({...base,eventId:'frame:100:left',foot:'left' as const,verified:true});
 assert.ok(contact);
 assert.equal(contact.foot,'left');
 assert.equal(floorEventCanStamp(contact),true);
 assert.equal(floorEventPhysicalOutputAuthorized(contact),false);
 assert.equal(engine.contact({...base,eventId:'frame:100:left',foot:'left',verified:true}),null);
 assert.equal(engine.snapshot.counts.contact,1);
});

test('GEO-01: canvas renderer keeps mirrored side, prediction outline and restores state',()=>{
 const ops:string[]=[];
 const ctx={
  globalAlpha:1,fillStyle:'',strokeStyle:'',lineWidth:1,
  save:()=>ops.push('save'),restore:()=>ops.push('restore'),
  translate:()=>ops.push('translate'),rotate:()=>ops.push('rotate'),
  scale:()=>ops.push('scale'),beginPath:()=>ops.push('begin'),
  moveTo:()=>ops.push('move'),quadraticCurveTo:()=>ops.push('curve'),
  closePath:()=>ops.push('close'),fill:()=>ops.push('fill'),
  stroke:()=>ops.push('stroke'),setLineDash:()=>ops.push('dash'),
  ellipse:()=>ops.push('toe')
 } as unknown as CanvasRenderingContext2D;
 paintAuthenticFootprint(ctx,{x:100,y:100,side:'left',widthPx:24,lengthPx:58});
 assert.equal(ops.filter(x=>x==='toe').length,5);
 assert.ok(ops.includes('curve')&&ops.includes('fill'));
 assert.equal(ops[0],'save');
 assert.equal(ops.at(-1),'restore');
 ops.length=0;
 paintAuthenticFootprint(ctx,{x:0,y:0,side:'right',widthPx:20,lengthPx:50,phase:'prediction'});
 assert.ok(!ops.includes('fill'));
 assert.ok(ops.includes('stroke'));
});
