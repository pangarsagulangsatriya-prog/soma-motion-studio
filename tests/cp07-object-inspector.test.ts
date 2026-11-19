import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {normalizedCanvasPoint,pickTopmostObject,selectedLayerIndex,nudgeLayer} from '../src/studio/v3/composerObjectSelection.ts';
const src=()=>readFileSync(new URL('../src/studio/v3/SurfaceComposer.tsx',import.meta.url),'utf8');

test('CP07: click coordinates follow rendered canvas coordinates and ignore margins',()=>{
 const rect={left:100,top:50,width:800,height:450},canvas={width:960,height:540};
 assert.deepEqual(normalizedCanvasPoint(500,275,rect,canvas),{x:480,y:270});
 assert.equal(normalizedCanvasPoint(50,275,rect,canvas),null);
 assert.deepEqual(normalizedCanvasPoint(900,500,rect,canvas),{x:959,y:539});
});
test('CP07: select topmost visible, nontransparent composited layer',()=>{
 const layers=[{id:'mp4',visible:true,opacity:100},{id:'print',visible:true,opacity:60},
  {id:'hydra',visible:true,opacity:80}];
 const alpha={mp4:255,print:200,hydra:0};
 assert.deepEqual(pickTopmostObject(layers,id=>alpha[id as keyof typeof alpha]),{layerId:'print',layerIndex:1});
 assert.deepEqual(pickTopmostObject(layers,id=>id==='mp4'?255:0),{layerId:'mp4',layerIndex:0});
 assert.equal(pickTopmostObject(layers,()=>0),null);
});
test('CP07: hidden and low-opacity layers never steal selection',()=>{
 const layers=[{id:'base',visible:true,opacity:100},{id:'invisible',visible:false,opacity:100},
  {id:'faint',visible:true,opacity:2}];
 assert.deepEqual(pickTopmostObject(layers,()=>255),{layerId:'base',layerIndex:0});
});
test('CP07: selection ID survives stack changes and nudge stays bounded',()=>{
 const layers=[{id:'B'},{id:'A'},{id:'C'}];
 assert.equal(selectedLayerIndex(layers,'A'),1);
 assert.equal(selectedLayerIndex(layers,'deleted',7),2);
 assert.deepEqual(nudgeLayer({x:10,y:15},'ArrowLeft'),{x:9,y:15});
 assert.deepEqual(nudgeLayer({x:10,y:15},'ArrowDown',true),{x:10,y:20});
 assert.deepEqual(nudgeLayer({x:100,y:0},'ArrowRight'),{x:100,y:0});
 assert.equal(nudgeLayer({x:0,y:0},'Escape'),null);
});
test('CP07: live canvas picking and layer stack use same Inspector selection state',()=>{
 const s=src();
 assert.match(s,/pickTopmostObject\(layers,id=>/);
 assert.match(s,/setSelectedLayer\(picked\.layerIndex\);setInspectorTab\('object'\)/);
 assert.match(s,/onPointerDown=\{points\}/);
 assert.match(s,/setSelectedLayer\(i\);setInspectorTab\('object'\)/);
 assert.match(s,/previewArrangement!=='surface'/);
 assert.match(s,/if\(editMask&&layer\)/);
 assert.match(s,/previewLayerAlpha\.current/);
 assert.match(s,/nudgeLayer\(layer,event\.key,event\.shiftKey\)/);
});
