import {HydraPipeline} from '../src/studio/HydraPipeline';
import {MaterialRenderer} from '../src/studio/drawMaterial';
import {hydraDefaults} from '../src/studio/hydraConfig';
import {materialDefaults} from '../src/studio/material';
import {defaults,emptyFrame} from '../src/engine/types';
const result=document.querySelector('#result')!,checks:string[]=[];
const check=(name:string,value:boolean)=>{if(!value)throw new Error(name);checks.push('PASS '+name);};
const pipeline=new HydraPipeline(),material=new MaterialRenderer();
try{
 const display=document.createElement('canvas');display.width=960;display.height=960;document.body.append(display);
 const ctx=display.getContext('2d')!;let ticks=0;
 const sources=pipeline.sources.map(()=>({tex:{width:960,height:540,resize(w:number,h:number){this.width=w;this.height=h;}}}));
 // Deterministic GPU stand-in: enforce texture upload bounds and emulate buffer loss.
 // The application pipeline, text renderer, resizing and display-copy code remain real.
 const synth:any={o0:{render(){}},solid:()=>({glsl:()=>[]})};sources.forEach((s,i)=>synth['s'+i]=s);
 (pipeline as any).engine={synth,o:[],regl:{destroy(){}},setResolution(w:number,h:number){pipeline.canvas.width=w;pipeline.canvas.height=h;},tick(){
  ticks++;pipeline.sources.forEach((canvas,i)=>{const tex=sources[i].tex;if(canvas.width!==tex.width||canvas.height!==tex.height)throw new Error('source texture size mismatch');});
  const gpu=pipeline.canvas.getContext('2d')!;gpu.clearRect(0,0,pipeline.canvas.width,pipeline.canvas.height);gpu.drawImage(pipeline.sources[0],0,0);
 }};
 const s=defaults();s.hydra={...hydraDefaults(),preset:'custom',code:'solid(1,1,1,1).out(o0)'};s.material={...materialDefaults(),kind:'photo',text:'KATA TETAP TERLIHAT'};
 const f=emptyFrame();f.tracked=true;f.source='camera';let now=1000;
 const draw=(height:number,elapsed:number)=>{now+=elapsed;f.time=now;ctx.clearRect(0,0,960,960);return pipeline.render(ctx,s,f,[],true,960,height,now,.016,null,material);};
 const alpha=(height:number)=>{let sum=0;const p=ctx.getImageData(0,0,960,height).data;for(let i=3;i<p.length;i+=4)sum+=p[i];return sum;};
 check('text renders while camera tracking is live',draw(540,40)&&alpha(540)>0);
 const initial=alpha(540),before=ticks;pipeline.canvas.getContext('2d')!.clearRect(0,0,960,540);
 check('discarded GPU buffer does not erase the next display frame',draw(540,8)&&alpha(540)===initial&&ticks===before);
 check('Clean height-only resize retains text',draw(960,40)&&alpha(960)>0);
 check('all source texture dimensions follow the canvas',sources.every(s=>s.tex.width===960&&s.tex.height===960));
 check('return to Studio retains text',draw(420,40)&&alpha(420)>0);
 s.hydra.text=false;check('explicit text-off still hides the source',draw(420,40)&&alpha(420)===0);
 s.hydra.text=true;check('text-on restores the source',draw(420,40)&&alpha(420)>0);
}catch(e){checks.push('FAIL '+(e as Error).message);}finally{pipeline.dispose();material.dispose();result.textContent=checks.join('\n');}
