import test from 'node:test';
import assert from 'node:assert/strict';
import {parseHydraPatch,runHydraPatch} from '../src/studio/hydraPatch.ts';
import {hydraDefaults,mapHydraMotion,validateHydra,starterPatch} from '../src/studio/hydraConfig.ts';
import {validatePreset} from '../src/engine/mapping.ts';
import {defaults} from '../src/engine/types.ts';
import {switchLiveMode} from '../src/studio/liveVisual.ts';

test('Hydra accepts nested texture chains and rejects executable browser code',()=>{
 for(const code of [starterPatch,'osc(5, .1, 0).mult(src(s3)).add(src(s2), motion.mix).out(o0);','src(s0).rotate(-0.2).out()'])assert.doesNotThrow(()=>parseHydraPatch(code));
 for(const code of ['window.alert(1)','fetch(1).out(o0)','src(s0).constructor(1).out(o0)','src(s0).__proto__().out(o0)','src(s0).blend(src(s1).out(o0)).out(o0)','src(s0).out(o1)','src(s0).out(o0);src(s1).out(o0)','src(s4).out(o0)','src(s0).scale(Infinity).out(o0)','src(s0).scale(1001).out(o0)','src(s0).rotate(()=>1).out(o0)','src(s0).rotate(motion.constructor).out(o0)'])assert.throws(()=>parseHydraPatch(code),code);
});
test('Hydra limits nested and long patches before shader compilation',()=>{
 assert.throws(()=>parseHydraPatch('src(s0)'+'.rotate(1)'.repeat(180)+'.out(o0)'));
 assert.throws(()=>parseHydraPatch('src(s0)'.padEnd(8001,' ')));
});
test('custom motion uniforms read new values without recompiling; compile failures propagate',()=>{
 let speed=.2,uniform:(()=>number)|undefined,rendered=false;
 const chain={modulate(_texture:unknown,value:()=>number){uniform=value;return chain;},glsl(){return ['shader'];}};
 const api={s0:{},src:()=>chain,noise:()=>chain,o0:{render(p:unknown){assert.deepEqual(p,['shader']);rendered=true;}}};
 runHydraPatch('src(s0).modulate(noise(3), motion.speed).out(o0)',api,()=>({speed}));
 assert.equal(rendered,true);assert.equal(uniform!(),.2);speed=.9;assert.equal(uniform!(),.9);
 assert.throws(()=>runHydraPatch('src(s0).out(o0)',{...api,o0:{render(){throw new Error('compile');}}},()=>({})),/compile/);
});
test('motion stays bounded and lost tracking returns to manual values',()=>{
 const config=hydraDefaults(),lost=mapHydraMotion(config,{x:1,y:1,speed:1,pinch:1,spread:1},false);
 assert.equal(lost.mix,config.mix);assert.equal(lost.rotation,0);assert.equal(lost.speed,0);assert.equal(lost.repeat,1+config.repeat*5);
 const active=mapHydraMotion({...config,feedback:1},{x:10,y:-2,speed:8,pinch:9,spread:10},true);
 assert.ok(active.feedback<=.94&&active.distortion<=.35&&active.mix<=1&&active.repeat<=9);assert.equal(active.y,0);
 assert.ok(Object.values(mapHydraMotion(config,{x:NaN,y:NaN,speed:NaN,pinch:NaN,spread:NaN},false)).every(Number.isFinite));
});
test('presets restore sources, controls and custom patches; malformed imports fail',()=>{
 const settings={...defaults(),hydra:{...hydraDefaults(),preset:'custom' as const,camera:true,photo:false,feedback:.3,code:starterPatch}};
 assert.deepEqual(validatePreset(JSON.parse(JSON.stringify({version:2,settings}))).hydra,settings.hydra);
 assert.doesNotThrow(()=>validatePreset({version:2,settings:defaults()}));
 assert.throws(()=>validatePreset({version:2,settings:{...settings,hydra:{...settings.hydra,code:'fetch(1).out(o0)'}}}));
 assert.throws(()=>validateHydra({...hydraDefaults(),feedback:2}));
 assert.throws(()=>validateHydra({...hydraDefaults(),camera:'yes'}));
});
test('live switching retains history, sources and sound while opening visual output',()=>{
 const s={...defaults(),output:'sound' as const,hydra:{...hydraDefaults(),reset:9,palette:'ember' as const,feedback:.8,trails:'stack' as const}};
 const changed={...s,...switchLiveMode(s,'echo')};
 assert.equal(changed.hydra!.preset,'echo');assert.equal(changed.hydra!.reset,9);assert.equal(changed.hydra!.palette,'ember');assert.equal(changed.hydra!.feedback,.8);assert.equal(changed.output,'both');assert.deepEqual(changed.macros,s.macros);assert.deepEqual(changed.layers,s.layers);
 assert.equal(switchLiveMode(changed,'body').hydra!.silhouette,true);
});
test('old Hydra presets gain bounded trail and palette settings',()=>{
 const {palette,trails,trailLife,...old}=hydraDefaults();const migrated=validateHydra(old);
 assert.equal(migrated.trails,'stack');assert.equal(migrated.palette,'spectrum');
 assert.throws(()=>validateHydra({...old,trailLife:0}));assert.throws(()=>validateHydra({...old,palette:'wrong'}));
 const s={...defaults(),hydra:{...hydraDefaults(),palette:'violet' as const,trails:'fade' as const,trailLife:20}};
 assert.deepEqual(validatePreset({version:2,settings:s}).hydra,s.hydra);
});
