import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {PERFORM_DESTINATIONS,presentPerformDestination,routeChangeRequiresBlackout,performCueScope} from '../src/studio/v3/performDestinationModel.ts';
import {evaluatePerformOutputSummary,deriveSurfaceBadge} from '../src/studio/v3/performOutputModel.ts';
import {canStreamCleanFeed} from '../src/footprints/stage-optics/DualSurfaceSessionStore.ts';
import type {SurfaceDeviceState} from '../src/footprints/stage-optics/DualSurfaceSessionStore.ts';

const read=(name:string)=>readFileSync(new URL(name,import.meta.url),'utf8');
const device=(state:'offline'|'opening'|'blackout'|'live'):SurfaceDeviceState=>({
 connected:state==='blackout'||state==='live',opened:state!=='offline',
 mode:state==='live'?'live':'blackout',viewport:null,reason:'QA fixture'
});
const state=(hardwareEnabled:boolean,source:'webcam'|'video'='webcam',floor='offline' as 'offline'|'opening'|'blackout'|'live')=>
 evaluatePerformOutputSummary({hardwareEnabled,source,cameraOk:true,identityOk:true,
 floorOk:true,floorDevice:device(floor),bodyDevice:device('offline'),
 floorQaOk:false,bodyQaOk:false,operatorConfirm:false});
const view=(route:'soma'|'resolume'|'touchdesigner',summary:ReturnType<typeof state>)=>
 presentPerformDestination({route,primary:summary.primaryAction,
  floor:summary.floorBadge,body:summary.bodyBadge});

test('PF-UX-01: three output contracts distinguish visual feeds from local TD data',()=>{
 assert.deepEqual(PERFORM_DESTINATIONS.map(x=>x.id),['soma','resolume','touchdesigner']);
 assert.match(PERFORM_DESTINATIONS[0].description,/LIVE.*QA/);
 assert.match(PERFORM_DESTINATIONS[1].description,/belum membuktikan penerimaan/);
 assert.match(PERFORM_DESTINATIONS[2].description,/WebSocket lokal/);
 assert.ok(PERFORM_DESTINATIONS.every(x=>x.description.length<155));
});
test('PF-UX-04: production lock never claims open, ready or LIVE',()=>{
 const locked=view('soma',state(false));
 assert.equal(locked.kind,'info');
 assert.equal(locked.tone,'locked');
 assert.equal(locked.state,'Terkunci · build');
 assert.equal(view('soma',state(true,'video')).state,'Siap dibuka');
});
test('PF-UX-04: direct output follows setup -> open -> QA -> explicit arm -> LIVE',()=>{
 const base=state(true);
 assert.equal(view('soma',base).state,'Siap dibuka');
 assert.equal(view('soma',state(true,'webcam','blackout')).state,'Terbuka · Blackout');
 assert.equal(view('soma',state(true,'webcam','live')).state,'LIVE');
});
test('PF-UX-01: Resolume feed does not masquerade as hardware light authorization',()=>{
 assert.equal(view('resolume',state(false)).state,'Feed belum dibuka');
 assert.equal(view('resolume',state(false,'video','opening')).state,'Menunggu sambungan');
 assert.equal(view('resolume',state(false,'video','blackout')).state,'Feed Blackout / HOLD');
 assert.match(view('resolume',state(false,'video','blackout')).hint,/Lanjutkan Visual/);
});
test('PF-UX-03: cue changes monitor only on Direct/Resolume and data cue only on active TD',()=>{
 assert.match(performCueScope('soma'),/operator saja/);
 assert.match(performCueScope('resolume'),/operator saja/);
 assert.match(performCueScope('touchdesigner'),/saat data sedang mengalir/);
});
test('PF-UX-04: changing route always orders blackout and never silently opens output',()=>{
 for(const old of PERFORM_DESTINATIONS){
  for(const next of PERFORM_DESTINATIONS)
   assert.equal(routeChangeRequiresBlackout(old.id,next.id),old.id!==next.id);
 }
 const console=read('../src/studio/v3/OperatorStageConsole.tsx');
 assert.match(console,/blackoutAllDualSurfaces\('Tujuan output diganti/);
 assert.match(console,/window.dispatchEvent\(new Event\('soma:td-blackout'\)\)/);
 assert.match(console,/getDualSurfaceFeedUrl/);
 assert.match(console,/STAGE_HARDWARE_ENABLED/);
 assert.doesNotMatch(console,/new ProjectionLink|getUserMedia\(/);
});
test('PF-UX-02: one output CTA, details contain secondary per-surface controls',()=>{
 const ui=read('../src/studio/v3/OperatorStageConsole.tsx');
 assert.match(ui,/className="ops-r1-primary-cta"/);
 assert.match(ui,/className="ops-r1-output-details"/);
 assert.match(ui,/className="ops-r1-channel-row"/);
 assert.match(ui,/aria-label="Tujuan output"/);
 assert.doesNotMatch(ui,/className="ops-r1-cue-slots"/);
 assert.match(ui,/className="ops-r1-cue-transport"/);
 assert.match(ui,/Details|Detail koneksi/);
});
test('PF-UX-05: TD receiver handles disconnect and releases physical permission separately',()=>{
 const td=read('../src/studio/v3/TouchDesignerPerformPanel.tsx');
 const client=read('../src/studio/v3/touchDesignerClient.ts');
 assert.match(td,/className="soma-td-primary"/);
 assert.match(td,/className="soma-td-details"/);
 assert.match(td,/STAGE_BLACKOUT_EVENT/);
 assert.match(client,/this\.socket\.bufferedAmount>MAX_BUFFERED/);
 assert.match(client,/Koneksi TouchDesigner terputus/);
 assert.match(client,/this\.control\('blackout'\)/);
});

test('PF-UX-04: secondary FLOOR/BODY open remains disabled only for build locks',()=>{
 const console=read('../src/studio/v3/OperatorStageConsole.tsx');
 assert.match(console,/disabled=\{!isResolume&&!summary\.canOpenOutput\}/);
 assert.match(console,/if\(!isResolume&&!summary\.canOpenOutput\)/);
 assert.equal(state(false).canOpenOutput,false);
 assert.equal(state(true,'video').canOpenOutput,true);
 assert.equal(state(true,'webcam').canOpenOutput,true);
});

test('PF-UX: Clean Feed reports actual frames, not just an open popup',()=>{
 const feedDevice:SurfaceDeviceState={
  connected:true,opened:true,viewport:{width:1280,height:720,dpr:1},
  mode:'feed',reason:'Artwork frames received'
 };
 const model=evaluatePerformOutputSummary({
  hardwareEnabled:true,source:'video',cameraOk:true,identityOk:true,floorOk:true,
  floorDevice:feedDevice,bodyDevice:device('offline'),
  floorQaOk:false,bodyQaOk:false,operatorConfirm:false
 });
 assert.equal(deriveSurfaceBadge('floor',feedDevice).status,'Feed');
 assert.equal(view('resolume',model).state,'Feed mengalir');
 assert.notEqual(view('soma',model).state,'LIVE');
});
test('PF-UX: a feed needs explicit opening, a fresh source and a live raster; no QA is fabricated',()=>{
 const good={requested:true,connected:true,sourceFresh:true,cameraSafe:true,visualReady:true,canvasReady:true};
 assert.equal(canStreamCleanFeed(good),true);
 for(const key of Object.keys(good) as Array<keyof typeof good>){
  assert.equal(canStreamCleanFeed({...good,[key]:false}),false,key+' must block feed');
 }
 const src=read('../src/footprints/stage-optics/DualSurfaceSessionStore.ts');
 assert.match(src,/outputMode\[id\]==='resolume'/);
 assert.match(src,/feedEnabled\[id\]=false/);
 assert.match(src,/link\.sendArtwork\(stageSurfaceState\(plan,mode==='feed'/);
});
