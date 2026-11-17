import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {HandLimbDetailAnalyzer} from '../src/stage/videoHandLimbDetail.ts';
import {TemporalJointAnalyzer} from '../src/stage/temporalJointIntelligence.ts';
import type {Landmark} from '../src/engine/types.ts';
import type {VideoActorAssignment,VideoActorState} from '../src/stage/videoAutoActorTracker.ts';
const source=(path:string)=>readFileSync(new URL('../'+path,import.meta.url),'utf8');
test('MP4 pose worker and CPU pipeline never initialize Hand Landmarker',()=>{
 for(const path of [
  'src/stage/VideoPoseGaitEngine.ts',
  'src/stage/replayInferenceWorker.ts',
  'src/stage/replayInferenceWorkerClient.ts'
 ]){
  const code=source(path);
  assert.doesNotMatch(code,/HandLandmarker|hand_landmarker\.task|numHands/);
 }
 assert.match(source('src/stage/VideoPoseGaitEngine.ts'),/PoseLandmarker/);
});
test('video overlay and Lab no longer present 21-point finger scanning or controls',()=>{
 for(const path of [
  'src/stage/VideoMotionLab.tsx',
  'src/studio/v3/experimentStagePainter.ts'
 ])assert.doesNotMatch(source(path),/drawHandDetailOverlay|HandDetailMode|setHandDetailMode/);
 assert.match(source('src/stage/HandLimbInspector.tsx'),/Arms & Legs/);
 assert.doesNotMatch(source('src/stage/HandLimbInspector.tsx'),/hand\.fingers|pinchRatio|\/21|Detail jari/);
 assert.doesNotMatch(source('src/stage/ReplayPerformanceInspector.tsx'),/Hands AI|Hands aktual|Frekuensi deteksi tangan/);
});
test('33-joint pose remains sufficient for independent arm and leg metrics',()=>{
 const pose:Landmark[]=Array.from({length:33},(_,i)=>({
  x:.2+(i%3)*.025,y:.15+i*.018,z:0,visibility:.96
 }));
 const assignment:VideoActorAssignment={id:'A',rawIndex:0,pose,confidence:.95};
 const statuses:VideoActorState[]=[
  {id:'A',presence:'visible',confidence:.95,rawIndex:0,lastSeenAtMs:0},
  {id:'B',presence:'not-detected',confidence:0,rawIndex:null,lastSeenAtMs:null}
 ];
 const temporal=new TemporalJointAnalyzer();
 const limbs=new HandLimbDetailAnalyzer();
 const sample=limbs.observe([assignment],statuses,temporal.observe([assignment],statuses,0),0,
  {hands:null,handModelAvailable:false});
 assert.equal(sample.actors[0].limbs.length,4);
 assert.equal(sample.actors[0].limbs.filter(l=>l.presence==='visible').length,4);
 assert.equal(sample.actors[0].hands.every(h=>h.landmarks.length===0),true);
 assert.equal(sample.actors[1].limbs.filter(l=>l.presence==='visible').length,0);
});
