import {PALETTES} from './liveVisual';
import type {HydraConfig,HydraMotion} from './hydraConfig';
export function renderBuiltinPatch(h:any,config:()=>HydraConfig,motion:()=>HydraMotion){
 const c=config();
 const dyn=(k:keyof HydraMotion)=>()=>motion()[k];
 // Each source remains independent; enabled toggles clear its source canvas.
 let base=h.src(h.s0).add(h.src(h.s1),()=>config().photo?motion().mix:0).add(h.src(h.s2),()=>config().camera?.65:0).add(h.src(h.s3),()=>config().silhouette?.45:0);
 const wave=h.noise(3,.12).blend(h.osc(8,.035,.3),.35);
 if(c.preset==='liquid')base=base.modulate(wave,dyn('distortion')).modulateScale(h.noise(2,.08),()=>motion().distortion*.6).color(1,.95,.85);
 if(c.preset==='echo')base=base.repeat(dyn('repeat'),dyn('repeat')).modulate(wave,()=>motion().distortion*.4);
 if(c.preset==='cut')base=base.repeat(dyn('repeat'),1).modulate(h.osc(14,.04,0).thresh(.5,.05),dyn('distortion')).posterize(4,.6);
 if(c.preset==='body')base=base.mask(h.src(h.s3)).modulate(wave,dyn('distortion'));
 base=base.hue(()=>PALETTES[config().palette].hue);
 const previous=h.src(h.o0).scale(()=>1.002+motion().distortion*.04).rotate(dyn('rotation')).brightness(-.003);
 const output=base.blend(previous,dyn('feedback')).add(h.src(h.s0),()=>config().text?config().readability*.55:0);
 h.o0.render(output.glsl());
}
