import test from 'node:test';
import assert from 'node:assert/strict';
import {artworkMatrix} from '../src/projection/artwork.ts';
import {projectionDefaults} from '../src/projection/model.ts';
import {patternSVG,validateSession,type Sample} from '../src/footprints/pattern.ts';

test('shared projection maps a full-frame color canvas without secondary calibration',()=>{
 const config=projectionDefaults();config.mirror=false;
 const m=artworkMatrix(config,1280,720);
 assert.equal(m.length,16);
 assert.ok(Math.abs(m[0]-1)<1e-8);
 assert.ok(Math.abs(m[5]-1)<1e-8);
 assert.ok(Math.abs(m[12])<1e-8);
 assert.ok(Math.abs(m[13])<1e-8);
 config.mirror=true;
 const mirror=artworkMatrix(config,1280,720);
 assert.ok(mirror[0]<0);
 assert.ok(Math.abs(mirror[12]-1280)<1e-6);
});

test('one body session exports footprints, motion trails and chosen colors into SVG',()=>{
 const samples:Sample[]=[
  {x:.2,y:.45,t:0,side:0,join:false,heading:0,stamp:true},
  {x:.25,y:.49,t:120,side:0,join:true,heading:0,stamp:false},
  {x:.6,y:.55,t:250,side:1,join:false,heading:1,stamp:true}
 ];
 const recipe={style:'Campuran',palette:0,mirror:false,size:32,showTrail:true,colors:{background:'#0C1010',left:'#00EEDD',right:'#FFAA33'}};
 const svg=patternSVG(samples,recipe);
 assert.match(svg,/svg xmlns=/);
 assert.match(svg,/#00EEDD/);
 assert.match(svg,/#FFAA33/);
 assert.match(svg,/stroke-width="2.5"/);
 assert.match(svg,/<ellipse/);
 assert.match(svg,/fill="#0C1010"/);
 const parsed=validateSession({schema:'soma.footprints.session',version:2,samples,recipe});
 assert.equal(parsed.recipe.style,'Campuran');
});
