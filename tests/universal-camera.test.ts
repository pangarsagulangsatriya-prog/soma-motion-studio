import test from 'node:test';
import assert from 'node:assert/strict';
import {cameraDeviceLabel,cameraErrorMessage,normalizeCameraDevices,captureProfiles,openUniversalCamera} from '../src/engine/universalCamera.ts';

test('CAM-01: webcam, HDMI capture, OBS and NDI share one unique device list',()=>{
 const devices=[
  {kind:'videoinput',deviceId:'obs',label:'OBS Virtual Camera'},
  {kind:'videoinput',deviceId:'hdmi',label:'USB Video Capture HDMI'},
  {kind:'videoinput',deviceId:'obs',label:'OBS Duplicate'},
  {kind:'videoinput',deviceId:'ndi',label:'NDI Webcam Input'},
  {kind:'audioinput',deviceId:'mic',label:'Microphone'},
  {kind:'videoinput',deviceId:'webcam',label:'FaceTime HD Camera'}
 ] as MediaDeviceInfo[];
 const result=normalizeCameraDevices(devices);
 assert.equal(result.length,4);
 assert.ok(result.some(x=>x.deviceId==='hdmi'));
 assert.ok(result.some(x=>x.deviceId==='ndi'));
 assert.equal(cameraDeviceLabel({label:''},0),'Kamera 1 · izinkan kamera untuk melihat nama');
});
test('CAM-02: capture presets relax HD constraints while preserving the device',()=>{
 const profiles=captureProfiles('hdmi');
 assert.deepEqual(profiles.map(p=>p.name),['wide-720','wide-480','compatible']);
 assert.ok(profiles.every(p=>JSON.stringify(p.video).includes('hdmi')));
 assert.throws(()=>captureProfiles(''),/Pilih kamera/);
});
test('CAM-02: unsupported HD capture retries; successful stream uses the existing tracker',async()=>{
 const calls:MediaStreamConstraints[]=[];
 const stream={getVideoTracks:()=>[{readyState:'live'}],getTracks:()=>[]} as unknown as MediaStream;
 const media={getUserMedia:async(c:MediaStreamConstraints)=>{
  calls.push(c);if(calls.length===1)throw Object.assign(Error('unsupported'),{name:'OverconstrainedError'});
  return stream;
 }} as Pick<MediaDevices,'getUserMedia'>;
 const result=await openUniversalCamera(media,'capture-1');
 assert.equal(result.profile,'wide-480');
 assert.equal(result.stream,stream);
 assert.equal(calls.length,2);
 assert.equal(calls[0].audio,false);
});
test('CAM-04: denied camera permissions never trigger fallback prompts',async()=>{
 let calls=0;
 const media={getUserMedia:async()=>{calls++;throw Object.assign(Error('denied'),{name:'NotAllowedError'});}} as Pick<MediaDevices,'getUserMedia'>;
 await assert.rejects(()=>openUniversalCamera(media,'camera-1'),/denied/);
 assert.equal(calls,1);
 assert.match(cameraErrorMessage({name:'NotReadableError'}),/dipakai/);
});
test('CAM-03–05: static frontend retains QR/manual and explains USB, HDMI, IP/OBS, NDI bridges',async()=>{
 const {readFileSync}=await import('node:fs');
 const read=(p:string)=>readFileSync(new URL(p,import.meta.url),'utf8');
 const picker=read('../src/stage/UsbPhoneCameraReceiver.tsx');
 const phone=read('../src/stage/PhoneCameraReceiver.tsx');
 const app=read('../src/App.tsx');
 const landscape=read('../src/engine/landscapePhoneCamera.ts');
 assert.match(picker,/normalizeCameraDevices/);
 assert.match(picker,/devicechange/);
 assert.match(picker,/onDisconnect/);
 assert.match(picker,/OBS Virtual Camera/);
 assert.match(picker,/HDMI/);
 assert.match(picker,/NDI Webcam Input/);
 assert.match(phone,/setMode\('qr'\)/);
 assert.match(phone,/setMode\('manual'\)/);
 assert.match(app,/onMirrorCamera=\{mirrorPhoneCamera\}/);
 assert.match(landscape,/requestVideoFrameCallback/);
 assert.match(landscape,/track\.addEventListener\('ended',onEnded\)/);
});
