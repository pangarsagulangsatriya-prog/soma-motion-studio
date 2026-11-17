import test from 'node:test';
import assert from 'node:assert/strict';
import {deriveSourceScreenMode,showsSourcePicker,showsGaitPreviews}
 from '../src/studio/v3/sourceScreenModel.ts';

const base={
 cameraOn:false,cameraBusy:false,cameraError:'',bodySelected:false,videoReady:false
};

test('offline Footprints shows compact source picker and hides empty gait surfaces',()=>{
 const mode=deriveSourceScreenMode(base);
 assert.equal(mode,'select');assert.equal(showsSourcePicker(mode),true);
 assert.equal(showsGaitPreviews(mode),false);
});
test('connecting camera keeps source picker visible and cannot imply projector readiness',()=>{
 const mode=deriveSourceScreenMode({...base,cameraBusy:true});
 assert.equal(mode,'connecting');assert.equal(showsSourcePicker(mode),true);
 assert.equal(showsGaitPreviews(mode),false);
});
test('camera errors offer recovery before a fresh live source is available',()=>{
 const mode=deriveSourceScreenMode({...base,cameraError:'Permission denied'});
 assert.equal(mode,'recover');assert.equal(showsSourcePicker(mode),true);
 assert.equal(showsGaitPreviews(mode),false);
});
test('camera connected in Hands/Face mode explicitly requires Body',()=>{
 const mode=deriveSourceScreenMode({...base,cameraOn:true,videoReady:true});
 assert.equal(mode,'switch-body');
 assert.equal(showsSourcePicker(mode),false);
 assert.equal(showsGaitPreviews(mode),false);
});
test('camera with Body selected waits for first actual video frame',()=>{
 const mode=deriveSourceScreenMode({...base,cameraOn:true,bodySelected:true});
 assert.equal(mode,'warming');
 assert.equal(showsGaitPreviews(mode),false);
});
test('Body camera frame shows live camera and BODY/FLOOR side previews',()=>{
 const mode=deriveSourceScreenMode({...base,cameraOn:true,bodySelected:true,videoReady:true});
 assert.equal(mode,'live');
 assert.equal(showsSourcePicker(mode),false);
 assert.equal(showsGaitPreviews(mode),true);
});
test('mode resets safely after disconnection, even with stale tracking state',()=>{
 const active=deriveSourceScreenMode({...base,cameraOn:true,bodySelected:true,videoReady:true});
 const disconnected=deriveSourceScreenMode({...base,bodySelected:true,videoReady:true});
 assert.equal(active,'live');assert.equal(disconnected,'select');
});
test('busy camera acquisition overrides stale camera errors or an old frame',()=>{
 const mode=deriveSourceScreenMode({...base,cameraBusy:true,cameraError:'previous error',videoReady:true});
 assert.equal(mode,'connecting');
});
