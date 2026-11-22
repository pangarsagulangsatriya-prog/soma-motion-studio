import type {FootV3Sample} from './FootPositionResolver.ts';
import {footMotionCanStamp,type FootMotionEventV2} from '../../scenes/FootMotionEventV2.ts';

export type PainterlySource='camera'|'phone'|'video'|'simulator'|'demo';
export type ImpressionProvenance='detected-estimate'|'video-estimate'|'simulated';
export type PainterlyImpression={
 id:string;actorId:string;foot:'left'|'right';x:number;y:number;
 headingRad?:number;atSourceMs:number;eventKind:'contact-event'|'estimated-step';
 provenance:ImpressionProvenance;confidence:number;materialSeed:number;sourceKey:string
};
export type LiveSole={
 actorId:string;foot:'left'|'right';x:number;y:number;
 headingRad?:number;confidence:number;atSourceMs:number;provenance:ImpressionProvenance
};
type MotionState={
 last:{x:number;y:number;atMs:number}|null;
 traveledPx:number;lastCapAt:number;lastCapPos:{x:number;y:number}|null;
 stableSince:number|null;wasMoving:boolean;headingRad?:number
};
const key=(s:{actorId:string;foot:string})=>s.actorId+':'+s.foot;
const valid=(v:number)=>Number.isFinite(v)&&v>=0&&v<=1;
const clamp=(v:number,a:number,b:number)=>Math.min(b,Math.max(a,v));
const distance=(a:{x:number;y:number},b:{x:number;y:number})=>
 Math.hypot((a.x-b.x)*1600,(a.y-b.y)*900);
function stableHash(s:string){
 let h=2166136261;
 for(let i=0;i<s.length;i++){h=Math.imul(h^s.charCodeAt(i),16777619);}
 return h>>>0;
}
export function lifetimeOpacity(atSourceMs:number,presentationMs:number,lifeMs:number,keep=false){
 if(keep)return 1;
 if(!Number.isFinite(atSourceMs)||!Number.isFinite(presentationMs)||lifeMs<=0)return 0;
 const ratio=clamp((presentationMs-atSourceMs)/lifeMs,0,1);
 if(ratio>=1)return 0;
 if(ratio<=.15)return 1;
 const t=(ratio-.15)/.85;
 return 1-t*t*(3-2*t);
}
/** The current sole is observational; it is never a stamped physical contact.
 * All coordinates come from accepted Track/MP4 observations. */
export class PainterlyImpressionEngine {
 private sourceKey='';
 private marks:PainterlyImpression[]=[];
 private heads=new Map<string,LiveSole>();
 private motion=new Map<string,MotionState>();
 private usedEventIds=new Set<string>();
 private usedEventOrder:string[]=[];
 private frameMs=-1;
 private seq=0;
 readonly maxImpressions=1200;
 get impressions():readonly PainterlyImpression[]{return this.marks;}
 get count(){return this.marks.length;}
 get estimatedCount(){return this.marks.filter(x=>x.eventKind==='estimated-step').length;}
 get headsCount(){return this.heads.size;}
 reset(){
  this.marks=[];this.heads.clear();this.motion.clear();
  this.usedEventIds.clear();this.usedEventOrder=[];this.frameMs=-1;this.seq=0;
 }
 ensureSource(sourceKey:string){
  if(this.sourceKey!==sourceKey){this.reset();this.sourceKey=sourceKey;}
 }
 private stamp(mark:Omit<PainterlyImpression,'materialSeed'>){
  if(!valid(mark.x)||!valid(mark.y)||!Number.isFinite(mark.atSourceMs))return;
  this.marks.push({...mark,materialSeed:stableHash(mark.id)});
  if(this.marks.length>this.maxImpressions)this.marks.splice(0,this.marks.length-this.maxImpressions);
 }
 /** Contact events are only meaningful when source and coordinate space match.
  * Never use a floor-calibrated event as an image-space contact without mapping.
  */
 ingestContacts(events:readonly FootMotionEventV2[],source:PainterlySource,sourceTimeMs:number){
  if(source==='demo')return;
  for(const event of events){
   if(!footMotionCanStamp(event)||!valid(event.x)||!valid(event.y)||
    !event.eventId||this.usedEventIds.has(event.eventId))continue;
   const sameSource=source==='simulator'?event.source==='simulator':
    source===event.source;
   if(!sameSource||event.coordinateBasis!=='image-2d'&&
    !(source==='simulator'&&event.coordinateBasis==='simulated'))continue;
   // Time and session origin must belong to the current source epoch.
   if(Math.abs(sourceTimeMs-event.atMs)>1000)continue;
   const id='event:'+event.eventId;
   this.usedEventIds.add(event.eventId);this.usedEventOrder.push(event.eventId);
   while(this.usedEventOrder.length>2400)
    this.usedEventIds.delete(this.usedEventOrder.shift()!);
   this.stamp({id,sourceKey:this.sourceKey,actorId:event.actorId,
    foot:event.foot as 'left'|'right',x:event.x,y:event.y,
    ...(event.headingRad===undefined?{}:{headingRad:event.headingRad}),
    atSourceMs:event.atMs,eventKind:'contact-event',
    provenance:event.verification as ImpressionProvenance,
    confidence:event.confidence});
  }
 }
 /** Exactly one batch per source frame. The fallback estimates a resting phase
  * after a real excursion and a dwell; it never stamps every rendered frame.
  */
 ingestFrame(samples:readonly FootV3Sample[],sourceFrameMs:number,source:PainterlySource){
  if(!Number.isFinite(sourceFrameMs)||sourceFrameMs<0||sourceFrameMs===this.frameMs)return;
  if(this.frameMs>=0&&sourceFrameMs<this.frameMs){this.reset();}
  this.frameMs=sourceFrameMs;
  const seen=new Set<string>();
  for(const sample of samples){
   const k=key(sample);
   if(seen.has(k))continue;
   seen.add(k);
   if(!valid(sample.x)||!valid(sample.y)||sample.confidence<.55){
    this.heads.delete(k);this.motion.delete(k);continue;
   }
   const provenance:ImpressionProvenance=source==='demo'||source==='simulator'?
    'simulated':source==='video'?'video-estimate':'detected-estimate';
   const prior:MotionState=this.motion.get(k)??{
    last:null,traveledPx:0,lastCapAt:-Infinity,lastCapPos:null,
    stableSince:null,wasMoving:false,headingRad:undefined
   };
   const dt=prior.last?sourceFrameMs-prior.last.atMs:0;
   if(prior.last&&(dt<=0||dt>390||distance(sample,prior.last)>370)){
    this.heads.delete(k);this.motion.delete(k);
    prior.last=null;prior.traveledPx=0;prior.stableSince=null;prior.wasMoving=false;
   }
   const current={x:sample.x,y:sample.y,atMs:sourceFrameMs};
   const delta=prior.last?distance(current,prior.last):0;
   if(Number.isFinite(sample.headingRad))prior.headingRad=sample.headingRad;
   const headingRad=sample.headingRad??prior.headingRad;
   this.heads.set(k,{actorId:sample.actorId,foot:sample.foot,
    x:sample.x,y:sample.y,...(headingRad===undefined?{}:{headingRad}),
    atSourceMs:sourceFrameMs,confidence:sample.confidence,provenance});
   if(prior.last){
    if(delta>3.7){
     prior.wasMoving=true;prior.stableSince=null;
     prior.traveledPx+=Math.min(delta,110);
    }else if(prior.wasMoving){
     if(prior.stableSince===null)prior.stableSince=sourceFrameMs;
     const rested=sourceFrameMs-prior.stableSince>=170;
     const moved=prior.traveledPx>=28;
     const distinct=!prior.lastCapPos||distance(current,prior.lastCapPos)>25;
     const cooldown=sourceFrameMs-prior.lastCapAt>=620;
     if(rested&&moved&&distinct&&cooldown){
      this.stamp({id:'estimated:'+this.sourceKey+':'+k+':'+(++this.seq),
       actorId:sample.actorId,foot:sample.foot,x:sample.x,y:sample.y,
       ...(headingRad===undefined?{}:{headingRad}),sourceKey:this.sourceKey,
       atSourceMs:sourceFrameMs,eventKind:'estimated-step',provenance,
       confidence:sample.confidence});
      prior.lastCapAt=sourceFrameMs;prior.lastCapPos=current;
      prior.traveledPx=0;prior.wasMoving=false;prior.stableSince=null;
     }
    }
    // Demo/simulator can stamp from their own known synthetic movement,
    // while video/camera must pass dwell validation.
    if((source==='demo'||source==='simulator')&&
     prior.traveledPx>=38&&sourceFrameMs-prior.lastCapAt>=660){
     this.stamp({id:'simulated:'+this.sourceKey+':'+k+':'+(++this.seq),
      actorId:sample.actorId,foot:sample.foot,x:sample.x,y:sample.y,
      ...(headingRad===undefined?{}:{headingRad}),sourceKey:this.sourceKey,
      atSourceMs:sourceFrameMs,eventKind:'estimated-step',provenance:'simulated',
      confidence:sample.confidence});
     prior.lastCapAt=sourceFrameMs;prior.lastCapPos=current;
     prior.traveledPx=0;prior.wasMoving=false;prior.stableSince=null;
    }
   }
   prior.last=current;this.motion.set(k,prior);
  }
  // No phantom heads for missing feet.
  for(const k of [...this.heads.keys()])
   if(!seen.has(k)){this.heads.delete(k);this.motion.delete(k);}
 }
 visible(presentationMs:number,lifeMs:number,keep:boolean):readonly PainterlyImpression[]{
  return keep?this.marks:this.marks.filter(m=>lifetimeOpacity(m.atSourceMs,presentationMs,lifeMs)>0);
 }
 liveHeads(presentationMs:number):readonly (LiveSole&{alpha:number})[]{
  return [...this.heads.values()].map(h=>({...h,
   alpha:.35*lifetimeOpacity(h.atSourceMs,presentationMs,380)}))
   .filter(h=>h.alpha>0);
 }
}
