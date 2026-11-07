import {PALETTES} from './liveVisual';
import {renderBuiltinPatch} from './hydraBuiltin';
import {hydraDefaults,mapHydraMotion,type HydraMotion} from './hydraConfig';
import {hydraStatus} from './hydraStatus';
import {runHydraPatch} from './hydraPatch';
import {MaterialRenderer} from './drawMaterial';
import {bodyField} from './bodyField';
import {SilhouetteLayer} from './silhouette';
import type {Settings,MotionFrame} from '../engine/types';

export class HydraPipeline{
 canvas=document.createElement('canvas');private frame=document.createElement('canvas');sources=Array.from({length:4},()=>document.createElement('canvas'));
 private engine:any=null;private loading=false;private failed=false;private disposed=false;private key='';private hasPatch=false;private reset=-1;
 private config=hydraDefaults();private motion:HydraMotion=mapHydraMotion(this.config,{x:.5,y:.5,speed:0,pinch:0,spread:0},false);
 private mask=new SilhouetteLayer();private textRenderer=new MaterialRenderer();private lastTick=0;private lost=()=>{this.failed=true;hydraStatus.set('WebGL terputus · visual dasar aktif. Muat ulang untuk Hydra.');};
 constructor(){this.canvas.width=960;this.canvas.height=540;this.sources.forEach(c=>{c.width=960;c.height=540;});this.canvas.addEventListener('webglcontextlost',this.lost);}
 async init(){if(this.loading||this.engine||this.failed||this.disposed)return;this.loading=true;hydraStatus.set('Memuat hydra-synth…');
 try{const {default:Hydra}=await import('hydra-synth');if(this.disposed)return;this.engine=new Hydra({canvas:this.canvas,width:960,height:540,makeGlobal:false,autoLoop:false,detectAudio:false,enableStreamCapture:false,numSources:4,numOutputs:4});this.sources.forEach((c,i)=>{const source=this.engine.synth['s'+i];source.tex.destroy();source.init({src:c});});this.engine.synth.render(this.engine.synth.o0);hydraStatus.set('hydra-synth 1.4.0 · aktif');}
 catch(error){this.failed=true;this.engine?.regl?.destroy();this.engine=null;hydraStatus.set('Hydra perlu WebGL · visual dasar aktif. Aktifkan akselerasi grafis lalu muat ulang.');}finally{this.loading=false;}}
 private clear(){const e=this.engine;for(const o of e.o)for(const framebuffer of o.fbos)e.regl.clear({framebuffer,color:[0,0,0,0],depth:1});}
 private patch(){const h=this.engine.synth,c=this.config;
 if(c.preset==='custom'){runHydraPatch(c.code,h,()=>this.motion);return;}
 renderBuiltinPatch(h,()=>this.config,()=>this.motion);
 }
 render(ctx:CanvasRenderingContext2D,s:Settings,f:MotionFrame,anchors:{x:number;y:number}[],live:boolean,w:number,h:number,now:number,dt:number,video:HTMLVideoElement|null,material:MaterialRenderer):boolean{
 const c={...hydraDefaults(),...s.hydra};this.config=c;if(!c.enabled||!s.visual.enabled||s.output==='sound'){this.lastTick=now;return false;}if(!this.engine){void this.init();return false;}if(this.failed)return false;
 const target=mapHydraMotion(c,f.features,live);for(const name of Object.keys(target) as (keyof HydraMotion)[])this.motion[name]+=(target[name]-this.motion[name])*Math.min(1,dt*9);
 const renderWidth=960,renderHeight=Math.max(240,Math.min(1200,Math.round(960*h/w)));
 try{
 if(this.canvas.height!==renderHeight){this.engine.setResolution(renderWidth,renderHeight);this.sources.forEach((source,i)=>{source.width=renderWidth;source.height=renderHeight;this.engine.synth['s'+i].tex.resize(renderWidth,renderHeight);});}
 if(this.reset!==c.reset){this.reset=c.reset;this.clear();this.mask.reset();}
 // Cap visual synthesis at 30 fps; camera inference and audio keep their own clocks.
 if(now-this.lastTick>=1000/30){const elapsed=Math.min(100,now-this.lastTick||33);this.lastTick=now;
 const contexts=this.sources.map(source=>{const x=source.getContext('2d')!;x.clearRect(0,0,renderWidth,renderHeight);return x;});
 material.load(s.material?.assetId??'');
 if(c.text){const textSettings={...s,visual:{...s.visual,color:PALETTES[c.palette].colors[0]},material:{...s.material,kind:'text',effect:'drag',assetId:s.material?.assetId??''},output:'both'} as Settings;this.textRenderer.draw(contexts[0],textSettings,f,anchors.map(a=>({x:a.x/w*renderWidth,y:a.y/h*renderHeight})),live,renderWidth,renderHeight,now,elapsed/1000,(video?.videoWidth||640)/(video?.videoHeight||480));}
 if(c.photo&&material.image){const image=material.image,r=Math.min(renderWidth/image.width,renderHeight/image.height);contexts[1].drawImage(image,(renderWidth-image.width*r)/2,(renderHeight-image.height*r)/2,image.width*r,image.height*r);}
 if(c.camera&&video&&video.readyState>=2){const cw=video.videoWidth,ch=video.videoHeight,r=Math.min(renderWidth/cw,renderHeight/ch);contexts[2].save();if(s.mirror){contexts[2].translate(renderWidth,0);contexts[2].scale(-1,1);}contexts[2].drawImage(video,(renderWidth-cw*r)/2,(renderHeight-ch*r)/2,cw*r,ch*r);contexts[2].restore();}
 const field=live?bodyField(f,s.mirror,renderWidth/renderHeight,(video?.videoWidth||640)/(video?.videoHeight||480)):undefined;
 this.mask.update(field,renderWidth/renderHeight,elapsed/1000,0,false);
 if(c.silhouette){const mask=contexts[3];mask.drawImage(this.mask.canvas,0,0,renderWidth,renderHeight);if(field&&!field.mask){mask.strokeStyle='white';mask.lineCap='round';mask.lineWidth=renderHeight*.12;for(const {a,b} of field.surfaces){mask.beginPath();mask.moveTo(a.x*renderWidth,a.y*renderHeight);mask.lineTo(b.x*renderWidth,b.y*renderHeight);mask.stroke();}}}
 const key=JSON.stringify([c.preset,c.code,c.text,c.photo,c.camera,c.silhouette]);if(this.key!==key){try{this.patch();this.hasPatch=true;this.key=key;hydraStatus.set('hydra-synth 1.4.0 · '+(c.preset==='custom'?'patch aktif':'aktif'));}catch(error){this.key=key;if(!this.hasPatch){const requested=this.config;this.config={...requested,preset:'liquid'};this.patch();this.hasPatch=true;this.config=requested;}hydraStatus.set('Patch gagal · gambar sebelumnya dipertahankan. '+(error instanceof Error?error.message:'Periksa rangkaian.'));}}
 // Hydra tick catches runtime errors internally; a WebGL context loss is handled above.
 this.engine.tick(elapsed);
 // WebGL's default drawing buffer may be discarded after this animation frame.
 // Capture immediately; intermediate 60/120 Hz display frames reuse this 2D copy.
 if(this.frame.width!==renderWidth||this.frame.height!==renderHeight){this.frame.width=renderWidth;this.frame.height=renderHeight;}
 const copy=this.frame.getContext('2d')!;copy.clearRect(0,0,renderWidth,renderHeight);copy.drawImage(this.canvas,0,0);
 }
 ctx.drawImage(this.frame,0,0,w,h);return true;
 }catch(error){this.failed=true;hydraStatus.set('Hydra berhenti · visual dasar aktif. '+(error instanceof Error?error.message:'Periksa WebGL.'));return false;}
 }
 dispose(){this.disposed=true;this.textRenderer.dispose();this.canvas.removeEventListener('webglcontextlost',this.lost);this.engine?.regl?.destroy();this.engine=null;}
}
