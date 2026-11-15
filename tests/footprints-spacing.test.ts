import test from 'node:test';
import assert from 'node:assert/strict';
import {nextImprint} from '../src/footprints/spacing.ts';
test('imprints stay separate despite jitter and repeated pauses',()=>{const last={x:.5,y:.5,t:0};for(let t=10;t<5000;t+=10)assert.equal(nextImprint(last,{x:.5+Math.sin(t)*.01,y:.5,t},34),false);assert.equal(nextImprint(last,{x:.6,y:.5,t:300},34),true);assert.equal(nextImprint(last,{x:.6,y:.5,t:100},34),false);});
test('spacing scales with glyph size and stamps once per travelled interval',()=>{let last=null,count=0;for(let i=0;i<=100;i++){const p={x:i/100,y:.5,t:i*30};if(nextImprint(last,p,34)){count++;last=p;}}assert.ok(count>5&&count<15);assert.equal(nextImprint({x:.5,y:.5,t:0},{x:.58,y:.5,t:1000},90),false);});
