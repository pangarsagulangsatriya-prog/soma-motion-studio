import GeneratorFactory from '../node_modules/hydra-synth/src/generator-factory.js';
import {renderBuiltinPatch} from '../src/studio/hydraBuiltin';
import {mapHydraMotion,starterPatch} from '../src/studio/hydraConfig';
import Hydra from 'hydra-synth';
import {runHydraPatch} from '../src/studio/hydraPatch';
import {HydraPipeline} from '../src/studio/HydraPipeline';
import {MaterialRenderer} from '../src/studio/drawMaterial';
import {hydraDefaults} from '../src/studio/hydraConfig';
import {hydraStatus} from '../src/studio/hydraStatus';
import {defaults,emptyFrame} from '../src/engine/types';

const result=document.querySelector('#result')!;
const checks:string[]=[];let engine:any=null;
const assert=(name:string,condition:boolean)=>{if(!condition)throw new Error(name);checks.push('PASS '+name);};
const canvas=document.createElement('canvas');canvas.width=320;canvas.height=180;document.body.append(canvas);
async function run(){
 try{
  let shader:any=null;
  const destination={precision:'mediump',getTexture:()=>null,render:(passes:any)=>{shader=passes[0];}};
  const factory=new GeneratorFactory({defaultOutput:destination,defaultUniforms:{}});
  const hStub={...factory.generators,o0:destination,s0:{getTexture:()=>null},s1:{getTexture:()=>null},s2:{getTexture:()=>null},s3:{getTexture:()=>null}};
  let config=hydraDefaults();const motion=mapHydraMotion(config,{x:.5,y:.5,speed:.5,pinch:.5,spread:.5},true);
  for(const preset of ['liquid','echo','cut','body'] as const){config={...config,preset};renderBuiltinPatch(hStub,()=>config,()=>motion);assert(preset+' generates real Hydra GLSL',shader.frag.includes('gl_FragColor')&&shader.frag.includes('sampler2D'));}
  runHydraPatch(starterPatch,hStub,()=>motion);assert('custom expression generates real Hydra GLSL',shader.frag.includes('gl_FragColor'));
  assert('bad texture rejected by real Hydra generator',(()=>{try{runHydraPatch('src(s0).blend(3).out(o0)',hStub,()=>motion);return false;}catch{return true;}})());
  if(!document.createElement('canvas').getContext('webgl')){
   const fallback=new HydraPipeline(),material=new MaterialRenderer();await fallback.init();
   const ctx=canvas.getContext('2d')!,s=defaults(),f=emptyFrame();
   assert('WebGL unavailable is reported',hydraStatus.get().includes('visual dasar aktif'));
   assert('render delegates to basic visual',!fallback.render(ctx,s,f,[],false,320,180,1000,.033,null,material));
   fallback.dispose();material.dispose();checks.push('SKIP GPU shader/pixel checks: browser has no WebGL');return;
  }
  engine=new Hydra({canvas,width:320,height:180,makeGlobal:false,autoLoop:false,detectAudio:false,enableStreamCapture:false});
  const h=engine.synth,source=document.createElement('canvas');source.width=320;source.height=180;const x=source.getContext('2d')!;
  x.fillStyle='white';x.fillRect(70,40,150,80);h.s0.tex.destroy();h.s0.init({src:source});h.render(h.o0);
  runHydraPatch('src(s0).out(o0)',h,()=>({}));engine.tick(40);
  const pixels=engine.regl.read();assert('canvas source becomes GPU pixels',pixels.some((n:number,i:number)=>i%4!==3&&n>200));
  runHydraPatch('solid(0,0,0,1).out(o0)',h,()=>({}));engine.tick(40);
  assert('patch replacement changes GPU pixels',engine.regl.read().every((n:number,i:number)=>i%4===3||n===0));
  engine.regl.destroy();engine=null;
  const pipeline=new HydraPipeline(),material=new MaterialRenderer(),output=document.createElement('canvas');output.width=320;output.height=180;
  document.body.append(output);await pipeline.init();const s=defaults();s.hydra=hydraDefaults();const f=emptyFrame();
  let now=1000;
  for(const preset of ['liquid','echo','cut','body'] as const){s.hydra.preset=preset;s.hydra.silhouette=preset==='body';
   for(let i=0;i<4;i++){now+=40;assert(preset+' renders',pipeline.render(output.getContext('2d')!,s,f,[],false,320,180,now,.04,null,material));}
   assert(preset+' compiles',!hydraStatus.get().includes('gagal'));
  }
  s.hydra.reset++;now+=40;assert('feedback reset preserves renderer',pipeline.render(output.getContext('2d')!,s,f,[],false,320,180,now,.04,null,material));
  s.hydra.preset='custom';s.hydra.code='src(s0).blend(3).out(o0)';now+=40;
  assert('bad shader keeps renderer alive',pipeline.render(output.getContext('2d')!,s,f,[],false,320,180,now,.04,null,material));
  pipeline.dispose();material.dispose();
 }catch(e){checks.push('FAIL '+(e as Error).message);}finally{engine?.regl.destroy();result.textContent=checks.join('\n');}
}
void run();
