import test from 'node:test';
import assert from 'node:assert/strict';
import {isDismissEscape,shouldOpenInspector,shouldEnterInspectorByArrow,
 RAIL_TOOLTIP_DELAY_MS} from '../src/studio/v3/interactionPolicy.ts';

test('plain Escape closes local panels but Shift+Escape stays available for stage safety',()=>{
 assert.equal(isDismissEscape({key:'Escape',shiftKey:false}),true);
 assert.equal(isDismissEscape({key:'Escape',shiftKey:true}),false);
 assert.equal(isDismissEscape({key:'Enter',shiftKey:false}),false);
});
test('tooltip hover waits briefly while keyboard tooltip can display on focus',()=>{
 assert.ok(RAIL_TOOLTIP_DELAY_MS>=180);
 assert.ok(RAIL_TOOLTIP_DELAY_MS<=350);
});
test('clicking an inactive workflow tab opens the relevant inspector',()=>{
 assert.equal(shouldOpenInspector({
  sameStep:false,panelOpen:false,cameraOn:true,step:'process'
 }),true);
 assert.equal(shouldOpenInspector({
  sameStep:false,panelOpen:false,cameraOn:true,step:'compose'
 }),true);
});
test('reselecting the active workflow tab closes its inspector',()=>{
 assert.equal(shouldOpenInspector({
  sameStep:true,panelOpen:true,cameraOn:true,step:'process'
 }),false);
});
test('a status control always opens the inspector even when its tab was already active',()=>{
 assert.equal(shouldOpenInspector({
  sameStep:true,panelOpen:true,cameraOn:true,step:'process',forceOpen:true
 }),true);
});
test('offline source uses the actionable source screen instead of empty inspector',()=>{
 assert.equal(shouldOpenInspector({
  sameStep:false,panelOpen:false,cameraOn:false,step:'input'
 }),false);
 assert.equal(shouldOpenInspector({
  sameStep:true,panelOpen:true,cameraOn:false,step:'input',forceOpen:true
 }),true);
});
test('down arrow enters controls only when the panel is open for selected tab',()=>{
 assert.equal(shouldEnterInspectorByArrow({key:'ArrowDown'},true),true);
 assert.equal(shouldEnterInspectorByArrow({key:'ArrowDown'},false),false);
 assert.equal(shouldEnterInspectorByArrow({key:'ArrowUp'},true),false);
});
