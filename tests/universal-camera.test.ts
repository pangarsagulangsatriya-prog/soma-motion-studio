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


test('CAM-UX: picker auto-selects one device but never auto-starts camera',async()=>{
 const {readFileSync}=await import('node:fs');
 const source=readFileSync(new URL('../src/stage/UsbPhoneCameraReceiver.tsx',import.meta.url),'utf8');
 assert.match(source,/list\.length===1\?list\[0\]\.deviceId:''/);
 assert.match(source,/onClick=\{\(\)=>void connect\(\)\}/);
 assert.match(source,/aria-label="Muat ulang daftar kamera"/);
 assert.doesNotMatch(source,/soma-usb-intro/);
 assert.match(source,/soma-usb-help/);
 assert.match(source,/soma-usb-connected/);
});
test('CAM-UX: QR/manual preserved and tabs use compact labels',async()=>{
 const {readFileSync}=await import('node:fs');
 const source=readFileSync(new URL('../src/stage/PhoneCameraReceiver.tsx',import.meta.url),'utf8');
 assert.match(source,/<Cable size=\{15\}/);
 assert.match(source,/<QrCode size=\{15\}/);
 assert.match(source,/<KeyRound size=\{15\}/);
 assert.match(source,/<span>Kabel<\/span>/);
 assert.match(source,/<span>Nirkabel<\/span>/);
 assert.match(source,/<span>Kode<\/span>/);
 assert.match(source,/<AutomaticPhoneReceiver/);
 assert.match(source,/<ManualPhoneCameraReceiver/);
});


test('CAM-UX help: modal tutorial is contextual, hidden until clicked and dismissible',async()=>{
 const {readFileSync}=await import('node:fs');
 const r=(p:string)=>readFileSync(new URL(p,import.meta.url),'utf8');
 const phone=r('../src/stage/PhoneCameraReceiver.tsx');
 const css=r('../src/studio/v3/trk06-control-polish.css');
 assert.match(phone,/const \[helpOpen,setHelpOpen\]=useState\(false\)/);
 assert.match(phone,/aria-label="Petunjuk koneksi kamera"/);
 assert.match(phone,/role="dialog" aria-label="Panduan sambungan kamera"/);
 assert.match(phone,/helpOpen&&<section/);
 assert.match(phone,/e\.key==='Escape'/);
 assert.match(css,/\.soma-camera-help-pop/);
 assert.match(css,/prefers-reduced-motion:reduce/);
});
test('CAM-UX manual pairing: long URL and offer are hidden until requested',async()=>{
 const {readFileSync}=await import('node:fs');
 const phone=readFileSync(new URL('../src/stage/PhoneCameraReceiver.tsx',import.meta.url),'utf8');
 assert.match(phone,/<details className="soma-manual-reveal">/);
 assert.match(phone,/<summary>Lihat tautan HP<\/summary>/);
 assert.match(phone,/<summary>Lihat kode laptop<\/summary>/);
 assert.match(phone,/Buat kode laptop/);
 assert.match(phone,/placeholder="Tempel kode dari HP…"/);
 assert.match(phone,/disabled=\{!answer\.trim\(\)\|\|busy\}/);
 assert.match(phone,/pc\.current\?\.close\(\)/);
});
test('CAM-UX static QR sends user into code step without promising an automatic server',async()=>{
 const {readFileSync}=await import('node:fs');
 const qr=readFileSync(new URL('../src/stage/AutomaticPhoneReceiver.tsx',import.meta.url),'utf8');
 assert.match(qr,/>Lanjut ke Kode<\/button>/);
 assert.match(qr,/if\(staticPages\)/);
 assert.match(qr,/onUseManual&&<button/);
});

test('CAM-UI-02: help control is outside three-cell segmented camera tabs',async()=>{
 const {readFileSync}=await import('node:fs');
 const get=(file:string)=>readFileSync(new URL(file,import.meta.url),'utf8');
 const phone=get('../src/stage/PhoneCameraReceiver.tsx');
 const css=get('../src/studio/v3/trk06-control-polish.css');
 const stage=get('../src/studio/v3/FootprintsStageWorkspace.tsx');
 assert.match(phone,/className="soma-camera-method-row"/);
 assert.match(phone,/className="soma-camera-help-button"/);
 assert.match(phone,/<Cable size=\{15\}/);
 assert.match(phone,/<QrCode size=\{15\}/);
 assert.match(phone,/<KeyRound size=\{15\}/);
 assert.match(css,/grid-template-columns:repeat\(3,minmax\(0,1fr\)\)!important/);
 const cameraCss=get('../src/studio/v3/trk06-control-polish.css');
 assert.match(cameraCss,/grid-template-columns:repeat\(2,minmax\(0,1fr\)\)!important/);
 assert.match(css,/grid-template-columns:minmax\(0,1fr\) 37px!important/);
 assert.match(stage,/data-camera-setup=\{sourceStatus.selection==='phone'&&phonePanelOpen\?'open':'closed'\}/);
 assert.match(css,/prefers-reduced-motion:reduce/);
});
