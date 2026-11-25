import test from 'node:test';
import assert from 'node:assert/strict';
import {IncrementalFloorRaster,paintFloorCanvas} from '../src/footprints/simulator/floorCanvas.ts';
import {defaultFloorSpace} from '../src/footprints/spatial/coordinates.ts';
import {createFloorSession,type FootstepEvent} from '../src/footprints/spatial/events.ts';
const floor=defaultFloorSpace(3,2);
function fake(){
 const calls:string[]=[];let lost=false;
 const ctx=new Proxy({isContextLost:()=>lost}, {get(target,key){
  if(key in target)return Reflect.get(target,key);
  return (...args:unknown[])=>calls.push(String(key)+':'+JSON.stringify(args));
 }});
 const canvas={width:1280,height:720,getContext:()=>ctx} as unknown as HTMLCanvasElement;
 return {canvas,calls,lose:(v:boolean)=>{lost=v;}};
}
const event=(i:number,kind:FootstepEvent['kind']='contact'):FootstepEvent=>({
 id:'event-'+i,performerId:'A',foot:'left',kind,timestampMs:i*40,
 positionM:{xM:.5+(i%10)*.1,yM:1},headingRad:0,source:'camera',positionBasis:'calibrated-estimate',confidence:.95
});
test('incremental append matches full painter drawing operations without reclearing',()=>{
 const full=fake(),live=fake(),r=new IncrementalFloorRaster(),events=[event(1),event(2,'move'),event(3)];
 paintFloorCanvas(full.canvas,createFloorSession(floor,events),{showGrid:false});
 r.paint(live.canvas,{epoch:1,floor,start:0,total:1,events:events.slice(0,1)});
 r.paint(live.canvas,{epoch:1,floor,start:1,total:3,events:events.slice(1)});
 const drawing=(a:string[])=>a.filter(s=>!s.startsWith('setTransform:'));
 assert.deepEqual(drawing(live.calls),drawing(full.calls));
 assert.equal(r.cursor,3);
 assert.equal(live.calls.filter(s=>s.startsWith('fillRect:')).length,1);
});
test('10,000 events are appended once rather than replayed for every update',()=>{
 const f=fake(),r=new IncrementalFloorRaster();
 for(let start=0;start<10000;start+=100){
  const events=Array.from({length:100},(_,i)=>event(start+i));
  r.paint(f.canvas,{epoch:1,floor,start,total:start+100,events});
 }
 assert.equal(r.cursor,10000);
 assert.equal(f.calls.filter(s=>s.startsWith('translate:')).length,10000);
 assert.equal(f.calls.filter(s=>s.startsWith('fillRect:')).length,1);
});
test('epoch, resize, context loss and cursor mismatch require replay',()=>{
 const f=fake(),r=new IncrementalFloorRaster(),e=event(1);
 r.paint(f.canvas,{epoch:1,floor,start:0,total:1,events:[e]});
 assert.equal(r.needsRebuild(f.canvas,2),true);
 f.canvas.width=640;assert.equal(r.needsRebuild(f.canvas,1),true);
 r.invalidate();f.lose(true);
 assert.throws(()=>r.paint(f.canvas,{epoch:2,floor,start:0,total:1,events:[e]}));
 assert.equal(r.cursor,0);f.lose(false);
 r.paint(f.canvas,{epoch:2,floor,start:0,total:1,events:[e]});
 assert.equal(r.cursor,1);
 assert.throws(()=>r.paint(f.canvas,{epoch:2,floor,start:0,total:1,events:[e]}));
 assert.equal(r.cursor,0);
});
