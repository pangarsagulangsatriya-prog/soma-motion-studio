import type {FootLineSample} from './FootLineSampleAdapter.ts';

export type FootLineChannel='left'|'right';
export type FootLinePoint={x:number;y:number;atMs:number;speed:number};
export type FootLineStroke={id:string;actorId:string;foot:FootLineChannel;points:FootLinePoint[]};
const distance=(a:{x:number;y:number},b:{x:number;y:number})=>Math.hypot(a.x-b.x,a.y-b.y);
const bounded=(v:number)=>Number.isFinite(v)&&v>=0&&v<=1;
type Anchor={stroke:FootLineStroke;rawAt:number;rawPoint:{x:number;y:number}};
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
 /** Disconnect tracks on session/source switch. Existing drawing remains visible. */
 ensureSource(key:string){if(this.sourceKey!==key){this.sourceKey=key;this.disconnect();}}
 ingest(samples:readonly FootLineSample[],nowMs:number){
  const seen=new Set<string>();
  for(const sample of samples){
   if(!bounded(sample.x)||!bounded(sample.y)||!bounded(sample.confidence)||
    sample.confidence<.45||!Number.isFinite(sample.atMs)||sample.atMs<0||
    !['left','right'].includes(sample.foot))continue;
   const key=sample.actorId+':'+sample.foot;
   seen.add(key);
   const prev=this.anchors.get(key);
   // Identical or older camera frames must not create duplicate points.
   if(prev&&sample.atMs<=prev.rawAt)continue;
   const next={x:sample.x,y:sample.y};
   const dt=prev?sample.atMs-prev.rawAt:0;
   const moved=prev?distance(next,prev.rawPoint):0;
   // A large sudden jump is more likely loss/re-entry or an identity swap.
   const cut=!prev||dt>390||dt<=0||moved>.23;
   if(cut){
    const stroke:FootLineStroke={
     id:'line-'+(++this.serial),actorId:sample.actorId,foot:sample.foot,
     points:[{...next,atMs:nowMs,speed:0}]
    };
    this.strokes.push(stroke);
    this.anchors.set(key,{stroke,rawAt:sample.atMs,rawPoint:next});
   }else{
    // Record movement only above a small threshold; deadband avoids scribbling at rest.
    const last=prev.stroke.points.at(-1)!;
    if(moved<.0027){
     this.anchors.set(key,{stroke:prev.stroke,rawAt:sample.atMs,rawPoint:next});
     continue;
    }
    const filtered={x:last.x+(sample.x-last.x)*.72,y:last.y+(sample.y-last.y)*.72};
    const traveled=distance(filtered,last);
    if(traveled>.0036){
     const speed=Math.min(1,moved/Math.max(1,dt)*1150);
     prev.stroke.points.push({...filtered,atMs:nowMs,speed});
     this.lastMotionAt=nowMs;
    }
    this.anchors.set(key,{stroke:prev.stroke,rawAt:sample.atMs,rawPoint:next});
   }
  }
  // Drop anchors for invisible feet; never bridge a gap with a teleporting line.
  for(const key of this.anchors.keys())if(!seen.has(key))this.anchors.delete(key);
  this.compact();
 }
 /** Memory bounds for a long rehearsal. */
 private compact(){
  while(this.strokes.length>this.maxStrokes)this.strokes.shift();
  let excess=this.sampleCount-this.maxPoints;
  while(excess>0&&this.strokes.length>0){
   const first=this.strokes[0];
   if(first.points.length<=excess||first.points.length===1){
    excess-=first.points.length;
    this.strokes.shift();
    continue;
   }
   first.points.splice(0,excess);
   excess=0;
  }
  const retained=new Set(this.strokes);
  for(const [key,anchor] of this.anchors){
   if(!retained.has(anchor.stroke))this.anchors.delete(key);
  }
 }
 /** Display-only filtering; changes in colors never mutate path geometry. */
 visible(nowMs:number,mode:'keep'|'fade',lifeMs=8000):FootLineStroke[]{
  if(mode==='keep')return this.strokes.filter(s=>s.points.length>1);
  const since=nowMs-Math.max(1000,lifeMs);
  return this.strokes.map(stroke=>({
   ...stroke,
   points:stroke.points.filter((p,i)=>p.atMs>=since||
    (i+1<stroke.points.length&&stroke.points[i+1].atMs>=since))
  })).filter(stroke=>stroke.points.length>1);
 }
}
