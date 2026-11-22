import type {SumiStrokeGeometry} from './SumiStrokeGeometryBuilder.ts';
export type PaintingBounds={x:number;y:number;width:number;height:number};
export type PainterlyViewTransform={scale:number;tx:number;ty:number};
const lerp=(a:number,b:number,t:number)=>a+(b-a)*t;
/** A preview-only view transform. It must never be fed back into Map/projector geometry. */
export function fitPaintingBounds(bounds:PaintingBounds|null,
 width=1600,height=900,margin=.16,maxZoom=2.1):PainterlyViewTransform{
 if(!bounds||bounds.width<=0||bounds.height<=0)return {scale:1,tx:0,ty:0};
 const safeMargin=Math.min(.25,Math.max(.08,margin));
 const usableW=width*(1-2*safeMargin),usableH=height*(1-2*safeMargin);
 const scale=Math.max(1,Math.min(maxZoom,usableW/bounds.width,usableH/bounds.height));
 // Keep a fully filled canvas stable at identity.
 if(scale<=1.02)return {scale:1,tx:0,ty:0};
 const cx=bounds.x+bounds.width/2,cy=bounds.y+bounds.height/2;
 return {scale,tx:width/2-scale*cx,ty:height/2-scale*cy};
}
export class PainterlyPreviewTransform{
 private current:PainterlyViewTransform={scale:1,tx:0,ty:0};
 update(bounds:PaintingBounds|null,enabled:boolean){
  const goal=enabled?fitPaintingBounds(bounds):{scale:1,tx:0,ty:0};
  const alpha=.12;
  this.current={scale:lerp(this.current.scale,goal.scale,alpha),
   tx:lerp(this.current.tx,goal.tx,alpha),
   ty:lerp(this.current.ty,goal.ty,alpha)};
  return {...this.current};
 }
 reset(){this.current={scale:1,tx:0,ty:0};}
}
export function extendPaintingBounds(current:PaintingBounds|null,
 geometry:SumiStrokeGeometry):PaintingBounds{
 const b=geometry.bounds;
 if(!current)return {...b};
 const x=Math.min(current.x,b.x),y=Math.min(current.y,b.y);
 const right=Math.max(current.x+current.width,b.x+b.width);
 const bottom=Math.max(current.y+current.height,b.y+b.height);
 return {x,y,width:right-x,height:bottom-y};
}
