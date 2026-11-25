import test from 'node:test';
import assert from 'node:assert/strict';
import {canPlayDirectVisual,directPlaybackFileKey} from '../src/footprints/stage-optics/DirectVisualPlayback.ts';
test('Visual Playback requires explicit signature and every independent gate',()=>{
 const good={hardwareEnabled:true,experiment:true,direct:true,connected:true,fresh:true,
 sourceReady:true,visualReady:true,canvasReady:true,signature:'source/window/map',authorizedSignature:'source/window/map'};
 assert.equal(canPlayDirectVisual(good),true);
 for(const key of ['hardwareEnabled','experiment','direct','connected','fresh','sourceReady','visualReady','canvasReady'] as const)
  assert.equal(canPlayDirectVisual({...good,[key]:false}),false,key);
 for(const signature of ['changed-source','changed-window','changed-map',null])
  assert.equal(canPlayDirectVisual({...good,signature}),false);
 assert.equal(canPlayDirectVisual({...good,authorizedSignature:null}),false);
});
test('Playback binds an actual clip object, not the filename',()=>{
 const a={name:'clip.mp4'},b={name:'clip.mp4'};
 assert.equal(directPlaybackFileKey(a),directPlaybackFileKey(a));
 assert.notEqual(directPlaybackFileKey(a),directPlaybackFileKey(b));
});
