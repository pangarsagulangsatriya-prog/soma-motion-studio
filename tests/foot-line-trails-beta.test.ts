import {test} from 'node:test';
import assert from 'node:assert/strict';
import {emptyFrame,type Landmark} from '../src/engine/types.ts';
import {footSamplesFromPose,footSamplesFromLive,demoFootSamples} from '../src/footprints/lines/FootLineSampleAdapter.ts';
import {FootLineTrailEngine} from '../src/footprints/lines/FootLineTrailEngine.ts';
import {DEFAULT_LINE_TRAILS_OPTIONS,paintLineTrails} from '../src/footprints/lines/LineTrailCanvasRenderer.ts';

const point=(x:number,y:number,visibility=1):Landmark=>({x,y,z:0,visibility});
const pose=()=>{
 const result=Array.from({length:33},()=>point(-1,-1,0));
 result[27]=point(.30,.65);result[28]=point(.65,.67);
 result[29]=point(.28,.67);result[30]=point(.66,.69);
 result[31]=point(.32,.71);result[32]=point(.70,.72);
 return result;
};
const metadata={
 sessionId:'live-1',generation:1,source:'camera' as const,
 actorId:'performer-1',atMs:1000,coordinateBasis:'image-2d' as const
};
test('Line Trails: observed left and right feet are independent; torso is ignored',()=>{
 const pair=footSamplesFromPose(pose(),metadata);
 assert.equal(pair.length,2);
 assert.equal(pair[0].foot,'left');assert.equal(pair[1].foot,'right');
 assert.ok(Math.abs(pair[0].x-.30)<1e-10);assert.ok(Math.abs(pair[1].x-.68)<1e-10);
 assert.equal(footSamplesFromPose([point(.2,.2)],metadata).length,0);
 const one=pose();one[29]=point(-1,-1,0);one[31]=point(-1,-1,0);
 assert.equal(footSamplesFromPose(one,metadata).length,2,'visible ankle fallback allowed');
 one[27]=point(-1,-1,0);
 assert.deepEqual(footSamplesFromPose(one,metadata).map(x=>x.foot),['right']);
});
test('Line Trails: router blocks ambiguous or mismatched two-performer identities',()=>{
 const f={...emptyFrame(),tracked:true,time:1000,pose:pose(),poses:[pose(),pose()]};
 const base={mode:2 as const,visible:['A','B'] as ('A'|'B')[],
  ambiguous:false,reason:'',ghostCount:0,poseIndices:{A:0,B:1},observedFrameTime:1000};
 assert.equal(footSamplesFromLive(f,base,2,'camera','s',1,'A').length,2);
 assert.equal(footSamplesFromLive(f,{...base,ambiguous:true},2,'camera','s',1,'A').length,0);
 assert.equal(footSamplesFromLive(f,{...base,observedFrameTime:999},2,'camera','s',1,'A').length,0);
});
test('Line Trails: demo samples are deterministic and tagged SIMULASI',()=>{
 const a=demoFootSamples(1700,1000),b=demoFootSamples(1700,1000);
 assert.deepEqual(a,b);assert.equal(a.length,2);
 assert.ok(a.every(x=>x.actorId==='DEMO'&&x.source==='simulator'));
});
const sample=(foot:'left'|'right',x:number,y:number,atMs:number)=>({
 ...metadata,foot,x,y,atMs,confidence:1
});
test('Line Trails: no scribble at rest, no teleport after tracking loss, source change safe',()=>{
 const engine=new FootLineTrailEngine();
 engine.ensureSource('camera:one');
 engine.ingest([sample('left',.2,.3,1000),sample('right',.8,.3,1000)],1000);
 engine.ingest([sample('left',.3,.4,1033),sample('right',.75,.4,1033)],1033);
 assert.equal(engine.visible(1040,'keep').length,2);
 const before=engine.sampleCount;
 engine.ingest([sample('left',.3001,.4001,1066),sample('right',.7501,.4001,1066)],1066);
 assert.equal(engine.sampleCount,before,'static feet do not create new points');
 engine.ingest([],1099);
 engine.ingest([sample('left',.7,.8,1130)],1130);
 assert.equal(engine.visible(1140,'keep').length,2,'new stroke starts separate');
 engine.ingest([sample('left',.75,.83,1163)],1163);
 assert.equal(engine.visible(1170,'keep').length,3);
 engine.ensureSource('camera:two');
 engine.ingest([sample('left',.1,.1,1196)],1196);
 assert.equal(engine.visible(1200,'keep').length,3);
 engine.clear();assert.equal(engine.sampleCount,0);
});
test('Line Trails: fade hides old strokes and memory cap stays bounded',()=>{
 const engine=new FootLineTrailEngine();
 engine.ensureSource('demo');
 for(let i=0;i<7000;i++){
  engine.ingest([sample('left',.3+(i%8)*.014,.5,1000+i*33)],1000+i*33);
 }
 assert.ok(engine.sampleCount<=engine.maxPoints);
 assert.ok(engine.allStrokes.length<=engine.maxStrokes);
 assert.equal(engine.visible(400000,'fade').length,0);
 assert.ok(engine.visible(400000,'keep').length>0);
});
test('Line Trails: blackout paints only black, colored strokes use independent channels',()=>{
 const engine=new FootLineTrailEngine();engine.ensureSource('a');
 engine.ingest([sample('left',.2,.2,1000),sample('right',.8,.8,1000)],1000);
 engine.ingest([sample('left',.25,.25,1033),sample('right',.75,.75,1033)],1033);
 const fills:string[]=[],strokes:string[]=[];
 const ctx={
  canvas:{width:1600,height:900},strokeStyle:'',fillStyle:'',
  save(){},restore(){},setTransform(){},clearRect(){},
  fillRect(){fills.push(this.fillStyle);},beginPath(){},
  moveTo(){},lineTo(){},quadraticCurveTo(){},
  stroke(){strokes.push(this.strokeStyle);}
 } as unknown as CanvasRenderingContext2D;
 paintLineTrails(ctx,engine,DEFAULT_LINE_TRAILS_OPTIONS,1100,false);
 assert.ok(strokes.includes('#F34725')&&strokes.includes('#1D1D1D'));
 const count=strokes.length;
 paintLineTrails(ctx,engine,DEFAULT_LINE_TRAILS_OPTIONS,1100,true);
 assert.equal(strokes.length,count);
 assert.equal(fills.at(-1),'#000000');
});

test('Line Trails V2: motion smoothing is adjustable, while source points remain bounded',()=>{
 const exercise=(mode:'responsive'|'smooth'|'silky')=>{
  const engine=new FootLineTrailEngine();engine.ensureSource('mp4');
  engine.ingest([sample('left',.2,.3,1000)],1000,mode);
  engine.ingest([sample('left',.28,.37,1033)],1033,mode);
  engine.ingest([sample('left',.35,.42,1066)],1066,mode);
  return engine.allStrokes[0].points.at(-1)!;
 };
 const fast=exercise('responsive'),fine=exercise('silky');
 assert.ok(fast.x>fine.x,'responsive should follow the observed foot sooner');
 assert.ok(fast.x<=.35&&fine.x>=.2,'filter must stay inside observed x range');
});
test('Line Trails V2: 60 FPS display interpolates only observed segments',()=>{
 const engine=new FootLineTrailEngine();engine.ensureSource('video');
 engine.ingest([sample('left',.2,.2,1000)],1000);
 engine.ingest([sample('left',.3,.3,1033)],1033);
 const early=engine.renderVisible(1050,'keep',8000,55)[0];
 assert.equal(early,undefined,'reveal stays hidden until the first observed point');
 const later=engine.renderVisible(1070,'keep',8000,55)[0];
 assert.ok(later&&later.points.length===2,'partial observed stroke is rendered');
 assert.ok(later.points[1].x>=.2);
 assert.ok(later.points[1].x<=engine.allStrokes[0].points[1].x,'never extrapolates beyond last position');
});
test('Line Trails V2: all styles paint the same observed history, blackout stops them all',()=>{
 const engine=new FootLineTrailEngine();engine.ensureSource('source');
 engine.ingest([sample('left',.2,.3,1000),sample('right',.8,.7,1000)],1000);
 engine.ingest([sample('left',.3,.4,1033),sample('right',.7,.6,1033)],1033);
 const seen:Record<string,number>={};
 const ctx={
  canvas:{width:1600,height:900},fillStyle:'',strokeStyle:'',lineWidth:1,globalAlpha:1,
  save(){},restore(){},setTransform(){},clearRect(){},fillRect(){},
  beginPath(){},moveTo(){},lineTo(){},quadraticCurveTo(){},
  stroke(){seen[this.strokeStyle]=(seen[this.strokeStyle]??0)+1;}
 } as unknown as CanvasRenderingContext2D;
 for(const style of ['ink','contour','ribbon','fiber'] as const){
  seen['#F34725']=0;seen['#1D1D1D']=0;
  paintLineTrails(ctx,engine,{...DEFAULT_LINE_TRAILS_OPTIONS,style},1100);
  assert.ok(seen['#F34725']>0&&seen['#1D1D1D']>0,style);
  if(style==='fiber')assert.ok(seen['#F34725']>=5,'fiber uses multiple anchored strands');
 }
 seen['#F34725']=0;seen['#1D1D1D']=0;
 paintLineTrails(ctx,engine,{...DEFAULT_LINE_TRAILS_OPTIONS,style:'fiber'},1100,true);
 assert.equal(seen['#F34725']+seen['#1D1D1D'],0);
});
