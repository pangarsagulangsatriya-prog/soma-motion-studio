import {test} from 'node:test';
import assert from 'node:assert/strict';
import {PathObservationRouter} from '../src/footprints/lines/v3/PathObservationRouter.ts';
import {ActorPathTracker} from '../src/footprints/lines/v3/ActorPathTracker.ts';
import {defaultFloorSpace,type CameraFloorCalibration} from '../src/footprints/spatial/coordinates.ts';
import type {FootBrushPose} from '../src/footprints/lines/v3/FootBrushPoseAdapter.ts';

const calibration:CameraFloorCalibration={
 schema:'soma.footprints.camera-floor',version:1,floor:defaultFloorSpace(5,5),
 cameraQuad:[{x:0,y:0},{x:1,y:0},{x:1,y:1},{x:0,y:1}]
};
const stage=(id:string,y:number,x:number,atMs:number):FootBrushPose[]=>
 (['left','right'] as const).map((foot,index)=>({
 actorId:id,foot,sourceKey:'track:camera:calibrated:2',epoch:1,atMs,
 coordinateBasis:'image-2d' as const,
 center:{x:x+(index===0?-.01:.01),y},confidence:.97,
 provenance:'detected-estimate' as const
 }));
const opts={calibration,videoAspect:16/9,calibrationId:'test-5x5'};
test('SP-02 calibrated actor path preserves upstage/downstage and lateral direction',()=>{
 const router=new PathObservationRouter();
 const first=router.ingest(stage('A',.45,.4,1000),[],opts)[0];
 const back=router.ingest(stage('A',.65,.4,1100),[],opts)[0];
 const side=router.ingest(stage('A',.65,.6,1200),[],opts)[0];
 assert.equal(first.actorId,'A');
 assert.ok(back.point.y>first.point.y,'downstage must move downward on top-down canvas');
 assert.ok(Math.abs(back.point.x-first.point.x)<2,'depth should not drift sideways');
 assert.ok(side.point.x>back.point.x,'lateral movement must move right');
 assert.ok(Math.abs(side.point.y-back.point.y)<2,'lateral movement should not drift in depth');
 assert.match(side.sourceKey,/floor:test-5x5/);
});
test('SP-02 outside calibrated floor must not teleport a path into the viewport',()=>{
 const router=new PathObservationRouter();
 const outside:CameraFloorCalibration={...calibration,
  cameraQuad:[{x:.2,y:.2},{x:.8,y:.2},{x:.8,y:.8},{x:.2,y:.8}]};
 assert.equal(router.ingest(stage('A',.96,.5,1000),[],{
  calibration:outside,videoAspect:16/9,calibrationId:'cropped'
 }).length,0);
});
test('SP-05 changed profile creates a cut rather than joining incompatible coordinates',()=>{
 const router=new PathObservationRouter(),tracker=new ActorPathTracker();
 const a=router.ingest(stage('A',.4,.4,1000),[],opts);
 assert.equal(tracker.ingest(a,1000)[0].kind,'START');
 const b=router.ingest(stage('A',.4,.42,1100),[],{
  ...opts,calibrationId:'new-camera-framing'
 });
 const events=tracker.ingest(b,1100);
 assert.ok(events.some(e=>e.kind==='CUT'));
 assert.ok(!events.some(e=>e.kind==='ADD'));
});
test('SP-01 legacy image-space fallback remains usable',()=>{
 const r=new PathObservationRouter();
 const v=r.ingest(stage('A',.6,.6,1000));
 assert.equal(v.length,1);
 assert.ok(!v[0].sourceKey.includes('|floor:'));
});
