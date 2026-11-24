import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {pairedPhoneUrl} from '../src/stage/PhonePairProtocol.ts';
import {phoneCameraUrl} from '../src/stage/PhoneSignal.ts';
const read=(p:string)=>readFileSync(new URL(p,import.meta.url),'utf8');
const stage=read('../src/studio/v3/FootprintsStageWorkspace.tsx');
const auto=read('../src/stage/AutomaticPhoneReceiver.tsx');
const css=read('../src/studio/v3/trk06-control-polish.css');

test('one pairing CTA, no duplicate waiting copy inside camera',()=>{
 assert.match(stage,/sourceStatus.selection==='phone'&&!phonePanelOpen&&<button/);
 assert.match(stage,/hidden=\{!ownership\.sourceStatusVisible\}/);
 assert.match(stage,/hidden=\{!composerOpen&&!operatorMode&&!ownership\.showTrackingFeedback\}/);
 assert.match(stage,/!composerOpen&&!calibrationOpen&&!experimentalKind&&!sourceStatus.selection&&/);
 assert.doesNotMatch(stage,/sourceStatus.selection==='phone'\?'Menunggu HP'/);
 assert.match(stage,/<PhoneCameraReceiver onStream=\{onPhoneStream\} onDisconnect=\{onPhoneDisconnect\} engineError=\{sourceStatus\.phase==='error'\?sourceStatus\.message:undefined\}\/>/);
 assert.equal((stage.match(/<PhoneCameraReceiver /g)||[]).length,1);
});

test('QR-first UI has real scannable SVG and clear creation/retry action',()=>{
 assert.match(auto,/className="soma-setup-primary soma-track-create-qr"/);
 assert.match(auto,/Tampilkan QR/);
 assert.match(auto,/aria-label=\{phase==='creating'\?'Menyiapkan kode QR':'Tampilkan QR kamera HP'\}/);
 assert.match(auto,/<PhonePairQr value=\{url\}\/>/);
 assert.match(auto,/className="soma-track-qr-frame"/);
 assert.match(auto,/className="soma-track-qr-actions"/);
 assert.match(auto,/className="soma-track-regenerate"/);
 assert.match(auto,/if\(staticPages\)\{/);
 assert.match(auto,/phoneCameraUrl\(window.location.origin,window.location.pathname\)/);
 assert.match(auto,/onUseManual&&<button/);
 assert.match(read('../src/stage/PhoneCameraReceiver.tsx'),/onUseManual=\{\(\)=>setMode\('manual'\)\}/);
 assert.match(auto,/phase==='error'&&window.location.hostname.endsWith\('github.io'\)/);
 assert.match(css,/\.soma-track-qr-frame/);
 assert.match(css,/width:min\(100%,208px\)!important/);
 assert.match(css,/\.soma-track-qr-frame>\.soma-phone-qr/);
 assert.match(css,/prefers-reduced-motion:reduce/);
 assert.match(css,/:focus-visible/);
});

test('manual and QR invite URLs follow deploy base path without breaking Vercel root',()=>{
 const room='abcdefghijklmnop';
 const ticket='a'.repeat(32);
 const invitation={room,ticket};
 assert.equal(phoneCameraUrl('https://example.test'),
  'https://example.test/?phoneCamera=1');
 assert.equal(phoneCameraUrl('https://example.github.io','/soma-motion-studio/'),
  'https://example.github.io/soma-motion-studio/?phoneCamera=1');
 const root=pairedPhoneUrl('https://example.test',invitation);
 const nested=pairedPhoneUrl('https://example.github.io',invitation,'/soma-motion-studio/');
 assert.ok(root.startsWith('https://example.test/?phoneCamera=1#'));
 assert.ok(nested.startsWith('https://example.github.io/soma-motion-studio/?phoneCamera=1#'));
 assert.match(nested,/#room=abcdefghijklmnop&ticket=/);
});

test('CSS is strictly Track scoped: no hidden BODY or FLOOR regressions',()=>{
 assert.match(css,/\[data-workspace=track\]/);
 assert.doesNotMatch(css,/\[data-workspace=compose\]/);
 assert.doesNotMatch(css,/\[data-workspace=map\]/);
 assert.doesNotMatch(css,/\[data-workspace=perform\]/);
 assert.match(css,/\.soma-track-source-status\[hidden\]/);
 assert.match(css,/\.fp-stage-video>\.fp-stage-surface-foot\[hidden\]/);
 assert.match(stage,/import '\.\/trk06-control-polish.css'/);
});
