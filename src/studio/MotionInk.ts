import type {HydraConfig} from './hydraConfig';
import {PALETTES} from './liveVisual';
type Point={x:number;y:number};
// A bounded pixel buffer retains marks across mode/view changes; no growing point list.
export class MotionInk{
 canvas=document.createElement('canvas');private previous:Point[]=[];private sample=-1;private reset=-1;private source='';
 constructor(){this.canvas.width=1280;this.canvas.height=720;}
 draw(ctx:CanvasRenderingContext2D,h:HydraConfig,points:Point[],live:boolean,source:string,sample:number,speed:number,w:number,height:number,dt:number,visible:boolean){
  const x=this.canvas.getContext('2d')!,cw=this.canvas.width,ch=this.canvas.height;
  if(this.reset!==h.reset){x.clearRect(0,0,cw,ch);this.previous=[];this.sample=-1;this.reset=h.reset;}
  if(this.source!==source){this.previous=[];this.source=source;}
  if(!visible||h.trails==='off'){this.previous=[];this.sample=-1;return;}
  if(h.hold){this.previous=[];this.sample=-1;ctx.save();ctx.globalAlpha=.85;ctx.drawImage(this.canvas,0,0,w,height);ctx.restore();return;}
  if(h.trails==='fade'){x.save();x.globalCompositeOperation='destination-out';x.fillStyle=`rgba(0,0,0,${1-Math.exp(-dt*3/h.trailLife)})`;x.fillRect(0,0,cw,ch);x.restore();}
  if(h.colorMode==='age'){x.save();x.globalCompositeOperation='source-atop';x.globalAlpha=Math.min(.06,dt*.3);x.fillStyle=PALETTES[h.palette].colors.at(-1)!;x.fillRect(0,0,cw,ch);x.restore();}
  if(!live){this.previous=[];this.sample=-1;}
  else if(sample!==this.sample){
   const normalized=points.map(p=>({x:p.x/w,y:p.y/height}));
   const colors=PALETTES[h.palette].colors;x.lineCap='round';x.lineJoin='round';x.lineWidth=1.5+Math.max(0,Math.min(1,speed))*7;
   normalized.forEach((p,i)=>{const q=this.previous[i];if(!q||Math.hypot(p.x-q.x,p.y-q.y)>.22)return;
    const index=h.colorMode==='speed'?Math.min(colors.length-1,Math.floor(Math.max(0,Math.min(1,speed))*colors.length)):h.colorMode==='hands'?Math.floor(i/5)%colors.length:(i+Math.floor(sample/1600))%colors.length;
    x.strokeStyle=colors[index];x.globalAlpha=.2+h.density*.8;x.beginPath();x.moveTo(q.x*cw,q.y*ch);x.lineTo(p.x*cw,p.y*ch);x.stroke();
   });x.globalAlpha=1;this.previous=normalized;this.sample=sample;
  }
  ctx.save();ctx.globalAlpha=.85;ctx.drawImage(this.canvas,0,0,w,height);ctx.restore();
 }
}
