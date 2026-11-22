import {test} from 'node:test';
import assert from 'node:assert/strict';
import {DualFootTrajectoryEngine} from '../src/footprints/lines/v3/DualFootTrajectoryEngine.ts';
import {paintTrajectory,DEFAULT_V3_SETTINGS} from '../src/footprints/lines/v3/TrajectoryRenderer.ts';
import type {FootV3Sample} from '../src/footprints/lines/v3/FootPositionResolver.ts';

function foot(side:'left'|'right',x:number,y:number,ms:number):FootV3Sample{
 return {sessionId:'fixture',generation:0,source:'video',actorId:'A',foot:side,
  x,y,atMs:ms,confidence:.95,anchor:'heel-toe-center',
  coordinateBasis:'image-2d'};
}
type Recorded={color:string;segments:readonly number[][];alpha:number};
function fakeContext(){
 const recorded:Recorded[]=[];
 let path:number[][]=[];
 const ctx={
  canvas:{width:1600,height:900},globalAlpha:1,
  strokeStyle:'#000000',fillStyle:'#ffffff',lineWidth:1,lineCap:'round',lineJoin:'round',
  save(){},restore(){},setTransform(){},clearRect(){},fillRect(){},
  setLineDash(_value:number[]){},
  beginPath(){path=[];},
  moveTo(x:number,y:number){path.push([x,y]);},
  lineTo(x:number,y:number){path.push([x,y]);},
  stroke(){recorded.push({color:this.strokeStyle,segments:path.map(p=>p.slice()),alpha:this.globalAlpha});},
  arc(){},fill(){}
 };
 return {ctx:ctx as unknown as CanvasRenderingContext2D,recorded};
}

test('V3 keeps 90-degree corners as exact observed polyline, no midpoint curve',()=>{
 const e=new DualFootTrajectoryEngine();e.ensureSource('fixture');
 e.ingestFrame([foot('left',.2,.3,1000),foot('right',.7,.7,1000)],1000,1002);
 e.ingestFrame([foot('left',.3,.3,1033),foot('right',.7,.68,1033)],1033,1035);
 e.ingestFrame([foot('left',.3,.4,1066),foot('right',.7,.64,1066)],1066,1067);
 const {ctx,recorded}=fakeContext();
 paintTrajectory(ctx,e,{...DEFAULT_V3_SETTINGS,styleMode:'precision'},1100);
 const red=recorded.filter(x=>x.color==='#E44F32');
 assert.equal(red.length,4); // both feet of actor A are red
 assert.deepEqual(red[0].segments,[[320,270],[480,270]]);
 assert.deepEqual(red[1].segments,[[480,270],[480,360]]);
});

test('fullscreen and Compose preview use identical trajectory geometry',()=>{
 const e=new DualFootTrajectoryEngine();e.ensureSource('fixture');
 e.ingestFrame([foot('left',.2,.3,1000)],1000,1000);
 e.ingestFrame([foot('left',.25,.34,1033)],1033,1033);
 e.ingestFrame([foot('left',.30,.36,1066)],1066,1066);
 const preview=fakeContext(),fullscreen=fakeContext();
 paintTrajectory(preview.ctx,e,DEFAULT_V3_SETTINGS,1040,false,false);
 paintTrajectory(fullscreen.ctx,e,DEFAULT_V3_SETTINGS,1040,false,true);
 assert.deepEqual(preview.recorded,fullscreen.recorded);
});

test('blackout remains fully blank and renders no line segments',()=>{
 const e=new DualFootTrajectoryEngine();e.ensureSource('fixture');
 e.ingestFrame([foot('left',.2,.3,1000)],1000,1000);
 e.ingestFrame([foot('left',.25,.3,1033)],1033,1033);
 const {ctx,recorded}=fakeContext();
 paintTrajectory(ctx,e,DEFAULT_V3_SETTINGS,1100,true,true);
 assert.equal(recorded.length,0);
});
