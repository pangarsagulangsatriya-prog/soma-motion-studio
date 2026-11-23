import {test} from 'node:test';
import assert from 'node:assert/strict';
import {PathObservationRouter} from '../src/footprints/lines/v3/PathObservationRouter.ts';
import {ActorPathTracker} from '../src/footprints/lines/v3/ActorPathTracker.ts';
import {samplePathSegment,knotDistances,type PathKnot} from '../src/footprints/lines/v3/PathSplineFitter.ts';
import {buildPathRibbon} from '../src/footprints/lines/v3/SumiRibbonMeshBuilder.ts';
import {PersistentPathStore} from '../src/footprints/lines/v3/PersistentPathStore.ts';
import type {FootBrushPose} from '../src/footprints/lines/v3/FootBrushPoseAdapter.ts';
const pose=(actorId:string,foot:'left'|'right',x:number,time:number,key='video:take:0:2'):FootBrushPose=>({
 actorId,foot,center:{x,y:actorId==='A'?.3:.7},atMs:time,sourceKey:key,
 epoch:1,confidence:.96,coordinateBasis:'image-2d',provenance:key.startsWith('video:')?
 'video-estimate':key.startsWith('demo:')?'simulated':'detected-estimate'
});
const four=(time:number,x:number,key='video:take:0:2'):FootBrushPose[]=>[
 pose('A','left',x-.009,time,key),pose('A','right',x+.009,time,key),
 pose('B','left',1-x-.009,time,key),pose('B','right',1-x+.009,time,key)
];
const style={color:'#E44F32',weightPx:26,material:'path-sumi' as const,accents:'subtle' as const};
test('four feet give exactly two actor-center observations',()=>{
 const r=new PathObservationRouter(),obs=r.ingest(four(1000,.2));
 assert.deepEqual(obs.map(x=>x.actorId),['A','B']);
 assert.equal(obs[0].evidence,'estimated-ground-projection');
 assert.ok(obs[0].point.x>200);
 assert.equal(obs[0].clipStableId,'video:take');
});
test('single-foot occlusion uses displacement, not a center snap',()=>{
 const r=new PathObservationRouter();
 const a=r.ingest(four(1000,.20))[0];
 const b=r.ingest([pose('A','left',.201,1033)])[0];
 assert.ok(Math.abs(b.point.x-a.point.x)<20,'occlusion must not teleport actor path');
});
test('20-second straight walk builds only one stroke per actor',()=>{
 const r=new PathObservationRouter(),track=new ActorPathTracker();
 let starts=0,cut=0,adds=0;
 for(let k=0;k<200;k++){
  const t=1000+k*100,x=.2+k*.001;
  const events=track.ingest(r.ingest(four(t,x)),t);
  starts+=events.filter(e=>e.kind==='START').length;
  cut+=events.filter(e=>e.kind==='CUT').length;
  adds+=events.filter(e=>e.kind==='ADD'||e.kind==='TURN').length;
 }
 assert.equal(starts,2);assert.equal(cut,0);
 assert.equal(track.activeCount,2);assert.ok(adds>40);
});
test('stop-start does not generate a new head or ink while standing',()=>{
 const r=new PathObservationRouter(),t=new ActorPathTracker();
 t.ingest(r.ingest(four(1000,.2)),1000);
 const first=t.ingest(r.ingest(four(1100,.22)),1100);
 assert.ok(first.some(e=>e.kind==='START'||e.kind==='ADD'));
 let rest=[] as ReturnType<typeof t.ingest>;
 for(let i=0;i<6;i++)rest.push(...t.ingest(r.ingest(four(1200+i*100,.22)),1200+i*100));
 assert.ok(rest.filter(e=>e.kind==='STOP').length<=2);
 const resumed=t.ingest(r.ingest(four(1900,.24)),1900);
 assert.ok(resumed.every(e=>e.kind!=='START'),'stop-start must retain stroke identity');
});
test('seek, source change and teleport do not bridge distant coordinates',()=>{
 const r=new PathObservationRouter(),t=new ActorPathTracker();
 t.ingest(r.ingest(four(1000,.2)),1000);
 t.ingest(r.ingest(four(1100,.24)),1100);
 const change=t.ingest(r.ingest(four(1200,.7,'track:phone:s2:2')),1200);
 assert.ok(change.some(e=>e.kind==='CUT'));
 assert.ok(!change.some(e=>e.kind==='ADD'));
 const seek=t.cutAll('seek');assert.ok(seek.length<=2);
});
test('spline is bounded near the observed corridor; nib head and CUT tail taper',()=>{
 const knots:PathKnot[]=[
  {point:{x:100,y:150},timeMs:0,confidence:.98},
  {point:{x:130,y:150},timeMs:100,confidence:.98},
  {point:{x:155,y:150},timeMs:200,confidence:.98},
  {point:{x:185,y:155},timeMs:300,confidence:.98}
 ];
 const dist=knotDistances(knots),one=samplePathSegment(knots,1,dist[1],5);
 assert.ok(one.length>3);
 assert.ok(one.every(p=>Number.isFinite(p.tx)&&Number.isFinite(p.ty)&&p.y<=158));
 const first=samplePathSegment(knots,0,0,4),last=samplePathSegment(knots,2,dist[2],4);
 const mesh=buildPathRibbon([...first,...one,...last],
  {weightPx:26,material:'path-sumi'},dist.at(-1)!,true);
 assert.ok(mesh);
 assert.ok(mesh.widths[0]<.5);
 assert.ok(mesh.widths.at(-1)!<.5);
 assert.ok(mesh.widths.some(w=>w>5));
 const huge=buildPathRibbon(one,{weightPx:64,material:'path-sumi'},200,false)!;
 assert.ok(Math.max(...huge.widths)<=42);
 assert.deepEqual(one,samplePathSegment(knots,1,dist[1],5));
});
test('all source flavors use one actor-path event pipeline',()=>{
 const sources=['track:camera:s:2','track:phone:s:2','video:take:0:2',
 'simulator:s:2','demo:v3'];
 for(const source of sources){
  const router=new PathObservationRouter(),tracker=new ActorPathTracker();
  const starts=tracker.ingest(router.ingest(four(1000,.2,source)),1000);
  const moves=tracker.ingest(router.ingest(four(1100,.23,source)),1100);
  assert.equal(starts.filter(x=>x.kind==='START').length,2,source);
  assert.equal(moves.filter(x=>x.kind==='ADD'||x.kind==='TURN').length,2,source);
 }
});
function fakeDocument(){
 const old=(globalThis as {document?:unknown}).document;
 let drawCount=0;
 class Canvas{
  width=0;height=0;
  getContext(){
   return {save(){},restore(){},translate(){},setTransform(){},clearRect(){},
    beginPath(){},moveTo(){},lineTo(){},stroke(){},arc(){},fill(){},fillRect(){},
    drawImage(){drawCount++;},closePath(){},clip(){},
    set strokeStyle(_x:string){},set fillStyle(_x:string){},set lineWidth(_x:number){},
    set lineJoin(_x:string){},set lineCap(_x:string){},
    set globalAlpha(_x:number){},set globalCompositeOperation(_x:string){}
   };
  }
  toDataURL(){return 'data:image/png;base64,TEST';}
 }
 (globalThis as {document?:unknown}).document={createElement:()=>new Canvas()};
 return {restore:()=>{(globalThis as {document?:unknown}).document=old;},
  drawn:()=>drawCount};
}
test('painting persists across cut, repeated compositor reads, clear and MP4 replay',()=>{
 const fake=fakeDocument();
 try{
  const r=new PathObservationRouter(),t=new ActorPathTracker(),store=new PersistentPathStore();
  for(let i=0;i<35;i++){
   const tm=1000+i*100;
   for(const e of t.ingest(r.ingest(four(tm,.2+i*.002)),tm))
    store.ingest(e,style);
  }
  const canvas=store.getCanvas();assert.ok(canvas);
  const before=fake.drawn();
  for(let i=0;i<100;i++)assert.equal(store.getCanvas(),canvas);
  assert.equal(fake.drawn(),before,'repaint cannot accumulate dark pigment');
  assert.ok(store.isReplayCovered({
   actorId:'A',sourceKey:'video:take:99:2',clipStableId:'video:take',
   epoch:99,timeMs:2000,point:{x:1,y:1},confidence:.9,
   provenance:'video-estimate',evidence:'estimated-ground-projection',footEvent:'none'
  }));
  for(const e of t.cutAll('seek'))store.ingest(e,style);
  assert.equal(store.activeCount,0);
  assert.equal(store.getCanvas(),canvas);
  assert.ok(store.exportPNG());
  store.clearPainting();
  assert.equal(store.depositCount,0);
  assert.equal(store.getBounds(),null);
 }finally{fake.restore();}
});
test('30-minute accelerated two-actor stream retains bounded active-tail knots',()=>{
 const fake=fakeDocument();
 try{
  const r=new PathObservationRouter(),t=new ActorPathTracker(),store=new PersistentPathStore();
  for(let i=0;i<5406;i++){
   const ms=1000+i*333,x=.30+.05*Math.sin(i/28);
   for(const e of t.ingest(r.ingest(four(ms,x,'track:camera:soak:2')),ms))
    store.ingest(e,style);
  }
  assert.ok(store.depositCount>300);
  assert.equal(store.activeCount,2);
  assert.ok(store.diagnostics.atlasBytes<=1600*900*4*3);
  assert.ok(store.exportPNG());
 }finally{fake.restore();}
});

test('v3.5.1: planted foot resists a 320px swinging-foot excursion',()=>{
 const r=new PathObservationRouter();
 const first=r.ingest([pose('A','left',.20,1000),pose('A','right',.22,1000)])[0];
 const swing=r.ingest([pose('A','left',.20,1100),pose('A','right',.42,1100)])[0];
 assert.equal(swing.supportFoot,'left');
 assert.equal(swing.evidence,'estimated-ground-projection');
 assert.ok(Math.abs(swing.point.x-first.point.x)<12,
  'a swinging foot must not drag the path center or cause a false teleport');
 const returned=r.ingest([pose('A','left',.20,1200),pose('A','right',.42,1200)])[0];
 assert.ok(Math.abs(returned.point.x-swing.point.x)<6);
});
test('v3.5.1: irregular video frames bridge only coherent short gaps',()=>{
 const r=new PathObservationRouter(),t=new ActorPathTracker();
 t.ingest(r.ingest(four(1000,.20)),1000);
 const forward=t.ingest(r.ingest(four(1100,.22)),1100);
 assert.equal(forward.filter(e=>e.kind==='ADD').length,2);
 const gap=t.ingest(r.ingest(four(1700,.27)),1700);
 assert.equal(gap.filter(e=>e.kind==='CUT').length,0,
  '600ms MP4 inference gap with same direction must not automatically cut');
 assert.ok(gap.some(e=>e.kind==='ADD'));
 const long=t.ingest(r.ingest(four(2900,.31)),2900);
 assert.equal(long.filter(e=>e.kind==='CUT').length,2,
  'more than 900ms without evidence must cut each actor');
});
test('v3.5.1: lost identity or source swap cannot connect two actors',()=>{
 const r=new PathObservationRouter(),t=new ActorPathTracker();
 t.ingest(r.ingest(four(1000,.2)),1000);
 const swapped=t.ingest(r.ingest(four(1100,.8)),1100);
 assert.ok(swapped.some(e=>e.kind==='CUT'));
 assert.ok(swapped.every(e=>e.kind!=='ADD'&&e.kind!=='TURN'));
});
test('v3.5.1: full mesh painter fills joined polygon, without per-knot stroke',async()=>{
 const {paintDirectionalRibbon}=await import('../src/footprints/lines/v3/DirectionalInkPainter.ts');
 const knots:PathKnot=[
  {point:{x:20,y:20},timeMs:0,confidence:1},
  {point:{x:50,y:20},timeMs:80,confidence:1},
  {point:{x:70,y:35},timeMs:160,confidence:1}
 ];
 const pts=samplePathSegment(knots,1,30,3);
 const mesh=buildPathRibbon(pts,{weightPx:26,material:'pigment-mass'},60,false)!;
 let strokes=0,fills=0,vertices=0;
 const ctx={
  save(){},restore(){},beginPath(){},moveTo(){},lineTo(){vertices++;},
  closePath(){},arc(){},clip(){},fill(){fills++;},stroke(){strokes++;},
  set fillStyle(_x:string){},set strokeStyle(_x:string){},
  set lineWidth(_n:number){},set lineJoin(_n:string){},set lineCap(_n:string){},
  set globalAlpha(_n:number){}
 };
 paintDirectionalRibbon(ctx as unknown as CanvasRenderingContext2D,mesh,
  {color:'#242424',weightPx:26,material:'pigment-mass',accents:'off',seed:42});
 assert.ok(vertices>5);
 assert.ok(fills>=1);
 assert.equal(strokes,0,'pigment mesh must be a joined fill rather than strokes');
});
