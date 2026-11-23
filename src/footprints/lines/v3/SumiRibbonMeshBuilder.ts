import type {PathSample} from './PathSplineFitter.ts';
export type MeshPoint={x:number;y:number};
export type PathRibbonMesh={
 centerline:PathSample[];left:MeshPoint[];right:MeshPoint[];widths:number[];
 bounds:{x:number;y:number;width:number;height:number};
};
export type RibbonStyle={weightPx:number;material:'path-sumi'|'dry-ink'|'pigment-mass'};
const clamp=(n:number,low:number,high:number)=>Math.max(low,Math.min(high,n));
const smoothstep=(t:number)=>{const v=clamp(t,0,1);return v*v*(3-2*v);};
/** Build a bounded joined ribbon from arc-length samples, with a real tapered head/tail. */
export function buildPathRibbon(samples:readonly PathSample[],style:RibbonStyle,
 lengthPx:number,finalTail=false):PathRibbonMesh|null{
 if(samples.length<2)return null;
 const base=clamp(style.weightPx,8,42);
 const widths:number[]=[],left:MeshPoint[]=[],right:MeshPoint[]=[];
 for(let i=0;i<samples.length;i++){
  const p=samples[i];
  // Curvature and confidence can modulate the ink, never enlarge it into a blob.
  const previous=samples[Math.max(0,i-1)],next=samples[Math.min(samples.length-1,i+1)];
  const cosine=clamp(previous.tx*next.tx+previous.ty*next.ty,-1,1);
  const curvature=(1-cosine)/2;
  const confidence=clamp(.9+.1*p.confidence,.9,1);
  const width=clamp(base*(1+.12*curvature)*confidence,6,42);
  const head=smoothstep(p.s/(base*1.55));
  const tail=finalTail?smoothstep((lengthPx-p.s)/(base*3)):1;
  const w=width*Math.min(head,tail);
  widths.push(w);
  left.push({x:p.x-p.ty*w/2,y:p.y+p.tx*w/2});
  right.push({x:p.x+p.ty*w/2,y:p.y-p.tx*w/2});
 }
 const points=[...left,...right];
 const x0=Math.min(...points.map(p=>p.x)),y0=Math.min(...points.map(p=>p.y));
 const x1=Math.max(...points.map(p=>p.x)),y1=Math.max(...points.map(p=>p.y));
 const margin=base*.12+4;
 return {centerline:[...samples],left,right,widths,bounds:{
  x:x0-margin,y:y0-margin,width:x1-x0+margin*2,height:y1-y0+margin*2}};
}
