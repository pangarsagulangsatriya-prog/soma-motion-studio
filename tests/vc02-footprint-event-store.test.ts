import test from 'node:test';
import assert from 'node:assert/strict';
import {applyFootprintEvent,emptyFootprintState,makeDemoFootEvent,footprintOpacity,pruneFootprints} from '../src/studio/v3/footprintEventStore.ts';

test('VC02: six independent contacts produce six footprints, planted foot is idempotent',()=>{
 let state=emptyFootprintState();
 for(let i=0;i<6;i++){
  let foot=i%2===0?'left' as const:'right' as const;
  const contact=makeDemoFootEvent(state,'contact',foot,100+i*1000);
  state=applyFootprintEvent(state,contact);
  assert.equal(state.imprints.length,i+1);
  assert.equal(applyFootprintEvent(state,contact),state,'exact duplicate event ID');
  state=applyFootprintEvent(state,{...contact,id:'planted-'+i,atMs:150+i*1000});
  assert.equal(state.imprints.length,i+1,'same foot held cannot make duplicate imprint');
  state=applyFootprintEvent(state,makeDemoFootEvent(state,'release',foot,160+i*1000));
 }
 assert.equal(state.imprints.length,6);
 assert.notEqual(state.imprints[0].foot,state.imprints[1].foot);
});
test('VC02: slide changes active contact position and pivot rotates that same stamp',()=>{
 let state=emptyFootprintState();
 state=applyFootprintEvent(state,{id:'c',performerId:'A',foot:'left',kind:'contact',
  atMs:100,x:.2,y:.3,headingDeg:0,confidence:1,trackingState:'tracked'});
 state=applyFootprintEvent(state,{id:'s',performerId:'A',foot:'left',kind:'slide',
  atMs:120,x:.4,y:.5,headingDeg:25,confidence:1,trackingState:'tracked'});
 assert.equal(state.imprints.length,1);assert.equal(state.imprints[0].x,.4);
 assert.equal(state.imprints[0].headingDeg,0,'slide preserves orientation');
 state=applyFootprintEvent(state,{id:'p',performerId:'A',foot:'left',kind:'pivot',
  atMs:140,x:.5,y:.5,headingDeg:40,confidence:1,trackingState:'tracked'});
 assert.equal(state.imprints.length,1);assert.equal(state.imprints[0].headingDeg,40);
});
test('VC02: uncertain tracking never stamps or swaps actor identities',()=>{
 let state=emptyFootprintState();
 const event={id:'e',performerId:'A' as const,foot:'right' as const,kind:'contact' as const,
  atMs:100,x:.25,y:.35,headingDeg:0,confidence:.4,trackingState:'estimated' as const};
 assert.equal(applyFootprintEvent(state,event),state);
 assert.equal(applyFootprintEvent(state,{...event,confidence:1,trackingState:'lost'}),state);
 state=applyFootprintEvent(state,{...event,confidence:1,trackingState:'tracked'});
 state=applyFootprintEvent(state,{...event,id:'e2',performerId:'B',foot:'right'});
 assert.equal(state.imprints.length,2);
 assert.deepEqual(state.imprints.map(x=>x.performerId),['A','B']);
});
test('VC02: released footprints hold, decay, clear; active footprint stays visible',()=>{
 let state=emptyFootprintState();
 state=applyFootprintEvent(state,{id:'c',performerId:'A',foot:'left',kind:'contact',
  atMs:100,x:.2,y:.3,headingDeg:0,confidence:1,trackingState:'tracked'});
 const stamp=state.imprints[0],timing={holdMs:1000,decayMs:2000};
 assert.equal(footprintOpacity(stamp,100_000,timing),1);
 state=applyFootprintEvent(state,{id:'r',performerId:'A',foot:'left',kind:'release',
  atMs:200,x:.2,y:.3,headingDeg:0,confidence:1,trackingState:'tracked'});
 assert.equal(footprintOpacity(state.imprints[0],1200,timing),1);
 assert.equal(footprintOpacity(state.imprints[0],2200,timing),.5);
 assert.equal(pruneFootprints(state,4000,timing).imprints.length,0);
});
