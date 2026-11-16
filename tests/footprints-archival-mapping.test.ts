import test from 'node:test';
import assert from 'node:assert/strict';
import type {MotionFrame} from '../src/engine/types.ts';
import {buildLowerBodyMask,LOWER_BODY_MASK_DEFAULTS,sampleLowerBodyFrame} from '../src/footprints/stage-optics/LowerBodyMaskEngine.ts';
import {archiveGrain,archiveSessionReport,compositeArchivalFrame,
 DEFAULT_ARCHIVE_PLAYBACK,validateArchivePlayback,type ArchivePixels,
 type ArchiveSettings} from '../src/footprints/stage-optics/ArchivalCompositeEngine.ts';

const clips=(shade:number):ArchivePixels=>({width:80,height:45,
 data:Uint8ClampedArray.from(Array.from({length:80*45},()=>[shade,shade,shade,255]).flat())});
const config:ArchiveSettings={
 A:{...DEFAULT_ARCHIVE_PLAYBACK,grain:0,contrast:1,zoom:1,brightness:1},
 B:{...DEFAULT_ARCHIVE_PLAYBACK,grain:0,contrast:1,zoom:1,brightness:1}
};
const makeMask=(n:1|2=2,phase=0,overlap=false)=>
 buildLowerBodyMask(sampleLowerBodyFrame(1000,n,phase,overlap),{
  ...LOWER_BODY_MASK_DEFAULTS,performers:n},1000);
const brightness=(p:ArchivePixels,i:number)=>p.data[4*i];
// Use a high-confidence interior pixel; the first nonzero pixel is a feathered edge.
const first=(data:Uint8Array)=>{
 let best=-1,max=-1;
 for(let i=0;i<data.length;i++)if(data[i]>max){max=data[i];best=i;}
 return max>100?best:-1;
};
test('A/B uploaded sources render independently in their original masks, monochrome with black upper frame',()=>{
 const mask=makeMask(),a=clips(40),b=clips(220);
 const result=compositeArchivalFrame(mask,{A:a,B:b},config,{A:0,B:1});
 assert.equal(result.status,'ready');
 assert.deepEqual(result.activeSlots,['A','B']);
 const ia=first(mask.perPoseMasks[0].data),ib=first(mask.perPoseMasks[1].data);
 assert.ok(ia>=0&&ib>=0);
 assert.ok(brightness(result.pixels,ia)>0&&brightness(result.pixels,ia)<100);
 assert.ok(brightness(result.pixels,ib)>160);
 for(let i=0;i<result.pixels.width*result.pixels.height;i++){
  assert.equal(result.pixels.data[i*4],result.pixels.data[i*4+1]);
  assert.equal(result.pixels.data[i*4+1],result.pixels.data[i*4+2]);
  assert.equal(result.pixels.data[i*4+3],255);
  if(mask.mask.data[i]===0)assert.equal(brightness(result.pixels,i),0);
 }
 const headIndex=2*mask.mask.width+Math.floor(.29*mask.mask.width);
 assert.equal(brightness(result.pixels,headIndex),0);
});
test('clip availability affects only the assigned performer; no fallback footage or white silhouettes',()=>{
 const mask=makeMask(),result=compositeArchivalFrame(mask,{A:clips(190),B:null},config,{A:0,B:1});
 assert.equal(result.status,'partial');
 const ib=first(mask.perPoseMasks[1].data),ia=first(mask.perPoseMasks[0].data);
 assert.equal(brightness(result.pixels,ib),0);
 assert.ok(brightness(result.pixels,ia)>0);
 assert.equal(compositeArchivalFrame(mask,{A:null,B:null},config,{A:0,B:1}).status,'blackout');
});
test('identity reorder uses explicit mapping, never accidental pose array order',()=>{
 const mask=makeMask(),a=clips(35),b=clips(220);
 const swapped=compositeArchivalFrame(mask,{A:a,B:b},config,{A:1,B:0});
 const normal=compositeArchivalFrame(mask,{A:a,B:b},config,{A:0,B:1});
 const p0=first(mask.perPoseMasks[0].data);
 assert.ok(brightness(swapped.pixels,p0)>brightness(normal.pixels,p0)+100);
 assert.equal(compositeArchivalFrame(mask,{A:a,B:b},config,{A:0,B:0}).status,'blackout');
 assert.equal(compositeArchivalFrame(mask,{A:a,B:b},config,{A:null,B:1}).litPixels,0);
});
test('lost or ambiguous body tracking fails black even when both videos have readable pixels',()=>{
 const sources={A:clips(220),B:clips(190)};
 const crossing=makeMask(2,2.3,true);
 assert.equal(crossing.status,'ambiguous');
 const blocked=compositeArchivalFrame(crossing,sources,config,{A:0,B:1});
 assert.equal(blocked.status,'blackout');assert.equal(blocked.litPixels,0);
 const frame=sampleLowerBodyFrame(1000,2);
 const stale=buildLowerBodyMask(frame,LOWER_BODY_MASK_DEFAULTS,1500);
 assert.equal(compositeArchivalFrame(stale,sources,config,{A:0,B:1}).litPixels,0);
 const missing:MotionFrame={...frame,poses:frame.poses!.slice(0,1)};
 const no=compositeArchivalFrame(buildLowerBodyMask(missing,LOWER_BODY_MASK_DEFAULTS,1000),
  sources,config,{A:0,B:1});
 assert.equal(no.status,'blackout');
});
test('intensity, zoom, crop, grain, opacity, invert preserve tight mask bounds',()=>{
 const mask=makeMask(1),img:ArchivePixels={width:2,height:2,
 data:new Uint8ClampedArray([20,10,30,255,210,190,130,255,80,60,40,255,240,230,200,255])};
 const low={...config,A:{...config.A,zoom:2.4,panX:1,panY:-1,opacity:.1,grain:.4,invert:true}};
 const result=compositeArchivalFrame(mask,{A:img,B:null},low,{A:0,B:null},99);
 assert.equal(result.status,'ready');
 for(let i=0;i<mask.mask.data.length;i++){
  const val=brightness(result.pixels,i);
  assert.ok(val<=255&&val>=0);
  if(!mask.mask.data[i])assert.equal(val,0);
 }
 assert.equal(archiveGrain(2,3,40,0),archiveGrain(2,3,40,0));
 assert.notEqual(archiveGrain(2,3,40,0),archiveGrain(2,3,44,0));
});
test('reject malformed clip buffers and invalid playback parameters; never accepts missing pixels as footage',()=>{
 const mask=makeMask(1),invalid={width:2,height:2,data:new Uint8ClampedArray(3)};
 assert.equal(compositeArchivalFrame(mask,{A:invalid,B:null},config,{A:0,B:null}).status,'blackout');
 assert.throws(()=>validateArchivePlayback({...DEFAULT_ARCHIVE_PLAYBACK,speed:0}));
 assert.throws(()=>validateArchivePlayback({...DEFAULT_ARCHIVE_PLAYBACK,zoom:20}));
 assert.throws(()=>validateArchivePlayback({...DEFAULT_ARCHIVE_PLAYBACK,panX:3}));
 assert.throws(()=>validateArchivePlayback({...DEFAULT_ARCHIVE_PLAYBACK,contrast:Infinity}));
 assert.throws(()=>validateArchivePlayback({...DEFAULT_ARCHIVE_PLAYBACK,grain:1}));
});
test('preview report stores filenames/settings, not video bytes and never claims hardware acceptance',()=>{
 const settings:ArchiveSettings={A:{...config.A},B:{...config.B}};
 const report=archiveSessionReport(settings,{A:'kaki-sawah.mp4',B:'kaki-pelabuhan.mp4'},2);
 assert.equal(report.projectionReady,false);
 assert.equal(report.files.A,'kaki-sawah.mp4');
 assert.equal(report.settings.B.speed,1);
 assert.ok(!JSON.stringify(report).includes('data:video'));
});
