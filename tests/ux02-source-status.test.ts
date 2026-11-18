import assert from 'node:assert/strict';
import test from 'node:test';
import {deriveFootprintsInputStatus,canStartSourceSwitch,requiresSourceRecheck} from '../src/studio/v3/sourceSwitchModel.ts';

const base={selection:'webcam' as const,cameraOn:false,cameraBusy:false,cameraError:'',phoneActive:false,switchBusy:false,switchError:''};

test('webcam errors remain actionable',()=>{
 const status=deriveFootprintsInputStatus({...base,cameraError:'Kamera ditolak'});
 assert.equal(status.phase,'error');
 assert.equal(status.message,'Kamera ditolak');
});

test('webcam camera busy is connecting',()=>{
 assert.equal(deriveFootprintsInputStatus({...base,cameraBusy:true}).phase,'connecting');
});

test('stale webcam error does not contaminate video session',()=>{
 const status=deriveFootprintsInputStatus({...base,selection:'video',cameraBusy:true,cameraError:'Kamera ditolak'});
 assert.equal(status.phase,'experiment');
 assert.match(status.message,/MP4/);
});

test('stale webcam error does not contaminate simulator session',()=>{
 assert.equal(deriveFootprintsInputStatus({...base,selection:'simulator',cameraError:'Kamera gagal'}).phase,'experiment');
});

test('source switching error stays visible for experimental source',()=>{
 const status=deriveFootprintsInputStatus({...base,selection:'video',switchError:'Tidak dapat memuat berkas'});
 assert.equal(status.phase,'error');
});

test('phone pairing and ready phases follow phone connection',()=>{
 assert.equal(deriveFootprintsInputStatus({...base,selection:'phone'}).phase,'pairing');
 assert.equal(deriveFootprintsInputStatus({...base,selection:'phone',phoneActive:true,cameraOn:true}).phase,'ready');
});

test('source switch guard prevents duplicate or concurrent switch',()=>{
 assert.equal(canStartSourceSwitch({busy:true,from:'webcam',to:'video'}),false);
 assert.equal(canStartSourceSwitch({busy:false,from:'webcam',to:'webcam'}),false);
 assert.equal(canStartSourceSwitch({busy:false,from:'webcam',to:'video'}),true);
 assert.equal(requiresSourceRecheck('webcam','video'),true);
 assert.equal(requiresSourceRecheck('webcam','webcam'),false);
});
