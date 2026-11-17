import test from 'node:test';
import assert from 'node:assert/strict';
import type {Landmark} from '../src/engine/types.ts';
import {duetSearchRegions,remapPoseFromCrop,rescuePoseQuality,
 mergeRescueDetections} from '../src/stage/duetPoseRescue.ts';
import {VideoAutoActorTracker} from '../src/stage/videoAutoActorTracker.ts';
const pose=(x:number,visibility=.95):Landmark[]=>
 Array.from({length:33},(_,i)=>({x:x+(i%2===0?-.02:.02),
 y:.14+Math.floor(i/5)*.09,z:0,visibility}));
test('Duet recovery crops remain within frame and target both sides of existing actor',()=>{
 for(const input of [[],[pose(.52)],[pose(.06)],[pose(.95)]]){
  const rois=duetSearchRegions(input);
  assert.equal(rois.length,2);
  for(const roi of rois){
   assert.ok(roi.x>=0&&roi.y>=0&&roi.width>0&&roi.height>0);
   assert.ok(roi.x+roi.width<=1.00001&&roi.y+roi.height<=1.00001);
  }
 }
 const regions=duetSearchRegions([pose(.52)]);
 assert.ok(regions[0].x<regions[1].x);
});
test('Crop coordinates unproject into full video coordinates',()=>{
 const region={x:.20,y:.10,width:.4,height:.8};
 const remapped=remapPoseFromCrop([
  {x:.5,y:.5,z:.2,visibility:.95}],region);
 assert.equal(remapped[0].x,.4);
 assert.equal(remapped[0].y,.5);
 assert.equal(remapped[0].z,.08);
});
test('Rescue accepts a second well-observed actor and keeps the original raw pose',()=>{
 const original=pose(.25),second=pose(.73);
 const result=mergeRescueDetections([original],[
  {landmarks:second,worldLandmarks:second,quality:.95}
 ]);
 assert.equal(result.poses.length,2);
 assert.equal(result.rescued.length,1);
 assert.equal(result.poses[0][23].x,original[23].x);
 assert.equal(result.poses[1][23].x,second[23].x);
});
test('Rescue never counts a duplicate crop as another person',()=>{
 const one=pose(.53),near=pose(.565);
 const output=mergeRescueDetections([one],[
  {landmarks:near,worldLandmarks:near,quality:.96},
  {landmarks:one,worldLandmarks:one,quality:.96}
 ]);
 assert.equal(output.poses.length,1);
 assert.equal(output.rescued.length,0);
});
test('Low-quality torso/legs cannot fake a second performer',()=>{
 const original=pose(.25),weak=pose(.78,.3);
 assert.ok(rescuePoseQuality(weak)<.68);
 const result=mergeRescueDetections([original],[
  {landmarks:weak,worldLandmarks:weak,quality:.99}
 ]);
 assert.equal(result.poses.length,1);
});
test('Initial two nearly adjacent poses occupy two visible identity slots',()=>{
 const tracker=new VideoAutoActorTracker();
 const frame=tracker.observe([pose(.42),pose(.49)],100);
 assert.equal(frame.detectedCount,2);
 assert.equal(frame.visibleCount,2);
 assert.deepEqual(frame.assignments.map(x=>x.id),['A','B']);
});
test('Partially visible shoulders remain distinguishable when both actors appear',()=>{
 const tracker=new VideoAutoActorTracker();
 const left=pose(.27),right=pose(.75);
 right[11].visibility=.35;right[12].visibility=.35;
 const result=tracker.observe([left,right],100);
 assert.equal(result.detectedCount,2);
 assert.equal(result.visibleCount,2);
 assert.deepEqual(result.actors.map(a=>a.presence),['visible','visible']);
});
test('Single detected person never causes a fabricated second landmark set',()=>{
 const tracker=new VideoAutoActorTracker();
 tracker.observe([pose(.2),pose(.8)],0);
 const onlyOne=tracker.observe([pose(.25)],100);
 assert.equal(onlyOne.detectedCount,1);
 assert.equal(onlyOne.assignments.length,1);
 assert.equal(onlyOne.actors[1].presence,'occluded');
});
