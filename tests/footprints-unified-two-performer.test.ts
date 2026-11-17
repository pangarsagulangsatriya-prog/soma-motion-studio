import {test} from 'node:test';
import assert from 'node:assert/strict';
import {pose33AsD2,descriptorsFor33,d2ToVideoActorFrame} from '../src/stage/mediaPipeD2Bridge.ts';
import {MoveNetIdentityTracker} from '../src/stage/moveNetIdentityTracker.ts';
import type {Landmark} from '../src/engine/types.ts';
import {readFileSync} from 'node:fs';
function body(x:number):Landmark[]{
 const pose:Landmark[]=Array.from({length:33},()=>({x,y:.5,z:0,visibility:.95}));
 for(const [i,dx,y] of [[11,-.031,.3],[12,.031,.3],[23,-.028,.58],[24,.028,.58],
  [25,-.02,.73],[26,.02,.73],[27,-.02,.90],[28,.02,.90]]){
  pose[i]={x:x+dx,y,z:0,visibility:.98};
 }
 return pose;
}
function pixelFrame(people:Array<{x:number;shade:'red'|'blue'}>){
 const width=320,height=180,data=new Uint8ClampedArray(width*height*4);
 for(let i=3;i<data.length;i+=4)data[i]=255;
 for(const p of people)for(let y=54;y<=105;y++)for(let x=Math.floor((p.x-.031)*width);x<=Math.ceil((p.x+.031)*width);x++){
  if(x<0||x>=width)continue;
  const at=(y*width+x)*4;
  data[at]=p.shade==='red'?190:45;
  data[at+1]=p.shade==='red'?65:90;
  data[at+2]=p.shade==='red'?35:180;
 }
 return {data,width,height} as ImageData;
}
test('33 MediaPipe landmarks produce real 17-point geometry for A/B matching',()=>{
 const result=pose33AsD2(body(.3),640,360);
 assert.equal(result.keypoints.length,17);
 assert.equal(result.keypoints[5].x,(.3-.031)*640);
 assert.ok((result.score??0)>.9);
 assert.equal(pose33AsD2([],640,360).score,0);
});
test('same video frame color descriptors feed A/B; returned pose stays 33 landmark',()=>{
 const people=[{x:.2,shade:'red' as const},{x:.8,shade:'blue' as const}];
 const poses=people.map(p=>body(p.x));
 const pixels=pixelFrame(people);
 const descriptors=descriptorsFor33(poses,pixels);
 assert.ok(descriptors[0]&&descriptors[1]);
 assert.notDeepEqual(descriptors[0],descriptors[1]);
 const tracker=new MoveNetIdentityTracker();
 const observed=tracker.observeDescriptors(poses.map(p=>pose33AsD2(p,320,180)),descriptors,320,180,1);
 const linked=d2ToVideoActorFrame(observed,poses);
 assert.deepEqual(linked.assignments.map(p=>p.id),['A','B']);
 assert.ok(linked.assignments.every(p=>p.pose.length===33));
 assert.equal(linked.visibleCount,2);
 assert.ok(linked.actors.every(a=>a.lastSeenAtMs===1));
});
test('crossing holds both IDs, then restores A/B despite reversed raw detector order',()=>{
 const tracker=new MoveNetIdentityTracker();
 const coords=[[.2,.8],[.27,.73],[.34,.66],[.43,.57],[.49,.51],
  [.56,.44],[.63,.37],[.70,.30],[.76,.24]];
 const frames=coords.map(([a,b],i)=>{
  const people=[{x:a,shade:'red' as const},{x:b,shade:'blue' as const}];
  const reversed=i%2?[people[1],people[0]]:people;
  const poses=reversed.map(p=>body(p.x));
  const pixels=pixelFrame(reversed);
  const observed=tracker.observeDescriptors(poses.map(p=>pose33AsD2(p,320,180)),
   descriptorsFor33(poses,pixels),320,180,1+i*84);
  return d2ToVideoActorFrame(observed,poses);
 });
 assert.equal(frames[0].visibleCount,2);
 assert.equal(frames[4].visibleCount,0);
 assert.ok(frames[4].ambiguous);
 assert.equal(frames.at(-1)!.visibleCount,2);
 assert.ok(frames.at(-1)!.assignments.find(p=>p.id==='A')!.pose[11].x>.65);
});
test('Footprints main never needs a second benchmark button to produce gait',()=>{
 const root=readFileSync(new URL('../src/studio/v3/FootprintsExperimentalSource.tsx',import.meta.url),'utf8');
 const engine=readFileSync(new URL('../src/stage/VideoPoseGaitEngine.ts',import.meta.url),'utf8');
 assert.doesNotMatch(root,/D1MoveNetBenchmark/);
 assert.match(engine,/new MoveNetIdentityTracker/);
 assert.match(engine,/observeDescriptors\(mapped,descriptors,width,height,atMs\)/);
 assert.match(engine,/this\.qa\.observe\(candidates,observed\.actors\)/);
 assert.match(root,/fp-duet-engine-status/);
});
