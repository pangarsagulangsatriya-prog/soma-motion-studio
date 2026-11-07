import {MaterialRenderer} from '../src/studio/drawMaterial';
import {MotionInk} from '../src/studio/MotionInk';
import {SkeletonMemory,SceneTransition} from '../src/studio/StageMemory';
import {hydraDefaults} from '../src/studio/hydraConfig';
import {materialDefaults} from '../src/studio/material';
import {defaults,emptyFrame} from '../src/engine/types';
const checks:string[]=[];const check=(s:string,b:boolean)=>{if(!b)throw Error(s);checks.push('PASS '+s);};
const canvas=document.createElement('canvas');canvas.width=960;canvas.height=540;document.body.append(canvas);const ctx=canvas.getContext('2d')!;
const pixels=()=>ctx.getImageData(0,0,960,540).data;
const alpha=(p:Uint8ClampedArray)=>{let n=0;for(let i=3;i<p.length;i+=4)n+=p[i];return n;};
const diff=(a:Uint8ClampedArray,b:Uint8ClampedArray)=>{let n=0;for(let i=0;i<a.length;i++)if(a[i]!==b[i])n++;return n;};
const clear=()=>ctx.clearRect(0,0,960,540);const s=defaults();s.hydra=hydraDefaults();s.material={...materialDefaults(),text:'TUBUH\nMENINGGALKAN JEJAK'};const f=emptyFrame('mouse');f.tracked=true;f.features.speed=.9;f.features.spread=.6;
const renderer=new MaterialRenderer();let now=1000;
const draw=(x:number,live=true)=>{clear();now+=40;f.time=now;renderer.draw(ctx,s,f,[{x:x*960,y:270}],live,960,540,now,.04);};
try{
 draw(.1,false);check('new text remains visible before any tracking',alpha(pixels())>10000);
 for(const mode of ['elastic','fragments','flow','photo','classic'] as const){s.hydra.typography=mode;draw(.2,false);const start=pixels();for(let i=0;i<20;i++)draw(.25+i*.025);check(mode+' responds to live motion and keeps text visible',alpha(pixels())>10000&&diff(start,pixels())>1000);}
 s.hydra.typography='elastic';draw(.1,false);const beforeWidth=renderer.kinetic.scene.glyphs[0].width;clear();renderer.draw(ctx,s,f,[],false,960,960,now+40,.04);check('Clean resize recalculates glyph spacing',renderer.kinetic.scene.glyphs[0].width>beforeWidth);draw(.1,false);
 const marked=new MotionInk();marked.draw(ctx,s.hydra,[{x:100,y:100}],true,'mouse',1,.5,960,540,.04,true);marked.draw(ctx,s.hydra,[{x:180,y:100}],true,'mouse',2,.5,960,540,.04,true);
 const inkSum=()=>alpha(marked.canvas.getContext('2d')!.getImageData(0,0,1280,720).data),before=inkSum();
 s.hydra.hold=true;s.hydra.trails='fade';marked.draw(ctx,s.hydra,[{x:200,y:100}],true,'mouse',3,.9,960,540,.04,true);check('hold preserves every trail pixel',before>0&&before===inkSum());
 s.hydra.textReset++;draw(.5,false);check('recover text leaves ink intact',before===inkSum());
 s.hydra.hold=false;marked.draw(ctx,s.hydra,[{x:500,y:100}],true,'mouse',4,.9,960,540,.04,true);check('release fades old ink without a bridge',inkSum()<before);
 const texture=document.createElement('canvas');texture.width=960;texture.height=540;texture.getContext('2d')!.fillStyle='#ff0000';texture.getContext('2d')!.fillRect(0,0,960,540);renderer.image=await createImageBitmap(texture);renderer.asset='test-photo';s.material.assetId='test-photo';s.hydra.typography='photo';draw(.1,false);const photo=pixels();let red=0,green=0;for(let i=0;i<photo.length;i+=4){red+=photo[i];green+=photo[i+1];}check('photo fills the actual glyph mask and leaves empty space',red>1000&&green===0&&alpha(photo)<960*540*255*.4);
 const memory=new SkeletonMemory();s.hydra.hold=false;for(let i=0;i<50;i++)memory.draw(ctx,s.hydra,[[.1,.1,.3,.3]],true,'hands',i,2000+i*180,960,540,true);check('skeleton memory stays bounded',memory.samples.length<=12);const count=memory.samples.length;memory.draw(ctx,s.hydra,[],false,'hands',999,11000,960,540,true);check('lost tracking never creates a skeleton sample',memory.samples.length<=count);memory.draw(ctx,s.hydra,[],false,'body',1000,11010,960,540,true);check('source change removes unrelated skeleton echoes',memory.samples.length===0);
 const blend=new SceneTransition();clear();ctx.fillStyle='red';ctx.fillRect(0,0,960,540);blend.apply(ctx,'a',1,12000,960,540,true,0);clear();ctx.fillStyle='blue';ctx.fillRect(0,0,960,540);blend.apply(ctx,'b',1,12001,960,540,true,0);check('mode change carries previous picture',ctx.getImageData(10,10,1,1).data[0]>240);clear();ctx.fillStyle='blue';ctx.fillRect(0,0,960,540);blend.apply(ctx,'b',1,12501,960,540,true,0);const mix=ctx.getImageData(10,10,1,1).data;check('transition blends old and live pictures',mix[0]>100&&mix[2]>100);clear();blend.apply(ctx,'b',1,12502,960,540,true,1);check('clear never resurrects outgoing visual',alpha(pixels())===0);
 s.hydra.typography='elastic';draw(.5,false);
}catch(e){checks.push('FAIL '+(e as Error).message);}finally{renderer.dispose();document.querySelector('#result')!.textContent=checks.join('\n');}
