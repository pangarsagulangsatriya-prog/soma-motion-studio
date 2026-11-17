import test from 'node:test';
import assert from 'node:assert/strict';
import {VideoAutoActorTracker,videoActorPresenceLabel}
 from '../src/stage/videoAutoActorTracker.ts';
import {replaySkeletonPresentation,SKELETON_COLORS} from '../src/stage/fullBodySkeleton.ts';
import type {Landmark} from '../src/engine/types.ts';

const pose=(x:number,visibility=.96):Landmark[]=>Array.from({length:33},(_,i)=>({
 x:x+(i%2===0?-.018:.018),
 y:.14+Math.floor(i/5)*.09,z:0,visibility
}));
test('S6.8.8.2 automatically recognizes one actor and exposes B separately',()=>{
 const tracker=new VideoAutoActorTracker();
 const init=tracker.observe([],0);
 assert.equal(init.detectedCount,0);
 assert.equal(init.visibleCount,0);
 assert.deepEqual(init.actors.map(a=>a.presence),['not-detected','not-detected']);
 const frame=tracker.observe([pose(.28)],100);
 assert.equal(frame.knownCount,1);
 assert.equal(frame.detectedCount,1);
 assert.equal(frame.visibleCount,1);
 assert.deepEqual(frame.assignments.map(a=>a.id),['A']);
 assert.equal(frame.actors[0].presence,'visible');
 assert.equal(frame.actors[1].presence,'not-detected');
});

test('S6.8.8.2 automatically finds A/B and survives raw detection reordering',()=>{
 const tracker=new VideoAutoActorTracker();
 const first=tracker.observe([pose(.7),pose(.25)],100);
 assert.equal(first.knownCount,2);
 assert.equal(first.detectedCount,2);
 assert.equal(first.visibleCount,2);
 assert.deepEqual(first.actors.map(a=>a.presence),['visible','visible']);
 assert.deepEqual(first.assignments.map(a=>[a.id,a.rawIndex]),[['A',1],['B',0]]);
 const second=tracker.observe([pose(.27),pose(.68)],200);
 assert.equal(second.knownCount,2);
 assert.deepEqual(second.assignments.map(a=>[a.id,a.rawIndex]),[['A',0],['B',1]]);
 const preview=replaySkeletonPresentation({atMs:200,
  rawPoses:[pose(.27),pose(.68)],actorStates:second.actors},200);
 assert.deepEqual(preview.labels,['ACTOR A','ACTOR B']);
 assert.deepEqual(preview.colors,[SKELETON_COLORS[0],SKELETON_COLORS[1]]);
 const reversed=replaySkeletonPresentation({atMs:100,
  rawPoses:[pose(.7),pose(.25)],actorStates:first.actors},100);
 assert.deepEqual(reversed.labels,['ACTOR B','ACTOR A']);
 assert.deepEqual(reversed.colors,[SKELETON_COLORS[1],SKELETON_COLORS[0]]);
});

test('S6.8.8.2 second actor can enter after first without manually selecting 2',()=>{
 const tracker=new VideoAutoActorTracker();
 tracker.observe([pose(.26)],0);
 const frame=tracker.observe([pose(.28),pose(.76)],120);
 assert.equal(frame.knownCount,2);
 assert.equal(frame.visibleCount,2);
 assert.deepEqual(frame.assignments.map(a=>a.id),['A','B']);
});

test('S6.8.8.2 one person remains visible as B becomes occluded and later lost',()=>{
 const tracker=new VideoAutoActorTracker();
 tracker.observe([pose(.25),pose(.75)],100);
 const hidden=tracker.observe([pose(.27)],250);
 assert.equal(hidden.visibleCount,1);
 assert.deepEqual(hidden.assignments.map(a=>a.id),['A']);
 assert.equal(hidden.actors.find(a=>a.id==='A')?.presence,'visible');
 assert.equal(hidden.actors.find(a=>a.id==='B')?.presence,'occluded');
 assert.equal(hidden.actors.find(a=>a.id==='B')?.rawIndex,null);
 const gone=tracker.observe([pose(.28)],1200);
 assert.equal(gone.actors.find(a=>a.id==='B')?.presence,'lost');
 // A also returns after a long sampled-frame gap: re-identification is
 // quarantined instead of silently continuing its old event trajectory.
 assert.equal(gone.assignments.length,0);
 assert.equal(gone.actors[0].presence,'reacquiring');
 assert.equal(videoActorPresenceLabel(gone.actors[1].presence),'Keluar frame');
});

test('S6.8.8.2 close overlap marks identity uncertain rather than inventing coordinates',()=>{
 const tracker=new VideoAutoActorTracker();
 tracker.observe([pose(.24),pose(.72)],100);
 const crossing=tracker.observe([pose(.46),pose(.50)],200);
 assert.equal(crossing.detectedCount,2);
 assert.equal(crossing.ambiguous,true);
 assert.deepEqual(crossing.assignments,[]);
 assert.deepEqual(crossing.actors.map(a=>a.presence),['uncertain','uncertain']);
 const after=tracker.observe([pose(.26),pose(.74)],330);
 // With only a single pre-crossing observation there is no direction
 // evidence proving which human emerged on either side.
 assert.equal(after.visibleCount,0);
 assert.equal(after.ambiguous,true);
 assert.deepEqual(after.actors.map(a=>a.presence),['uncertain','uncertain']);
 tracker.reset();
 const restarted=tracker.observe([pose(.26),pose(.74)],440);
 assert.equal(restarted.visibleCount,2);
 assert.deepEqual(restarted.assignments.map(a=>a.id),['A','B']);
});

test('S6.8.8.2 temporary missing torso points do not create phantom identity',()=>{
 const tracker=new VideoAutoActorTracker();
 const missing=pose(.3);
 for(const i of [11,12])missing[i].visibility=0;
 const frame=tracker.observe([missing],100);
 assert.equal(frame.detectedCount,1);
 assert.equal(frame.visibleCount,0);
 assert.equal(frame.actors[0].presence,'not-detected');
 const preview=replaySkeletonPresentation({atMs:100,rawPoses:[missing],
  actorStates:frame.actors},100);
 assert.deepEqual(preview.labels,['POSE 1 ?']);
 assert.equal(preview.colors[0],'#b7bdba');
 assert.deepEqual(replaySkeletonPresentation({atMs:100,rawPoses:[missing],
  actorStates:frame.actors},900).poses,[]);
});

test('S6.8.8.2 identity reset prevents carrying A/B across unrelated seek',()=>{
 const tracker=new VideoAutoActorTracker();
 tracker.observe([pose(.2),pose(.8)],50);
 tracker.reset();
 const next=tracker.observe([pose(.77)],100);
 assert.deepEqual(next.assignments.map(a=>a.id),['A']);
 assert.equal(next.actors[1].presence,'not-detected');
});

test('S6.8.8.2 invalid time never updates actor state',()=>{
 const tracker=new VideoAutoActorTracker();
 assert.throws(()=>tracker.observe([pose(.5)],NaN),/Timestamp/);
 assert.equal(tracker.observe([],0).visibleCount,0);
});
