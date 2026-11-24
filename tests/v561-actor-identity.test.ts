import test from 'node:test';
import assert from 'node:assert/strict';
import {TwoPersonIdentityTracker} from '../src/footprints/live/TwoPersonIdentityTracker.ts';
import type {Landmark} from '../src/engine/types.ts';
function pose(x:number,mode:'full'|'lower'|'legs'='full'):Landmark[]{
 return Array.from({length:33},(_,i)=>({
  x:x+(i%2 ? .008 : -.008),y:i>=27 ? .8 : i>=25 ? .65 : i>=23 ? .5 : .35,z:0,
  visibility:(mode==='legs'&&i<25||mode==='lower'&&i<23) ? 0 : .96
 }));
}
test('detector order reverses without changing A/B',()=>{
 const t=new TwoPersonIdentityTracker();t.observe([pose(.2),pose(.8)],0);
 const a=pose(.23),b=pose(.77),r=t.observe([b,a],50);
 assert.equal(r.assignments.find(x=>x.id==='A')?.pose,a);
 assert.equal(r.assignments.find(x=>x.id==='B')?.pose,b);
});
test('short observable crossing recovers from motion evidence, not x order',()=>{
 const t=new TwoPersonIdentityTracker();t.observe([pose(.2),pose(.8)],0);
 t.observe([pose(.34),pose(.66)],100);
 assert.equal(t.observe([pose(.48),pose(.52)],200).ambiguous,true);
 const a=pose(.65),b=pose(.35),r=t.observe([b,a],350);
 assert.equal(r.ambiguous,false);
 assert.equal(r.assignments.find(x=>x.id==='A')?.pose,a);
 assert.equal(r.assignments.find(x=>x.id==='B')?.pose,b);
});
test('no temporal evidence: remain fail-closed after ambiguous crossing',()=>{
 const t=new TwoPersonIdentityTracker();t.observe([pose(.2),pose(.8)],0);
 assert.equal(t.observe([pose(.48),pose(.52)],100).ambiguous,true);
 assert.equal(t.observe([pose(.2),pose(.8)],150).assignments.length,0);
});
test('lower-body observations maintain identity using matching anchor types',()=>{
 const t=new TwoPersonIdentityTracker();t.observe([pose(.2),pose(.8)],0);
 const a=pose(.22,'legs'),b=pose(.78,'lower'),r=t.observe([b,a],50);
 assert.equal(r.assignments.find(x=>x.id==='A')?.pose,a);
 assert.equal(r.assignments.find(x=>x.id==='B')?.pose,b);
 assert.equal(r.states?.A,'partial');assert.equal(r.states?.B,'partial');
});
test('one actor continues while unknown second pose remains unassigned',()=>{
 const t=new TwoPersonIdentityTracker();t.observe([pose(.15),pose(.85)],0);
 const b=pose(.83),r=t.observe([pose(.5),b],50);
 assert.equal(r.ambiguous,false);assert.deepEqual(r.assignments.map(x=>x.id),['B']);
 assert.equal(r.states?.A,'occluded');assert.equal(r.states?.B,'confirmed');
});
test('long disappearance does not silently assign a replacement',()=>{
 const t=new TwoPersonIdentityTracker();t.observe([pose(.2),pose(.8)],0);
 t.observe([pose(.8)],500);const r=t.observe([pose(.2),pose(.8)],1000);
 assert.deepEqual(r.assignments.map(x=>x.id),['B']);assert.equal(r.states?.A,'lost');
});
test('stale out-of-order frame cannot overwrite temporal registry',()=>{
 const t=new TwoPersonIdentityTracker();t.observe([pose(.2),pose(.8)],100);
 assert.equal(t.observe([pose(.8),pose(.2)],90).assignments.length,0);
 assert.equal(t.observe([pose(.21),pose(.79)],150).assignments.length,2);
});
