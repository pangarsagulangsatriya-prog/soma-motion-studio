import type {BrushPoint,FootBrushPose} from './FootBrushPoseAdapter.ts';

export type BrushDab={
 center:BrushPoint;headingRad:number;side:'left'|'right';alpha:number;
 sourceMs:number;kind:'imprint'|'drag'|'pivot';actorId:string;seed:number;
};
const lerp=(a:number,b:number,t:number)=>a+(b-a)*t;
const between=(a:BrushPoint,b:BrushPoint,t:number)=>({x:lerp(a.x,b.x,t),y:lerp(a.y,b.y,t)});
const angleDelta=(a:number,b:number)=>Math.atan2(Math.sin(b-a),Math.cos(b-a));
const hash=(s:string)=>{let h=2166136261;for(const c of s)h=Math.imul(h^c.charCodeAt(0),16777619);return h>>>0;};
const valid=(a:BrushPoint)=>Number.isFinite(a.x)&&Number.isFinite(a.y);
function poseHeading(p:FootBrushPose){return Number.isFinite(p.headingRad)?p.headingRad!:0;}
/** Pure geometry: samples only observed spatial displacement within an accepted segment.
 * The dabs' center and heading are output commands, not extra tracking positions.
 */
export function buildFootBrushDabs(before:FootBrushPose,after:FootBrushPose,
 kind:'imprint'|'drag'|'pivot',opts:{footWidth?:number;maxDabs?:number;pivot?:'heel'|'toe'}={}):BrushDab[]{
 if(before.actorId!==after.actorId||before.foot!==after.foot||
 before.sourceKey!==after.sourceKey||before.epoch!==after.epoch||
 before.coordinateBasis!==after.coordinateBasis||after.atMs<before.atMs||
 !valid(before.center)||!valid(after.center))return [];
 const a=poseHeading(before),delta=angleDelta(a,poseHeading(after));
 const width=Math.max(.004,opts.footWidth??.025);
 const dist=Math.hypot((after.center.x-before.center.x)*16/9,
  after.center.y-before.center.y);
 if(dist>.23||after.atMs-before.atMs>390)return [];
 if(kind==='imprint')return [{center:after.center,headingRad:poseHeading(after),
  side:after.foot,alpha:1,sourceMs:after.atMs,kind,actorId:after.actorId,
  seed:hash(after.sourceKey+after.epoch+after.actorId+after.foot+after.atMs)}];
 const pivot=kind==='pivot'&&opts.pivot==='heel'&&before.heel&&after.heel?
  {start:before.heel,end:after.heel,offset:{x:before.center.x-before.heel.x,
   y:before.center.y-before.heel.y}}:
  kind==='pivot'&&opts.pivot==='toe'&&before.toe&&after.toe?
  {start:before.toe,end:after.toe,offset:{x:before.center.x-before.toe.x,
   y:before.center.y-before.toe.y}}:null;
 if(kind==='pivot'&&!pivot)return [];
 const samples=Math.min(opts.maxDabs??64,Math.max(1,Math.ceil(Math.max(
  dist/(width*.25),Math.abs(delta)/(Math.PI/36)))));
 const out:BrushDab[]=[];
 const seed=hash(after.sourceKey+after.epoch+after.actorId+after.foot+before.atMs);
 for(let i=0;i<=samples;i++){
  const t=i/samples,theta=lerp(a,a+delta,t);
  let center=between(before.center,after.center,t);
  if(pivot){
   const origin=between(pivot.start,pivot.end,t);
   const turn=theta-a;
   center={x:origin.x+pivot.offset.x*Math.cos(turn)-pivot.offset.y*Math.sin(turn),
    y:origin.y+pivot.offset.x*Math.sin(turn)+pivot.offset.y*Math.cos(turn)};
  }
  out.push({center,headingRad:theta,side:after.foot,
   alpha:.65+.35*Math.sin(Math.PI*t),sourceMs:lerp(before.atMs,after.atMs,t),
   kind,actorId:after.actorId,seed:seed+i});
 }
 return out;
}
