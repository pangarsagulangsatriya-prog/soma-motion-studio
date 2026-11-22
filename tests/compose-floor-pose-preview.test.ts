import {test} from 'node:test';
import assert from 'node:assert/strict';
import {ComposeFloorPosePreview,useComposeFloorPoseFallback}
 from '../src/studio/v3/ComposeFloorPosePreview.ts';
import type {FootLineSample} from '../src/footprints/lines/FootLineSampleAdapter.ts';

const foot=(side:'left'|'right',x:number,y:number,atMs:number):FootLineSample=>({
 foot:side,x,y,atMs,sessionId:'phone-1',generation:0,actorId:'performer-1',
 source:'phone',confidence:.98,headingRad:.42,coordinateBasis:'image-2d'
});
const base={
 softwareMonitor:true,previewLive:true,blackout:false,lineTrails:false,
 liquidEnabled:true,liquidMode:'track' as const,
 timelineMode:'live' as const,verifiedImprints:0
};
function mockCtx(){
 let fills=0,labels:string[]=[];
 const canvas={width:960,height:540};
 const ctx={
  canvas,globalAlpha:1,globalCompositeOperation:'source-over',
  fillStyle:'',strokeStyle:'',font:'',
  save(){},restore(){},translate(){},rotate(){},scale(){},
  beginPath(){},moveTo(){},quadraticCurveTo(){},lineTo(){},
  closePath(){},ellipse(){},fill(){fills++;},stroke(){},
  fillText(label:string){labels.push(label);}
 } as unknown as CanvasRenderingContext2D;
 return {ctx,get fills(){return fills;},get labels(){return labels;}};
}
test('Liquid Imprint receives no verified contact: camera still shows 2D preview',()=>{
 assert.equal(useComposeFloorPoseFallback(base),true);
 const preview=new ComposeFloorPosePreview();
 const ctx=mockCtx();
 preview.ingest([foot('left',.34,.74,1000),foot('right',.42,.79,1000)],1000,'phone:session-1');
 assert.equal(preview.activeFeet,2);
 assert.equal(preview.count,2);
 assert.equal(preview.paint(ctx.ctx,1010,960,540),true);
 assert.ok(ctx.fills>=12,'both anatomical soles and 10 toes appear');
 assert.ok(ctx.labels.includes('JEJAK 2D · PREVIEW'));
});
test('No duplicated stamps while stationary or on repeated camera frames',()=>{
 const p=new ComposeFloorPosePreview();
 for(let i=0;i<24;i++){
  p.ingest([foot('left',.34+i*.00008,.73,1000+i*33),
   foot('right',.42,.76,1000+i*33)],1000+i*33,'phone:same');
 }
 assert.equal(p.count,2);
 p.ingest([foot('left',.3402,.73,1759)],1800,'phone:same');
 assert.equal(p.count,2);
 p.ingest([foot('left',.41,.73,1850)],1850,'phone:same');
 assert.equal(p.count,3,'a real displaced foot can leave another image-space mark');
});
test('Camera switch, stale input and tracking dropout cannot fake new footprints',()=>{
 const p=new ComposeFloorPosePreview(),ctx=mockCtx();
 p.ingest([foot('left',.35,.65,1000)],1000,'phone:one');
 p.ingest([],1700,'phone:one');
 assert.equal(p.activeFeet,0);
 assert.equal(p.count,1);
 p.ingest([],11000,'phone:one');
 assert.equal(p.count,0,'old ink fades after nine seconds');
 assert.equal(p.paint(ctx.ctx,11000,960,540),false);
 p.ingest([foot('left',.2,.4,2200)],2200,'camera:two');
 assert.equal(p.count,1);
 p.ingest([foot('right',.8,.6,2400)],2400,'video:clip');
 assert.equal(p.count,1,'previous camera print must not transfer to MP4');
});
test('Physical gates, blackout, Demo, verified contacts and replay skip the 2D fallback',()=>{
 assert.equal(useComposeFloorPoseFallback({...base,softwareMonitor:false}),false);
 assert.equal(useComposeFloorPoseFallback({...base,blackout:true}),false);
 assert.equal(useComposeFloorPoseFallback({...base,previewLive:false}),false);
 assert.equal(useComposeFloorPoseFallback({...base,lineTrails:true}),false);
 assert.equal(useComposeFloorPoseFallback({...base,liquidEnabled:false}),false);
 assert.equal(useComposeFloorPoseFallback({...base,liquidMode:'demo'}),false);
 assert.equal(useComposeFloorPoseFallback({...base,timelineMode:'replay'}),false);
 assert.equal(useComposeFloorPoseFallback({...base,verifiedImprints:1}),false);
});
