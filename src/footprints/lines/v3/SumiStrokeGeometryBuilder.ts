import type {InkSegmentEvent} from './ObservedMotionInkEngine.ts';

export type InkPoint={x:number;y:number};
export type SumiStrokeGeometry={
 kind:'ribbon'|'pivot';centerline:InkPoint[];left:InkPoint[];right:InkPoint[];
 widths:number[];bounds:{x:number;y:number;width:number;height:number};
};
export type SumiGeometrySettings={weightPx:number;expression:'natural'|'bold'};
const clamp=(n:number,a:number,b:number)=>Math.min(b,Math.max(a,n));
const mix=(a:number,b:number,t:number)=>a+(b-a)*t;
const angleDiff=(a:number,b:number)=>Math.atan2(Math.sin(b-a),Math.cos(b-a));
const uv=(p:{x:number;y:number}):InkPoint=>({x:p.x*1600,y:p.y*900});
/** Filled ribbon coordinates are computed in the canonical 1600×900 canvas. */
export function buildSumiStrokeGeometry(event:InkSegmentEvent,
 style:SumiGeometrySettings):SumiStrokeGeometry|null{
 const from=uv(event.from.center),to=uv(event.to.center);
 const weight=clamp(style.weightPx,8,96)*(style.expression==='bold'?1:.8);
 const dx=to.x-from.x,dy=to.y-from.y;
 const length=Math.hypot(dx,dy);
 const dt=Math.max(1,event.toMs-event.fromMs);
 const speed=length/(dt/1000);
 const speedFactor=clamp(1.08-.00022*speed,.83,1.18);
 const qualityFactor=clamp(.85+.15*event.confidence,.85,1);
 const theta0=event.from.headingRad??0;
 const dtheta=event.to.headingRad===undefined?0:angleDiff(theta0,event.to.headingRad);
 const width=clamp(weight*speedFactor*qualityFactor*(1+.10*Math.min(1,Math.abs(dtheta))),weight*.65,weight*1.35);
 let steps=Math.min(64,Math.max(2,Math.ceil(length/Math.max(1,width*.20)),
  Math.ceil(Math.abs(dtheta)/(Math.PI/36))));
 const centers:InkPoint[]=[];
 if(event.kind==='pivot'&&event.pivot){
  const a=event.from[event.pivot],b=event.to[event.pivot];
  if(!a||!b)return null;
  const pivotA=uv(a),pivotB=uv(b);
  // Rotate the actually observed centre-to-anchor vector; avoids invented midpoint lines.
  const offset={x:from.x-pivotA.x,y:from.y-pivotA.y};
  steps=Math.max(2,steps);
  for(let i=0;i<=steps;i++){
   const t=i/steps,rot=dtheta*t;
   const cx=mix(pivotA.x,pivotB.x,t),cy=mix(pivotA.y,pivotB.y,t);
   centers.push({x:cx+offset.x*Math.cos(rot)-offset.y*Math.sin(rot),
    y:cy+offset.x*Math.sin(rot)+offset.y*Math.cos(rot)});
  }
 }else{
  if(length<1.6)return null;
  for(let i=0;i<=steps;i++){
   const t=i/steps;
   centers.push({x:mix(from.x,to.x,t),y:mix(from.y,to.y,t)});
  }
 }
 const left:InkPoint[]=[],right:InkPoint[]=[],widths:number[]=[];
 for(let i=0;i<centers.length;i++){
  const current=centers[i];
  const a=centers[Math.max(0,i-1)],b=centers[Math.min(centers.length-1,i+1)];
  const vx=b.x-a.x,vy=b.y-a.y,vlen=Math.hypot(vx,vy);
  if(vlen<.01)return null;
  const nx=-vy/vlen,ny=vx/vlen,t=i/(centers.length-1);
  // Short, bounded brush entry; subsequent events retain full body.
  const startFactor=event.startsStroke?mix(.70,1,Math.min(1,t*3)) : 1;
  const modulation=clamp(1+.09*Math.sin(Math.PI*t)+.05*Math.sin(t*4.5),.86,1.14);
  const w=width*modulation*startFactor;
  widths.push(w);
  left.push({x:current.x+nx*w/2,y:current.y+ny*w/2});
  right.push({x:current.x-nx*w/2,y:current.y-ny*w/2});
 }
 const all=[...left,...right];
 const x0=Math.min(...all.map(p=>p.x)),x1=Math.max(...all.map(p=>p.x));
 const y0=Math.min(...all.map(p=>p.y)),y1=Math.max(...all.map(p=>p.y));
 const padding=width*.12+3;
 return {kind:event.kind==='pivot'?'pivot':'ribbon',centerline:centers,
  left,right,widths,bounds:{x:x0-padding,y:y0-padding,
   width:x1-x0+2*padding,height:y1-y0+2*padding}};
}
