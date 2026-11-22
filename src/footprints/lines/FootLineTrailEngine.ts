import type {FootLineSample} from './FootLineSampleAdapter.ts';

export type FootLineChannel='left'|'right';
export type LineSmoothness='responsive'|'smooth'|'silky';
export type FootLinePoint={x:number;y:number;atMs:number;speed:number;headingRad?:number};
export type FootLineStroke={id:string;actorId:string;foot:FootLineChannel;points:FootLinePoint[]};
type Vector={x:number;y:number};
type Anchor={stroke:FootLineStroke;rawAt:number;rawPoint:Vector;filtered:Vector;velocity:Vector};
const distance=(a:Vector,b:Vector)=>Math.hypot(a.x-b.x,a.y-b.y);
const smoothHeading=(previous:number|undefined,next:number|undefined)=>{
 if(!Number.isFinite(next))return previous;
 if(!Number.isFinite(previous))return next;
 const delta=Math.atan2(Math.sin(next!-previous!),Math.cos(next!-previous!));
 return previous!+delta*.38;
};
const bounded=(v:number)=>Number.isFinite(v)&&v>=0&&v<=1;
const clamp=(v:number,min:number,max:number)=>Math.max(min,Math.min(max,v));
const alpha=(cutoff:number,dt:number)=>1/(1+1/(2*Math.PI*cutoff*Math.max(.001,dt)));
const SMOOTH:Record<LineSmoothness,{cutoff:number;beta:number;velocityCutoff:number;deadband:number}>={
 responsive:{cutoff:3.3,beta:2.1,velocityCutoff:2,deadband:.0027},
 smooth:{cutoff:2.0,beta:1.35,velocityCutoff:1.5,deadband:.0027},
 silky:{cutoff:1.15,beta:.85,velocityCutoff:1.2,deadband:.0032}
};

/** Sample source stays authoritative; smoothing can only move inside observed positions. */
export class FootLineTrailEngine{
 private strokes:FootLineStroke[]=[];
 private anchors=new Map<string,Anchor>();
 private sourceKey='';
 private serial=0;
 private lastMotionAt=0;
 readonly maxPoints=5200;
 readonly maxStrokes=180;
 get allStrokes():readonly FootLineStroke[]{return this.strokes;}
 get lastObservedAt(){return this.lastMotionAt;}
 get sampleCount(){return this.strokes.reduce((total,stroke)=>total+stroke.points.length,0);}
 clear(){this.strokes=[];this.anchors.clear();this.serial=0;this.lastMotionAt=0;}
 disconnect(){this.anchors.clear();}
 /** On source/person switch keep finished trails but never splice identities. */
 ensureSource(key:string){if(this.sourceKey!==key){this.sourceKey=key;this.disconnect();}}
 ingest(samples:readonly FootLineSample[],nowMs:number,smoothness:LineSmoothness='smooth'){
  const seen=new Set<string>();
  const tuning=SMOOTH[smoothness];
  for(const sample of samples){
   if(!bounded(sample.x)||!bounded(sample.y)||!bounded(sample.confidence)||
    sample.confidence<.45||!Number.isFinite(sample.atMs)||sample.atMs<0||
    !['left','right'].includes(sample.foot))continue;
   const key=sample.actorId+':'+sample.foot;
   seen.add(key);
   const prev=this.anchors.get(key);
   // Repeated / older input frames must not add another line segment.
   if(prev&&sample.atMs<=prev.rawAt)continue;
   const next={x:sample.x,y:sample.y};
   const elapsed=prev?sample.atMs-prev.rawAt:0;
   const moved=prev?distance(next,prev.rawPoint):0;
   const cut=!prev||elapsed>390||elapsed<=0||moved>.23;
   if(cut){
    const stroke:FootLineStroke={
     id:'line-'+(++this.serial),actorId:sample.actorId,foot:sample.foot,
     points:[{...next,atMs:nowMs,speed:0,...(Number.isFinite(sample.headingRad)?{headingRad:sample.headingRad}:{})}]
    };
    this.strokes.push(stroke);
    this.anchors.set(key,{stroke,rawAt:sample.atMs,rawPoint:next,
     filtered:next,velocity:{x:0,y:0}});
    continue;
   }
   const dt=clamp(elapsed/1000,.001,.39);
   // A One Euro filter per tracked foot: rapid movement increases responsiveness.
   // The raw input remains responsible for jump/loss detection.
   const derivative={x:(next.x-prev.rawPoint.x)/dt,y:(next.y-prev.rawPoint.y)/dt};
   const va=alpha(tuning.velocityCutoff,dt);
   const velocity={
    x:prev.velocity.x+(derivative.x-prev.velocity.x)*va,
    y:prev.velocity.y+(derivative.y-prev.velocity.y)*va
   };
   const fc=tuning.cutoff+tuning.beta*Math.hypot(velocity.x,velocity.y);
   const a=alpha(fc,dt);
   const filtered={
    x:prev.filtered.x+(next.x-prev.filtered.x)*a,
    y:prev.filtered.y+(next.y-prev.filtered.y)*a
   };
   if(moved>=tuning.deadband){
    const last=prev.stroke.points.at(-1)!;
    if(distance(filtered,last)>.0032){
     const speed=clamp(Math.hypot(velocity.x,velocity.y)/2.5,0,1);
     const angle=smoothHeading(last.headingRad,sample.headingRad);
     prev.stroke.points.push({...filtered,atMs:nowMs,speed,
      ...(Number.isFinite(angle)?{headingRad:angle}:{})});
     this.lastMotionAt=nowMs;
    }
   }
   this.anchors.set(key,{stroke:prev.stroke,rawAt:sample.atMs,rawPoint:next,
    filtered,velocity});
  }
  // A missing foot only disconnects its own stroke.
  for(const key of this.anchors.keys())if(!seen.has(key))this.anchors.delete(key);
  this.compact();
 }
 private compact(){
  while(this.strokes.length>this.maxStrokes)this.strokes.shift();
  let excess=this.sampleCount-this.maxPoints;
  while(excess>0&&this.strokes.length>0){
   const first=this.strokes[0];
   if(first.points.length<=excess||first.points.length===1){
    excess-=first.points.length;this.strokes.shift();continue;
   }
   first.points.splice(0,excess);
   excess=0;
  }
  const retained=new Set(this.strokes);
  for(const [key,anchor] of this.anchors)if(!retained.has(anchor.stroke))this.anchors.delete(key);
 }
 visible(nowMs:number,mode:'keep'|'fade',lifeMs=8000):FootLineStroke[]{
  if(mode==='keep')return this.strokes.filter(s=>s.points.length>1);
  const since=nowMs-Math.max(1000,lifeMs);
  return this.strokes.map(stroke=>({
   ...stroke,
   points:stroke.points.filter((p,i)=>p.atMs>=since||
    (i+1<stroke.points.length&&stroke.points[i+1].atMs>=since))
  })).filter(stroke=>stroke.points.length>1);
 }
 /** Display only: interpolate between already OBSERVED endpoints, never predict the foot. */
 renderVisible(nowMs:number,mode:'keep'|'fade',lifeMs=8000,lagMs=55):FootLineStroke[]{
  const limit=nowMs-clamp(lagMs,0,90);
  return this.visible(nowMs,mode,lifeMs).map(stroke=>{
   const points=stroke.points;
   if(points.at(-1)!.atMs<=limit)return stroke;
   const firstAfter=points.findIndex(p=>p.atMs>limit);
   if(firstAfter<=0)return {...stroke,points:[]};
   const prev=points[firstAfter-1],next=points[firstAfter];
   const t=clamp((limit-prev.atMs)/Math.max(1,next.atMs-prev.atMs),0,1);
   // Display interpolation also preserves the observed heel-to-toe direction.
   const direction=Number.isFinite(prev.headingRad)&&Number.isFinite(next.headingRad)?
    prev.headingRad!+Math.atan2(Math.sin(next.headingRad!-prev.headingRad!),
     Math.cos(next.headingRad!-prev.headingRad!))*t:
    (next.headingRad??prev.headingRad);
   const eased={x:prev.x+(next.x-prev.x)*t,y:prev.y+(next.y-prev.y)*t,
    atMs:limit,speed:prev.speed+(next.speed-prev.speed)*t,
    ...(Number.isFinite(direction)?{headingRad:direction}:{})};
   return {...stroke,points:[...points.slice(0,firstAfter),eased]};
  }).filter(stroke=>stroke.points.length>1);
 }
}
