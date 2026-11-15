import test from 'node:test';
import assert from 'node:assert/strict';
import {emptyFrame,type MotionFrame,type Landmark} from '../src/engine/types.ts';
import {GaitAnalyzer} from '../src/footprints/gait-analysis/index.ts';

function makePose(t:number,footY:number,wholeShift=0):MotionFrame{
 const f=emptyFrame('camera');f.time=t;f.source='camera';f.tracked=true;f.quality=.95;
 f.pose=Array.from({length:33},()=>({x:.5,y:.5,z:0,visibility:0})) as Landmark[];
 const point=(n:number,x:number,y:number)=>{f.pose[n]={x,y:y+wholeShift,z:0,visibility:.99};};
 point(23,.41,.45);point(24,.59,.45);
 point(27,.42,footY-.03);point(29,.42,footY);point(31,.45,footY);
 point(28,.58,.78);point(30,.58,.81);point(32,.61,.81);
 return f;
}
test('gait estimates one initial contact after stationary confirmation',()=>{
 const engine=new GaitAnalyzer();
 const first=engine.observe(makePose(0,.82),0,0,4/3);
 const still=engine.observe(makePose(130,.82),0,130,4/3);
 const repeat=engine.observe(makePose(260,.82),0,260,4/3);
 assert.equal(first?.stamp,false);
 assert.equal(still?.stamp,true);
 assert.equal(still?.phase,'stance');
 assert.equal(repeat?.stamp,false);
});
test('gait follows swing then estimates a new contact in any movement direction',()=>{
 const engine=new GaitAnalyzer();
 const marks=[
  engine.observe(makePose(0,.82),0,0,4/3),
  engine.observe(makePose(130,.82),0,130,4/3),
  engine.observe(makePose(200,.64),0,200,4/3),
  engine.observe(makePose(270,.82),0,270,4/3),
  engine.observe(makePose(340,.82),0,340,4/3),
  engine.observe(makePose(470,.82),0,470,4/3)
 ];
 assert.equal(marks[2]?.phase,'swing');
 assert.equal(marks[5]?.phase,'stance');
 assert.equal(marks.filter(m=>m?.stamp).length,2);
 for(const m of marks)if(m)assert.ok(m.x>=0&&m.x<=1&&m.y>=0&&m.y<=1);
});
test('torso translation does not create repeated steps',()=>{
 const engine=new GaitAnalyzer();
 let count=0;
 for(let t=0;t<=780;t+=65){
  const m=engine.observe(makePose(t,.82,t/780*.08),0,t,4/3);
  if(m?.stamp)count++;
 }
 assert.equal(count,1);
});
test('tracking interruption resets phase and never draws a jump',()=>{
 const engine=new GaitAnalyzer();
 engine.observe(makePose(0,.82),0,0,4/3);
 const bad=makePose(500,.82);bad.pose[29].visibility=0;
 assert.equal(engine.observe(bad,0,500,4/3),null);
 const next=engine.observe(makePose(550,.5),0,550,4/3);
 assert.equal(next?.join,false);
 assert.equal(next?.stamp,false);
});
