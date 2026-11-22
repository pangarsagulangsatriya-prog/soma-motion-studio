import type {FootLineStroke,FootLinePoint} from './FootLineTrailEngine.ts';
import {footMotionCanStamp,type FootMotionEventV2} from '../scenes/FootMotionEventV2.ts';

export type BrushMode='sweep'|'step';
export type FootprintBrushStamp={
 id:string;actorId:string;foot:'left'|'right';x:number;y:number;
 headingRad:number;atMs:number;mode:BrushMode;demo:boolean;
};
type Cursor={index:number;last:FootLinePoint;travelPx:number};
const clamp=(v:number,lo:number,hi:number)=>Math.min(hi,Math.max(lo,v));
const finite=(v:number)=>Number.isFinite(v);
const orientation=(a:FootLinePoint,b:FootLinePoint,width:number,height:number)=>{
 if(finite(b.headingRad??NaN))return b.headingRad!;
 if(finite(a.headingRad??NaN))return a.headingRad!;
 // Sole points upwards in local coordinates. Follow the observed direction of travel.
 return Math.atan2((b.x-a.x)*width,-(b.y-a.y)*height);
};
export class FootprintBrushEngine{
 private stamps:FootprintBrushStamp[]=[];
 private cursors=new Map<string,Cursor>();
 private contacts=new Set<string>();
 private contactOrder:string[]=[];
 private serial=0;
 private lastDemoSweepSerial=0;
 private demoStepCount=0;
 readonly maxStamps=1200;
 get count(){return this.stamps.length;}
 get allStamps():readonly FootprintBrushStamp[]{return this.stamps;}
 clear(){this.stamps=[];this.cursors.clear();this.contacts.clear();this.contactOrder=[];this.serial=0;this.lastDemoSweepSerial=0;this.demoStepCount=0;}
 disconnect(){this.cursors.clear();}
 private add(mark:Omit<FootprintBrushStamp,'id'>){
  if(![mark.x,mark.y,mark.headingRad,mark.atMs].every(finite)||
   mark.x<0||mark.x>1||mark.y<0||mark.y>1)return;
  this.stamps.push({...mark,id:'brush-'+(++this.serial)});
  if(this.stamps.length>this.maxStamps)this.stamps.splice(0,this.stamps.length-this.maxStamps);
 }
 /** Only sample already observed segments. Cadence depends on distance, not video FPS. */
 ingestSweeps(strokes:readonly FootLineStroke[],nowMs:number,
  sizePx=52,spacing=.58,width=1600,height=900,demo=false){
  const stepPx=clamp(sizePx,20,100)*clamp(spacing,.25,1.4);
  const retained=new Set<string>();
  for(const stroke of strokes){
   const key=stroke.id+':'+stroke.actorId+':'+stroke.foot;
   retained.add(key);
   const points=stroke.points;
   if(!points.length)continue;
   let cursor=this.cursors.get(key);
   if(!cursor||cursor.index>=points.length||
    cursor.last.atMs>points[Math.max(0,cursor.index)].atMs){
    cursor={index:0,last:points[0],travelPx:0};
   }
   // The first position isn't itself a stamp until motion produces distance.
   for(let i=cursor.index+1;i<points.length;i++){
    const end=points[i],start=cursor.last;
    const dx=(end.x-start.x)*width,dy=(end.y-start.y)*height;
    const distance=Math.hypot(dx,dy);
    if(distance>=.001&&distance<Math.hypot(width,height)*.23){
     let walked=0;
     cursor.travelPx=Math.min(cursor.travelPx,stepPx);
     while(cursor.travelPx+distance-walked>=stepPx){
      const remainder=Math.max(.001,stepPx-cursor.travelPx);
      walked+=remainder;
      const ratio=clamp(walked/distance,0,1);
      this.add({actorId:stroke.actorId,foot:stroke.foot,
       x:start.x+(end.x-start.x)*ratio,y:start.y+(end.y-start.y)*ratio,
       headingRad:orientation(start,end,width,height),atMs:nowMs,mode:'sweep',demo});
      cursor.travelPx=0;
     }
     cursor.travelPx+=distance-walked;
    }else if(distance>0)cursor.travelPx=0;
    cursor.index=i;
    cursor.last=end;
   }
   this.cursors.set(key,cursor);
  }
  for(const key of this.cursors.keys())if(!retained.has(key))this.cursors.delete(key);
 }
 /** Contact stamps are distinct from movement; no arbitrary pose is a verified step. */
 ingestContacts(events:readonly FootMotionEventV2[],actor:'A'|'B'|'all'='all',
  session?:string,nowMs?:number){
  for(const e of events){
   if(!footMotionCanStamp(e)||e.confidence<.45||
    (session!==undefined&&e.sessionId!==session)||
    (actor!=='all'&&e.actorId!==actor))continue;
   if(this.contacts.has(e.eventId))continue;
   this.contacts.add(e.eventId);this.contactOrder.push(e.eventId);
   this.add({actorId:e.actorId,foot:e.foot as 'left'|'right',
    x:e.x,y:e.y,headingRad:finite(e.headingRad??NaN)?Math.PI/2-e.headingRad!:0,
    atMs:nowMs??e.atMs,mode:'step',demo:e.verification==='simulated'});
  }
  while(this.contactOrder.length>2400)this.contacts.delete(this.contactOrder.shift()!);
 }
 /** Demo: a small subset of synthetic sweep marks illustrates step mode; never LIVE. */
 demoStepsFromSweeps(){
  const unprocessed=this.stamps.filter(s=>s.mode==='sweep'&&s.demo&&
   Number(s.id.slice(6))>this.lastDemoSweepSerial);
  for(const mark of unprocessed){
   this.lastDemoSweepSerial=Math.max(this.lastDemoSweepSerial,Number(mark.id.slice(6)));
   this.demoStepCount++;
   if(this.demoStepCount%6===0)this.add({...mark,mode:'step',demo:true});
  }
 }
 visible(nowMs:number,decay:'keep'|'fade',lifeMs=8000,mode?:BrushMode):FootprintBrushStamp[]{
  return this.stamps.filter(s=>(!mode||s.mode===mode)&&
   (decay==='keep'||nowMs-s.atMs<lifeMs));
 }
}
