import {test} from 'node:test';
import assert from 'node:assert/strict';
import {ObservedMotionInkEngine,stableInkSourceIdentity} from '../src/footprints/lines/v3/ObservedMotionInkEngine.ts';
import {buildSumiStrokeGeometry} from '../src/footprints/lines/v3/SumiStrokeGeometryBuilder.ts';
import {PersistentInkStore} from '../src/footprints/lines/v3/PersistentInkStore.ts';
import type {FootBrushPose} from '../src/footprints/lines/v3/FootBrushPoseAdapter.ts';
const pose=(x:number,ms:number,sourceKey='video:take:0:2',actorId='A',foot:'left'|'right'='left'):FootBrushPose=>({
 actorId,foot,sourceKey,epoch:0,atMs:ms,coordinateBasis:'image-2d',
 center:{x,y:.55},confidence:.95,provenance:'video-estimate',headingRad:0,
 heel:{x:x-.018,y:.55},toe:{x:x+.018,y:.55}
});
const inputStreams=[
 ['webcam','track:camera:session:2','detected-estimate'],
 ['phone','track:phone:session:2','detected-estimate'],
 ['video','video:take:0:2','video-estimate'],
 ['simulator','simulator:session:2','simulated'],
 ['demo','demo:v3','simulated']
] as const;
test('all five sources produce the same solid ribbon geometry',()=>{
 for(const [name,key,provenance] of inputStreams){
  const engine=new ObservedMotionInkEngine();
  const a={...pose(.25,1000,key),provenance};
  const b={...pose(.29,1033,key),provenance};
  assert.deepEqual(engine.ingest([a]),[],name);
  const events=engine.ingest([b]);assert.equal(events.length,1,name);
  const g=buildSumiStrokeGeometry(events[0],{weightPx:36,expression:'bold'});
  assert.ok(g,name);assert.equal(g.left.length,g.right.length);
  assert.ok(g.bounds.height>=30,name+' must produce bold filled width');
  assert.ok(g.centerline.length>2,name);
  assert.equal(events[0].actorId,'A');
 }
});
test('cut prevents a bridge yet does not affect the next stroke geometry',()=>{
 const e=new ObservedMotionInkEngine();
 e.ingest([pose(.2,1000)]);e.ingest([pose(.23,1033)]);
 e.cutMotionSegment('seek');
 assert.equal(e.ingest([pose(.75,2000)]).length,0);
 assert.equal(e.ingest([pose(.77,2033)]).length,1);
});
test('duplicate, missing, weak, teleport and crossing are rejected',()=>{
 const e=new ObservedMotionInkEngine();
 e.ingest([pose(.2,1000,'track:camera:session:2')]);
 assert.equal(e.ingest([pose(.2,1000,'track:camera:session:2')]).length,0);
 assert.equal(e.ingest([{...pose(.9,1033,'track:camera:session:2'),confidence:.99}]).length,0);
 e.ingest([]);assert.equal(e.ingest([pose(.2,1100,'track:camera:session:2')]).length,0);
 assert.equal(e.ingest([{...pose(.22,1133,'track:camera:session:2'),confidence:.3}]).length,0);
});
test('actor/feet are independent channels and source segment stays isolated',()=>{
 const e=new ObservedMotionInkEngine();
 const a=pose(.2,1000,'track:phone:s1:2','A','left');
 const b=pose(.8,1000,'track:phone:s1:2','B','right');
 e.ingest([a,b]);
 const events=e.ingest([{...a,atMs:1033,center:{x:.24,y:.55}},
  {...b,atMs:1033,center:{x:.76,y:.55}}]);
 assert.deepEqual(events.map(x=>x.actorId+':'+x.foot).sort(),['A:left','B:right']);
 const other={...a,sourceKey:'track:camera:s2:2',atMs:1066};
 assert.equal(e.ingest([other]).length,0);
});
test('MP4 clip identity excludes segment epoch and performer count',()=>{
 assert.equal(stableInkSourceIdentity('video:take:test:1:2'),
  stableInkSourceIdentity('video:take:test:8:1'));
});
test('geometry scales with bobot and preserves determinism',()=>{
 const e=new ObservedMotionInkEngine();
 e.ingest([pose(.2,1000)]);
 const evt=e.ingest([pose(.24,1033)])[0];
 const b=buildSumiStrokeGeometry(evt,{weightPx:36,expression:'bold'});
 const thin=buildSumiStrokeGeometry(evt,{weightPx:8,expression:'bold'});
 assert.ok(b&&thin);assert.ok(b.bounds.height>thin.bounds.height*2.5);
 assert.deepEqual(b,buildSumiStrokeGeometry(evt,{weightPx:36,expression:'bold'}));
});
test('real heel pivot produces a sweep even when center barely moves',()=>{
 const e=new ObservedMotionInkEngine();
 const a=pose(.4,1000);
 e.ingest([a]);
 const b={...a,atMs:1033,headingRad:.4,
  center:{x:.415,y:.553},heel:a.heel};
 const ev=e.ingest([b]);
 assert.equal(ev.length,1);
 assert.equal(ev[0].kind,'pivot');
 const g=buildSumiStrokeGeometry(ev[0],{weightPx:36,expression:'bold'});
 assert.ok(g);assert.ok(g.centerline.length>=3);
});
test('persistent store paints once, cuts without clearing, and clears on command',()=>{
 const saved=(globalThis as any).document;
 let composites=0;
 class FakeCanvas {
  width=0;height=0;
  getContext(){
   return {canvas:this,save(){},restore(){},translate(){},setTransform(){},beginPath(){},
    moveTo(){},lineTo(){},closePath(){},fill(){},stroke(){},clip(){},
    ellipse(){},clearRect(){},fillRect(){},drawImage(){composites++;},
    set globalAlpha(_x:number){},set globalCompositeOperation(_x:string){},
    set strokeStyle(_x:string){},set fillStyle(_x:string){},
    set lineWidth(_x:number){},set lineJoin(_x:string){},set lineCap(_x:string){}
   };
  }
  toDataURL(){return 'data:image/png;base64,TEST';}
 }
 (globalThis as any).document={createElement:()=>new FakeCanvas()};
 try{
  const engine=new ObservedMotionInkEngine(),store=new PersistentInkStore();
  engine.ingest([pose(.2,1000)]);
  const ev=engine.ingest([pose(.23,1033)])[0];
  const g=buildSumiStrokeGeometry(ev,{weightPx:36,expression:'bold'})!;
  const style={color:'#e44f32',material:'sumi' as const,
   weightPx:36,expression:'bold' as const,seed:42};
  assert.equal(store.appendOnce(ev,g,style),true);
  const snapshot=store.getCanvas();
  assert.equal(store.appendOnce(ev,g,style),false);
  store.cutMotionSegment('source-switch');
  assert.equal(store.getCanvas(),snapshot);
  assert.equal(composites,1);
  assert.ok(store.exportPNG());
  store.clearPainting();assert.equal(store.depositCount,0);
  assert.equal(store.appendOnce(ev,g,style),true);
  assert.equal(composites,3); // export PNG + two deposits
 }finally{
  (globalThis as any).document=saved;
 }
});

test('accelerated 30-minute 2-actor/4-foot stream bounds the ink cache and metadata',()=>{
 const saved=(globalThis as any).document;
 let frames=0;
 class FakeCanvas{
  width=0;height=0;
  getContext(){
   return {canvas:this,save(){},restore(){},translate(){},setTransform(){},
    clearRect(){},drawImage(){frames++;},beginPath(){},moveTo(){},
    lineTo(){},closePath(){},fill(){},stroke(){},clip(){},ellipse(){},
    set globalAlpha(_n:number){},set globalCompositeOperation(_s:string){},
    set strokeStyle(_s:string){},set fillStyle(_s:string){},
    set lineWidth(_n:number){},set lineJoin(_s:string){},set lineCap(_s:string){}
   };
  }
 }
 (globalThis as any).document={createElement:()=>new FakeCanvas()};
 try{
  const engine=new ObservedMotionInkEngine();
  const store=new PersistentInkStore();
  for(let i=0;i<5401;i++){
   const atMs=1000+i*333;
   const poses:FootBrushPose[]=[];
   for(const [actor,foot,offset] of [
    ['A','left',0],['A','right',.14],['B','left',.35],['B','right',.49]
   ] as const){
    poses.push({...pose(.16+offset+.04*Math.sin(i/5),atMs,
     'video:thirty-minute-clip:0:2',actor,foot),
     center:{x:.16+offset+.04*Math.sin(i/5),y:foot==='left'?.48:.61}});
   }
   for(const event of engine.ingest(poses)){
    const g=buildSumiStrokeGeometry(event,{weightPx:36,expression:'bold'});
    if(g)store.appendOnce(event,g,{color:event.actorId==='A'?'#e44f32':'#242424',
     material:'sumi',weightPx:36,expression:'bold',seed:i});
   }
  }
  const s=store.diagnostics;
  assert.ok(s.deposits>1000);
  assert.ok(s.liveIds<=3000);
  assert.ok(s.coveredRanges<=16);
  assert.equal(s.rasterBytes,1600*900*4);
  assert.ok(frames>=s.deposits);
  store.cutMotionSegment('camera-disconnect');
  assert.equal(store.depositCount,s.deposits);
 }finally{(globalThis as any).document=saved;}
});
