import test from 'node:test';
import assert from 'node:assert/strict';
import {SOURCE_CHOICES,SOURCE_LABELS,deriveFootprintsInputStatus,
 canStartSourceSwitch,requiresSourceRecheck} from '../src/studio/v3/sourceSwitchModel.ts';

const base={selection:null,cameraOn:false,cameraBusy:false,cameraError:'',
 phoneActive:false,switchBusy:false,switchError:''} as const;

test('S6.8.1: all four source routes remain available, Labs are explicit',()=>{
 assert.deepEqual(SOURCE_CHOICES.map(x=>x.id),['webcam','phone','video','simulator']);
 assert.equal(SOURCE_CHOICES.filter(x=>x.kind==='live').length,2);
 assert.deepEqual(SOURCE_CHOICES.filter(x=>x.kind==='lab').map(x=>x.id),['video','simulator']);
 assert.equal(SOURCE_LABELS.phone,'Kamera HP');
});
test('initial state does not invent an active camera',()=>{
 assert.deepEqual(deriveFootprintsInputStatus(base),{
  selection:null,phase:'idle',message:'Pilih sumber gerak.'
 });
});
test('webcam connecting is separate from confirmed camera readiness',()=>{
 assert.equal(deriveFootprintsInputStatus({...base,selection:'webcam',switchBusy:true}).phase,'connecting');
 assert.equal(deriveFootprintsInputStatus({...base,selection:'webcam',cameraBusy:true,cameraOn:true}).phase,'connecting');
 assert.equal(deriveFootprintsInputStatus({...base,selection:'webcam',cameraOn:true}).phase,'ready');
});
test('phone pairing does not count as connected before actual video',()=>{
 const pairing=deriveFootprintsInputStatus({...base,selection:'phone'});
 assert.equal(pairing.phase,'pairing');
 assert.equal(deriveFootprintsInputStatus({...base,selection:'phone',cameraOn:true,phoneActive:false}).phase,'pairing');
 assert.equal(deriveFootprintsInputStatus({...base,selection:'phone',cameraOn:true,phoneActive:true}).phase,'ready');
});
test('webcam permission failure keeps explicit error',()=>{
 const data=deriveFootprintsInputStatus({...base,selection:'webcam',cameraError:'Akses ditolak'});
 assert.equal(data.phase,'error');
 assert.match(data.message,/ditolak/);
});
test('disconnected phone keeps recovery error instead of ready indicator',()=>{
 const data=deriveFootprintsInputStatus({...base,selection:'phone',
  switchError:'Koneksi HP terputus'});
 assert.equal(data.phase,'error');
 assert.match(data.message,/terputus/);
});
test('MP4 and 3D remain labs until video and simulation enter the live input engine',()=>{
 for(const selection of ['video','simulator'] as const){
  const data=deriveFootprintsInputStatus({...base,selection});
  assert.equal(data.phase,'lab');
  assert.match(data.message,/eksperimen terpisah/);
 }
});
test('source changes invalidate camera-specific calibration while reselecting the same does not',()=>{
 assert.equal(requiresSourceRecheck('phone','webcam'),true);
 assert.equal(requiresSourceRecheck('webcam','webcam'),false);
 assert.equal(requiresSourceRecheck(null,'phone'),true);
});
test('busy source switching rejects overlapping transactions',()=>{
 assert.equal(canStartSourceSwitch({busy:true,from:'phone',to:'webcam'}),false);
 assert.equal(canStartSourceSwitch({busy:false,from:'phone',to:'webcam'}),true);
 assert.equal(canStartSourceSwitch({busy:false,from:'webcam',to:'webcam'}),false);
});
