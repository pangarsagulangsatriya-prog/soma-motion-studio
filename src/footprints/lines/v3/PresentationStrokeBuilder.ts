import type {V3Stroke,V3Point} from './DualFootTrajectoryEngine.ts';

export type StrokeCharacter='precision'|'fluid'|'paint';
export type PresentationVertex={x:number;y:number;atMs:number;speedPxPerSec:number};
export type PresentationPath={points:readonly PresentationVertex[];totalLengthPx:number;hiddenAsMicroStroke:boolean};

const dist=(a:{x:number;y:number},b:{x:number;y:number})=>Math.hypot(b.x-a.x,b.y-a.y);
const clamp=(x:number,a:number,b:number)=>Math.min(b,Math.max(a,x));
const CACHE_LIMIT=256;
// One current revision per trajectory, so long-running video cannot accumulate
// a cached path for every requestAnimationFrame or every received source frame.
const cache=new Map<string,{revision:string;result:PresentationPath}>();
export function clearPresentationCache(){cache.clear();}
export function presentationCacheSize(){return cache.size;}

function angleAt(a:{x:number;y:number},b:{x:number;y:number},c:{x:number;y:number}):number{
 const x=b.x-a.x,y=b.y-a.y,xx=c.x-b.x,yy=c.y-b.y;
 const d=Math.hypot(x,y)*Math.hypot(xx,yy);
 return d>1e-8?Math.acos(clamp((x*xx+y*yy)/d,-1,1)):0;
}
function scaled(p:V3Point,w:number,h:number){return {x:p.x*w,y:p.y*h};}
function speed(a:V3Point,b:V3Point,w:number,h:number){
 return dist(scaled(a,w,h),scaled(b,w,h))/Math.max(1,b.atMs-a.atMs)*1000;
}
function point(p:V3Point,w:number,h:number,v:number):PresentationVertex{
 return {x:p.x*w,y:p.y*h,atMs:p.atMs,speedPxPerSec:v};
}
function makePath(
 stroke:V3Stroke,character:StrokeCharacter,w:number,h:number
):PresentationPath{
 const source=stroke.points;
 const len=source.reduce((sum,p,i)=>i?sum+dist(scaled(source[i-1],w,h),scaled(p,w,h)):sum,0);
 // Visual-only pruning. Raw data and cut provenance remain untouched.
 const hiddenAsMicroStroke=character!=='precision'&&(source.length<3||len<8*w/1600);
 if(source.length<2||hiddenAsMicroStroke)
  return {points:[],totalLengthPx:len,hiddenAsMicroStroke};
 if(character==='precision')return {
  points:source.map((p,i)=>point(p,w,h,i?speed(source[i-1],p,w,h):0)),
  totalLengthPx:len,hiddenAsMicroStroke:false
 };
 const data:PresentationVertex[]=[];
 const smoothSamples=source.length>800?2:4;
 for(let i=0;i<source.length-1;i++){
  const a=source[i],b=source[i+1],prev=source[Math.max(0,i-1)],next=source[Math.min(source.length-1,i+2)];
  const p0=scaled(a,w,h),p1=scaled(b,w,h);
  const before=scaled(prev,w,h),after=scaled(next,w,h);
  const chord=dist(p0,p1);
  if(chord<1e-4)continue;
  const sharpStart=i>0&&angleAt(before,p0,p1)>=Math.PI*75/180;
  const sharpEnd=i<source.length-2&&angleAt(p0,p1,after)>=Math.PI*75/180;
  // Tangents are deliberately soft at ordinary turns and zero at sharp corners.
  const t0=sharpStart?{x:0,y:0}:i===0?
    {x:p1.x-p0.x,y:p1.y-p0.y}:{x:(p1.x-before.x)*.35,y:(p1.y-before.y)*.35};
  const t1=sharpEnd?{x:0,y:0}:i===source.length-2?
    {x:p1.x-p0.x,y:p1.y-p0.y}:{x:(after.x-p0.x)*.35,y:(after.y-p0.y)*.35};
  const n={x:-(p1.y-p0.y)/chord,y:(p1.x-p0.x)/chord};
  const v=speed(a,b,w,h);
  if(i===0)data.push({x:p0.x,y:p0.y,atMs:a.atMs,speedPxPerSec:v});
  for(let step=1;step<=smoothSamples;step++){
   const t=step/smoothSamples,t2=t*t,t3=t2*t;
   const h00=2*t3-3*t2+1,h10=t3-2*t2+t,h01=-2*t3+3*t2,h11=t3-t2;
   const curved={
    x:h00*p0.x+h10*t0.x+h01*p1.x+h11*t1.x,
    y:h00*p0.y+h10*t0.y+h01*p1.y+h11*t1.y
   };
   // The curve's projection must stay between observed endpoints.
   // Sideways displacement ≤8 reference pixels, reduced to ≤3 near hard corners.
   const projection=clamp(((curved.x-p0.x)*(p1.x-p0.x)+
    (curved.y-p0.y)*(p1.y-p0.y))/(chord*chord),0,1);
   const spine={x:p0.x+(p1.x-p0.x)*projection,y:p0.y+(p1.y-p0.y)*projection};
   const cornerGuard=sharpStart||sharpEnd?3:8;
   const deviation=clamp((curved.x-spine.x)*n.x+(curved.y-spine.y)*n.y,
    -cornerGuard*w/1600,cornerGuard*w/1600);
   // Every observed corner remains an exact interpolated endpoint (t=1).
   data.push({x:spine.x+deviation*n.x,y:spine.y+deviation*n.y,
    atMs:a.atMs+(b.atMs-a.atMs)*t,speedPxPerSec:v});
  }
 }
 return {points:data,totalLengthPx:len,hiddenAsMicroStroke:false};
}
export function buildPresentationStroke(
 stroke:V3Stroke,character:StrokeCharacter,w:number,h:number
):PresentationPath{
 const pts=stroke.points;
 if(!pts.length)return {points:[],totalLengthPx:0,hiddenAsMicroStroke:true};
 const first=pts[0],last=pts[pts.length-1];
 const key=stroke.sourceKey+':'+stroke.id+':'+stroke.actorId+':'+stroke.foot;
 const revision=[character,w,h,pts.length,first.atMs,last.atMs,
  first.x,first.y,last.x,last.y].join('|');
 const prior=cache.get(key);
 if(prior?.revision===revision)return prior.result;
 const result=makePath(stroke,character,w,h);
 cache.delete(key);cache.set(key,{revision,result});
 if(cache.size>CACHE_LIMIT)cache.delete(cache.keys().next().value!);
 return result;
}
