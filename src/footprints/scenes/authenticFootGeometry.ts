/** GEO-01: anatomical, left/right foot artwork in local sole coordinates.
 * Heel at positive Y, toes at negative Y. Pure geometry; pressure is not sensed.
 * Canvas scale controls physical footprint dimensions. Never authorizes output.
 */
import {warpFootPoint,warpedToeRadius,type FootDeformation} from './dynamicFootDeformation.ts';
export type FootSide='left'|'right';
export type SolePoint=readonly [number,number];
export const FOOT_LENGTH_M=0.26;
export const FOOT_WIDTH_M=0.095;
/** Closed outer perimeter, from medial ball along toes to lateral heel. */
export const RIGHT_SOLE:readonly SolePoint[]=[
 [-.37,-.53],[-.45,-.35],[-.45,-.10],[-.37,.10],[-.30,.26],
 [-.34,.48],[-.33,.70],[-.25,.90],[-.09,.99],[.11,.98],
 [.27,.87],[.34,.66],[.33,.43],[.27,.23],[.34,.04],
 [.43,-.16],[.44,-.38],[.34,-.54],[.13,-.64],[-.10,-.65]
];
export type Toe={x:number;y:number;rx:number;ry:number;angle:number};
export const RIGHT_TOES:readonly Toe[]=[
 {x:-.29,y:-.83,rx:.135,ry:.16,angle:-.20},
 {x:-.055,y:-.87,rx:.105,ry:.125,angle:-.08},
 {x:.14,y:-.82,rx:.088,ry:.108,angle:.08},
 {x:.29,y:-.73,rx:.073,ry:.09,angle:.16},
 {x:.40,y:-.61,rx:.057,ry:.071,angle:.27}
];
const finite=(n:number)=>Number.isFinite(n);
export function footprintOutline(side:FootSide):SolePoint[]{
 const mirror=side==='left'?-1:1;
 return RIGHT_SOLE.map(([x,y])=>[x*mirror,y]);
}
export function footprintToes(side:FootSide):Toe[]{
 const mirror=side==='left'?-1:1;
 return RIGHT_TOES.map(t=>({...t,x:t.x*mirror,angle:t.angle*mirror}));
}
/** Geometry is in a unit-height footprint with independent horizontal scaling.
 * Measurements are nominal artistic geometry, not calibrated body measurements.
 */
export function paintAuthenticFootprint(
 ctx:CanvasRenderingContext2D,params:{
 x:number;y:number;side:FootSide;headingRad?:number;
 widthPx:number;lengthPx:number;alpha?:number;color?:string;
 phase?:'contact'|'prediction';deformation?:FootDeformation;
 }){
 const {x,y,side,widthPx,lengthPx}=params;
 if(![x,y,widthPx,lengthPx].every(finite)||widthPx<=0||lengthPx<=0)return;
 const heading=finite(params.headingRad??0)?(params.headingRad??0):0;
 const alpha=Math.max(0,Math.min(1,params.alpha??1));
 if(alpha===0)return;
 ctx.save();
 ctx.translate(x,y);
 ctx.rotate(heading);
 ctx.scale(widthPx,lengthPx/2);
 ctx.globalAlpha*=alpha;
 ctx.fillStyle=params.color??'#e6ebd9';
 ctx.strokeStyle=params.color??'#e6ebd9';
 const outline=footprintOutline(side).map(([px,py])=>
  warpFootPoint(px,py,params.deformation));
 ctx.beginPath();
 ctx.moveTo(outline[0][0],outline[0][1]);
 // Quadratic smoothing retains recognizable medial arch indentation.
 for(let i=1;i<=outline.length;i++){
  const current=outline[i%outline.length];
  const next=outline[(i+1)%outline.length];
  ctx.quadraticCurveTo(current[0],current[1],
   (current[0]+next[0])/2,(current[1]+next[1])/2);
 }
 ctx.closePath();
 if(params.phase==='prediction'){
  ctx.lineWidth=.045;ctx.setLineDash([.08,.09]);ctx.stroke();ctx.setLineDash([]);
 }else ctx.fill();
 for(const t of footprintToes(side)){
  const [tx,ty]=warpFootPoint(t.x,t.y,params.deformation);
  const radii=warpedToeRadius(t.rx,t.ry,t.y,params.deformation);
  ctx.beginPath();ctx.ellipse(tx,ty,radii.rx,radii.ry,t.angle,0,Math.PI*2);
  if(params.phase==='prediction')ctx.stroke();else ctx.fill();
 }
 ctx.restore();
}
