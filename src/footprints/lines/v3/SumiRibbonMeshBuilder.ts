import type {PathSample} from './PathSplineFitter.ts';
export type MeshPoint={x:number;y:number};
export type PathRibbonMesh={
 centerline:PathSample[];left:MeshPoint[];right:MeshPoint[];widths:number[];
 bounds:{x:number;y:number;width:number;height:number};
};
export type RibbonStyle={weightPx:number;material:'path-sumi'|'rough-sumi'|'dry-ink'|'pigment-mass';
 roughness?:number;seed?:number};
const clamp=(n:number,low:number,high:number)=>Math.max(low,Math.min(high,n));
const smoothstep=(t:number)=>{const v=clamp(t,0,1);return v*v*(3-2*v);};
const hash=(seed:number,i:number)=>{let n=Math.imul(seed^(i*0x9e3779b9),2246822519)>>>0;
 n=Math.imul(n^(n>>>13),3266489917)>>>0;
 return ((n^(n>>>16))>>>0)/4294967296;};
/** Correlated texture in GLOBAL arc-length; adjacent committed spans share edge phase. */
export function coherentEdgeNoise(seed:number,s:number,period:number){
 const x=s/period,i=Math.floor(x),t=smoothstep(x-i);
 return (hash(seed,i)*(1-t)+hash(seed,i+1)*t)*2-1;
}
/** Build a bounded joined ribbon from arc-length samples, with a real tapered head/tail. */
export function buildPathRibbon(samples:readonly PathSample[],style:RibbonStyle,
 lengthPx:number,finalTail=false):PathRibbonMesh|null{
 if(samples.length<2)return null;
 const base=clamp(style.weightPx,8,42);
 const widths:number[]=[],left:MeshPoint[]=[],right:MeshPoint[]=[];
 const rough=style.material==='rough-sumi'?clamp(style.roughness??.74,0,1):0;
 const seed=style.seed??0;
 for(let i=0;i<samples.length;i++){
  const p=samples[i];
  // Curvature and confidence can modulate the ink, never enlarge it into a blob.
  const previous=samples[Math.max(0,i-1)],next=samples[Math.min(samples.length-1,i+1)];
  const cosine=clamp(previous.tx*next.tx+previous.ty*next.ty,-1,1);
  const curvature=(1-cosine)/2;
  const confidence=clamp(.9+.1*p.confidence,.9,1);
  const width=clamp(base*(1+.12*curvature)*confidence*
   clamp(p.widthFactor??1,.65,1.3),6,42);
  const head=smoothstep(p.s/(base*.95));
  const tail=finalTail?smoothstep((lengthPx-p.s)/(base*1.9)):1;
  const w=width*Math.min(head,tail);
  widths.push(w);
  // The accepted centreline is unchanged. Only nib edges fray, bounded
  // to 18% of the local width; dense middle pigment remains continuous.
  const amp=rough*Math.min(.18*w,8);
  const leftNoise=coherentEdgeNoise(seed^0x73219,p.s,12)*.68+
   coherentEdgeNoise(seed^0x91eed,p.s,3.7)*.32;
  const rightNoise=coherentEdgeNoise(seed^0x53b19,p.s,11)*.68+
   coherentEdgeNoise(seed^0x2aa51,p.s,3.3)*.32;
  const lw=w/2+amp*leftNoise,rw=w/2+amp*rightNoise;
  left.push({x:p.x-p.ty*lw,y:p.y+p.tx*lw});
  right.push({x:p.x+p.ty*rw,y:p.y-p.tx*rw});
 }
 const points=[...left,...right];
 const x0=Math.min(...points.map(p=>p.x)),y0=Math.min(...points.map(p=>p.y));
 const x1=Math.max(...points.map(p=>p.x)),y1=Math.max(...points.map(p=>p.y));
 const margin=base*(rough>0?.24:.12)+4;
 return {centerline:[...samples],left,right,widths,bounds:{
  x:x0-margin,y:y0-margin,width:x1-x0+margin*2,height:y1-y0+margin*2}};
}
