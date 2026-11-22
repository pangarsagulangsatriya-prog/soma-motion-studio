import {test} from 'node:test';
import assert from 'node:assert/strict';
import {ActiveFootSelector} from '../src/footprints/lines/ActiveFootSelector.ts';
import {FootLineTrailEngine} from '../src/footprints/lines/FootLineTrailEngine.ts';
import {FootprintBrushEngine} from '../src/footprints/lines/FootprintBrushEngine.ts';
import {paintLineTrails,DEFAULT_LINE_TRAILS_OPTIONS} from '../src/footprints/lines/LineTrailCanvasRenderer.ts';
import {footSamplesFromPose} from '../src/footprints/lines/FootLineSampleAdapter.ts';
import type {FootLineSample} from '../src/footprints/lines/FootLineSampleAdapter.ts';
type Side='left'|'right';
const foot=(side:Side,x:number,y:number,atMs:number,actorId='performer-1'):FootLineSample=>({
 foot:side,x,y,atMs,actorId,confidence:.95,headingRad:.52,
 sessionId:'test',generation:0,source:'video',coordinateBasis:'image-2d'
});
test('One person with two tracked feet produces exactly one path and one sole-head',()=>{
 const one=new ActiveFootSelector(),lines=new FootLineTrailEngine(),brush=new FootprintBrushEngine();
 lines.ensureSource('camera-1');
 for(let i=0;i<12;i++){
  const now=1000+i*33;
  const selected=one.select([foot('left',.2+.012*i,.4,now),
   foot('right',.72,.62,now)]);
  assert.equal(selected.length,1,'two feet should be observations of one performer');
  lines.ingest(selected,now);
  brush.ingestSweeps(lines.allStrokes,now,52,.58,1600,900);
 }
 assert.equal(lines.allStrokes.length,1,'one performer keeps one brush path');
 assert.equal(brush.sweepCount,1,'foot sole exists once at the tip, not each frame');
 const path=lines.allStrokes[0];
 assert.equal(path.foot,'left');
 assert.ok(path.points.length>5);
 const mark=brush.allStamps[0];
 assert.ok(Math.abs(mark.headingRad-.52)<.2,'heel-toe direction reaches brush');
 assert.ok(Math.abs(mark.x-path.points.at(-1)!.x)<1e-7);
 const displayed=lines.renderVisible(1390,'keep',8000,55)[0];
 assert.ok(displayed?.points.at(-1)?.headingRad!==undefined);
 assert.ok(Math.abs(displayed.points.at(-1)!.headingRad!-.52)<.2,
  'interpolated brush follows heel-to-toe rather than motion tangent');
});
test('Switch active foot only after sustained observed alternate movement; do not teleport',()=>{
 const one=new ActiveFootSelector(),lines=new FootLineTrailEngine(),brush=new FootprintBrushEngine();
 lines.ensureSource('camera-2');
 for(let i=0;i<5;i++){
  const at=1000+i*33,chosen=one.select([
   foot('left',.2+.009*i,.3,at),foot('right',.7,.6,at)]);
  lines.ingest(chosen,at);
 }
 for(let i=0;i<8;i++){
  const at=1165+i*33,chosen=one.select([
   foot('left',.236,.3,at),foot('right',.7-.012*i,.6,at)]);
  if(chosen.length)lines.ingest(chosen,at);
 }
 brush.ingestSweeps(lines.allStrokes,1400);
 assert.ok(lines.allStrokes.some(s=>s.foot==='right'),
  'stable movement of second foot eventually takes over');
 assert.equal(lines.allStrokes.filter(s=>s.foot==='left').length,1);
 assert.equal(lines.allStrokes.filter(s=>s.foot==='right').length,1);
 assert.ok(brush.sweepCount<=2,'one sole head per separate motion pass');
 const paths=lines.allStrokes;
 assert.ok(Math.abs(paths[0].points.at(-1)!.x-paths[1].points[0].x)>.2,
  'foot switching never draws a joining teleport line');
 const n=brush.sweepCount;
 one.select([]);
 lines.ingest([],1500);
 brush.ingestSweeps(lines.allStrokes,1500);
 assert.equal(brush.sweepCount,n,'lost tracking cannot invent fresh marks');
});
test('Heel-toe vector changes the orientation of the anatomical brush',()=>{
 const pose=Array.from({length:33},()=>({x:.4,y:.4,visibility:0}));
 pose[29]={x:.3,y:.7,visibility:1};
 pose[31]={x:.37,y:.48,visibility:1};
 const stamps=footSamplesFromPose(pose,{
  sessionId:'s',generation:1,source:'video',actorId:'A',atMs:1000,
  coordinateBasis:'image-2d'
 });
 assert.equal(stamps.length,1);
 assert.equal(stamps[0].foot,'left');
 assert.ok((stamps[0].headingRad??0)>.1);
});
test('One continuous brush path and exactly one anatomical sole at the moving tip',()=>{
 const lines=new FootLineTrailEngine(),brush=new FootprintBrushEngine(),one=new ActiveFootSelector();
 lines.ensureSource('demo');
 for(let i=0;i<20;i++){
  const at=1000+i*33;
  const selected=one.select([foot('left',.15+i*.013,.4+i*.002,at),
   foot('right',.8,.7,at)]);
  lines.ingest(selected,at);
  brush.ingestSweeps(lines.allStrokes,at);
 }
 let fills=0,strokes=0;
 const ctx={
  canvas:{width:1600,height:900},globalAlpha:1,fillStyle:'',strokeStyle:'',lineWidth:1,
  save(){},restore(){},setTransform(){},clearRect(){},fillRect(){},
  beginPath(){},moveTo(){},lineTo(){},quadraticCurveTo(){},
  closePath(){},fill(){fills++;},stroke(){strokes++;},
  translate(){},rotate(){},scale(){},ellipse(){},setLineDash(){}
 } as unknown as CanvasRenderingContext2D;
 paintLineTrails(ctx,lines,{...DEFAULT_LINE_TRAILS_OPTIONS,showLines:false,
  brush:{enabled:true,mode:'sweep',size:52,spacing:.5}},1800,false,brush.allStamps);
 assert.equal(brush.sweepCount,1);
 assert.equal(fills,6,'sole outline plus five toes painted once only');
 assert.equal(strokes,2,'single continuous trace with two soft passes');
 const before=fills;
 paintLineTrails(ctx,lines,{...DEFAULT_LINE_TRAILS_OPTIONS,showLines:false,
  brush:{enabled:false,mode:'sweep',size:52,spacing:.5}},1800,false,brush.allStamps);
 assert.equal(fills,before);
});
