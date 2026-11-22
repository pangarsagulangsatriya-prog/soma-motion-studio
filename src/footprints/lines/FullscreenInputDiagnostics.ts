import type {Landmark} from '../../engine/types.ts';

export type FullscreenDiagnostics={camera:boolean;skeleton:boolean};
export const DEFAULT_FULLSCREEN_DIAGNOSTICS:FullscreenDiagnostics={
 camera:false,skeleton:false
};
export type FullscreenInputSource={
 image:CanvasImageSource|null;width:number;height:number;label:string;
 pose:readonly Landmark[]|null;
};

const CONNECTIONS:ReadonlyArray<readonly [number,number]>=[
 [11,12],[11,13],[13,15],[12,14],[14,16],
 [11,23],[12,24],[23,24],
 [23,25],[25,27],[27,29],[29,31],[27,31],
 [24,26],[26,28],[28,30],[30,32],[28,32]
];
const valid=(p:Landmark|undefined):p is Landmark=>!!p&&
 Number.isFinite(p.x)&&Number.isFinite(p.y)&&
 p.x>=0&&p.x<=1&&p.y>=0&&p.y<=1&&(p.visibility??1)>=.45;

/** One diagnostic preview inside the existing fullscreen canvas.
 * Camera and skeleton use the same source image coordinate system.
 * The stage painting remains independent; missing media never activates a camera. */
export function paintFullscreenInputDiagnostics(
 ctx:CanvasRenderingContext2D,
 options:FullscreenDiagnostics,
 input:FullscreenInputSource
):void{
 if(!options.camera&&!options.skeleton)return;
 const w=ctx.canvas.width,h=ctx.canvas.height;
 const width=Math.round(w*.28),height=Math.round(width*9/16);
 const x=w-width-Math.round(w*.026),y=Math.round(h*.035);
 const inset=Math.max(6,Math.round(w*.004));
 const header=Math.round(h*.038);
 const imageX=x+inset,imageY=y+header+inset;
 const imageW=width-2*inset,imageH=height-header-inset*2;
 ctx.save();
 ctx.setTransform(1,0,0,1,0,0);
 ctx.globalAlpha=1;
 ctx.fillStyle='#101712';
 ctx.fillRect(x,y,width,height);
 ctx.strokeStyle='#7b9c83';
 ctx.lineWidth=Math.max(1.3,w/1100);
 ctx.strokeRect(x+.5,y+.5,width-1,height-1);
 ctx.font=`${Math.max(12,Math.round(w*.009))}px system-ui,sans-serif`;
 ctx.fillStyle='#e5f1e5';
 ctx.textBaseline='middle';
 ctx.fillText(
  options.camera&&options.skeleton?'INPUT + SKELETON':
   options.camera?'INPUT KAMERA / VIDEO':'SKELETON',
  imageX,y+header/2
 );
 ctx.fillStyle='#1d2822';
 ctx.fillRect(imageX,imageY,imageW,imageH);

 const hasImage=input.image!==null&&input.width>0&&input.height>0;
 const aspect=hasImage?input.width/input.height:16/9;
 const drawW=aspect>=imageW/imageH?imageW:imageH*aspect;
 const drawH=aspect>=imageW/imageH?imageW/aspect:imageH;
 const dx=imageX+(imageW-drawW)/2,dy=imageY+(imageH-drawH)/2;
 if(options.camera&&hasImage){
  try{ctx.drawImage(input.image!,dx,dy,drawW,drawH);}
  catch{/* Decoded frame may have been replaced; keep preview blank. */}
 }
 if(options.skeleton&&input.pose?.length){
  ctx.strokeStyle='#c9ff85';
  ctx.fillStyle='#f1ffe0';
  ctx.lineWidth=Math.max(1.5,w*.00145);
  for(const [a,b] of CONNECTIONS){
   const from=input.pose[a],to=input.pose[b];
   if(!valid(from)||!valid(to))continue;
   ctx.beginPath();
   ctx.moveTo(dx+from.x*drawW,dy+from.y*drawH);
   ctx.lineTo(dx+to.x*drawW,dy+to.y*drawH);
   ctx.stroke();
  }
  const radius=Math.max(2.2,w*.0022);
  for(const index of [11,12,13,14,15,16,23,24,25,26,27,28,29,30,31,32]){
   const point=input.pose[index];
   if(!valid(point))continue;
   ctx.beginPath();
   ctx.arc(dx+point.x*drawW,dy+point.y*drawH,radius,0,Math.PI*2);
   ctx.fill();
  }
 }
 if((options.camera&&!hasImage)||(options.skeleton&&!input.pose?.length)){
  ctx.font=`${Math.max(12,Math.round(w*.0085))}px system-ui,sans-serif`;
  ctx.fillStyle='#e9eee5';
  ctx.textAlign='center';
  ctx.fillText(options.skeleton&&!input.pose?.length?
   'Skeleton belum terbaca':'Input belum tersedia',
   imageX+imageW/2,imageY+imageH/2);
  ctx.textAlign='start';
 }
 ctx.restore();
}
