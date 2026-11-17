import {test} from 'node:test';
import assert from 'node:assert/strict';
import {d3GuideForPose,d3MatchGuides,d3AcceptRefinement,torsoAnchor}
 from '../src/stage/duetPose33.ts';
import {remapPoseFromCrop} from '../src/stage/duetPoseRescue.ts';
import type {Landmark} from '../src/engine/types.ts';
import {readFileSync} from 'node:fs';

function body(x:number):Landmark[]{
 const p:Landmark[]=Array.from({length:33},(_,i)=>({
  x:x+(i%3-1)*.018,y:.45+(i%4-1)*.038,z:0,visibility:.96
 }));
 for(const [i,dx,y] of [[11,-.032,.27],[12,.032,.27],[23,-.029,.52],[24,.029,.52],
  [25,-.031,.7],[26,.031,.7],[27,-.033,.82],[28,.033,.82],
  [29,-.03,.86],[30,.03,.86],[31,-.037,.88],[32,.037,.88]]){
  p[i]={x:x+dx,y,z:0,visibility:.97};
 }
 return p;
}
test('D3 generates distinct aspect-correct regions for the same 640x360 MP4',()=>{
 const left=d3GuideForPose('A',body(.22),640,360);
 const right=d3GuideForPose('B',body(.78),640,360);
 assert.ok(left&&right);
 assert.ok(left.region.x+left.region.width<right.region.x+.1);
 for(const r of [left.region,right.region]){
  assert.ok(r.x>=0&&r.y>=0);
  assert.ok(r.x+r.width<=1.001&&r.y+r.height<=1.001);
  assert.ok(r.width>0&&r.height>0);
 }
 assert.equal(d3GuideForPose('A',[],640,360),null);
 assert.equal(d3GuideForPose('A',body(.2),0,360),null);
});
test('D3 stays with actual actor identity when raw MediaPipe ordering reverses',()=>{
 const a=body(.22),b=body(.78);
 const guides=[
  d3GuideForPose('A',a,640,360)!,
  d3GuideForPose('B',b,640,360)!
 ];
 const reversed=[body(.77),body(.23)];
 const matches=d3MatchGuides(guides,reversed);
 assert.deepEqual(matches.map(x=>[x.id,x.rawIndex]),[['A',1],['B',0]]);
 assert.equal(d3MatchGuides(guides,[body(.5),body(.52)]).length,0);
 assert.equal(d3MatchGuides(guides,[body(.5)]).length,0);
});
test('D3 remaps accepted 33 joints into full-frame coordinates without inventing feet',()=>{
 const source=body(.24);
 const guide=d3GuideForPose('A',source,640,360)!;
 const result=remapPoseFromCrop(source.map(p=>({
  ...p,x:(p.x-guide.region.x)/guide.region.width,
  y:(p.y-guide.region.y)/guide.region.height,
  z:p.z/guide.region.width
 })),guide.region);
 assert.equal(result.length,33);
 assert.ok(Math.abs(result[27].x-source[27].x)<1e-9);
 assert.ok(d3AcceptRefinement(result,source,[body(.76)],guide.region));
 const wrong=result.map(p=>({...p,x:p.x+.2}));
 assert.equal(d3AcceptRefinement(wrong,source,[body(.76)],guide.region),false);
 const missing=result.slice(0,32);
 assert.equal(d3AcceptRefinement(missing,source,[],guide.region),false);
 assert.ok(torsoAnchor(source));
});
test('D3 worker uses independent crop inference but same A/B gait engine and output guard',()=>{
 const worker=readFileSync(new URL('../src/stage/replayInferenceWorker.ts',import.meta.url),'utf8');
 const client=readFileSync(new URL('../src/stage/replayInferenceWorkerClient.ts',import.meta.url),'utf8');
 const engine=readFileSync(new URL('../src/stage/VideoPoseGaitEngine.ts',import.meta.url),'utf8');
 const ui=readFileSync(new URL('../src/studio/v3/FootprintsExperimentalSource.tsx',import.meta.url),'utf8');
 assert.match(worker,/function guidedDual33/);
 assert.match(worker,/d3MatchGuides\(guides,poses\)/);
 assert.match(worker,/rescue\.detect\(sample\)/);
 assert.match(worker,/d3AcceptRefinement\(refined,current,others,region\)/);
 assert.match(worker,/poses\[rawIndex\]=refined/);
 assert.match(client,/guides:D3Guide\[\]/);
 assert.match(engine,/this\.cropGuides\(video,atMs\)/);
 assert.match(engine,/this\.actorTracker\.observeDescriptors/);
 assert.match(engine,/this\.qa\.observe\(candidates,observed\.actors\)/);
 assert.match(ui,/D3 · Crop A\/B/);
});
