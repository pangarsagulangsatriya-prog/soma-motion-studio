import {GlyphScene} from './GlyphScene';
import {PALETTES} from './liveVisual';
import type {HydraConfig} from './hydraConfig';
import type {MotionFrame} from '../engine/types';
import {WordScene,type Word} from './material';
export class KineticText{
 scene=new GlyphScene();private key='';private reset=-1;private mask=document.createElement('canvas');
 draw(ctx:CanvasRenderingContext2D,h:HydraConfig,f:MotionFrame,_words:Word[],points:{x:number;y:number}[],live:boolean,w:number,height:number,font:number,dt:number,key:string,image:ImageBitmap|null,text:string){
  const signature=key+':'+Math.round(w/height*1000);
  if(this.key!==signature){this.key=signature;const layout=new WordScene();layout.layout(text,font/height,t=>ctx.measureText(t).width/w);this.scene.layout(layout.words,t=>ctx.measureText(t).width/w);}
  if(this.reset!==h.textReset){if(this.reset>=0)this.scene.recover();this.reset=h.textReset;}
  this.scene.step(points.map(a=>({x:a.x/w,y:a.y/height})),live,f.features.pinch,f.features.spread,f.features.speed,dt,h.typography,h.motion);
  const photo=h.typography==='photo'&&image;
  if(photo&&(this.mask.width!==w||this.mask.height!==height)){this.mask.width=w;this.mask.height=height;}
  const x=photo?this.mask.getContext('2d')!:ctx;
  x.save();if(photo)x.clearRect(0,0,w,height);x.font=ctx.font;x.textAlign='center';x.textBaseline='middle';
  const palette=PALETTES[h.palette].colors;
  for(let i=0;i<this.scene.glyphs.length;i++){
   const g=this.scene.glyphs[i];x.save();x.translate(g.x*w,g.y*height);x.rotate(g.angle);
   const color=h.colorMode==='speed'?Math.min(palette.length-1,Math.floor(this.scene.energy*palette.length)):h.colorMode==='hands'?(g.ox<.5?0:1):0;
   x.fillStyle=palette[color];
   if(h.typography==='elastic')x.scale(1+this.scene.energy*.16,1-this.scene.energy*.08);
   const breakup=h.typography==='fragments'?this.scene.energy:0;
   if(breakup>.06&&i<900){const gw=Math.max(g.width*w+4,font*.25),gh=font*1.3;for(let tile=0;tile<4;tile++){const ix=tile%2,iy=Math.floor(tile/2),offset=breakup*font*(.4+h.density)*(1+(i%5)*.14);x.save();x.translate((ix-.5)*offset,(iy-.5)*offset);x.beginPath();x.rect((ix-1)*gw/2,(iy-1)*gh/2,gw/2,gh/2);x.clip();x.fillText(g.text,0,0);x.restore();}}
   else x.fillText(g.text,0,0);
   x.restore();
  }
  if(photo){x.globalCompositeOperation='source-in';const r=Math.max(w/image.width,height/image.height);x.drawImage(image,(w-image.width*r)/2,(height-image.height*r)/2,image.width*r,image.height*r);}
  x.restore();if(photo)ctx.drawImage(this.mask,0,0,w,height);
 }
}
