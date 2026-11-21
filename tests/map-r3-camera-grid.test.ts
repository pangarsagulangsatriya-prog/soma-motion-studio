import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {mapGridFractions} from '../src/studio/v3/mapStageModel.ts';

test('MAP-R3 grid is measured in physical meters rather than percent of canvas',()=>{
 assert.equal(mapGridFractions(5,1).length,4);
 assert.equal(mapGridFractions(5,0.5).length,9);
 assert.equal(mapGridFractions(5,0.25).length,19);
 assert.ok(Math.abs(mapGridFractions(5,0.5)[0]-.1)<1e-12);
 assert.ok(Math.abs(mapGridFractions(2.5,0.25).at(-1)!-.9)<1e-12);
 assert.deepEqual(mapGridFractions(0,0.5),[]);
 assert.deepEqual(mapGridFractions(5,0),[]);
 assert.ok(mapGridFractions(20,0.25).length<=80);
});

test('MAP-R3 Camera and Stage share monitor, and fullscreen does not open physical output',()=>{
 const read=(file:string)=>readFileSync(new URL(file,import.meta.url),'utf8');
 const monitor=read('../src/studio/v3/MapStageMonitor.tsx');
 const router=read('../src/footprints/stage-optics/DualSurfaceRoutingPanel.tsx');
 assert.match(monitor,/requestFullscreen\?\.\(\)/);
 assert.match(monitor,/document\.fullscreenElement===monitorRef\.current/);
 assert.match(monitor,/Fullscreen Map Monitor/);
 assert.match(monitor,/\['align','Kamera \+ Panggung'\]/);
 assert.match(monitor,/view==='align'&&<div className="map-r2-split map-r2-alignment"/);
 assert.match(monitor,/sourceKind==='camera'&&vid&&vid\.readyState>=2/);
 assert.match(monitor,/frameRef\?\.current\?\.pose\?\.length/);
 assert.match(monitor,/cal\.cameraQuad\.length===4/);
 assert.match(router,/setMonitorView\('align'\)/);
 assert.match(router,/className="map-r2-advanced"/);
 assert.match(router,/className="stage-dual-qa-disclosure"/);
 assert.match(router,/allBlackout/);
 assert.match(router,/STAGE_HARDWARE_ENABLED/);
});
