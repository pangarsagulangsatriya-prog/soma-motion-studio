import {validateHydra} from '../studio/hydraConfig.ts';
import {parseHydraPatch} from '../studio/hydraPatch.ts';
import {validateMaterial} from '../studio/material.ts';
import {clamp} from './motion.ts';
import {defaults,defaultVisualMappings,featureAvailable,FEATURES,TARGETS,VISUAL_TARGETS,type AudioParams,type Mapping,type MappingBase,type MotionFrame,type Settings,type VisualMapping,type VisualParams,type Character,type InputKind} from './types.ts';
function mapped(m:MappingBase,input:number,range:{min:number;max:number}){
 let v=clamp(input*m.sensitivity);v=v<m.threshold?0:clamp((v-m.threshold)/Math.max(.001,1-m.threshold));if(m.invert)v=1-v;if(m.curve==='ease')v=v*v*(3-2*v);
 return clamp(m.curve==='log'&&m.min>0&&m.max>0?m.min*Math.pow(m.max/m.min,v):m.min+(m.max-m.min)*v,range.min,range.max);
}
export const evaluateMapping=(m:Mapping,input:number)=>mapped(m,input,TARGETS[m.output]);
export const evaluateVisualMapping=(m:VisualMapping,input:number)=>mapped(m,input,VISUAL_TARGETS[m.output]);
export class MappingEngine {
 private values:Record<string,number>={};private lastTime=0;
 reset(){this.values={};this.lastTime=0;}
 process(f:MotionFrame,s:Settings):AudioParams{
 const dt=this.lastTime?clamp((f.time-this.lastTime)/1000,.001,.2):.033;this.lastTime=f.time;
 const out:AudioParams={frequency:s.mode==='drone'?80:220,amplitude:.35,filter:6000,reverb:s.macros.space*.85,pan:0,modulation:s.instrument==='fm'?s.modulation:0,delay:s.delay,resonance:s.resonance,attack:s.attack,release:s.release,modRate:s.modRate,roughness:s.macros.roughness,weight:s.macros.weight,brightness:s.macros.brightness};
 for(const m of s.mappings){if(!m.enabled||!featureAvailable(s.input,m.input))continue;const v=evaluateMapping(m,f.features[m.input]);const old=this.values[m.id]??v;this.values[m.id]=old+(v-old)*(1-Math.exp(-dt/Math.max(.005,m.smoothing)));out[m.output]=this.values[m.id];}return out;
 }
}
export class VisualMappingEngine {
 private values:Record<string,number>={};private lastTime=0;
 reset(){this.values={};this.lastTime=0;}
 process(f:MotionFrame,s:Settings):VisualParams{
 const dt=this.lastTime?clamp((f.time-this.lastTime)/1000,.001,.2):.033;this.lastTime=f.time;
 const out:VisualParams={size:s.visual.size,spread:.5,rotation:0,energy:.25,tension:.25,density:s.visual.density};
 for(const m of s.visual.mappings){if(!m.enabled||!featureAvailable(s.input,m.input))continue;const v=evaluateVisualMapping(m,f.features[m.input]);const old=this.values[m.id]??v;this.values[m.id]=old+(v-old)*(1-Math.exp(-dt/Math.max(.005,m.smoothing)));out[m.output]=this.values[m.id];}return out;
 }
}
export function validatePreset(input:unknown):Settings{
 const p=input as {version?:number;settings?:Settings};if(!p||![1,2].includes(p.version??0)||!p.settings||typeof p.settings!=='object')throw new Error('Format preset SOMA versi 1 atau 2 diperlukan.');
 const original=p.settings;const base=defaults();const source=original.input??(original.mode==='drone'||original.poseInLab?'body':'hands');
 const s:Settings={...base,...original,input:source,macros:{...base.macros,...original.macros},layers:{...base.layers,...original.layers},visual:{...base.visual,...original.visual,mappings:original.visual?.mappings??defaultVisualMappings(source)}};
 if(p.version===1&&!original.macros)s.macros.space=clamp(s.reverb/.85);
 if(!['theremin','drone','percussion','lab'].includes(s.mode)||!['sine','triangle','sawtooth','square','fm','white','pink'].includes(s.instrument)||!['hands','body','face','mouse'].includes(s.input)||!['clean','raw','metal','metallic','dark'].includes(s.character)||!['sound','visual','both'].includes(s.output))throw new Error('Pilihan instrumen tidak valid.');
 const ranges:Record<string,[number,number]>={master:[0,1],sensitivity:[.3,2.5],smoothing:[0,.5],deadZone:[0,.05],cooldown:[100,1500],attack:[.005,2],decay:[.01,2],sustain:[0,1],release:[.03,3],resonance:[.1,15],reverb:[0,.85],delay:[0,.65],modulation:[0,600],modRate:[.1,8],maxVoices:[1,12]};
 for(const [key,[lo,hi]] of Object.entries(ranges)){const v=s[key as keyof Settings];if(typeof v!=='number'||!Number.isFinite(v)||v<lo||v>hi)throw new Error(`Nilai ${key} di luar jangkauan.`);}
 const validNumber=(v:unknown,lo:number,hi:number)=>typeof v==='number'&&Number.isFinite(v)&&v>=lo&&v<=hi;
 for(const v of Object.values(s.macros))if(!validNumber(v,0,1))throw new Error('Makro suara tidak valid.');
 if(!s.eventMap||!['kick','snare','clap'].every(k=>['kick','snare','clap','off'].includes(s.eventMap[k as keyof typeof s.eventMap])))throw new Error('Pemetaan gestur tidak valid.');
 const check=(maps:MappingBase[],targets:Record<string,{min:number;max:number}>)=>{if(!Array.isArray(maps)||maps.length>24)throw new Error('Daftar pemetaan tidak valid.');const ids=new Set<string>();for(const raw of maps){const m=raw as Mapping;if(!m||typeof m.id!=='string'||ids.has(m.id)||!Object.hasOwn(FEATURES,m.input)||!Object.hasOwn(targets,m.output)||!['linear','log','ease'].includes(m.curve)||typeof m.enabled!=='boolean'||typeof m.invert!=='boolean')throw new Error('Pemetaan preset tidak valid.');ids.add(m.id);const r=targets[m.output];if(![m.min,m.max,m.sensitivity,m.smoothing,m.threshold].every(Number.isFinite)||m.min<r.min||m.min>r.max||m.max<r.min||m.max>r.max||m.sensitivity<.3||m.sensitivity>2.5||m.smoothing<0||m.smoothing>.5||m.threshold<0||m.threshold>.95)throw new Error('Jangkauan pemetaan tidak valid.');}};
 check(s.mappings,TARGETS);check(s.visual.mappings,VISUAL_TARGETS);
 for(const k of ['mirror','swapHands','poseInLab'] as const)if(typeof s[k]!=='boolean')throw new Error('Pengaturan kamera tidak valid.');
 if(typeof s.layers.camera!=='boolean'||typeof s.layers.gestureTrigger!=='boolean'||!['off','detected','trigger'].includes(s.layers.tracking)||!/^#[0-9a-f]{6}$/i.test(s.layers.background)||!/^#[0-9a-f]{6}$/i.test(s.visual.color)||typeof s.visual.enabled!=='boolean'||!['trail','fiber','particles','planes'].includes(s.visual.style)||!validNumber(s.visual.density,0,1)||!validNumber(s.visual.size,0,1)||!validNumber(s.visual.life,.3,6))throw new Error('Pengaturan visual tidak valid.');
 if(s.calibration){const c=s.calibration;if(![c.minX,c.maxX,c.minY,c.maxY].every(v=>Number.isFinite(v)&&v>=0&&v<=1)||c.maxX-c.minX<.1||c.maxY-c.minY<.1)throw new Error('Kalibrasi tidak valid.');}
 if(s.material)s.material=validateMaterial(s.material);
 if(s.hydra){s.hydra=validateHydra(s.hydra);if(s.hydra.preset==='custom')parseHydraPatch(s.hydra.code);}
 return structuredClone(s);
}
// A held pose fires once, and must be released before it can fire again.
export class HoldTrigger {
 private since:number|null=null;private fired=false;
 reset(){this.since=null;this.fired=false;}
 update(active:boolean,time:number,duration=1200){if(!active){this.reset();return {fired:false,progress:0};}if(this.since===null)this.since=time;const progress=clamp((time-this.since)/duration);if(progress>=1&&!this.fired){this.fired=true;return {fired:true,progress:1};}return {fired:false,progress:this.fired?0:progress};}
}
