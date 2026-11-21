import test from 'node:test';
import assert from 'node:assert/strict';
import {identityQuad} from '../src/projection/geometry.ts';
import {containedImageRect,initialCameraQuad,pointerInSource,replaceValidCorner,mapWarpPoint}
 from '../src/studio/v3/mapWysiwygModel.ts';

test('MAP-V2 camera media contain rectangle keeps corners away from letterboxes',()=>{
 const box=containedImageRect(1080,1920,640,360);
 assert.ok(box);
 assert.equal(box!.height,360);
 assert.equal(box!.x>0,true);
 assert.equal(pointerInSource(box!.x-1,180,box!),null);
 assert.equal(pointerInSource(box!.x+box!.width+1,180,box!),null);
 const p=pointerInSource(box!.x+box!.width*.25,box!.y+box!.height*.75,box!);
 assert.ok(p);
 assert.ok(Math.abs(p!.x-.25)<1e-8&&Math.abs(p!.y-.75)<1e-8);
 assert.equal(containedImageRect(0,100,640,360),null);
});
test('MAP-V2 four camera points reject crossed and degenerate geometry and keep saved data',()=>{
 const original=initialCameraQuad();
 assert.equal(replaceValidCorner(original,0,{x:1,y:1}),null);
 assert.equal(replaceValidCorner(original,1,{x:original[0].x,y:original[0].y}),null);
 assert.equal(replaceValidCorner(original,0,{x:-.1,y:.4}),null);
 const moved=replaceValidCorner(original,0,{x:.15,y:.25});
 assert.ok(moved);
 assert.deepEqual(moved![0],{x:.15,y:.25});
 assert.deepEqual(original[0],{x:.08,y:.18});
});
test('MAP-V2 camera correspondence and projector registration stay separate',()=>{
 const source=identityQuad();
 const projector=[
  {x:.15,y:.07},{x:.88,y:.04},{x:.95,y:.93},{x:.1,y:.89}
 ] as const;
 const screen=mapWarpPoint(source,[...projector],{x:0,y:0});
 assert.deepEqual(screen.input,{x:0,y:0});
 assert.ok(Math.abs(screen.output.x-.15)<1e-8);
 assert.ok(Math.abs(screen.output.y-.07)<1e-8);
 const middle=mapWarpPoint(source,[...projector],{x:.5,y:.5});
 assert.ok(middle.output.x>0&&middle.output.x<1);
});
