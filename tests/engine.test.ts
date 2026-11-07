import {test} from 'node:test';
import assert from 'node:assert/strict';
import {defaults,defaultMappings,defaultVisualMappings,emptyFrame} from '../src/engine/types.ts';
import {evaluateMapping,MappingEngine,VisualMappingEngine,HoldTrigger,validatePreset} from '../src/engine/mapping.ts';
import {MotionProcessor,handFeatures} from '../src/engine/motion.ts';
test('pitch covers three octaves logarithmically and clamps out-of-range input',()=>{const m=defaultMappings('theremin')[0];assert.equal(evaluateMapping(m,0),110);assert.equal(evaluateMapping(m,1),880);assert.ok(Math.abs(evaluateMapping(m,.5)-Math.sqrt(110*880))<.0001);assert.equal(evaluateMapping(m,10),880);assert.equal(evaluateMapping({...m,invert:true},0),880);});
test('mapping output cannot exceed safe native ranges, and duplicate output last row wins',()=>{const s=defaults(),f=emptyFrame('mouse');f.time=100;f.features.x=.8;s.mappings=[{...s.mappings[0],max:99000},{...s.mappings[1],output:'frequency',min:333,max:333}];assert.equal(new MappingEngine().process(f,s).frequency,333);assert.equal(evaluateMapping({...s.mappings[0],max:99000},1),2000);});
test('preset round-trip preserves mapping, invalid imports are rejected',()=>{const s=defaults();assert.deepEqual(validatePreset(JSON.parse(JSON.stringify({version:1,settings:s}))),s);assert.throws(()=>validatePreset({version:1,settings:{...s,master:5}}));assert.throws(()=>validatePreset({version:1,settings:{...s,mappings:[{...s.mappings[0],output:'__proto__'}]}}));assert.throws(()=>validatePreset({version:1,settings:{...s,calibration:{minX:.5,maxX:.5,minY:0,maxY:1}}}));});
test('tracking loss immediately clears gate, first reacquisition emits no swipe',()=>{const p=new MotionProcessor(),s=defaults();const f=p.process(null,null,100,s,30);assert.equal(f.tracked,false);assert.equal(f.features.open,0);assert.equal(f.events.length,0);});
test('pinch normalization is invariant to image hand scale',()=>{const a=Array.from({length:21},(_,i)=>({x:.2+i*.01,y:.2+i*.02,z:0}));a[4]={x:.3,y:.3,z:0};a[8]={x:.31,y:.31,z:0};const b=a.map(p=>({x:p.x*2,y:p.y*2,z:0}));assert.ok(Math.abs(handFeatures(a).pinch-handFeatures(b).pinch)<1e-9);});
test('velocity uses elapsed time and ignores the first frame',()=>{const s=defaults();s.mirror=false;s.smoothing=0;const hand=Array.from({length:21},(_,i)=>({x:.2+i*.003,y:.3+i*.004,z:0}));const raw=(dx:number)=>({landmarks:[hand.map(p=>({...p,x:p.x+dx}))],handedness:[[{categoryName:'Right',score:.99}]]});const a=new MotionProcessor(),b=new MotionProcessor();assert.equal(a.process(raw(0),null,100,s,30).features.speed,0);b.process(raw(0),null,100,s,60);const x=a.process(raw(.02),null,140,s,25).features.speed,y=b.process(raw(.01),null,120,s,50).features.speed;assert.ok(Math.abs(x-y)<.004);});

test('v1 drone preset migrates source and reverb without losing the saved mappings',()=>{
 const {input,character,output,macros,layers,visual,...legacy}=defaults();
 legacy.mode='drone';legacy.reverb=.425;legacy.mappings=defaultMappings('drone');
 const restored=validatePreset({version:1,settings:legacy});
 assert.equal(restored.input,'body');assert.equal(restored.macros.space,.5);
 assert.deepEqual(restored.mappings,legacy.mappings);assert.equal(restored.visual.style,'fiber');
});
test('v2 face preset round-trips layers, visual mapping and output; invalid visual ranges fail',()=>{
 const s=defaults();s.input='face';s.output='visual';s.layers.tracking='trigger';s.layers.camera=true;
 s.visual.style='planes';s.visual.mappings=defaultVisualMappings('face');s.mappings=defaultMappings('theremin','face');
 const restored=validatePreset(JSON.parse(JSON.stringify({version:2,settings:s})));
 assert.deepEqual(restored,s);restored.visual.color='#ffffff';assert.notEqual(restored.visual.color,s.visual.color);
 assert.throws(()=>validatePreset({version:2,settings:{...s,visual:{...s.visual,life:100}}}));
 assert.throws(()=>validatePreset({version:2,settings:{...s,visual:{...s.visual,mappings:[{...s.visual.mappings[0],output:'__proto__'}]}}}));
});
test('sound and visual mappings share motion but retain independent responses',()=>{
 const s=defaults();s.input='face';s.mappings=defaultMappings('theremin','face');s.visual.mappings=defaultVisualMappings('face');
 const f=emptyFrame();f.time=100;f.tracked=true;f.features.headTilt=1;f.features.mouth=.5;
 assert.equal(new MappingEngine().process(f,s).pan,1);
 assert.equal(new VisualMappingEngine().process(f,s).rotation,1);
 s.visual.mappings[1].invert=true;
 assert.equal(new VisualMappingEngine().process(f,s).rotation,-1);
 assert.equal(new MappingEngine().process(f,s).pan,1);
 s.input='hands';assert.equal(new MappingEngine().process(f,s).pan,0);
 assert.equal(new VisualMappingEngine().process(f,s).rotation,0);
});
test('gesture trigger fires once per hold and tracking loss cancels the incomplete hold',()=>{
 const h=new HoldTrigger();assert.equal(h.update(true,0).fired,false);
 assert.equal(h.update(true,600).progress,.5);assert.equal(h.update(true,1200).fired,true);
 assert.equal(h.update(true,2400).fired,false);h.update(false,2500);
 h.update(true,2600);h.update(false,3000);assert.equal(h.update(true,4000).progress,0);
 assert.equal(h.update(true,5200).fired,true);
});
test('face blendshapes drive mouth gate and blink; mirror reverses head tilt',()=>{
 const points=Array.from({length:478},()=>({x:.5,y:.5,z:0}));
 points[33]={x:.3,y:.4,z:0};points[263]={x:.7,y:.5,z:0};
 const raw=(mouth:number)=>({faceLandmarks:[points],faceBlendshapes:[{categories:[{categoryName:'jawOpen',score:mouth},{categoryName:'eyeBlinkLeft',score:.8},{categoryName:'eyeBlinkRight',score:.6}]}]});
 const s=defaults();s.input='face';s.mirror=false;s.smoothing=0;
 const p=new MotionProcessor(),f=p.process(null,null,100,s,30,raw(.5));
 assert.equal(f.tracked,true);assert.equal(f.face.length,478);assert.equal(f.features.open,1);
 assert.ok(Math.abs(f.features.blink-.7)<1e-8);assert.ok(f.features.headTilt>.5);
 const mirror=new MotionProcessor().process(null,null,100,{...s,mirror:true},30,raw(.5));
 assert.ok(Math.abs(f.features.headTilt+mirror.features.headTilt-1)<1e-8);
 assert.equal(p.process(null,null,150,s,30,raw(.02)).features.open,0);
 const lost=p.process(null,null,200,s,30);assert.equal(lost.tracked,false);assert.equal(lost.features.open,0);
});
