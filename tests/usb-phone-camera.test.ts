import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {landscapeFramePlan,PHONE_LANDSCAPE_WIDTH,PHONE_LANDSCAPE_HEIGHT} from '../src/engine/landscapePhoneCamera.ts';
const read=(path:string)=>readFileSync(new URL(path,import.meta.url),'utf8');

test('USB-02: landscape 16:9 source is passed through without cropping or rotating',()=>{
 const p=landscapeFramePlan(1280,720);
 assert.equal(p.rotation,0);
 assert.deepEqual([p.drawnWidth,p.drawnHeight,p.offsetX,p.offsetY],[1280,720,0,0]);
 assert.equal(PHONE_LANDSCAPE_WIDTH/PHONE_LANDSCAPE_HEIGHT,16/9);
});
test('USB-02: portrait source rotates into real 16:9 tracking pixels, not CSS only',()=>{
 const p=landscapeFramePlan(720,1280);
 assert.equal(p.rotation,90);
 assert.deepEqual([p.drawnWidth,p.drawnHeight,p.offsetX,p.offsetY],[1280,720,0,0]);
 const alternative=landscapeFramePlan(720,1280,1280,720,270);
 assert.equal(alternative.rotation,270);
 assert.deepEqual([alternative.drawnWidth,alternative.drawnHeight],[1280,720]);
 const smaller=landscapeFramePlan(480,854);
 assert.equal(smaller.rotation,90);
 assert.ok(smaller.drawnWidth<=1280&&smaller.drawnHeight<=720);
});
test('USB-02: 4:3 source is contained in wide canvas, feet not cropped',()=>{
 const p=landscapeFramePlan(640,480);
 assert.equal(p.rotation,0);
 assert.deepEqual([p.drawnWidth,p.drawnHeight],[960,720]);
 assert.equal(p.offsetX,160);
 assert.equal(p.offsetY,0);
});
test('USB-02: invalid/no camera dimensions fail before connection is ready',()=>{
 for(const [w,h] of [[0,720],[1280,0],[-1,720],[NaN,720],[Infinity,720]]){
  assert.throws(()=>landscapeFramePlan(w,h),/Ukuran video/);
 }
});
test('USB-03: Track phone has explicit USB, QR and manual options',()=>{
 const receiver=read('../src/stage/PhoneCameraReceiver.tsx');
 const usb=read('../src/stage/UsbPhoneCameraReceiver.tsx');
 const stage=read('../src/studio/v3/FootprintsStageWorkspace.tsx');
 assert.match(receiver,/setMode\('usb'\)/);
 assert.match(receiver,/setMode\('qr'\)/);
 assert.match(receiver,/setMode\('manual'\)/);
 assert.match(receiver,/<UsbPhoneCameraReceiver/);
 assert.match(usb,/enumerateDevices/);
 assert.match(usb,/addEventListener\?\.\('devicechange'/);
 assert.match(usb,/getUserMedia\(\{audio:false,video:/);
 assert.match(usb,/onDisconnect/);
 assert.match(stage,/<PhoneCameraReceiver onStream=\{onPhoneStream\}/);
});
test('USB-04: pixels are normalized before existing tracker, with stale cleanup and stage blackout',()=>{
 const app=read('../src/App.tsx');
 const normalization=read('../src/engine/landscapePhoneCamera.ts');
 assert.match(app,/const landscape=await createLandscapePhoneCamera\(stream/);
 assert.match(app,/undefined,landscape\.stream/);
 assert.match(app,/const angle=phoneLandscapeRef\.current\.rotate90\(\)/);
 assert.match(app,/phoneLandscapeRef\.current\?\.stop\(\)/);
 assert.match(app,/liveFloorEngine\.revoke\('Sumber kamera HP berubah/);
 assert.match(app,/requestStageBlackout\(\(\)=>projection\.setTransport\('blackout'\)\)/);
 assert.match(normalization,/canvas\.captureStream\(PHONE_LANDSCAPE_FPS\)/);
 assert.match(normalization,/ctx\.rotate\(p\.rotation\*Math\.PI\/180\)/);
 assert.match(normalization,/track\.addEventListener\('ended',onEnded\)/);
 assert.match(normalization,/track\.addEventListener\('mute',onMute\)/);
});
