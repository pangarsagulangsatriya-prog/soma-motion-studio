import test from 'node:test';
import assert from 'node:assert/strict';
import {
 detectResolumeHostPlatform,getResolumeBridgeRecipe,getPerformRouteDescription,
 RESOLUME_BRIDGE_DOCS
} from '../src/studio/v3/resolumeBridgeModel.ts';

test('Perform bridge detects macOS, Windows, and explicitly unknown devices',()=>{
 assert.equal(detectResolumeHostPlatform('Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7)'),'mac');
 assert.equal(detectResolumeHostPlatform('Mozilla/5.0 (Windows NT 10.0; Win64; x64)'),'windows');
 assert.equal(detectResolumeHostPlatform('Mozilla/5.0 (X11; Linux x86_64)'),'other');
});
test('Mac uses OBS Window Capture + native Syphon; Windows uses Spout',()=>{
 const mac=getResolumeBridgeRecipe('mac'),win=getResolumeBridgeRecipe('windows');
 assert.equal(mac.transport,'Syphon');
 assert.equal(win.transport,'Spout');
 assert.match(mac.obsCapture,/Window Capture/);
 assert.match(win.obsCapture,/Window Capture/);
 assert.match(mac.resolumeSource,/Sources → Syphon/);
 assert.match(win.resolumeSource,/Sources → Spout/);
 assert.equal(mac.pluginUrl,RESOLUME_BRIDGE_DOCS.mac);
 assert.equal(win.pluginUrl,RESOLUME_BRIDGE_DOCS.windows);
 assert.equal(mac.supportsNativeSender,true);
 assert.equal(win.supportsNativeSender,true);
 const fallback=getResolumeBridgeRecipe('other');
 assert.equal(fallback.supportsNativeSender,false);
 assert.equal(fallback.pluginUrl,null);
});
test('Direct maps to projector; Resolume source needs native bridge',()=>{
 assert.match(getPerformRouteDescription('soma'),/fullscreen proyektor/);
 assert.match(getPerformRouteDescription('resolume'),/OBS → Syphon\/Spout → Resolume/);
});
