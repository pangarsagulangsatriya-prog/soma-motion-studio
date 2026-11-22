import type {FootLineStroke,FootLinePoint} from './FootLineTrailEngine.ts';
import {footMotionCanStamp,type FootMotionEventV2} from '../scenes/FootMotionEventV2.ts';

export type BrushMode='sweep'|'step';
export type FootprintBrushStamp={
 id:string;actorId:string;foot:'left'|'right';x:number;y:number;
 headingRad:number;atMs:number;mode:BrushMode;demo:boolean;
};
const finite=(v:number)=>Number.isFinite(v);
const heading=(a:FootLinePoint,b:FootLinePoint,width:number,height:number)=>
 finite(b.headingRad??NaN)?b.headingRad!:
 finite(a.headingRad??NaN)?a.headingRad!:
 Math.atan2((b.x-a.x)*width,-(b.y-a.y)*height);
/** A sweep stores ONE moving sole-head per observed continuous stroke.
 * The renderer paints the continuous body directly from the matching stroke.
 * No repeated sole stamps are deposited along a moving foot. */
export class FootprintBrushEngine{
 private stamps:FootprintBrushStamp[]=[];
 private contacts=new Set<string>();
 private contactOrder:string[]=[];
 private serial=0;
 private lastDemoStepAt=0;
 private lastDemoPosition:{x:number;y:number}|null=null;
 readonly maxStamps=1200;
 get count(){return this.stamps.length;}
 get sweepCount(){return this.stamps.filter(s=>s.mode==='sweep').length;}
 get allStamps():readonly FootprintBrushStamp[]{return this.stamps;}
 clear(){this.stamps=[];this.contacts.clear();this.contactOrder=[];this.serial=0;this.lastDemoStepAt=0;this.lastDemoPosition=null;}
 disconnect(){this.lastDemoStepAt=0;this.lastDemoPosition=null;}
 private add(mark:FootprintBrushStamp){
  if(![mark.x,mark.y,mark.headingRad,mark.atMs].every(finite)||
   mark.x<0||mark.x>1||mark.y<0||mark.y>1)return;
  this.stamps.push(mark);
  if(this.stamps.length>this.maxStamps)this.stamps.splice(0,this.stamps.length-this.maxStamps);
 }
 ingestSweeps(strokes:readonly FootLineStroke[],_nowMs:number,
  _sizePx=52,_spacing=.58,width=1600,height=900,demo=false){
  for(const stroke of strokes){
   if(stroke.points.length<2)continue;
   const end=stroke.points.at(-1)!,prev=stroke.points.at(-2)!;
   const id='sweep:'+stroke.id+':'+stroke.actorId+':'+stroke.foot;
   const existing=this.stamps.find(s=>s.id===id);
   if(existing&&end.atMs<=existing.atMs)continue;
   const mark:FootprintBrushStamp={id,actorId:stroke.actorId,foot:stroke.foot,
    x:end.x,y:end.y,headingRad:heading(prev,end,width,height),
    atMs:end.atMs,mode:'sweep',demo};
   if(existing)Object.assign(existing,mark);
   else this.add(mark);
  }
 }
 /** Only accepted CONTACT events produce a discrete sole print.
  * Ambiguous identities and image-only motion can never mint a real step. */
 ingestContacts(events:readonly FootMotionEventV2[],actor:'A'|'B'|'all'='all',
  session?:string,nowMs?:number){
  for(const e of events){
   if(!footMotionCanStamp(e)||e.confidence<.45||
    (session!==undefined&&e.sessionId!==session)||
    (actor!=='all'&&e.actorId!==actor)||
    this.contacts.has(e.eventId))continue;
   this.contacts.add(e.eventId);this.contactOrder.push(e.eventId);
   this.add({id:'step-'+(++this.serial),actorId:e.actorId,
    foot:e.foot as 'left'|'right',x:e.x,y:e.y,
    headingRad:finite(e.headingRad??NaN)?Math.PI/2-e.headingRad!:0,
    atMs:nowMs??e.atMs,mode:'step',demo:e.verification==='simulated'});
  }
  while(this.contactOrder.length>2400)this.contacts.delete(this.contactOrder.shift()!);
 }
 /** Clear demo provenance: occasional simulated steps, separate from tracked contacts. */
 demoStepsFromSweeps(nowMs=0){
  if(nowMs-this.lastDemoStepAt<680)return;
  const last=this.stamps.filter(s=>s.mode==='sweep'&&s.demo)
   .sort((a,b)=>b.atMs-a.atMs)[0];
  if(!last)return;
  if(this.lastDemoPosition&&Math.hypot((last.x-this.lastDemoPosition.x)*1600,
   (last.y-this.lastDemoPosition.y)*900)<32)return;
  this.lastDemoStepAt=nowMs;
  this.lastDemoPosition={x:last.x,y:last.y};
  this.add({...last,id:'demo-step-'+(++this.serial),mode:'step',atMs:nowMs,demo:true});
 }
 visible(nowMs:number,decay:'keep'|'fade',lifeMs=8000,mode?:BrushMode):FootprintBrushStamp[]{
  const minTime=nowMs-Math.max(1000,lifeMs);
  return this.stamps.filter(s=>(!mode||s.mode===mode)&&
   (decay==='keep'||s.atMs>=minTime));
 }
}
