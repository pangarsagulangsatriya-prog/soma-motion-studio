import type {BodyField} from './bodyField';
export class SilhouetteLayer{
 canvas=document.createElement('canvas');private mask=document.createElement('canvas');
 constructor(){this.canvas.width=640;this.canvas.height=360;}
 reset(){this.canvas.getContext('2d')!.clearRect(0,0,this.canvas.width,this.canvas.height);}
 update(field:BodyField|undefined,aspect:number,dt:number,linger:number,accumulate:boolean){
 const h=Math.round(640/aspect);if(this.canvas.height!==h)this.canvas.height=h;
 const c=this.canvas.getContext('2d')!,w=this.canvas.width;
 if(!accumulate){if(linger<=0)c.clearRect(0,0,w,h);else{c.save();c.globalCompositeOperation='destination-out';c.fillStyle=`rgba(0,0,0,${1-Math.exp(-dt*3/linger)})`;c.fillRect(0,0,w,h);c.restore();}}
 const data=field?.mask;if(!data)return;
 this.mask.width=data.width;this.mask.height=data.height;const mc=this.mask.getContext('2d')!;const pixels=mc.createImageData(data.width,data.height);
 for(let i=0;i<data.data.length;i++){pixels.data[i*4]=255;pixels.data[i*4+1]=255;pixels.data[i*4+2]=255;pixels.data[i*4+3]=Math.round(Math.max(0,Math.min(1,(data.data[i]-100)/90))*255);}mc.putImageData(pixels,0,0);
 c.save();c.translate(field!.left*w,field!.top*h);if(field!.mirror){c.translate(field!.width*w,0);c.scale(-1,1);}c.drawImage(this.mask,0,0,field!.width*w,field!.height*h);c.restore();
 }
 outline(ctx:CanvasRenderingContext2D,field:BodyField,w:number,h:number,color:string){const mask=field.mask;if(!mask)return;ctx.save();ctx.strokeStyle=color;ctx.lineWidth=1.3;ctx.globalAlpha=.8;ctx.beginPath();const p=(x:number,y:number)=>({x:(field.left+(field.mirror?1-x/mask.width:x/mask.width)*field.width)*w,y:(field.top+y/mask.height*field.height)*h});const solid=(x:number,y:number)=>x>=0&&y>=0&&x<mask.width&&y<mask.height&&mask.data[y*mask.width+x]>150;for(let y=0;y<mask.height;y++)for(let x=0;x<mask.width;x++){if(!solid(x,y))continue;for(const [dx,dy,x1,y1,x2,y2]of [[0,-1,x,y,x+1,y],[0,1,x,y+1,x+1,y+1],[-1,0,x,y,x,y+1],[1,0,x+1,y,x+1,y+1]]){if(solid(x+dx,y+dy))continue;const a=p(x1,y1),b=p(x2,y2);ctx.moveTo(a.x,a.y);ctx.lineTo(b.x,b.y);}}ctx.stroke();ctx.restore();}
}
