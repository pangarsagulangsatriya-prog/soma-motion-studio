import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {looksLikePhoneWebcam,looksLikeBuiltInCamera,preferredCameraDevice,
 prioritizedCameraDevices,cameraPathHelp} from '../src/engine/cameraRouteModel.ts';
import {SOURCE_CHOICES,deriveFootprintsInputStatus} from '../src/studio/v3/sourceSwitchModel.ts';
const read=(p:string)=>readFileSync(new URL(p,import.meta.url),'utf8');
const devices=[
 {deviceId:'mac',label:'FaceTime HD Camera'},
 {deviceId:'android',label:'Android Webcam'},
 {deviceId:'capture',label:'USB HDMI Capture'},
 {deviceId:'iphone',label:'iPhone Camera'}
];
test('E2E-CAM-01: HP and other cameras separated, MP4/3D unchanged',()=>{
 assert.deepEqual(SOURCE_CHOICES.map(x=>x.label),['Kamera lain','Kamera HP','Video MP4','Simulasi 3D']);
 assert.match(SOURCE_CHOICES[1].description,/iPhone \/ Android/);
 assert.match(deriveFootprintsInputStatus({selection:'phone',cameraOn:false,cameraBusy:false,
  cameraError:'',phoneActive:false,switchBusy:false,switchError:''}).message,/HP/);
});
test('E2E-CAM-02: FaceTime never auto-selected as phone',()=>{
 assert.equal(looksLikeBuiltInCamera('FaceTime HD Camera'),true);
 assert.equal(looksLikePhoneWebcam('Android Webcam'),true);
 assert.equal(looksLikePhoneWebcam('iPhone Camera'),true);
 assert.equal(preferredCameraDevice([{deviceId:'mac',label:'FaceTime HD Camera'}],'phone'),'');
 assert.equal(preferredCameraDevice(devices,'phone'),'');
 assert.equal(preferredCameraDevice([devices[0],devices[1]],'phone'),'android');
 assert.equal(preferredCameraDevice([devices[0],devices[3]],'phone'),'iphone');
});
test('E2E-CAM-03: remember selected Mac camera across changed ID',()=>{
 assert.equal(preferredCameraDevice(devices,'phone','iphone'),'iphone');
 assert.equal(preferredCameraDevice(devices,'phone','old-id','Android Webcam'),'android');
 assert.equal(preferredCameraDevice([devices[0]],'other'),'mac');
 assert.equal(preferredCameraDevice([devices[0]],'phone','mac'),'');
 assert.equal(prioritizedCameraDevices(devices,'phone')[0].label,'Android Webcam');
});
test('E2E-CAM-04: USB and static QR capability labels are honest',()=>{
 assert.match(cameraPathHelp('phone'),/Continuity Camera/);
 assert.match(cameraPathHelp('phone'),/USB → Webcam/);
 assert.match(cameraPathHelp('phone'),/Kabel saja/);
 const qr=read('../src/stage/AutomaticPhoneReceiver.tsx');
 assert.match(qr,/GitHub Pages, sambungkan videonya melalui Kode/);
 assert.match(qr,/Lanjut ke Kode/);
 const phone=read('../src/stage/PhoneCameraReceiver.tsx');
 assert.match(phone,/intent="phone"/);
 assert.match(phone,/<span>Kabel<\/span>/);
 assert.match(phone,/<span>Nirkabel<\/span>/);
});
test('E2E-CAM-05: same SOMA tracker and fail-closed camera recovery',()=>{
 const app=read('../src/App.tsx');
 const stage=read('../src/studio/v3/FootprintsStageWorkspace.tsx');
 assert.match(app,/tracker\.start\(video\.current!/);
 assert.match(app,/createLandscapePhoneCamera\(stream/);
 assert.match(app,/requestStageBlackout\(\(\)=>projection\.setTransport\('blackout'\)\)/);
 assert.match(app,/media\.addEventListener\?\.\('devicechange',refresh\)/);
 assert.match(app,/liveFloorEngine\.revoke\('Kamera Mac terputus/);
 assert.match(stage,/sourceStatus\.selection==='webcam'&&<div className="soma-track-mac-camera"/);
 assert.match(stage,/onChange=\{event=>void onSelectCameraDevice\(event.target.value\)\}/);
 assert.match(stage,/<PhoneCameraReceiver onStream=\{onPhoneStream\}/);
});
