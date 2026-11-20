import {test} from 'node:test';
import assert from 'node:assert/strict';
import {deriveFootprintsInputStatus,requiresSourceRecheck,canStartSourceSwitch,
 type FootprintsInputChoice} from '../src/studio/v3/sourceSwitchModel.ts';
import {physicalOutputPermitted,sourceSafeTransport,preserveCurrentSource}
 from '../src/studio/v3/sourceE2EGuard.ts';
import {activeExperimentKind,currentExperimentFrame,allowPhysicalOutputFromExperiment}
 from '../src/studio/v3/experimentSourceModel.ts';
import {deriveSourceScreenMode,showsSourcePicker,showsGaitPreviews}
 from '../src/studio/v3/sourceScreenModel.ts';

const state=(selection:FootprintsInputChoice|null,options:{
 cameraOn?:boolean;cameraBusy?:boolean;cameraError?:string;phoneActive?:boolean;
 switchBusy?:boolean;switchError?:string
}={})=>deriveFootprintsInputStatus({
 selection,cameraOn:false,cameraBusy:false,cameraError:'',
 phoneActive:false,switchBusy:false,switchError:'',...options
});

test('S6.8.5 complete operator sequence webcam → HP → MP4 → 3D → webcam',()=>{
 const sequence:FootprintsInputChoice[]=['webcam','phone','video','simulator','webcam'];
 for(const [i,source] of sequence.entries()){
  const previous=i===0?null:sequence[i-1];
  assert.equal(requiresSourceRecheck(previous,source),true);
  assert.equal(canStartSourceSwitch({busy:false,from:previous,to:source}),true);
  if(source==='webcam'){
   assert.equal(state(source,{cameraBusy:true,cameraOn:true}).phase,'connecting');
   assert.equal(state(source,{cameraOn:true}).phase,'ready');
   assert.equal(physicalOutputPermitted(source),true);
  }else if(source==='phone'){
   assert.equal(state(source).phase,'pairing');
   assert.equal(state(source,{cameraOn:true,phoneActive:true}).phase,'ready');
  }else{
   assert.equal(state(source).phase,'experiment');
   assert.equal(physicalOutputPermitted(source),false);
   for(const requested of ['live','hold','blackout'] as const)
    assert.equal(sourceSafeTransport(source,requested),'blackout');
  }
 }
 assert.equal(sourceSafeTransport('webcam','blackout'),'blackout');
});

test('S6.8.5 switching transaction stays locked while busy, and accepts recovery',()=>{
 assert.equal(canStartSourceSwitch({busy:true,from:'phone',to:'video'}),false);
 assert.equal(canStartSourceSwitch({busy:false,from:'phone',to:'phone'}),false);
 assert.equal(state('phone',{cameraOn:false,switchError:'Koneksi HP putus'}).phase,'error');
 assert.match(state('phone',{switchError:'Koneksi HP putus'}).message,/HP putus/);
 assert.equal(state('phone',{cameraOn:true,cameraBusy:true,phoneActive:true}).phase,'connecting');
 assert.equal(state('phone',{cameraOn:true,switchBusy:true,phoneActive:true}).phase,'connecting');
 assert.equal(state('webcam',{cameraError:'Izin kamera ditolak'}).phase,'error');
 assert.equal(state('webcam',{cameraOn:true}).phase,'ready');
});

test('S6.8.5 never discards a current MP4/3D session on source reselect',()=>{
 for(const next of ['video','simulator','phone'] as const){
  assert.equal(preserveCurrentSource({current:next,next,cameraOn:false,cameraBusy:false}),true);
 }
 assert.equal(preserveCurrentSource({current:'webcam',next:'webcam',cameraOn:true,cameraBusy:false}),true);
 assert.equal(preserveCurrentSource({current:'webcam',next:'webcam',cameraOn:true,cameraBusy:true}),false);
 assert.equal(preserveCurrentSource({current:'webcam',next:'webcam',cameraOn:false,cameraBusy:false}),false);
 assert.equal(preserveCurrentSource({current:'video',next:'simulator',cameraOn:false,cameraBusy:false}),false);
});

test('S6.8.5 old experiments cannot leak into subsequent BODY/FLOOR previews',()=>{
 const video={kind:'video',snapshot:null,video:null,timeMs:0,ready:false,name:'uji.mp4'} as const;
 const simulator={kind:'simulator',session:{} as never,performers:[],orbit:{} as never,timeMs:0,name:'Puppet'} as const;
 assert.equal(currentExperimentFrame('video',video),video);
 assert.equal(currentExperimentFrame('simulator',video),null);
 assert.equal(currentExperimentFrame('video',simulator),null);
 assert.equal(currentExperimentFrame(null,video),null);
 assert.equal(currentExperimentFrame('simulator',simulator),simulator);
 assert.equal(activeExperimentKind('webcam'),null);
 assert.equal(activeExperimentKind('phone'),null);
 assert.equal(activeExperimentKind('video'),'video');
 assert.equal(activeExperimentKind('simulator'),'simulator');
});

test('S6.8.5 live camera and experiment render gates remain distinct',()=>{
 const blank=deriveSourceScreenMode({cameraOn:false,cameraBusy:false,cameraError:'',
  bodySelected:false,videoReady:false});
 assert.equal(blank,'select');
 assert.equal(showsSourcePicker(blank),true);
 assert.equal(showsGaitPreviews(blank),false);
 const live=deriveSourceScreenMode({cameraOn:true,cameraBusy:false,cameraError:'',
  bodySelected:true,videoReady:true});
 assert.equal(live,'live');
 assert.equal(showsSourcePicker(live),false);
 assert.equal(showsGaitPreviews(live),true);
});

test('S6.8.5 experiment projector gate is fail-closed under all transport requests',()=>{
 assert.equal(allowPhysicalOutputFromExperiment(),false);
 for(const source of ['video','simulator'] as const)
  for(const mode of ['live','hold','blackout'] as const)
   assert.equal(sourceSafeTransport(source,mode),'blackout');
 for(const source of ['phone','webcam',null] as const)
  assert.equal(sourceSafeTransport(source,'live'),'live');
});
