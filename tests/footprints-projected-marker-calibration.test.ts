import test from 'node:test';
import assert from 'node:assert/strict';
import {correspondence,identityQuad,transform,type Quad} from '../src/projection/geometry.ts';
import {FLOOR_MARKERS} from '../src/stage/GuidedSetupEngine.ts';
import {PROJECTED_FIDUCIAL_UV,differentialProjectedScan,
 recoverProjectedFloorQuad,resolveProjectedMatch} from '../src/stage/ProjectedMarkerCalibration.ts';

const width=320,height=180;
const expected:Quad=[
 {x:.12,y:.11},{x:.86,y:.14},{x:.83,y:.88},{x:.16,y:.86}
];
const make=(display=true,unchangedProp=false)=>{
 const base=new Uint8ClampedArray(width*height*4);
 const lit=new Uint8ClampedArray(width*height*4);
 for(let i=0;i<base.length;i+=4){
  base[i]=base[i+1]=base[i+2]=12;base[i+3]=255;
  lit[i]=lit[i+1]=lit[i+2]=12;lit[i+3]=255;
 }
 const draw=(buffer:Uint8ClampedArray,px:number,py:number,hex:string,radius=12)=>{
  const rgb=[1,3,5].map(s=>parseInt(hex.slice(s,s+2),16));
  for(let y=0;y<height;y++)for(let x=0;x<width;x++){
   if(Math.hypot(x-px,y-py)>radius)continue;
   const n=(y*width+x)*4;
   buffer[n]=rgb[0];buffer[n+1]=rgb[1];buffer[n+2]=rgb[2];
  }
 };
 const homography=correspondence(identityQuad(),expected);
 if(unchangedProp){
  draw(base,160,85,FLOOR_MARKERS[0].hex,24);
  draw(lit,160,85,FLOOR_MARKERS[0].hex,24);
 }
 if(display)PROJECTED_FIDUCIAL_UV.forEach((p,i)=>{
  const camera=transform(homography,p);
  draw(lit,Math.round(camera.x*width),Math.round(camera.y*height),FLOOR_MARKERS[i].hex);
 });
 return {base,lit};
};
test('S6.2: four unique projected markers recover physical camera quad by homography',()=>{
 const {base,lit}=make();
 const scans=Array.from({length:5},()=>differentialProjectedScan(lit,base,width,height));
 const match=resolveProjectedMatch(scans);
 assert.equal(match.scans,5);
 assert.equal(match.method,'projected-four-color');
 assert.ok(match.confidence>.2);
 assert.equal(match.markerQuad.length,4);
 match.cameraQuad.forEach((p,i)=>{
  assert.ok(Math.abs(p.x-expected[i].x)<.025,
   'camera X for corner '+i+': '+p.x);
  assert.ok(Math.abs(p.y-expected[i].y)<.025,
   'camera Y for corner '+i+': '+p.y);
 });
});
test('S6.2: unchanged coloured props are rejected by Blackout baseline subtraction',()=>{
 const {base,lit}=make(false,true);
 assert.throws(()=>differentialProjectedScan(lit,base,width,height),/Cahaya marker/);
});
test('S6.2: missing marker and invalid camera dimensions cannot pass',()=>{
 const {base,lit}=make();
 const wrong=lit.slice();
 for(let i=0;i<wrong.length;i+=4){
  // Suppress cyan completely.
  if(wrong[i]<100&&wrong[i+1]>150&&wrong[i+2]>150){
   wrong[i]=wrong[i+1]=wrong[i+2]=12;
  }
 }
 assert.throws(()=>differentialProjectedScan(wrong,base,width,height),/Empat marker/);
 assert.throws(()=>differentialProjectedScan(lit,base,0,height),/ukuran berbeda/);
});
test('S6.2: low-confidence, unstable scan or out-of-frame extrapolation must fail',()=>{
 const {base,lit}=make();
 const scan=differentialProjectedScan(lit,base,width,height);
 assert.throws(()=>resolveProjectedMatch([scan,scan,scan]),/Minimal empat/);
 const moved={...scan,quad:scan.quad.map(p=>({x:p.x+.055,y:p.y})) as Quad};
 assert.throws(()=>resolveProjectedMatch([scan,scan,scan,scan,moved]),/bergeser/);
 const dim={...scan,confidence:.1};
 assert.throws(()=>resolveProjectedMatch(Array(5).fill(dim)),/redup/);
 const edge:Quad=[
  {x:.012,y:.012},{x:.988,y:.012},{x:.988,y:.988},{x:.012,y:.988}
 ];
 assert.throws(()=>recoverProjectedFloorQuad(edge),/keluar bingkai/);
});
