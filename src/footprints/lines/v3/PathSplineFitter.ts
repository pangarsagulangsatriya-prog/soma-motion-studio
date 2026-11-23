import type {PathPoint} from './PathObservationRouter.ts';
export type PathKnot={point:PathPoint;timeMs:number;confidence:number};
export type PathSample=PathPoint&{s:number;tx:number;ty:number;confidence:number};
const length=(a:PathPoint,b:PathPoint)=>Math.hypot(b.x-a.x,b.y-a.y);
const mix=(a:number,b:number,t:number)=>a+(b-a)*t;
const interpolate=(a:PathPoint,b:PathPoint,t:number):PathPoint=>
 ({x:mix(a.x,b.x,t),y:mix(a.y,b.y,t)});
/** Sample one Catmull–Rom span; only its direct neighbours can influence its shape. */
export function samplePathSegment(knots:readonly PathKnot[],index:number,
 startArc:number,spacing=5):PathSample[]{
 if(index<0||index>=knots.length-1)return [];
 const p0=knots[Math.max(0,index-1)].point,p1=knots[index].point;
 const p2=knots[index+1].point,p3=knots[Math.min(knots.length-1,index+2)].point;
 const chord=length(p1,p2);
 if(chord<.001)return [];
 const steps=Math.min(72,Math.max(2,Math.ceil(chord/Math.max(1,spacing))));
 // Centripetal parameterisation avoids the wide loops that uniform interpolation
 // creates near a sharp corner. Bound to a small corridor around observed feet.
 const t0=0,t1=t0+Math.sqrt(Math.max(.0001,length(p0,p1)));
 const t2=t1+Math.sqrt(chord),t3=t2+Math.sqrt(Math.max(.0001,length(p2,p3)));
 const lerpT=(a:PathPoint,b:PathPoint,ta:number,tb:number,t:number):PathPoint=>
  Math.abs(tb-ta)<1e-9?b:interpolate(a,b,(t-ta)/(tb-ta));
 const positions:PathPoint[]=[];
 for(let i=0;i<=steps;i++){
  const u=i/steps;
  if(i===0){positions.push({...p1});continue;}
  if(i===steps){positions.push({...p2});continue;}
  const t=t1+(t2-t1)*u;
  const a1=lerpT(p0,p1,t0,t1,t),a2=lerpT(p1,p2,t1,t2,t);
  const a3=lerpT(p2,p3,t2,t3,t);
  const b1=lerpT(a1,a2,t0,t2,t),b2=lerpT(a2,a3,t1,t3,t);
  const c=lerpT(b1,b2,t1,t2,t);
  const minX=Math.min(p1.x,p2.x)-7,maxX=Math.max(p1.x,p2.x)+7;
  const minY=Math.min(p1.y,p2.y)-7,maxY=Math.max(p1.y,p2.y)+7;
  positions.push({x:Math.max(minX,Math.min(maxX,c.x)),y:Math.max(minY,Math.min(maxY,c.y))});
 }
 const samples:PathSample[]=[];
 let arc=startArc;
 for(let i=0;i<positions.length;i++){
  const a=positions[Math.max(0,i-1)],b=positions[Math.min(positions.length-1,i+1)];
  const dl=Math.hypot(b.x-a.x,b.y-a.y);
  if(i>0)arc+=length(positions[i-1],positions[i]);
  samples.push({...positions[i],s:arc,
   tx:dl>.001?(b.x-a.x)/dl:(p2.x-p1.x)/chord,
   ty:dl>.001?(b.y-a.y)/dl:(p2.y-p1.y)/chord,
   confidence:mix(knots[index].confidence,knots[index+1].confidence,i/steps)});
 }
 return samples;
}
export function knotDistances(knots:readonly PathKnot[],baseArc=0):number[]{
 const distances=[baseArc];
 for(let i=1;i<knots.length;i++)
  distances.push(distances[i-1]+length(knots[i-1].point,knots[i].point));
 return distances;
}
