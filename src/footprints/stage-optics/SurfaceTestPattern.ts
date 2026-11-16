import type {BodyMask} from '../../studio/bodyField.ts';
import {SURFACE_TARGETS,type StageSurface} from './DualSurfaceCalibration.ts';

export function drawSurfaceTestPattern(canvas:HTMLCanvasElement,surface:StageSurface,
 targetId:string,bodyMask:BodyMask|null):boolean{
 const ctx=canvas.getContext('2d');
 if(!ctx)return false;
 const w=canvas.width,h=canvas.height;
 ctx.setTransform(1,0,0,1,0,0);ctx.fillStyle='#000';ctx.fillRect(0,0,w,h);
 const target=SURFACE_TARGETS[surface].find(t=>t.id===targetId);
 if(!target)return false;
 if(surface==='floor'){
  // Only a small target cross is illuminated at any time, never a full
  // unbounded white projector field.
  const x=target.uv.x*w,y=target.uv.y*h,size=Math.min(w,h)*.045;
  ctx.strokeStyle='#b0b0b0';ctx.lineWidth=Math.max(1,w/600);
  ctx.beginPath();ctx.moveTo(x-size,y);ctx.lineTo(x+size,y);
  ctx.moveTo(x,y-size);ctx.lineTo(x,y+size);ctx.stroke();
  ctx.beginPath();ctx.arc(x,y,size/3,0,2*Math.PI);ctx.stroke();
  return true;
 }
 if(!bodyMask||bodyMask.width<16||bodyMask.height<16||
  bodyMask.data.length!==bodyMask.width*bodyMask.height)return false;
 const temp=document.createElement('canvas');temp.width=bodyMask.width;temp.height=bodyMask.height;
 const tctx=temp.getContext('2d');if(!tctx)return false;
 const img=tctx.createImageData(temp.width,temp.height);
 let visible=0;
 for(let i=0;i<bodyMask.data.length;i++){
  const alpha=bodyMask.data[i];if(alpha>0)visible++;
  const shade=Math.round(alpha*.22);
  img.data[i*4]=shade;img.data[i*4+1]=shade;img.data[i*4+2]=shade;img.data[i*4+3]=255;
 }
 if(visible<20)return false;
 tctx.putImageData(img,0,0);
 ctx.imageSmoothingEnabled=true;
 ctx.drawImage(temp,0,0,w,h);
 // There are no unmasked crosses: user measures moving outline registration
 // while each pose is sampled under its own safe lower-body mask.
 return true;
}
