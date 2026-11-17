import test from 'node:test';
import assert from 'node:assert/strict';
import {VIDEO_LAB_MAX_BYTES,validVideoLabFile,clampVideoTime,stepVideoTime,
 validLoopRange,formatVideoTime,simpleVideoFilename} from '../src/stage/videoMotionLabUtils.ts';
test('accept MP4/WebM and reject unsupported, spoofed and oversized files',()=>{
 assert.equal(validVideoLabFile({name:'walking.mp4',size:6_000_000,type:'video/mp4'}),null);
 assert.equal(validVideoLabFile({name:'walking.webm',size:6000,type:'video/webm'}),null);
 assert.match(validVideoLabFile({name:'walking.exe',size:2000,type:'application/octet-stream'})??'',/MP4/);
 assert.match(validVideoLabFile({name:'walking.mp4',size:2000,type:'application/pdf'})??'',/bukan video/);
 assert.match(validVideoLabFile({name:'walking.mp4',size:VIDEO_LAB_MAX_BYTES+1,type:'video/mp4'})??'',/maksimal/);
 assert.ok(validVideoLabFile({name:'walking.mp4',size:0,type:'video/mp4'}));
});
test('time calculations are clamped to finite positive duration',()=>{
 assert.equal(clampVideoTime(-20,14),0);
 assert.equal(clampVideoTime(25,14),14);
 assert.equal(clampVideoTime(NaN,14),0);
 assert.equal(clampVideoTime(2,Infinity),0);
 assert.equal(stepVideoTime(0,10,25,-1),0);
 assert.equal(stepVideoTime(9.999,10,30,1),10);
 assert.ok(Math.abs(stepVideoTime(1,10,24,1)-1.0416666666666667)<1e-9);
});
test('loop range requires at least 50ms and remains inside video',()=>{
 assert.deepEqual(validLoopRange(-3,50,10),{start:0,end:10});
 assert.equal(validLoopRange(3,3.03,10),null);
 assert.equal(validLoopRange(4,2,10),null);
 assert.equal(validLoopRange(1,2,0),null);
});
test('timecode and capture filenames remain stable',()=>{
 assert.equal(formatVideoTime(62.245),'00:01:02.245');
 assert.equal(formatVideoTime(-20),'00:00:00.000');
 assert.equal(simpleVideoFilename('../../walking field (1).MP4'),'walking-field-1');
 assert.equal(simpleVideoFilename('***'),'video');
});
