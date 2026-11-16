import test from 'node:test';
import assert from 'node:assert/strict';
import {defaultFloorSpace} from '../src/footprints/spatial/coordinates.ts';
import type {FootstepEvent} from '../src/footprints/spatial/events.ts';
import {BRIDGE_DEFAULTS,ContactArchiveBridge,bridgeExport,freezeArchiveFrame,
 makeBridgeSimulationEvents,validateBridgeSettings,type BridgeMode} from '../src/footprints/stage-optics/ContactArchiveBridge.ts';
import {padPreviewPoint} from '../src/footprints/stage-optics/ContactArchivePadPreview.ts';
import type {ArchivePixels,ArchiveSources} from '../src/footprints/stage-optics/ArchivalCompositeEngine.ts';

const floor=defaultFloorSpace(8,6);
const clip=(shade:number):ArchivePixels=>({width:4,height:4,
 data:Uint8ClampedArray.from(Array.from({length:16},()=>[shade,shade,shade,255]).flat())});
const media:ArchiveSources={A:clip(90),B:clip(210)};
const bridge=()=>new ContactArchiveBridge();
const snapshot=(b:ContactArchiveBridge,events:FootstepEvent[],t:number,
 mode:BridgeMode='simulation',trusted=true,source:ArchiveSources=media,prime=false,context='take1')=>
 b.sync(events,t,context,floor,source,mode,trusted,prime);
// Rehearsal playback advances at regular frame intervals. Jumping straight to
// t=6000 intentionally skips old contacts under the anti-catch-up safety gate.
function drive(b:ContactArchiveBridge,events:FootstepEvent[],endMs:number){
 let result=b.snapshot(0);
 for(let t=0;t<=endMs;t+=100)result=snapshot(b,events,t);
 if(endMs%100!==0)result=snapshot(b,events,endMs);
 return result;
}
const cameraEvent=(id:string,who='A',at=1000,kind:FootstepEvent['kind']='contact'):FootstepEvent=>({
 id,performerId:who,foot:'left',kind,timestampMs:at,
 positionM:{xM:2,yM:3},headingRad:0,source:'camera',positionBasis:'calibrated-estimate',confidence:.94
});
test('one real FloorSession V3 contact triggers one archive hold and leaves one immutable frame residue',()=>{
 const b=bridge(),events=makeBridgeSimulationEvents(floor,1);
 assert.equal(snapshot(b,events,100).residueCount,0);
 const landed=snapshot(b,events,550);
 assert.equal(landed.contactCount,1);
 assert.equal(landed.residueCount,1);
 assert.equal(landed.holdActive.A,true);
 assert.equal(landed.holdActive.B,false);
 assert.equal(landed.residues[0].texture.gray[0],90);
 assert.equal(landed.residues[0].positionM.xM,events[0].positionM.xM);
 assert.equal(snapshot(b,events,550).contactCount,1);
 const later=snapshot(b,events,1150);
 assert.equal(later.holdActive.A,false);
 assert.equal(later.residueCount,1); // release does not erase history
 assert.equal(later.recent.at(-1)?.kind,'release');
});
test('two performers freeze their own footage, and A contact does not freeze B',()=>{
 const b=bridge(),events=makeBridgeSimulationEvents(floor,2);
 const a=snapshot(b,events,600);
 assert.equal(a.residueCount,1);assert.equal(a.holdActive.A,true);
 assert.equal(a.holdActive.B,false);
 const both=snapshot(b,events,920);
 assert.equal(both.residueCount,2);
 assert.equal(both.holdActive.A,true); // A arrived to preview at t=600, expires t=1020
 assert.equal(both.holdActive.B,true);
 const afterA=snapshot(b,events,1030);
 assert.equal(afterA.holdActive.A,false);
 assert.equal(afterA.holdActive.B,true);
 const aa=both.residues.find(e=>e.slot==='A')!,bb=both.residues.find(e=>e.slot==='B')!;
 assert.equal(aa.texture.gray[0],90);assert.equal(bb.texture.gray[0],210);
});
test('slide/move extends a grounded path but creates no extra frozen footprint',()=>{
 const b=bridge(),events=makeBridgeSimulationEvents(floor,1);
 const before=drive(b,events,3000);
 assert.equal(before.residueCount,3);
 const after=snapshot(b,events,3120);
 assert.equal(after.residueCount,3);
 assert.equal(after.dragCount,1);
 assert.equal(after.moveCount,1);
 assert.equal(after.drags[0].slot,'A');
 assert.ok(after.drags[0].toM.xM>after.drags[0].fromM.xM);
 assert.equal(snapshot(b,events,3120).dragCount,1);
});
test('a newly opened live bridge primes to current session tail, accepts only NEW camera contacts',()=>{
 const b=bridge(),old=[cameraEvent('old-contact','A',1000)];
 const primed=snapshot(b,old,1100,'camera',true,media,true,'camera:v1');
 assert.equal(primed.contactCount,0);
 const fresh=snapshot(b,[...old,cameraEvent('new-contact','B',1190)],1200,
  'camera',true,media,true,'camera:v1');
 assert.equal(fresh.contactCount,1);
 assert.equal(fresh.residues[0].slot,'B');
 assert.equal(fresh.holdActive.A,false);
 assert.equal(fresh.holdActive.B,true);
});
test('tracking blackout skips events permanently instead of replaying them after recovery',()=>{
 const b=bridge();
 const e=[cameraEvent('contact-1','A',1000)];
 const first=snapshot(b,e,1100,'camera',true,media,false,'stage1');
 assert.equal(first.residueCount,1);
 const bad=snapshot(b,[...e,cameraEvent('contact-2','B',1200)],1250,
  'camera',false,media,false,'stage1');
 assert.equal(bad.status,'blocked');assert.equal(bad.residueCount,1);
 assert.equal(bad.holdActive.A,false);assert.equal(bad.skipped,1);
 const returned=snapshot(b,[...e,cameraEvent('contact-2','B',1200)],1300,
  'camera',true,media,false,'stage1');
 assert.equal(returned.residueCount,1);assert.equal(returned.holdActive.B,false);
 const next=snapshot(b,[...e,cameraEvent('contact-2','B',1200),
  cameraEvent('contact-3','B',1390)],1410,'camera',true,media,false,'stage1');
 assert.equal(next.residueCount,2);
});
test('reject prediction/replay/legacy, low confidence and old frames rather than inventing contacts',()=>{
 const b=bridge(),base=cameraEvent('a','A',1000);
 const mixed:FootstepEvent[]=[
  {...base,id:'ghost',kind:'prediction',timestampMs:600},
  {...base,id:'old',source:'legacy',positionBasis:'illustrative',timestampMs:650},
  {...base,id:'sim',source:'simulation',positionBasis:'simulated',timestampMs:700},
  {...base,id:'uncertain',confidence:.20,timestampMs:750},
  {...base,id:'late',timestampMs:900}
 ];
 assert.equal(snapshot(b,mixed,2200,'camera').residueCount,0);
 assert.equal(snapshot(b,mixed,2200,'camera').skipped,5);
});
test('no available actual archive video means no generated residue or fake light',()=>{
 const b=bridge(),e=[cameraEvent('a')];
 const s=snapshot(b,e,1100,'camera',true,{A:null,B:null});
 assert.equal(s.contactCount,0);assert.equal(s.residueCount,0);
 assert.equal(s.skipped,1);
 assert.equal(freezeArchiveFrame(null),null);
});
test('same event ids with altered event time reset historical residue; changing calibration also resets',()=>{
 const b=bridge(),a=cameraEvent('foot-1','A',1000);
 assert.equal(snapshot(b,[a],1010,'camera').residueCount,1);
 assert.equal(snapshot(b,[{...a,timestampMs:1300}],1400,'camera').residueCount,1);
 assert.equal(snapshot(b,[{...a,timestampMs:1300}],1400,'camera',true,media,false,'recalibrated').residueCount,1);
 const cleared=snapshot(b,[],1500,'camera',true,media,false,'recalibrated');
 assert.equal(cleared.residueCount,0);
});
test('bounded fragments, deterministic texture capture and physically oriented normalized pad positions',()=>{
 const b=new ContactArchiveBridge({...BRIDGE_DEFAULTS,maxResidues:2});
 const events=makeBridgeSimulationEvents(floor,1);
 const result=drive(b,events,6000);
 assert.equal(result.residueCount,2);
 assert.equal(result.contactCount,5);
 const loc=padPreviewPoint(floor,{xM:2,yM:4.5},640,360);
 assert.equal(loc.x,160);assert.equal(loc.y,90);
 const frame=freezeArchiveFrame(clip(128));
 assert.ok(frame);assert.equal(frame.gray.length,16*24);
 assert.deepEqual(freezeArchiveFrame(clip(128)),frame);
 assert.throws(()=>validateBridgeSettings({...BRIDGE_DEFAULTS,minConfidence:.1}));
 assert.throws(()=>validateBridgeSettings({...BRIDGE_DEFAULTS,maxResidues:2000}));
});
test('bridge report is coordinate/event metadata, not the uploaded video or captured thumbnail pixels',()=>{
 const b=bridge(),events=makeBridgeSimulationEvents(floor,1);
 const s=snapshot(b,events,600);
 const report=bridgeExport(s,'simulation',BRIDGE_DEFAULTS,{A:'sawah_arsip.mp4',B:null},floor);
 assert.equal(report.schema,'soma.footprints.contact-archive-preview');
 assert.equal(report.projectorReady,false);
 assert.equal(report.counts.frozenFragments,1);
 assert.equal(report.residues[0].eventId,events[0].id);
 assert.ok(!JSON.stringify(report.residues[0]).includes('gray'));
 assert.equal(report.files.A,'sawah_arsip.mp4');
});
