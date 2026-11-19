import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';

const read=(path:string)=>readFileSync(new URL(path,import.meta.url),'utf8');
const stage=read('../src/studio/v3/FootprintsStageWorkspace.tsx');
const flowCss=read('../src/studio/v3/trk03-source-flow.css');
const layoutCss=read('../src/studio/v3/trk02-layout.css');
const experimental=read('../src/studio/v3/FootprintsExperimentalSource.tsx');

test('all four source types continue using the same canonical picker',()=>{
 const model=read('../src/studio/v3/sourceSwitchModel.ts');
 for(const id of ['webcam','phone','video','simulator']){
  assert.match(model,new RegExp("id:'"+id+"'"));
 }
 assert.match(stage,/SOURCE_CHOICES\.map\(option=><button/);
 assert.match(stage,/if\(await chooseSource\(option.id\)\)/);
});

test('phone pairing opens inline in the left rail while preview remains visible',()=>{
 const railStart=stage.indexOf('className="soma-track-source-panel"');
 const railEnd=stage.indexOf('</aside>',railStart);
 const preview=stage.indexOf('<div className="fp-stage-video">');
 assert.ok(railStart>=0&&railEnd>railStart&&preview>railEnd);
 const rail=stage.slice(railStart,railEnd);
 assert.match(rail,/aria-expanded=\{phonePanelOpen\} aria-controls="soma-track-phone-pairing"/);
 assert.match(rail,/id="soma-track-phone-pairing"/);
 assert.match(rail,/<PhoneCameraReceiver onStream=\{onPhoneStream\} onDisconnect=\{onPhoneDisconnect\}\/>/);
 assert.equal((stage.match(/<PhoneCameraReceiver /g)||[]).length,1);
 assert.match(stage,/setInspectorOpen\(false\);\s*setPhonePanelOpen\(choice==='phone'\)/);
 assert.doesNotMatch(stage,/\|\|sourceStatus\.selection==='phone'\)\&\&<aside id="fp-context-panel"/);
});

test('closing QR hides the panel and keeps its WebRTC component mounted',()=>{
 assert.match(stage,/hidden=\{!phonePanelOpen\|\|operatorMode\} aria-hidden=\{!phonePanelOpen\|\|operatorMode\}/);
 assert.match(stage,/setPhonePanelOpen\(v=>!v\)/);
 assert.match(stage,/if\(sourceStatus\.selection==='phone'\)setPhonePanelOpen\(!phoneActive\)/);
 assert.match(stage,/onClick=\{closePhonePanel\}/);
 assert.match(stage,/soma-track-side-action'\)\?\?document\.querySelector/);
 assert.match(flowCss,/\.soma-track-phone-pairing\[hidden\]\{\s*display:none!important/);
});

test('MP4 and 3D controls are mounted once within the left source rail',()=>{
 const railStart=stage.indexOf('className="soma-track-source-panel"');
 const railEnd=stage.indexOf('</aside>',railStart);
 const rail=stage.slice(railStart,railEnd);
 assert.match(rail,/experimentalKind&&<FootprintsExperimentalSource/);
 assert.equal((stage.match(/<FootprintsExperimentalSource/g)||[]).length,1);
 assert.match(rail,/clip=\{experimentClip\} onClip=\{onExperimentClip\} onFrame=\{onExperimentFrame\}/);
 assert.match(experimental,/accept="video\/mp4,video\/webm/);
 assert.match(experimental,/onChange=\{inputVideo\}/);
 assert.match(experimental,/onClick=\{play\} disabled=\{!videoReady\}/);
 assert.match(experimental,/onClick=\{\(\)=>step\(-\.14\)\}/);
 assert.match(experimental,/onClick=\{\(\)=>step\(\.14\)\}/);
});

test('webcam recovery is contextual, not a second source picker',()=>{
 assert.match(stage,/ownership\.webcamAction&&<button/);
 assert.match(stage,/onClick=\{onStartBody\}/);
 assert.match(stage,/Aktifkan webcam/);
 assert.doesNotMatch(stage,/<FootprintsSourceSwitcher/);
});

test('source media controls wrap in the bounded rail and never cover the preview',()=>{
 assert.match(flowCss,/\.soma-track-source-panel>\.fp-experiment-dock\{/);
 assert.match(flowCss,/grid-column:auto!important;grid-row:auto!important/);
 assert.match(flowCss,/\.soma-track-source-panel \.fp-experiment-controls\{/);
 assert.match(flowCss,/\.soma-track-phone-pairing :is\(img,svg,canvas\)/);
 assert.match(flowCss,/@media\(max-width:850px\)/);
 assert.match(layoutCss,/--trk-camera-limit:960px/);
});

test('Compose still displays all original FLOOR, BODY and INPUT monitors',()=>{
 const compose=read('../src/studio/v3/ia-r1-four-workspaces.css');
 assert.match(compose,/data-workspace=compose\] \.fp-stage-overview/);
 assert.match(compose,/data-workspace=compose\] \.fp-stage-overview > \.fp-stage-side-previews:not\(\[hidden\]\)/);
 for(const cl of ['fp-preview-floor','fp-preview-body','fp-stage-video']){
  assert.ok(compose.includes('.'+cl),cl);
 }
 assert.match(stage,/hidden=\{!composerOpen\|\|mappingOpen\}/);
});

test('source switching preserves physical blackout, frame isolation and one preview',()=>{
 const app=read('../src/App.tsx');
 assert.match(app,/requestStageBlackout\(\(\)=>projection\.setTransport\('blackout'\)\)/);
 assert.match(stage,/onClip=\{onExperimentClip\}/);
 assert.match(stage,/const selectedExperimentFrame=currentExperimentFrameForClip/);
 assert.equal((stage.match(/<canvas ref=\{cameraCanvas\}/g)||[]).length,1);
});
