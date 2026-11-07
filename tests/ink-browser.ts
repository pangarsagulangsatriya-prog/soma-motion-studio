import {MotionInk} from '../src/studio/MotionInk';
import {hydraDefaults} from '../src/studio/hydraConfig';
const result=document.querySelector('#result')!,checks:string[]=[];
const check=(name:string,value:boolean)=>{if(!value)throw new Error(name);checks.push('PASS '+name);};
try{
 const ink=new MotionInk(),out=document.createElement('canvas');out.width=1000;out.height=700;const ctx=out.getContext('2d')!;document.body.append(out);
 let h=hydraDefaults();let time=0;
 const draw=(x:number,y:number,live=true,visible=true)=>ink.draw(ctx,h,[{x:x*1000,y:y*700}],live,'hands',time+=40,.6,1000,700,.04,visible);
 const sum=()=>{const pixels=ink.canvas.getContext('2d')!.getImageData(0,0,1280,720).data;let total=0;for(let i=3;i<pixels.length;i+=4)total+=pixels[i];return total;};
 draw(.1,.3);draw(.2,.3);const initial=sum();check('actual movement paints marks',initial>0);
 h={...h,preset:'echo',palette:'violet'};draw(.2,.3,false);check('mode and palette switches preserve old marks',sum()===initial);
 draw(.7,.7);check('reacquisition starts a new stroke without a bridge',sum()===initial);
 draw(.8,.7);check('new stroke stacks over the retained buffer',sum()>initial);
 const stacked=sum();draw(.1,.1);check('sudden position jump never draws a connector',sum()===stacked);
 h={...h,trails:'fade',trailLife:.5};draw(.1,.1,false);check('fade removes pixel opacity',sum()<stacked);
 h={...h,reset:h.reset+1};draw(.1,.1,false);check('clear removes every mark',sum()===0);
 draw(.2,.2,true,false);draw(.3,.2,true,true);check('hidden visual resumes without connecting unseen motion',sum()===0);
}catch(e){checks.push('FAIL '+(e as Error).message);}result.textContent=checks.join('\n');
