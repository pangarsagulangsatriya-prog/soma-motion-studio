import test from 'node:test';
import assert from 'node:assert/strict';
import {GaitAnalyzer} from '../src/footprints/gait-analysis/index.ts';
import {emptyFrame,type MotionFrame} from '../src/engine/types.ts';

function frame(t:number,y=.8,visibility=.95,x=.3,angle=0):MotionFrame{
 const pose=Array.from({length:33},(_,i)=>({x:i%2===0 ? .32 : .28,y:i>=27 ? .8 : i>=25 ? .65 : i>=23 ? .5 : .35,z:0,visibility:.95}));
 for(const i of [27,29,31])pose[i]={x,y,z:0,visibility};
 pose[29].x=x-.012*Math.cos(angle);pose[29].y=y-.012*Math.sin(angle);
 pose[31].x=x+.012*Math.cos(angle);pose[31].y=y+.012*Math.sin(angle);
 return {...emptyFrame(),time:t,tracked:true,pose,poses:[pose]};
}
const observe=(g:GaitAnalyzer,t:number,y=.8,confidence=.95,x=.3,angle=0)=>g.observe(frame(t,y,confidence,x,angle),0,t,16/9);
const warm=(g:GaitAnalyzer,confidence=.95)=>[1000,1040,1080,1120].map(t=>observe(g,t,.8,confidence));
test('two well sampled lifts enable a faster observed landing than legacy cooldown',()=>{
 const g=new GaitAnalyzer(),samples=warm(g);
 for(const [t,y] of [[1160,.75],[1200,.68],[1240,.8],[1280,.8],[1320,.8],[1360,.75],[1400,.68],[1440,.8],[1480,.8],[1520,.8]])samples.push(observe(g,t,y));
 assert.deepEqual(samples.filter(s=>s?.stamp).map(s=>s?.t),[1120,1320,1520]);
});
test('uncertain landmarks retain conservative landing debounce',()=>{
 const g=new GaitAnalyzer(),samples=warm(g,.65);
 for(const [t,y] of [[1160,.75],[1200,.68],[1240,.8],[1280,.8],[1320,.8],[1360,.8],[1400,.8],[1440,.8]])samples.push(observe(g,t,y,.65));
 assert.deepEqual(samples.filter(s=>s?.stamp).map(s=>s?.t),[1120,1440]);
});
test('airborne stationary foot after observed lift cannot produce a new contact',()=>{
 const g=new GaitAnalyzer();warm(g);observe(g,1160,.75);observe(g,1200,.68);
 for(let t=1240;t<=1800;t+=40){const s=observe(g,t,.68);assert.equal(s?.stamp,false);assert.equal(s?.phase,'swing');}
});
test('pivot and slow drag after landing do not stamp a second sole',()=>{
 const g=new GaitAnalyzer();warm(g);
 const pivot=[1160,1200,1240,1280].map(t=>observe(g,t,.8,.95,.3,Math.PI/2));
 assert.ok(pivot.some(s=>s?.motionKind==='pivot'));assert.ok(pivot.every(s=>!s?.stamp));
 const h=new GaitAnalyzer();warm(h);
 const drag=Array.from({length:8},(_,i)=>observe(h,1160+i*40,.8,.95,.31+i*.01));
 assert.ok(drag.some(s=>s?.motionKind==='slide'));assert.ok(drag.every(s=>!s?.stamp));
});
test('duplicate and out-of-order frames cannot accelerate landing debounce',()=>{
 const g=new GaitAnalyzer();warm(g);observe(g,1160,.75);observe(g,1200,.68);
 observe(g,1240,.8);observe(g,1280,.8);
 assert.equal(observe(g,1280,.8),null);assert.equal(observe(g,1270,.8),null);
 assert.equal(observe(g,1320,.8)?.stamp,true);
});
test('initial clearly elevated foot is held while opposite support is observed',()=>{
 const g=new GaitAnalyzer();
 for(const t of [1000,1040,1080,1120])g.observe(frame(t),1,t,16/9);
 for(const t of [1160,1200,1240,1280,1320]){const f=frame(t,.64);g.observe(f,1,t,16/9);assert.equal(g.observe(f,0,t,16/9)?.stamp,false);}
});
