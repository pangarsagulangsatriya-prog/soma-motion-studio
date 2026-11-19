import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {trackStatusOwnership} from '../src/studio/v3/trackStatusOwnership.ts';
import type {TrackFeedback} from '../src/studio/v3/trackFeedbackModel.ts';
import type {SourceScreenMode} from '../src/studio/v3/sourceScreenModel.ts';
import type {FootprintsInputChoice,FootprintsInputPhase} from '../src/studio/v3/sourceSwitchModel.ts';

const read=(p:string)=>readFileSync(new URL(p,import.meta.url),'utf8');
const base={
 selection:null as FootprintsInputChoice|null,
 phase:'idle' as FootprintsInputPhase,
 cameraOn:false,cameraBusy:false,cameraError:'',
 phonePanelOpen:false,experimentalKind:null as 'video'|'simulator'|null,
 sourceMode:'select' as SourceScreenMode,
 feedbackState:'idle' as TrackFeedback['state'],
 composerOpen:false,operatorMode:false
};
const state=(patch:Partial<typeof base>)=>trackStatusOwnership({...base,...patch});

test('no source: one picker only, no helper card or duplicated status',()=>{
 const x=state({});
 assert.equal(x.sourceStatusVisible,false);
 assert.equal(x.webcamAction,null);
 assert.equal(x.showInlineAssistant,false);
 assert.equal(x.showTrackingFeedback,false);
});

test('webcam offline: exactly the rail activation, no extra assistant or waiting overlay',()=>{
 const x=state({selection:'webcam'});
 assert.equal(x.webcamAction,'activate');
 assert.equal(x.sourceStatusVisible,false);
 assert.equal(x.showInlineAssistant,false);
 assert.equal(x.showPreviewWarming,false);
 assert.equal(x.showBodyAction,false);
});

test('connecting webcam owns a single disabled button with spinner',()=>{
 const x=state({selection:'webcam',phase:'connecting',cameraBusy:true,
  sourceMode:'connecting'});
 assert.equal(x.webcamAction,'connecting');
 assert.equal(x.sourceStatusVisible,false);
 assert.equal(x.showPreviewWarming,false);
});

test('webcam errors get one sidebar error and a retry action',()=>{
 const fromSource=state({selection:'webcam',phase:'error',
  sourceMode:'recover',cameraError:'NotAllowedError'});
 assert.equal(fromSource.webcamAction,'retry');
 assert.equal(fromSource.sourceStatusVisible,true);
 assert.equal(fromSource.sourceStatusError,true);
 assert.equal(fromSource.showInlineAssistant,false);
 const fromDevice=state({selection:'webcam',phase:'idle',
  sourceMode:'recover',cameraError:'Camera device disconnected'});
 assert.equal(fromDevice.webcamAction,'retry');
 assert.equal(fromDevice.sourceStatusVisible,true);
});

test('live camera with Body disabled moves action to source rail',()=>{
 const x=state({selection:'webcam',phase:'ready',cameraOn:true,
  sourceMode:'switch-body',feedbackState:'waiting'});
 assert.equal(x.showBodyAction,true);
 assert.equal(x.webcamAction,null);
 assert.equal(x.sourceStatusVisible,false);
 assert.equal(x.showInlineAssistant,false);
});

test('warming camera uses one short monitor hint, not the duplicate helper card',()=>{
 const x=state({selection:'webcam',phase:'ready',cameraOn:true,
  sourceMode:'warming',feedbackState:'waiting'});
 assert.equal(x.showPreviewWarming,true);
 assert.equal(x.sourceStatusVisible,false);
 assert.equal(x.showTrackingFeedback,false);
});

test('ready framing is owned only by the preview feedback',()=>{
 const x=state({selection:'webcam',phase:'ready',cameraOn:true,
  sourceMode:'live',feedbackState:'framing'});
 assert.equal(x.sourceStatusVisible,false);
 assert.equal(x.showTrackingFeedback,true);
 assert.equal(x.showInlineAssistant,false);
});

test('phone pairing and phone Body recovery do not stack actions',()=>{
 const pairing=state({selection:'phone',phase:'pairing',phonePanelOpen:true});
 assert.equal(pairing.sourceStatusVisible,false);
 assert.equal(pairing.showBodyAction,false);
 assert.equal(pairing.webcamAction,null);
 const connected=state({selection:'phone',phase:'ready',cameraOn:true,
  sourceMode:'switch-body',phonePanelOpen:false});
 assert.equal(connected.showBodyAction,true);
 assert.equal(connected.sourceStatusVisible,false);
});

test('MP4 and simulator own their loading state in the source dock',()=>{
 for(const choice of ['video','simulator'] as const){
  const x=state({selection:choice,phase:'experiment',experimentalKind:choice});
  assert.equal(x.sourceStatusVisible,false);
  assert.equal(x.showPreviewWarming,false);
  assert.equal(x.webcamAction,null);
  assert.equal(x.showInlineAssistant,false);
 }
});

test('Compose retains its separate contextual helper, Perform gets no Track actions',()=>{
 const compose=state({selection:'webcam',phase:'ready',
  composerOpen:true,sourceMode:'warming'});
 assert.equal(compose.showInlineAssistant,true);
 assert.equal(compose.webcamAction,null);
 const perform=state({selection:'webcam',operatorMode:true});
 assert.equal(perform.showInlineAssistant,false);
 assert.equal(perform.webcamAction,null);
});

test('source rail and preview use the ownership model, no recovery card in Track',()=>{
 const stage=read('../src/studio/v3/FootprintsStageWorkspace.tsx');
 const style=read('../src/studio/v3/trk06a-status-ownership.css');
 assert.match(stage,/const ownership=trackStatusOwnership\(/);
 assert.match(stage,/hidden=\{!ownership.sourceStatusVisible\}/);
 assert.match(stage,/ownership.webcamAction&&<button/);
 assert.match(stage,/ownership.showBodyAction&&<button/);
 assert.match(stage,/showSetupHint&&ownership.showInlineAssistant/);
 assert.match(stage,/sourceMode==='switch-body'&&!operatorMode&&composerOpen&&/);
 assert.match(stage,/className="trk06a-preview-warming"/);
 assert.match(stage,/hidden=\{!composerOpen&&!operatorMode&&!ownership.showTrackingFeedback\}/);
 assert.match(style,/\[data-workspace=track\]/);
 assert.doesNotMatch(style,/\[data-workspace=compose\]/);
 assert.match(style,/prefers-reduced-motion:reduce/);
 assert.match(stage,/import '\.\/trk06a-status-ownership.css'/);
});
