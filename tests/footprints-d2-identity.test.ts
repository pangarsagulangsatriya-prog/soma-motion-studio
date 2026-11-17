import {test} from 'node:test';
import assert from 'node:assert/strict';
import {MoveNetIdentityTracker,moveNetTorsoAppearance,type D2Pose}
 from '../src/stage/moveNetIdentityTracker.ts';
import {readFileSync} from 'node:fs';

function sample(x:number,color:'red'|'blue'){
 const width=640,height=360,px=x*width,py=170;
 const k=Array.from({length:17},()=>({x:px,y:py,score:.95}));
 k[5]={x:px-20,y:py-35,score:.95};k[6]={x:px+20,y:py-35,score:.95};
 k[11]={x:px-20,y:py+35,score:.95};k[12]={x:px+20,y:py+35,score:.95};
 const pose:D2Pose={score:.97,box:{xMin:px-32,yMin:py-70,width:64,height:145},keypoints:k};
 return {pose,color};
}
function imageFrame(people:Array<ReturnType<typeof sample>>){
 const width=640,height=360,data=new Uint8ClampedArray(width*height*4);
 for(let i=3;i<data.length;i+=4)data[i]=255;
 for(const person of people){
  const px=person.pose.keypoints[5].x+20,py=170;
  for(let y=py-35;y<=py+35;y++)for(let x=px-20;x<=px+20;x++){
   if(x<0||x>=width||y<0||y>=height)continue;
   const i=(y*width+x)*4;
   data[i]=person.color==='red'?200:35;
   data[i+1]=person.color==='red'?66:100;
   data[i+2]=person.color==='red'?33:210;
  }
 }
 return {data,width,height} as ImageData;
}
test('Torso color descriptor separates two clothes',()=>{
 const a=sample(.2,'red'),b=sample(.8,'blue');
 const img=imageFrame([a,b]);
 assert.notDeepEqual(moveNetTorsoAppearance(a.pose,img),moveNetTorsoAppearance(b.pose,img));
});
test('D2 holds ambiguous crossing and recovers stable A/B after three observations',()=>{
 const t=new MoveNetIdentityTracker();
 const xs:[[number,number],[number,number],[number,number],[number,number],
  [number,number],[number,number],[number,number],[number,number],[number,number]]=[
  [.20,.80],[.27,.73],[.34,.66],[.43,.57],[.49,.51],
  [.56,.44],[.63,.37],[.70,.30],[.76,.24]
 ];
 const results=xs.map(([a,b],i)=>{
  const r=sample(a,'red'),s=sample(b,'blue');
  const people=i%2?[s,r]:[r,s];
  return t.observe(people.map(x=>x.pose),imageFrame(people),i*84+1);
 });
 assert.deepEqual(results[0].assignments.map(x=>x.id),['A','B']);
 assert.equal(results[4].held,true);
 assert.equal(results[4].assignments.length,0);
 assert.ok(results.some(x=>x.actors.some(a=>a.presence==='reacquiring')));
 const last=results.at(-1)!;
 assert.ok(last.assignments.find(x=>x.id==='A')!.center.x>.65);
 assert.ok(last.assignments.find(x=>x.id==='B')!.center.x<.35);
});
test('D2 refuses uncertain single pose and rejects backward video time',()=>{
 const t=new MoveNetIdentityTracker();
 const a=sample(.2,'red'),b=sample(.8,'blue');
 t.observe([a.pose,b.pose],imageFrame([a,b]),1);
 const middle=sample(.5,'blue');
 for(const i of [5,6,11,12])middle.pose.keypoints[i].score=.01;
 const mid=t.observe([middle.pose],imageFrame([middle]),90);
 assert.equal(mid.assignments.length,0);
 assert.throws(()=>t.observe([middle.pose],imageFrame([middle]),80),/waktu frame/);
 t.reset();
 assert.equal(t.observe([a.pose,b.pose],imageFrame([a,b]),10).assignments.length,2);
});
test('D2 stays attached to Footprints primary input, no duplicate lab',()=>{
 const root=readFileSync(new URL('../src/studio/v3/FootprintsExperimentalSource.tsx',import.meta.url),'utf8');
 const panel=readFileSync(new URL('../src/stage/D1MoveNetBenchmark.tsx',import.meta.url),'utf8');
 assert.match(root,/D1MoveNetBenchmark sourceUrl=\{url\}/);
 assert.match(panel,/new MoveNetIdentityTracker\(\)/);
 assert.match(panel,/trackers\[index\]\.observe/);
});
