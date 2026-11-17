import test from 'node:test';
import assert from 'node:assert/strict';
import {FLOOR_MARKERS,scanFloorMarkers,combineStableMarkerScans,
 guidedSetupReadiness,canVisitGuidedStep,type ReadinessInput} from '../src/stage/GuidedSetupEngine.ts';

const width=320,height=180;
const makeFrame=()=>{
 const image=new Uint8ClampedArray(width*height*4);
 const fill=(x:number,y:number,color:string)=>{
  const r=parseInt(color.slice(1,3),16),g=parseInt(color.slice(3,5),16),
   b=parseInt(color.slice(5,7),16);
  for(let cy=y-9;cy<y+9;cy++)for(let cx=x-9;cx<x+9;cx++){
   const i=(cy*width+cx)*4;
   image[i]=r;image[i+1]=g;image[i+2]=b;image[i+3]=255;
  }
 };
 const points=[[45,32],[265,32],[260,151],[50,151]] as const;
 FLOOR_MARKERS.forEach((m,i)=>fill(points[i][0],points[i][1],m.hex));
 return image;
};
test('S6.1.3: four distinct floor markers produce ordered unmirrored camera corners',()=>{
 const result=scanFloorMarkers(makeFrame(),width,height);
 assert.equal(result.quad.length,4);
 const expected=[[45,32],[265,32],[260,151],[50,151]];
 for(let i=0;i<4;i++){
  assert.ok(Math.abs(result.quad[i].x-expected[i][0]/width)<.01);
  assert.ok(Math.abs(result.quad[i].y-expected[i][1]/height)<.01);
  assert.ok(result.counts[i]>200);
 }
 const stable=combineStableMarkerScans(Array.from({length:5},()=>result));
 assert.deepEqual(stable,result.quad);
});
test('S6.1.3: incomplete/invalid marker scan cannot silently approve floor geometry',()=>{
 const data=makeFrame();
 // Hide top-right corner.
 for(let y=20;y<50;y++)for(let x=250;x<280;x++){
  const i=(y*width+x)*4;
  data[i]=0;data[i+1]=0;data[i+2]=0;
 }
 assert.throws(()=>scanFloorMarkers(data,width,height),/Empat marker/);
 assert.throws(()=>scanFloorMarkers(data,10,10),/tidak valid/);
 const ok=scanFloorMarkers(makeFrame(),width,height);
 assert.throws(()=>combineStableMarkerScans([ok,ok,ok]),/Minimal empat/);
 const changed={...ok,quad:ok.quad.map(p=>({x:p.x+.06,y:p.y})) as typeof ok.quad};
 assert.throws(()=>combineStableMarkerScans([ok,ok,ok,changed]),/bergeser/);
});
const empty:ReadinessInput={
 cameraOn:false,bodySelected:true,frameFresh:false,source:'laptop',
 phoneActive:false,videoReady:false,floorConfirmed:false,cameraMatched:false,
 poseTracked:false,contacts:0,performers:1,visibleCount:0,
 identityAmbiguous:false,sameFrame:false,hasArchive:false,skipArchive:false,
 bodyPreview:false,floorPreview:false
};
test('S6.1.3: steps are locked until live camera, calibration and one actual contact',()=>{
 let input={...empty};
 let g=guidedSetupReadiness(input);
 assert.equal(canVisitGuidedStep(0,g),true);
 assert.equal(canVisitGuidedStep(1,g),false);
 assert.equal(canVisitGuidedStep(3,g),false);
 input={...input,cameraOn:true,frameFresh:true,videoReady:true};
 g=guidedSetupReadiness(input);
 assert.equal(g.source.ready,true);
 assert.equal(canVisitGuidedStep(1,g),true);
 assert.equal(canVisitGuidedStep(2,g),false);
 input={...input,floorConfirmed:true,cameraMatched:true};
 g=guidedSetupReadiness(input);
 assert.equal(g.calibration.ready,true);
 assert.equal(canVisitGuidedStep(2,g),true);
 assert.equal(g.tracking.ready,false);
 input={...input,poseTracked:true,contacts:3};
 g=guidedSetupReadiness(input);
 assert.equal(g.tracking.ready,true);
 assert.equal(canVisitGuidedStep(3,g),true);
 assert.equal(canVisitGuidedStep(4,g),false);
 input={...input,skipArchive:true,bodyPreview:true,floorPreview:true};
 g=guidedSetupReadiness(input);
 assert.equal(g.rehearsal.ready,true);
 assert.equal(canVisitGuidedStep(4,g),true);
});
test('S6.1.3: phone pairing and dual-performer identity block unsafe progression',()=>{
 const input:ReadinessInput={...empty,cameraOn:true,frameFresh:true,videoReady:true,
  source:'phone',phoneActive:false,floorConfirmed:true,cameraMatched:true,
  poseTracked:true,contacts:10,performers:2,visibleCount:2,
  identityAmbiguous:false,sameFrame:true,hasArchive:true,
  bodyPreview:true,floorPreview:true};
 let state=guidedSetupReadiness(input);
 assert.equal(state.source.ready,false);
 state=guidedSetupReadiness({...input,phoneActive:true});
 assert.equal(state.tracking.ready,true);
 assert.equal(state.rehearsal.ready,true);
 state=guidedSetupReadiness({...input,phoneActive:true,identityAmbiguous:true});
 assert.equal(state.tracking.ready,false);
 state=guidedSetupReadiness({...input,phoneActive:true,sameFrame:false});
 assert.equal(state.tracking.ready,false);
 state=guidedSetupReadiness({...input,phoneActive:true,cameraMatched:false});
 assert.equal(state.calibration.ready,false);
 state=guidedSetupReadiness({...input,source:'simulation',phoneActive:true});
 assert.equal(state.source.ready,false);
});
test('S6.1.3: missing mask and floor previews cannot enter Perform',()=>{
 const input:ReadinessInput={...empty,cameraOn:true,frameFresh:true,videoReady:true,
  floorConfirmed:true,cameraMatched:true,poseTracked:true,contacts:1,
  hasArchive:true,bodyPreview:false,floorPreview:true};
 const a=guidedSetupReadiness(input);
 assert.equal(a.archive.ready,true);
 assert.equal(a.rehearsal.ready,false);
 assert.match(a.rehearsal.reason,/BODY/);
 const b=guidedSetupReadiness({...input,bodyPreview:true,floorPreview:false});
 assert.equal(b.rehearsal.ready,false);
 assert.match(b.rehearsal.reason,/FLOOR/);
});
