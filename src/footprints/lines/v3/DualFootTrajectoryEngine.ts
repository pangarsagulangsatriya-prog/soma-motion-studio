import type {FootV3Sample} from './FootPositionResolver.ts';

export type CutReason =
 'missing-foot'|'low-confidence'|'time-gap'|'distance-jump'|'identity-change'|
 'source-change'|'seek'|'anchor-change'|'stale-frame'|'manual-reset';
export type V3Point={
 x:number;y:number;rawX:number;rawY:number;atMs:number;receivedAtMs:number;
 confidence:number;anchor:FootV3Sample['anchor'];headingRad?:number
};
export type V3Stroke={id:number;actorId:string;foot:'left'|'right';points:V3Point[];
 sourceKey:string;cutReason?:CutReason};
export type V3Decision={id:string;accepted:boolean;reason?:string;raw?:{x:number;y:number};
 display?:{x:number;y:number};atMs:number};
type Last={raw:FootV3Sample;stroke:V3Stroke;lastFrameMs:number;lastDisplay:{x:number;y:number}};
const valid=(x:number)=>Number.isFinite(x)&&x>=0&&x<=1;
const dist=(a:{x:number;y:number},b:{x:number;y:number})=>Math.hypot(a.x-b.x,a.y-b.y);
const footKey=(s:Pick<FootV3Sample,'actorId'|'foot'>)=>s.actorId+':'+s.foot;

/**
 * Source time and performance time never share a clock.
 * Every accepted position belongs to one actor's one foot.
 * Ingest exactly once per *source frame*, not per requestAnimationFrame.
 */
export class DualFootTrajectoryEngine{
 private strokes:V3Stroke[]=[];
 private active=new Map<string,Last>();
 private session='';
 private lastFrameMs=-1;
 private serial=0;
 private notes:V3Decision[]=[];
 private lastCutReason:CutReason|null=null;
 readonly maxPoints=6000;
 readonly maxStrokes=240;
 get allStrokes():readonly V3Stroke[]{return this.strokes;}
 get sampleCount(){return this.strokes.reduce((total,s)=>total+s.points.length,0);}
 get diagnostics():readonly V3Decision[]{return this.notes;}
 get lastCut(){return this.lastCutReason;}
 get activeCount(){return this.active.size;}
 reset(reason:CutReason='manual-reset'){
  this.strokes=[];this.active.clear();this.lastFrameMs=-1;
  this.notes=[];this.serial=0;this.lastCutReason=reason;
 }
 ensureSource(sourceKey:string){
  if(sourceKey!==this.session){this.reset('source-change');this.session=sourceKey;}
 }
 cutAll(reason:CutReason='seek'){
  for(const key of [...this.active.keys()])this.cut(key,reason);
 }
 private cut(key:string,reason:CutReason){
  const item=this.active.get(key);
  if(item){
   item.stroke.cutReason=reason;this.active.delete(key);this.lastCutReason=reason;
   this.note({id:key,accepted:false,reason,atMs:Math.max(0,this.lastFrameMs),
    raw:{x:item.raw.x,y:item.raw.y}});
  }
 }
 private note(x:V3Decision){
  this.notes.push(x);if(this.notes.length>120)this.notes.shift();
 }
 ingestFrame(samples:readonly FootV3Sample[],frameMs:number,receivedAtMs:number):number{
  if(!Number.isFinite(frameMs)||frameMs<0)return 0;
  // A duplicate painted frame never erases the last valid foot.
  if(frameMs===this.lastFrameMs)return 0;
  if(this.lastFrameMs>=0&&frameMs<this.lastFrameMs){
   this.cutAll('seek');
  }
  this.lastFrameMs=frameMs;
  const seen=new Set<string>();
  let added=0;
  for(const sample of samples){
   const key=footKey(sample);
   if(seen.has(key))continue;
   seen.add(key);
   const reason=!valid(sample.x)||!valid(sample.y)||!valid(sample.confidence)?
    'out-of-range':sample.confidence<.55?'low-confidence':null;
   if(reason){
    this.cut(key,'low-confidence');
    this.note({id:key,accepted:false,reason,atMs:frameMs});
    continue;
   }
   const prior=this.active.get(key);
   const delta=prior?frameMs-prior.lastFrameMs:0;
   const candidate={x:sample.x,y:sample.y};
   let cut:CutReason|null=null;
   if(prior&&delta>390)cut='time-gap';
   if(prior&&delta<=0)cut='seek';
   if(prior&&sample.anchor!==prior.raw.anchor)cut='anchor-change';
   if(prior&&dist(candidate,prior.raw)>.23)cut='distance-jump';
   if(cut)this.cut(key,cut);
   const previous=this.active.get(key);
   if(!previous){
    const stroke:V3Stroke={id:++this.serial,actorId:sample.actorId,
     foot:sample.foot,sourceKey:this.session,points:[]};
    const point:V3Point={x:sample.x,y:sample.y,rawX:sample.x,rawY:sample.y,
     atMs:frameMs,receivedAtMs,confidence:sample.confidence,anchor:sample.anchor,
     ...(sample.headingRad===undefined?{}:{headingRad:sample.headingRad})};
    stroke.points.push(point);
    this.strokes.push(stroke);
    this.active.set(key,{raw:sample,stroke,lastFrameMs:frameMs,
     lastDisplay:{x:point.x,y:point.y}});
    this.note({id:key,accepted:true,raw:candidate,display:candidate,atMs:frameMs});
    added++;
    continue;
   }
   // A turning sole can move its midpoint while the ankle stays put.
   // Keep the displayed anchor stationary on a pivot, without fabricating motion.
   const ankleStill=Boolean(sample.ankle&&previous.raw.ankle&&
    dist(sample.ankle,previous.raw.ankle)<.003);
   const headingShift=Number.isFinite(sample.headingRad)&&Number.isFinite(previous.raw.headingRad)?
    Math.abs(Math.atan2(Math.sin(sample.headingRad!-previous.raw.headingRad!),
     Math.cos(sample.headingRad!-previous.raw.headingRad!))):0;
   const rawMoved=dist(candidate,previous.raw);
   const pivot=ankleStill&&headingShift>.18&&rawMoved<.037;
   const display=pivot?previous.lastDisplay:candidate;
   // Adaptive deadband in image-normalized space; smaller than real steps.
   // No interpolation/filters across gaps and no forward prediction.
   const isMove=dist(display,previous.lastDisplay)>.0026;
   if(isMove){
    previous.stroke.points.push({x:display.x,y:display.y,rawX:sample.x,rawY:sample.y,
     atMs:frameMs,receivedAtMs,confidence:sample.confidence,anchor:sample.anchor,
     ...(sample.headingRad===undefined?{}:{headingRad:sample.headingRad})});
    added++;
   }
   previous.raw=sample;
   previous.lastFrameMs=frameMs;
   previous.lastDisplay=display;
   this.note({id:key,accepted:true,raw:candidate,display,atMs:frameMs});
  }
  for(const key of [...this.active.keys()])if(!seen.has(key))this.cut(key,'missing-foot');
  this.trim();
  return added;
 }
 private trim(){
  while(this.strokes.length>this.maxStrokes)this.strokes.shift();
  let excess=this.sampleCount-this.maxPoints;
  while(excess>0&&this.strokes.length){
   const first=this.strokes[0];
   if(first.points.length<=excess){excess-=first.points.length;this.strokes.shift();}
   else{first.points.splice(0,excess);excess=0;}
  }
  const retained=new Set(this.strokes);
  for(const [k,item] of this.active)if(!retained.has(item.stroke))this.active.delete(k);
 }
 visible(presentationMs:number,decay:'keep'|'fade',lifeMs=8000):V3Stroke[]{
  if(decay==='keep')return this.strokes.filter(s=>s.points.length>1);
  const since=presentationMs-lifeMs;
  return this.strokes.map(s=>({...s,points:s.points.filter((p,i)=>p.atMs>=since||
    (i+1<s.points.length&&s.points[i+1].atMs>=since))}))
    .filter(s=>s.points.length>1);
 }
}
