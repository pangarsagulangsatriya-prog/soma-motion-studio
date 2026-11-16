import {cameraGroundToFloor,uvToFloor,type CameraFloorCalibration,type FloorPoint} from '../spatial/coordinates.ts';
import {validQuad,type Point,type Quad} from '../../projection/geometry.ts';

/** Independent interior checkpoints, not the four points used to fit either homography. */
export const CALIBRATION_QA_TARGETS=[
 {id:'Q1',label:'Belakang kiri',uv:{x:.2,y:.2}},
 {id:'Q2',label:'Belakang kanan',uv:{x:.8,y:.2}},
 {id:'Q3',label:'Tengah lantai',uv:{x:.5,y:.5}},
 {id:'Q4',label:'Depan kiri',uv:{x:.2,y:.8}},
 {id:'Q5',label:'Depan kanan',uv:{x:.8,y:.8}}
] as const;
export type CalibrationQATarget=typeof CALIBRATION_QA_TARGETS[number];
export type CalibrationQASample={
 targetId:string;targetIndex:number;contextKey:string;
 expectedM:FloorPoint;observedCameraUV:Point;observedM:FloorPoint;
 dxCm:number;dyCm:number;errorCm:number;recordedAt:string;
 method:'operator-click-projected-cross';
};
export type CalibrationQASummary={
 count:number;required:number;meanCm:number|null;rmseCm:number|null;p95Cm:number|null;
 maximumCm:number|null;status:'incomplete'|'within-provisional-target'|'needs-adjustment';
 targets:{rmseCm:number;p95Cm:number};caveat:string;
};
const cm=(n:number)=>Math.round(n*100)/100;
const quantile=(xs:number[],p:number)=>{
 const sorted=[...xs].sort((a,b)=>a-b),i=(sorted.length-1)*p,a=Math.floor(i),b=Math.ceil(i);
 return sorted[a]+(sorted[b]-sorted[a])*(i-a);
};
export function calibrationQAContextKey(cal:CameraFloorCalibration|null,cameraKey:string|null,projectorQuad:Quad,resolution:string):string{
 if(!cal||!cameraKey||!validQuad(projectorQuad)||!resolution)throw Error('Periksa kalibrasi kamera dan proyektor terlebih dahulu.');
 return JSON.stringify([cal,cameraKey,projectorQuad,resolution]);
}
/** Operator clicks the actual *illuminated* cross in the unmirrored webcam image.
 * The combined camera/projector residual is an observation, NOT physical ground truth.
 * No score can be inferred from four fitted corner points alone. */
export function measureCalibrationQATarget(cal:CameraFloorCalibration,targetIndex:number,
 observedCameraUV:Point,contextKey:string,recordedAt=new Date().toISOString()):CalibrationQASample{
 if(!Number.isInteger(targetIndex)||targetIndex<0||targetIndex>=CALIBRATION_QA_TARGETS.length)
  throw Error('Indeks titik QA tidak dikenal.');
 if(!contextKey)throw Error('Pengukuran QA harus terikat pada kalibrasi yang aktif.');
 const target=CALIBRATION_QA_TARGETS[targetIndex];
 const measured=cameraGroundToFloor(cal,{cameraUV:observedCameraUV,phase:'contact',confidence:1});
 if(!measured)throw Error('Klik silang yang terlihat di dalam area lantai terkalibrasi.');
 const expected=uvToFloor(cal.floor,target.uv),dxCm=(measured.xM-expected.xM)*100,dyCm=(measured.yM-expected.yM)*100;
 return {targetId:target.id,targetIndex,contextKey,expectedM:expected,
  observedCameraUV:{...observedCameraUV},observedM:measured,
  dxCm:cm(dxCm),dyCm:cm(dyCm),errorCm:cm(Math.hypot(dxCm,dyCm)),
  recordedAt,method:'operator-click-projected-cross'};
}
export function summarizeCalibrationQA(samples:CalibrationQASample[],contextKey:string,
 targets={rmseCm:8,p95Cm:15}):CalibrationQASummary{
 if(!(targets.rmseCm>0&&Number.isFinite(targets.rmseCm)&&targets.p95Cm>0&&Number.isFinite(targets.p95Cm)))
  throw Error('Ambang QA harus berupa sentimeter positif.');
 const valid=samples.filter(s=>s.contextKey===contextKey&&Number.isFinite(s.errorCm)&&
  s.targetIndex>=0&&s.targetIndex<CALIBRATION_QA_TARGETS.length&&s.targetId===CALIBRATION_QA_TARGETS[s.targetIndex].id);
 const latest=new Map<number,CalibrationQASample>();valid.forEach(s=>latest.set(s.targetIndex,s));
 const errors=[...latest.values()].map(s=>s.errorCm),n=errors.length,required=CALIBRATION_QA_TARGETS.length;
 const rmse=n?cm(Math.sqrt(errors.reduce((sum,e)=>sum+e*e,0)/n)):null;
 const p95=n?cm(quantile(errors,.95)):null;
 return {count:n,required,
  meanCm:n?cm(errors.reduce((sum,e)=>sum+e,0)/n):null,rmseCm:rmse,p95Cm:p95,
  maximumCm:n?cm(Math.max(...errors)):null,
  status:n<required?'incomplete':rmse!<=targets.rmseCm&&p95!<=targets.p95Cm?
   'within-provisional-target':'needs-adjustment',
  targets,caveat:'Operator menandai silang cahaya secara manual. Hasil menggabungkan galat kamera, proyektor, perspektif dan klik. Lima titik bukan sertifikasi akurasi fisik; ulangi dengan pita ukur, rekaman, dan posisi kaki aktual.'};
}
export function calibrationQAReport(cal:CameraFloorCalibration,projectorQuad:Quad,cameraKey:string,
 resolution:string,samples:CalibrationQASample[],remarks=''){
 const contextKey=calibrationQAContextKey(cal,cameraKey,projectorQuad,resolution);
 return {schema:'soma.footprints.calibration-qa',version:1,recordedAt:new Date().toISOString(),
  cameraCalibration:cal,projectorQuad,projectorResolution:resolution,cameraBinding:cameraKey,
  targetCount:CALIBRATION_QA_TARGETS.length,
  samples:samples.filter(s=>s.contextKey===contextKey),summary:summarizeCalibrationQA(samples,contextKey),
  remarks:remarks.trim().slice(0,500)};
}
