import {MaterialRenderer} from '../src/studio/drawMaterial';
import {defaults,emptyFrame} from '../src/engine/types';
import {materialDefaults} from '../src/studio/material';
const c=document.createElement('canvas');c.width=640;c.height=360;document.body.append(c);const ctx=c.getContext('2d')!;
const source=document.createElement('canvas');source.width=640;source.height=360;const sc=source.getContext('2d')!;for(let x=0;x<640;x+=20){sc.fillStyle=x%40?'#ccd':'#346';sc.fillRect(x,0,20,360);}
const renderer=new MaterialRenderer();renderer.image=await createImageBitmap(source);renderer.asset='test';const s=defaults();s.material={...materialDefaults(),kind:'photo',assetId:'test'};const f=emptyFrame('mouse');f.tracked=true;f.features.x=.5;f.features.y=.5;
const lines:string[]=[];function render(effect:string,live:boolean,output='both'){ctx.clearRect(0,0,640,360);s.material!.effect=effect as any;s.output=output as any;renderer.draw(ctx,s,f,[{x:320,y:180}],live,640,360,1000,.016);return ctx.getImageData(0,0,640,360).data;}
function count(a:Uint8ClampedArray){let n=0;for(let i=3;i<a.length;i+=4)if(a[i])n++;return n;}
function check(name:string,ok:boolean){lines.push(`${ok?'PASS':'FAIL'} ${name}`);}
const original=render('original',false);check('original photo fills canvas',count(original)===640*360);check('reveal hidden when tracking absent',count(render('reveal',false))===0);const revealed=count(render('reveal',true));check('detected motion reveals a bounded region',revealed>1000&&revealed<640*360/2);check('empty brush reveals no image',count(render('brush',false))===0);check('brush follows detected cursor',count(render('brush',true))>1000);
for(const effect of ['warp','shatter']){const a=render(effect,true);let diff=0;for(let i=0;i<a.length;i++)if(a[i]!==original[i])diff++;check(effect+' changes photo geometry',diff>1000);}check('sound-only output hides material',count(render('original',true,'sound'))===0);
s.output='both';s.input='body';s.material!.linger=0;f.source='camera';f.segmentation={width:4,height:4,data:new Uint8Array([0,0,0,0,0,255,255,0,0,255,255,0,0,0,0,0])};
const silhouette=count(render('silhouette',true));check('silhouette reveals only detected mask',silhouette>1000&&silhouette<640*360/2);check('missing body clears zero-linger silhouette',count(render('silhouette',false))===0);
const eroded=count(render('erosion',true));check('body erodes photo',eroded>0&&eroded<640*360);check('erosion remains after body leaves',count(render('erosion',false))===eroded);s.material!.reset++;check('restore removes accumulated erosion',count(render('erosion',false))===640*360);
s.material!.effect='silhouette';s.material!.delay=2;s.material!.reset++;ctx.clearRect(0,0,640,360);renderer.draw(ctx,s,f,[],true,640,360,4000,.016);check('delayed body waits for recorded history',count(ctx.getImageData(0,0,640,360).data)===0);ctx.clearRect(0,0,640,360);renderer.draw(ctx,s,f,[],false,640,360,6100,.016);check('delayed body uses earlier detected mask',count(ctx.getImageData(0,0,640,360).data)>1000);
document.querySelector('#result')!.textContent=lines.join('\n');renderer.dispose();
