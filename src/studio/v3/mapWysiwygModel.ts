import {correspondence,identityQuad,transform,validQuad,type Point,type Quad} from '../../projection/geometry.ts';

/** Source image is contained in the monitor. Letterbox pixels are never editable. */
export function containedImageRect(srcW:number,srcH:number,destW:number,destH:number){
 if(!(srcW>0&&srcH>0&&destW>0&&destH>0))return null;
 const scale=Math.min(destW/srcW,destH/srcH);
 const width=srcW*scale,height=srcH*scale;
 return {x:(destW-width)/2,y:(destH-height)/2,width,height};
}
export function pointerInSource(x:number,y:number,frame:{x:number;y:number;width:number;height:number}):Point|null{
 if(!Number.isFinite(x)||!Number.isFinite(y)||frame.width<=0||frame.height<=0)return null;
 const u=(x-frame.x)/frame.width,v=(y-frame.y)/frame.height;
 return u<0||u>1||v<0||v>1?null:{x:u,y:v};
}
export const initialCameraQuad=():Quad=>[
 {x:.08,y:.18},{x:.92,y:.18},{x:.92,y:.92},{x:.08,y:.92}
];
export function replaceValidCorner(quad:Quad,index:number,point:Point):Quad|null{
 if(index<0||index>3||!Number.isFinite(point.x)||!Number.isFinite(point.y))return null;
 const next=quad.map((p,i)=>i===index?point:p) as Quad;
 return validQuad(next)?next:null;
}
export function mapWarpPoint(source:Quad,destination:Quad,uv:Point){
 return {input:transform(correspondence(identityQuad(),source),uv),
  output:transform(correspondence(identityQuad(),destination),uv)};
}
/** Same normalized projective correspondence as the projector registration.
 * Triangles approximate the homography on a 2D preview canvas. Never use this
 * raster preview to authorize physical output or QA. */
export function paintMapWarp(
 ctx:CanvasRenderingContext2D,source:HTMLCanvasElement,
 sourceQuad:Quad,destinationQuad:Quad,w:number,h:number,
 subdivisions=10
){
 if(!source.width||!source.height||!validQuad(sourceQuad)||!validQuad(destinationQuad))return false;
 const from=correspondence(identityQuad(),sourceQuad);
 const to=correspondence(identityQuad(),destinationQuad);
 const cells=Math.max(2,Math.min(20,Math.floor(subdivisions)));
 const project=(u:number,v:number)=>{
  const s=transform(from,{x:u,y:v}),d=transform(to,{x:u,y:v});
  return {sx:s.x*source.width,sy:s.y*source.height,dx:d.x*w,dy:d.y*h};
 };
 const tri=(a:ReturnType<typeof project>,b:ReturnType<typeof project>,c:ReturnType<typeof project>)=>{
  const det=(b.sx-a.sx)*(c.sy-a.sy)-(c.sx-a.sx)*(b.sy-a.sy);
  if(Math.abs(det)<1e-8)return;
  const ax=((b.dx-a.dx)*(c.sy-a.sy)-(c.dx-a.dx)*(b.sy-a.sy))/det;
  const bx=((c.dx-a.dx)*(b.sx-a.sx)-(b.dx-a.dx)*(c.sx-a.sx))/det;
  const ay=((b.dy-a.dy)*(c.sy-a.sy)-(c.dy-a.dy)*(b.sy-a.sy))/det;
  const by=((c.dy-a.dy)*(b.sx-a.sx)-(b.dy-a.dy)*(c.sx-a.sx))/det;
  const tx=a.dx-ax*a.sx-bx*a.sy,ty=a.dy-ay*a.sx-by*a.sy;
  ctx.save();
  ctx.beginPath();ctx.moveTo(a.dx,a.dy);ctx.lineTo(b.dx,b.dy);ctx.lineTo(c.dx,c.dy);ctx.closePath();
  ctx.clip();
  ctx.setTransform(ax,ay,bx,by,tx,ty);
  ctx.drawImage(source,0,0);
  ctx.restore();
 };
 try{
  for(let y=0;y<cells;y++)for(let x=0;x<cells;x++){
   const a=project(x/cells,y/cells),b=project((x+1)/cells,y/cells),
    c=project((x+1)/cells,(y+1)/cells),d=project(x/cells,(y+1)/cells);
   tri(a,b,c);tri(a,c,d);
  }
  return true;
 }catch{return false;}
}
