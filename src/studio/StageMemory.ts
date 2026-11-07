import type {HydraConfig} from './hydraConfig';
import {PALETTES} from './liveVisual';
export type Segment=[number,number,number,number];
// Keep only twelve past detections. Historical echoes never invent new points.
export class SkeletonMemory{
 samples:{time:number;lines:Segment[];palette:HydraConfig['palette']}[]=[];private sample=-1;private source='';private reset=-1;
 draw(ctx:CanvasRenderingContext2D,h:HydraConfig,lines:Segment[],live:boolean,source:string,sample:number,now:number,w:number,height:number,visible:boolean){
  if(this.source!==source||this.reset!==h.reset){this.samples=[];this.sample=-1;this.source=source;this.reset=h.reset;}
  if(!h.echoes||!visible){this.samples=[];return;}
  if(!h.hold){this.samples=this.samples.filter(s=>now-s.time<h.trailLife*1000);
   if(live&&sample!==this.sample&&(!this.samples.length||now-this.samples.at(-1)!.time>160)){this.samples.push({time:now,lines:lines.map(l=>[...l] as Segment),palette:h.palette});this.sample=sample;while(this.samples.length>Math.round(3+h.density*9))this.samples.shift();}
  }else {for(const s of this.samples)s.time+=Math.max(0,now-(this.lastNow||now));}
  this.lastNow=now;ctx.save();ctx.lineWidth=1;
  for(const s of this.samples){const age=Math.min(1,(now-s.time)/(h.trailLife*1000)),colors=PALETTES[s.palette].colors;ctx.strokeStyle=colors[Math.min(colors.length-1,Math.floor(age*colors.length))];ctx.globalAlpha=(1-age)*.28;ctx.beginPath();for(const [ax,ay,bx,by]of s.lines){ctx.moveTo(ax*w,ay*height);ctx.lineTo(bx*w,by*height);}ctx.stroke();}ctx.restore();
 }
 private lastNow=0;
}
// One retained frame makes a bounded dissolve; live synthesis keeps running underneath.
export class SceneTransition{
 private previous=document.createElement('canvas');private outgoing=document.createElement('canvas');private key='';private start=0;private reset=-1;
 apply(ctx:CanvasRenderingContext2D,key:string,seconds:number,now:number,w:number,h:number,enabled:boolean,reset=0){
  if(this.reset!==reset){this.reset=reset;this.start=0;this.key='';this.previous.width=0;this.outgoing.width=0;}
  const changed=this.key!==key;
  if(changed&&this.key&&enabled&&seconds>0){this.outgoing.width=this.previous.width;this.outgoing.height=this.previous.height;this.outgoing.getContext('2d')!.drawImage(this.previous,0,0);this.start=now;}
  if(!enabled||seconds===0)this.start=0;this.key=key;
  const alpha=this.start?Math.max(0,1-(now-this.start)/(seconds*1000)):0;
  if(alpha>0&&this.outgoing.width){ctx.save();ctx.globalAlpha=alpha;ctx.drawImage(this.outgoing,0,0,w,h);ctx.restore();}else this.start=0;
  const pw=960,ph=Math.max(1,Math.round(960*h/w));if(this.previous.width!==pw||this.previous.height!==ph){this.previous.width=pw;this.previous.height=ph;}
  const x=this.previous.getContext('2d')!;x.clearRect(0,0,pw,ph);x.drawImage(ctx.canvas,0,0,pw,ph);
 }
}
