import test from 'node:test';
import assert from 'node:assert/strict';
import {identityQuad,type Quad} from '../src/projection/geometry.ts';
import {defaultFloorSpace,type CameraFloorCalibration} from '../src/footprints/spatial/coordinates.ts';
import {createFloorSession} from '../src/footprints/spatial/events.ts';
import {paintFloorCanvas} from '../src/footprints/simulator/floorCanvas.ts';
import {CALIBRATION_QA_TARGETS,calibrationQAContextKey,measureCalibrationQATarget,
 summarizeCalibrationQA,calibrationQAReport} from '../src/footprints/validation/CalibrationQA.ts';

const floor=defaultFloorSpace(8,6);
const calibration:CameraFloorCalibration={
 schema:'soma.footprints.camera-floor',version:1,floor,cameraQuad:identityQuad()
};
const projector=identityQuad();
const signature=calibrationQAContextKey(calibration,'camera:HDMI',projector,'1080p');
const near=(n:number,expected:number)=>assert.ok(Math.abs(n-expected)<1e-7,n+' != '+expected);

test('five QA targets are interior points: four fitted corners cannot pass independent validation',()=>{
 assert.equal(CALIBRATION_QA_TARGETS.length,5);
 assert.ok(CALIBRATION_QA_TARGETS.every(x=>x.uv.x>0&&x.uv.x<1&&x.uv.y>0&&x.uv.y<1));
 assert.equal(summarizeCalibrationQA([],signature).status,'incomplete');
 assert.equal(summarizeCalibrationQA([],signature).rmseCm,null);
});

test('manual projector-light click maps unmirrored camera pixel to floor displacement in centimetres',()=>{
 const exact=measureCalibrationQATarget(calibration,0,{x:.2,y:.2},signature);
 near(exact.expectedM.xM,1.6);near(exact.expectedM.yM,4.8);
 assert.equal(exact.errorCm,0);
 const shifted=measureCalibrationQATarget(calibration,2,{x:.52,y:.49},signature);
 near(shifted.dxCm,16);near(shifted.dyCm,6);near(shifted.errorCm,17.09);
 assert.equal(shifted.method,'operator-click-projected-cross');
 assert.throws(()=>measureCalibrationQATarget(calibration,2,{x:1.2,y:.5},signature));
 assert.throws(()=>measureCalibrationQATarget(calibration,5,{x:.5,y:.5},signature));
});

test('five separate operator-observed interior targets required for provisional QA result',()=>{
 const measurements=CALIBRATION_QA_TARGETS.map((target,index)=>
  measureCalibrationQATarget(calibration,index,target.uv,signature));
 const partial=summarizeCalibrationQA(measurements.slice(0,4),signature);
 assert.equal(partial.count,4);assert.equal(partial.status,'incomplete');
 const all=summarizeCalibrationQA(measurements,signature);
 assert.equal(all.count,5);assert.equal(all.rmseCm,0);
 assert.equal(all.p95Cm,0);assert.equal(all.status,'within-provisional-target');
 const changed=measureCalibrationQATarget(calibration,4,{x:.86,y:.84},signature);
 const failed=summarizeCalibrationQA([...measurements.slice(0,4),changed],signature);
 assert.equal(failed.status,'needs-adjustment');
 assert.ok(failed.maximumCm!==null&&failed.maximumCm>20);
});

test('switching projector geometry or camera binding invalidates previously recorded QA samples',()=>{
 const otherQuad:Quad=[{x:.04,y:.05},{x:.97,y:.06},{x:.94,y:.95},{x:.05,y:.94}];
 const changed=calibrationQAContextKey(calibration,'camera:HDMI',otherQuad,'1080p');
 const cameraChanged=calibrationQAContextKey(calibration,'camera:replacement',projector,'1080p');
 const resolutionChanged=calibrationQAContextKey(calibration,'camera:HDMI',projector,'720p');
 assert.notEqual(changed,signature);assert.notEqual(cameraChanged,signature);
 assert.notEqual(resolutionChanged,signature);
 const sample=measureCalibrationQATarget(calibration,0,{x:.2,y:.2},signature);
 assert.equal(summarizeCalibrationQA([sample],changed).count,0);
 assert.equal(calibrationQAReport(calibration,otherQuad,'camera:HDMI','1080p',[sample]).samples.length,0);
 const duplicate=summarizeCalibrationQA([sample,sample],signature);
 assert.equal(duplicate.count,1);
});

test('QA mode shows only the selected interior cross in calibrated raster, no footprint and no corner set',()=>{
 const labels:string[]=[],noop=()=>{};
 const ctx={setTransform:noop,fillRect:noop,beginPath:noop,moveTo:noop,lineTo:noop,
  stroke:noop,strokeRect:noop,fillText:(str:string)=>labels.push(str),
  arc:noop,save:noop,restore:noop,translate:noop,rotate:noop,scale:noop,
  fill:noop,ellipse:noop};
 const canvas={width:0,height:0,getContext:()=>ctx} as unknown as HTMLCanvasElement;
 paintFloorCanvas(canvas,createFloorSession(floor),
  {markersOnly:true,qaTarget:CALIBRATION_QA_TARGETS[2]});
 assert.equal(labels.length,1);
 assert.match(labels[0],/QA Q3/);
 assert.ok(!labels.some(x=>['1','2','3','4'].includes(x)));
});
