import test from 'node:test';
import assert from 'node:assert/strict';
import {identityQuad,homography,transform,type Quad} from '../src/projection/geometry.ts';
import {projectionDefaults,ProjectionModel,projectionMatrix} from '../src/projection/model.ts';
import {floorArtworkProjectionConfig,floorCalibrationSignature,chooseFloorArtworkSource,simulatorArtworkState,canShowFloorArtwork} from '../src/projection/floorBridge.ts';
import {shouldTransmitArtwork} from '../src/projection/channel.ts';
import {defaultFloorSpace} from '../src/footprints/spatial/coordinates.ts';
import {createFloorSession,type FootstepEvent} from '../src/footprints/spatial/events.ts';
import {floorRasterPoint,paintFloorCanvas,FLOOR_RASTER} from '../src/footprints/simulator/floorCanvas.ts';
import {emptyFrame} from '../src/engine/types.ts';

const close=(a:number,b:number)=>assert.ok(Math.abs(a-b)<1e-7,`${a} vs ${b}`);
const quad:Quad=[{x:.08,y:.09},{x:.9,y:.07},{x:.95,y:.86},{x:.18,y:.94}];

test('floor coordinates map into a 16:9 raster exactly once before SOMA calibrated output',()=>{
 const floor=defaultFloorSpace(8,6);
 assert.deepEqual(floorRasterPoint(floor,{xM:0,yM:6}),{x:0,y:0});
 assert.deepEqual(floorRasterPoint(floor,{xM:8,yM:0}),{x:1280,y:720});
 assert.deepEqual(floorRasterPoint(floor,{xM:4,yM:3}),{x:640,y:360});
 const conf=projectionDefaults();
 conf.quad=quad;conf.mirror=true;conf.registration.enabled=true;
 conf.placement.rotation=45;conf.placement.scale=2;conf.placement.x=.1;
 const floorConfig=floorArtworkProjectionConfig(conf);
 assert.equal(floorConfig.mirror,false);
 assert.equal(floorConfig.registration.enabled,false);
 assert.equal(floorConfig.placement.rotation,0);
 assert.equal(floorConfig.placement.scale,1);
 assert.equal(floorConfig.mode,'screen');
 assert.deepEqual(conf.quad,quad);
 assert.equal(conf.registration.enabled,true); // stored config is not modified
 const image={mask:{width:1,height:1,data:new Uint8Array(1)},time:0,aspect:16/9};
 const matrix=projectionMatrix(floorConfig,image);
 const corners=identityQuad();
 for(let i=0;i<4;i++){
  const out=transform(matrix,corners[i]);close(out.x,quad[i].x);close(out.y,quad[i].y);
 }
 const point={x:.37,y:.62};
 const actual=transform(matrix,point);
 const expected=transform(homography(quad),point);
 close(actual.x,expected.x);close(actual.y,expected.y);
 const twice=transform(homography(quad),expected);
 assert.ok(Math.hypot(twice.x-actual.x,twice.y-actual.y)>.01);
});

test('confirmation fingerprint expires on floor quad and projector resolution changes',()=>{
 const c=projectionDefaults(),first=floorCalibrationSignature(c);
 assert.equal(first,floorCalibrationSignature({...c}));
 const altered={...c,quad:quad};
 assert.notEqual(first,floorCalibrationSignature(altered));
 assert.notEqual(first,floorCalibrationSignature({...c,resolution:'1080p'}));
 assert.throws(()=>floorArtworkProjectionConfig({...c,quad:[quad[0],quad[2],quad[1],quad[3]]}));
});

test('simulator owns output while its dialog is open, even before floor confirmation',()=>{
 assert.deepEqual(chooseFloorArtworkSource(true,false,true,true,true),{source:'simulator',canStream:false});
 assert.deepEqual(chooseFloorArtworkSource(true,true,false,true,true),{source:'simulator',canStream:false});
 assert.deepEqual(chooseFloorArtworkSource(true,true,true,true,true),{source:'simulator',canStream:true});
 assert.deepEqual(chooseFloorArtworkSource(false,false,false,true,true),{source:'live-footprints',canStream:true});
 assert.deepEqual(chooseFloorArtworkSource(false,false,false,false,false),{source:'none',canStream:false});
});

test('a simulator artwork has independent tracking state but respects shared transport and gate',()=>{
 const m=new ProjectionModel();m.setTransport('live');
 const sample=m.sample(emptyFrame(),'mouse',4/3,100);
 assert.equal(sample.blank,true); // main camera has no body
 const blocked=simulatorArtworkState(sample,false);
 assert.equal(blocked.blank,true);
 assert.equal(blocked.tracking,false);
 const live=simulatorArtworkState(sample,true);
 assert.equal(live.blank,false);assert.equal(live.tracking,true);
 assert.equal(live.config.mirror,false);
 assert.equal(live.image,null);
 const testCorners=simulatorArtworkState(sample,true,true);
 assert.match(testCorners.reason,/uji/i);
 m.setTransport('blackout');
 assert.equal(simulatorArtworkState(m.sample(emptyFrame(),'mouse',4/3,120),true).blank,true);
 assert.equal(canShowFloorArtwork(true,'live',false),true);
 assert.equal(canShowFloorArtwork(true,'hold',false),true); // retained bitmap visible
 assert.equal(canShowFloorArtwork(true,'blackout',false),false);
 assert.equal(canShowFloorArtwork(false,'live',false),false);
});

test('the artwork transport does not stream new frames during Hold, Blackout, or calibration grid',()=>{
 assert.equal(shouldTransmitArtwork({transport:'live',blank:false,pattern:false}),true);
 assert.equal(shouldTransmitArtwork({transport:'hold',blank:false,pattern:false}),false);
 assert.equal(shouldTransmitArtwork({transport:'blackout',blank:false,pattern:false}),false);
 assert.equal(shouldTransmitArtwork({transport:'live',blank:true,pattern:false}),false);
 assert.equal(shouldTransmitArtwork({transport:'live',blank:false,pattern:true}),false);
});

test('floor canvas draws only four corner alignment markers until permitted to show footprints',()=>{
 const log:string[]=[];
 const ctx={
  setTransform:()=>{},fillRect:()=>log.push('background'),beginPath:()=>{},moveTo:()=>{},
  quadraticCurveTo:()=>{},closePath:()=>{},lineTo:()=>{},stroke:()=>log.push('stroke'),strokeRect:()=>log.push('outline'),
  fillText:(str:string)=>log.push('label-'+str),save:()=>{},restore:()=>{},
  translate:()=>{},rotate:()=>{},scale:()=>{},fill:()=>{},ellipse:()=>log.push('toe')
 };
 const c={width:0,height:0,getContext:()=>ctx} as unknown as HTMLCanvasElement;
 const f=defaultFloorSpace(8,6),session=createFloorSession(f);
 paintFloorCanvas(c,session,{markersOnly:true});
 assert.equal(c.width,FLOOR_RASTER.width);
 assert.equal(c.height,FLOOR_RASTER.height);
 assert.ok(log.includes('background'));
 for(let i=1;i<=4;i++)assert.ok(log.includes('label-'+i));
 assert.equal(log.filter(x=>x==='toe').length,0);
 const e:FootstepEvent={
  id:'sim-1',performerId:'A',foot:'left',kind:'contact',timestampMs:1,
  positionM:{xM:4,yM:3},headingRad:Math.PI/2,
  source:'simulation',positionBasis:'simulated',confidence:1
 };
 paintFloorCanvas(c,createFloorSession(f,[e]),{showGrid:false});
 assert.equal(log.filter(x=>x==='toe').length,5);
});
