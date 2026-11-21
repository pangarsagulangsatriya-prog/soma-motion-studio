import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import {
 DEFAULT_CAMERA_CAPTURE_SIZE,
 WIDE_CAMERA_ASPECT_RATIO,
 buildHorizontalCameraConstraints,
 isPortraitStreamDimensions
} from '../src/engine/cameraConstraints.ts';
import {
 COMPOSE_VIEW_TABS,
 LOWER_BODY_QUICK_PRESETS,
 applyLowerBodyQuickPreset,
 buildSimulatedLowerBodyFrame,
 defaultLowerBodyState,
 resolveMaskGeometry,
 saveCustomLowerBodyPreset,
 updateLowerBodyStyle
} from '../src/studio/v3/composeLowerBodyModel.ts';
import {buildResolumeFeedUrl} from '../src/studio/v3/performOutputModel.ts';

test('camera constraints default to horizontal wide 16:9 720p, never vertical',()=>{
 assert.equal(DEFAULT_CAMERA_CAPTURE_SIZE,'720p');
 assert.ok(Math.abs(WIDE_CAMERA_ASPECT_RATIO-16/9)<1e-6);

 const c720=buildHorizontalCameraConstraints();
 const w720=(c720.width as ConstrainULongRange).ideal??0;
 const h720=(c720.height as ConstrainULongRange).ideal??0;
 assert.equal(w720,1280);
 assert.equal(h720,720);
 assert.ok(w720>h720,'720p constraints must be horizontal landscape');
 assert.equal((c720.aspectRatio as ConstrainDoubleRange).ideal,16/9);

 const c480=buildHorizontalCameraConstraints({captureSize:'480p',facingMode:'environment'});
 const w480=(c480.width as ConstrainULongRange).ideal??0;
 const h480=(c480.height as ConstrainULongRange).ideal??0;
 assert.equal(w480,854);
 assert.equal(h480,480);
 assert.ok(w480>h480,'480p constraints must remain horizontal landscape');

 assert.equal(isPortraitStreamDimensions(720,1280),true);
 assert.equal(isPortraitStreamDimensions(1280,720),false);
});

test('compose stage monitor keeps Floor, A/B, Split and real Skeleton without Foot',()=>{
 assert.deepEqual(
  COMPOSE_VIEW_TABS.map(t=>t.id),
  ['FLOOR','LEG A','LEG B','SPLIT','SKELETON']
 );
 assert.equal(COMPOSE_VIEW_TABS[0].id,'FLOOR');
});

test('lower-body quick presets cover all 8 required benchmark presets and apply cleanly',()=>{
 assert.equal(LOWER_BODY_QUICK_PRESETS.length,8);
 const names=LOWER_BODY_QUICK_PRESETS.map(p=>p.name);
 for(const required of [
  'A Red / B Blue',
  'A Green / B Magenta',
  'Both White',
  'Both Red Wash',
  'Both Blue Wash',
  'Texture Linen',
  'Texture Grain',
  'Archive B/W Fill'
 ]){
  assert.ok(names.includes(required),`Missing preset: ${required}`);
 }

 const init=defaultLowerBodyState();
 const linen=applyLowerBodyQuickPreset(init,'texture-linen');
 assert.equal(linen.look,'texture');
 assert.equal(linen.styleA.texture,'linen');
 assert.equal(linen.activePresetId,'texture-linen');

 const wash=applyLowerBodyQuickPreset(init,'both-blue-wash');
 assert.equal(wash.look,'wash');
 assert.equal(wash.styleA.color,'#3b8cff');
 assert.equal(wash.styleB.color,'#2f78e8');

 const white=applyLowerBodyQuickPreset(init,'both-white');
 assert.equal(white.styleA.color,white.styleB.color);

 const updated=updateLowerBodyStyle(init,'A',{color:'#4cd97b',opacity:2.5,brightness:0.1});
 assert.equal(updated.styleA.color,'#4cd97b');
 assert.equal(updated.styleA.opacity,1);
 assert.equal(updated.styleA.brightness,0.35);
 assert.equal(updated.styleB.color,init.styleB.color);
});

test('mask geometry presets and custom clamping behave deterministically',()=>{
 const autoGeo=resolveMaskGeometry({maskPreset:'auto',customCutoff:0.32,customSpread:1});
 const tightGeo=resolveMaskGeometry({maskPreset:'tight',customCutoff:0.32,customSpread:1});
 const wideGeo=resolveMaskGeometry({maskPreset:'wide',customCutoff:0.32,customSpread:1});
 assert.ok(tightGeo.cutoff>autoGeo.cutoff,'Tight Legs cutoff starts lower than Auto');
 assert.ok(wideGeo.spread>autoGeo.spread,'Wide Lower Body spread is wider than Auto');

 const clamped=resolveMaskGeometry({maskPreset:'custom',customCutoff:0.01,customSpread:5});
 assert.equal(clamped.cutoff,0.15);
 assert.equal(clamped.spread,1.4);
});

test('built-in lower-body simulation supports STEP L/R, SLIDE, PIVOT, and CROSSING ambiguity guard',()=>{
 const stepL=buildSimulatedLowerBodyFrame(700,'step-l',2);
 assert.equal(stepL.performers.length,2);
 assert.equal(stepL.source,'simulation');
 assert.ok(stepL.actionLabel.includes('STEP L'));

 const pivot=buildSimulatedLowerBodyFrame(900,'pivot',1);
 assert.equal(pivot.performers.length,1);
 assert.ok(Math.abs(pivot.performers[0].right.headingRad)>0.1);

 // Find crossing window when sin(phase * 0.75) approaches 0
 const crossing=buildSimulatedLowerBodyFrame(0,'crossing',2);
 assert.equal(crossing.crossing,true);
 assert.equal(crossing.ambiguous,true);
 assert.ok(crossing.actionLabel.includes('IDENTITY GUARD'));
});

test('custom preset save persists and deduplicates by name',()=>{
 const mem=new Map<string,string>();
 const storage={setItem:(k:string,v:string)=>mem.set(k,v)};
 const base=defaultLowerBodyState();
 const list1=saveCustomLowerBodyPreset([],'Panggung 1',base,storage);
 assert.equal(list1.length,1);
 const list2=saveCustomLowerBodyPreset(list1,'panggung 1',base,storage);
 assert.equal(list2.length,1);
 assert.ok(mem.size===1);
});

test('Resolume feed URL and Perform console output mode toggle contract',()=>{
 const urlFloor=buildResolumeFeedUrl('http://localhost:3000/','session-1','floor');
 assert.equal(urlFloor,'http://localhost:3000/?bodyProjection=session-1&stageSurface=floor&feed=resolume');
 const urlBody=buildResolumeFeedUrl('https://soma.stage','s2','body');
 assert.equal(urlBody,'https://soma.stage/?bodyProjection=s2&stageSurface=body&feed=resolume');

 const performSrc=fs.readFileSync('src/studio/v3/OperatorStageConsole.tsx','utf8');
 assert.ok(performSrc.includes('PERFORM_DESTINATIONS'),'Perform must render destination labels from route model');
 assert.ok(performSrc.includes('PERFORM_DESTINATIONS'),'Perform must offer source-of-truth route choices');
 const routeModel=fs.readFileSync('src/studio/v3/performDestinationModel.ts','utf8');
 assert.ok(routeModel.includes('Resolume'),'Perform must offer Resolume clean feed route');
 assert.ok(routeModel.includes('Buka Feed FLOOR'),'Perform must expose Resolume clean-feed launch CTA');
 assert.ok(!performSrc.includes('getDualSurfaceFeedUrl'),'Do not advertise a session-bound popup URL as a standalone OBS Browser Source');
 assert.ok(performSrc.includes('ops-r1-bridge-guide'),'Perform must guide OBS Window Capture + Syphon/Spout');
 assert.ok(performSrc.includes('PRIMARY_PERFORM_DESTINATIONS'),'Only the two visual routes appear as primary controls');
});
