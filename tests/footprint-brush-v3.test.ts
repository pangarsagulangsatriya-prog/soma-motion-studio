import {test} from 'node:test';
import assert from 'node:assert/strict';
import {FootLineTrailEngine} from '../src/footprints/lines/FootLineTrailEngine.ts';
import {FootprintBrushEngine} from '../src/footprints/lines/FootprintBrushEngine.ts';
import {paintLineTrails,DEFAULT_LINE_TRAILS_OPTIONS} from '../src/footprints/lines/LineTrailCanvasRenderer.ts';
import type {FootMotionEventV2} from '../src/footprints/scenes/FootMotionEventV2.ts';

const sample=(x:number,y:number,atMs:number,foot:'left'|'right'='left')=>({
 sessionId:'s',generation:1,source:'video' as const,actorId:'performer-1',
 foot,x,y,atMs,confidence:1,coordinateBasis:'image-2d' as const,
 headingRad:Math.PI/6
});
const event:FootMotionEventV2={
 schema:'soma.foot-motion-event',version:2,
 eventId:'contact-1',originEventId:'contact-1',sessionId:'s',generation:1,
 actorId:'performer-1',foot:'left',kind:'contact',source:'video',x:.4,y:.3,
 atMs:1000,speed:0,confidence:.9,verified:true,
 verification:'video-estimate',coordinateBasis:'image-2d',headingRad:.3
};
test('Footprint Brush V3: sweep stamps by traveled distance, not frame count or rest',()=>{
 const lines=new FootLineTrailEngine(),brush=new FootprintBrushEngine();
 lines.ensureSource('mp4');
 lines.ingest([sample(.2,.3,1000)],1000);
 lines.ingest([sample(.32,.3,1033)],1033);
 lines.ingest([sample(.4,.34,1066)],1066);
 brush.ingestSweeps(lines.allStrokes,1066,52,.5,1600,900);
 assert.ok(brush.count>=1);
 const n=brush.count;
 brush.ingestSweeps(lines.allStrokes,1100,52,.5,1600,900);
 assert.equal(brush.count,n,'repainting same frames never deposits more stamps');
 lines.ingest([sample(.4001,.3401,1099)],1099);
 brush.ingestSweeps(lines.allStrokes,1100,52,.5,1600,900);
 assert.equal(brush.count,n,'stationary jitter must not paint');
 assert.ok(brush.allStamps.every(s=>s.mode==='sweep'&&s.foot==='left'));
});
test('Footprint Brush V3: verified contact only, stable identity and session, no duplicates',()=>{
 const brush=new FootprintBrushEngine();
 brush.ingestContacts([{...event,kind:'movement',verified:false}], 'all','s',1010);
 assert.equal(brush.count,0);
 brush.ingestContacts([{...event,actorId:'unassigned-0'}],'all','s',1010);
 assert.equal(brush.count,0);
 brush.ingestContacts([event],'B','s',1010);
 assert.equal(brush.count,0);
 brush.ingestContacts([event],'all','wrong-session',1010);
 assert.equal(brush.count,0);
 brush.ingestContacts([event,event],'all','s',1010);
 assert.equal(brush.count,1);
 assert.equal(brush.allStamps[0].mode,'step');
 assert.equal(brush.visible(11000,'fade',8000).length,0);
 assert.equal(brush.visible(11000,'keep').length,1);
 brush.clear();assert.equal(brush.count,0);
});
test('Footprint Brush V3: bounds memory and disconnect never teleports across strokes',()=>{
 const lines=new FootLineTrailEngine(),brush=new FootprintBrushEngine();
 lines.ensureSource('test');
 lines.ingest([sample(.2,.2,1000)],1000);
 lines.ingest([sample(.29,.22,1033)],1033);
 brush.ingestSweeps(lines.allStrokes,1033,20,.3);
 const existing=brush.count;
 lines.ingest([],1066);
 lines.ingest([sample(.8,.8,1100)],1100);
 brush.ingestSweeps(lines.allStrokes,1100,20,.3);
 assert.equal(brush.count,existing,'new disconnected stroke should not be linked to previous stroke');
 for(let i=0;i<1350;i++){
  brush.ingestContacts([{...event,eventId:'contact-'+i,atMs:1500+i*5}], 'all','s',1500+i*5);
 }
 assert.ok(brush.count<=brush.maxStamps);
});
test('Footprint Brush V3: renderer switches layers, dark/color channels and blackout',()=>{
 const lines=new FootLineTrailEngine(),brush=new FootprintBrushEngine();
 brush.ingestContacts([event],'all','s',1050);
 let footprintFills=0,backgrounds=0;
 const ctx={
  canvas:{width:1600,height:900},globalAlpha:1,fillStyle:'',strokeStyle:'',
  save(){},restore(){},setTransform(){},clearRect(){},
  fillRect(){backgrounds++;},beginPath(){},moveTo(){},lineTo(){},quadraticCurveTo(){},
  closePath(){},fill(){footprintFills++;},stroke(){},translate(){},rotate(){},
  scale(){},ellipse(){},setLineDash(){}
 } as unknown as CanvasRenderingContext2D;
 const settings={...DEFAULT_LINE_TRAILS_OPTIONS,showLines:false,
  brush:{enabled:true,mode:'step' as const,size:52,spacing:.58}};
 paintLineTrails(ctx,lines,settings,1060,false,brush.allStamps);
 assert.ok(footprintFills>0);
 const before=footprintFills;
 paintLineTrails(ctx,lines,{...settings,brush:{...settings.brush,enabled:false}},1060,false,brush.allStamps);
 assert.equal(footprintFills,before,'toggle OFF hides footprint layer');
 paintLineTrails(ctx,lines,settings,1060,true,brush.allStamps);
 assert.equal(footprintFills,before,'blackout never paints a footprint');
 assert.equal(backgrounds,3);
});
