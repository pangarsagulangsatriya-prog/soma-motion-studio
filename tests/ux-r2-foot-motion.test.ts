import test from 'node:test';
import assert from 'node:assert/strict';
import {FloorInteractionEngine} from '../src/footprints/scenes/FloorInteractionEngine.ts';
import {footMotionCanStamp,footMotionAuthorizesPhysicalOutput,toFootMotionEvent,validFootMotionEvent} from '../src/footprints/scenes/FootMotionEventV2.ts';

const make=(source:'camera'|'video'|'simulator'='video')=>{
 const engine=new FloorInteractionEngine();engine.reset(source);return engine;
};
const observation=(source:'camera'|'video'|'simulator'='video')=>({
 source,actorId:'A',x:.25,y:.7,confidence:.94,atMs:1000,
 basis:source==='video'?'image-2d' as const:source==='camera'?'calibrated-estimate' as const:'simulated' as const
});
test('UX-R2: six accepted contacts yield precisely six canonical event IDs, replay duplicates suppressed',()=>{
 const engine=make();
 for(let i=0;i<6;i++){
  const e=engine.contact({...observation(),foot:i%2?'right':'left',eventId:'step-'+i,atMs:1000+i*100,verified:true});
  assert.ok(e);
  assert.equal(engine.contact({...observation(),foot:i%2?'right':'left',eventId:'step-'+i,atMs:1000+i*100,verified:true}),null);
 }
 const accepted=engine.canonicalRecent;
 assert.equal(accepted.length,6);
 assert.equal(new Set(accepted.map(e=>e.eventId)).size,6);
 assert.ok(accepted.every(footMotionCanStamp));
 assert.ok(accepted.every(e=>e.verification==='video-estimate'&&validFootMotionEvent(e)));
 assert.ok(accepted.every(e=>!footMotionAuthorizesPhysicalOutput(e)));
});
test('UX-R2: stationary presence emits no contact stamps',()=>{
 const engine=make();
 for(let t=1000;t<=11000;t+=100)engine.observe({...observation(),atMs:t});
 assert.equal(engine.canonicalRecent.filter(footMotionCanStamp).length,0);
 assert.ok(engine.canonicalRecent.every(e=>e.kind==='presence'||e.kind==='movement'));
});
test('UX-R2: actor, foot and session boundary keep event IDs separate',()=>{
 const engine=make();
 const input={...observation(),eventId:'shared-frame',verified:true};
 assert.ok(engine.contact({...input,actorId:'A',foot:'left'}));
 assert.ok(engine.contact({...input,actorId:'A',foot:'right'}));
 assert.ok(engine.contact({...input,actorId:'B',foot:'left'}));
 const first=engine.canonicalRecent.map(e=>e.eventId);
 assert.equal(new Set(first).size,3);
 assert.equal(engine.contact({...input,actorId:'A',foot:'left'}),null);
 engine.reset('video');
 assert.ok(engine.contact({...input,actorId:'A',foot:'left'}));
 assert.ok(!first.includes(engine.canonicalRecent[0].eventId));
});
test('UX-R2: ambiguous identities cannot stamp from a presence observation',()=>{
 const engine=make('camera');
 assert.ok(engine.observe({...observation('camera'),actorId:'unassigned-0',basis:'presence-only'}));
 assert.equal(engine.contact({...observation('camera'),actorId:'unassigned-0',basis:'presence-only',
   foot:'left',eventId:'bad',verified:true}),null);
 const event=engine.canonicalRecent[0];
 assert.equal(event.foot,'unknown');
 assert.equal(event.verified,false);
 assert.equal(footMotionCanStamp(event),false);
});
test('UX-R2: simulation does not become physical proof and fallback movement stays movement',()=>{
 const engine=make('simulator');
 engine.observe({...observation('simulator'),atMs:1000});
 engine.observe({...observation('simulator'),x:.42,atMs:1200});
 const e=engine.contact({...observation('simulator'),foot:'right',eventId:'virtual-foot',verified:true});
 assert.ok(e);
 assert.equal(engine.canonicalRecent[1].kind,'movement');
 assert.equal(engine.canonicalRecent[1].verified,false);
 assert.equal(engine.canonicalRecent.at(-1)?.verification,'simulated');
 assert.ok(engine.canonicalRecent.every(e=>!footMotionAuthorizesPhysicalOutput(e)));
});
test('UX-R2: malformed confidence, coordinates, and contradictory verified claims are rejected',()=>{
 const source=make().contact({...observation(),eventId:'x',foot:'left',verified:true});
 assert.ok(source);
 const canonical=toFootMotionEvent(source,'test-session',3);
 assert.equal(validFootMotionEvent(canonical),true);
 assert.equal(validFootMotionEvent({...canonical,x:NaN}),false);
 assert.equal(validFootMotionEvent({...canonical,confidence:1.1}),false);
 assert.equal(validFootMotionEvent({...canonical,verification:'unverified'}),false);
 assert.equal(validFootMotionEvent({...canonical,kind:'movement'}),false);
});
