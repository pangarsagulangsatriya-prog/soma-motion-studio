/**
 * D3 — guided independent 33-point crop inference.
 * Identity guides refer ONLY to confirmed A/B poses from the previous
 * analyzed frame. Uncertain or overlapping people are never cropped blindly.
 */
import type {Landmark} from '../engine/types.ts';
import type {PoseSearchRegion} from './duetPoseRescue.ts';
import {rescuePoseQuality} from './duetPoseRescue.ts';

export type D3Actor='A'|'B';
export type D3Guide={id:D3Actor;region:PoseSearchRegion;anchor:{x:number;y:number}};
export type D3Match={id:D3Actor;rawIndex:number;region:PoseSearchRegion;anchor:{x:number;y:number}};
export type D3Report={
 status:'warming'|'active'|'fallback';
 attempted:number;accepted:number;refined:D3Actor[];elapsedMs:number;
 reason?:string;
};
const clip=(n:number,min:number,max:number)=>Math.max(min,Math.min(max,n));
const distance=(a:{x:number;y:number},b:{x:number;y:number})=>Math.hypot(a.x-b.x,a.y-b.y);
const good=(p:Landmark|undefined,visibility=.34)=>Boolean(p&&
 Number.isFinite(p.x)&&Number.isFinite(p.y)&&p.x>=0&&p.x<=1&&p.y>=0&&p.y<=1&&
 (p.visibility??.7)>=visibility);
export function torsoAnchor(pose:readonly Landmark[]):{x:number;y:number}|null{
 if(pose.length!==33)return null;
 const used=[11,12,23,24].map(i=>pose[i]).filter((p):p is Landmark=>good(p,.44));
 if(used.length<3)return null;
 return {x:used.reduce((s,p)=>s+p.x,0)/used.length,
  y:used.reduce((s,p)=>s+p.y,0)/used.length};
}
/** Full-body crop in pixel-correct aspect ratio, with at least one step margin. */
export function d3GuideForPose(id:D3Actor,pose:readonly Landmark[],width:number,height:number):D3Guide|null{
 if(!Number.isFinite(width)||!Number.isFinite(height)||width<=0||height<=0)return null;
 const anchor=torsoAnchor(pose);
 if(!anchor)return null;
 const visible=pose.filter(p=>good(p));
 if(visible.length<10)return null;
 const xs=visible.map(p=>p.x),ys=visible.map(p=>p.y);
 const minX=Math.min(...xs),maxX=Math.max(...xs),minY=Math.min(...ys),maxY=Math.max(...ys);
 const centerX=(minX+maxX)/2,centerY=(minY+maxY)/2;
 const h=clip(Math.max(.38,(maxY-minY)*1.24),.38,.98);
 const w=clip(Math.max(.14,(maxX-minX)*1.3,h*height/width*.75),.14,.66);
 const x=clip(centerX-w/2,0,1-w),y=clip(centerY-h/2,0,1-h);
 if(anchor.x<x+.02||anchor.x>x+w-.02||anchor.y<y+.02||anchor.y>y+h-.02)return null;
 return {id,region:{x,y,width:w,height:h},anchor};
}
/**
 * Match guide A/B to *current* raw MediaPipe poses independently from array
 * order. Tight margin prevents the wrong crop from relabeling a crossing.
 */
export function d3MatchGuides(guides:readonly D3Guide[],poses:readonly (readonly Landmark[])[]):D3Match[]{
 const centers=poses.map(p=>torsoAnchor(p));
 const proposed=guides.flatMap(guide=>{
  const scores=centers.map((center,index)=>({
   index,cost:center?distance(center,guide.anchor):Infinity
  })).sort((a,b)=>a.cost-b.cost);
  if(!scores.length||scores[0].cost>.14)return [];
  if(scores.length>1&&scores[1].cost-scores[0].cost<.065)return [];
  return [{id:guide.id,rawIndex:scores[0].index,region:guide.region,anchor:guide.anchor,
   cost:scores[0].cost}];
 });
 // An observation cannot serve two actors. Reject the contested observation.
 const counts=new Map<number,number>();
 for(const p of proposed)counts.set(p.rawIndex,(counts.get(p.rawIndex)??0)+1);
 return proposed.filter(p=>counts.get(p.rawIndex)===1)
  .map(({cost:_cost,...p})=>p);
}
/** Reject crop output that jumped to the adjacent actor or lost the feet. */
export function d3AcceptRefinement(
 refined:readonly Landmark[],primary:readonly Landmark[],
 others:readonly (readonly Landmark[])[],region:PoseSearchRegion
):boolean{
 if(refined.length!==33||primary.length!==33)return false;
 if(rescuePoseQuality(refined)<.68)return false;
 const original=torsoAnchor(primary),recovered=torsoAnchor(refined);
 if(!original||!recovered||distance(original,recovered)>.08)return false;
 if(recovered.x<region.x||recovered.x>region.x+region.width||
    recovered.y<region.y||recovered.y>region.y+region.height)return false;
 for(const other of others){
  const neighboring=torsoAnchor(other);
  if(neighboring&&distance(recovered,neighboring)<.085)return false;
 }
 // No large artificial displacement of feet through crop distortion.
 const footIndices=[27,28,31,32];
 for(const i of footIndices){
  const a=primary[i],b=refined[i];
  if(good(a,.55)&&good(b,.55)&&distance(a,b)>.13)return false;
 }
 return true;
}
