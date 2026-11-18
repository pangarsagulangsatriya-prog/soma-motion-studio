import {floorEventCanStamp,type FloorInteractionEvent} from './FloorInteractionEngine.ts';

/** F1 — deterministic, replayable snow surface. The only mark-producing
 * inputs are independently verified FloorInteraction contact or touch events.
 * Movement and stationary presence may stir a scene later; never stamp snow. */
export const SNOW_GRID={width:320,height:180} as const;
export type SnowMark={id:string;source:string;actorId:string;foot:'left'|'right';
 x:number;y:number;atMs:number;angleRad:number};
export type SnowfallOptions={recoverySeconds:number;snowfall:number;paused:boolean};
const clamp=(v:number,a:number,b:number)=>Math.max(a,Math.min(b,v));
const BASE=0.95;
/** Parameters intentionally bounded for stable visual output. */
export function snowfallOptions(o:Partial<SnowfallOptions>={}):SnowfallOptions{
 return {recoverySeconds:clamp(Number.isFinite(o.recoverySeconds)?o.recoverySeconds!:75,12,240),
  snowfall:clamp(Number.isFinite(o.snowfall)?o.snowfall!:0.55,0,1),
  paused:!!o.paused};
}
export class SnowfallScene{
 readonly width=SNOW_GRID.width;
 readonly height=SNOW_GRID.height;
 readonly density=new Float32Array(SNOW_GRID.width*SNOW_GRID.height);
 readonly pixels=new Uint8Array(SNOW_GRID.width*SNOW_GRID.height);
 readonly marks:SnowMark[]=[];
 private lastXY=new Map<string,{x:number;y:number}>();
 private lastAngle=new Map<string,number>();
 private seen=new Set<string>();
 private generation=-1;
 private lastStepMs:number|null=null;
 private presentationMs=0;
 get visualTimeMs(){return this.presentationMs;}
 private counted=0;
 private stopped=false;
 constructor(){this.reset();}
 get count(){return this.counted;}
 get busGeneration(){return this.generation;}
 get paused(){return this.stopped;}
 reset(generation=-1){
  this.density.fill(BASE);this.pixels.fill(Math.round(BASE*255));
  this.marks.splice(0);this.lastXY.clear();this.lastAngle.clear();this.seen.clear();
  this.generation=generation;this.lastStepMs=null;this.presentationMs=0;
  this.counted=0;this.stopped=false;
 }
 setPaused(pause:boolean){this.stopped=pause;this.lastStepMs=null;}
 /** Snapshot may be a rolling 480-event buffer; de-duplicate by source
  * bus event identity rather than array index. Generation prevents collisions
  * after the source adapter clears its serial counter. */
 consume(events:readonly FloorInteractionEvent[],generation:number,enabled=true){
  if(generation!==this.generation)this.reset(generation);
  for(const event of events){
   const id=generation+':'+event.id;
   if(this.seen.has(id))continue;
   this.seen.add(id);
   if(this.seen.size>4096){
    // Bus retains <=480 events. Only current bounded buffer needs keys.
    const inBuffer=new Set(events.map(e=>generation+':'+e.id));
    this.seen=new Set([...this.seen].filter(k=>inBuffer.has(k)));
   }
   if(!enabled||this.stopped)continue;
   if(event.kind==='movement'){
    const old=this.lastXY.get(event.actorId);
    if(old&&Math.hypot(event.x-old.x,event.y-old.y)>.002)
     this.lastAngle.set(event.actorId,Math.atan2(event.y-old.y,event.x-old.x)+Math.PI/2);
    this.lastXY.set(event.actorId,{x:event.x,y:event.y});
   }else if(event.kind==='presence'){
    if(!this.lastXY.has(event.actorId))
     this.lastXY.set(event.actorId,{x:event.x,y:event.y});
   }else if(floorEventCanStamp(event))this.stamp(event);
  }
 }
 private stamp(e:FloorInteractionEvent){
  if(!Number.isFinite(e.x)||!Number.isFinite(e.y)||e.x<0||e.x>1||e.y<0||e.y>1||
   !e.foot)return;
  const angle=this.lastAngle.get(e.actorId)??0;
  const mark:SnowMark={id:e.id,source:e.source,actorId:e.actorId,
   foot:e.foot,x:e.x,y:e.y,atMs:e.atMs,angleRad:angle};
  this.marks.push(mark);this.counted++;
  if(this.marks.length>200)this.marks.splice(0,this.marks.length-200);
  const w=this.width,h=this.height;
  // Foot is ~4.8% screen width by ~10% screen height, with asymmetrical toes.
  const sx=.019,sy=.045;
  const marginX=.069,marginY=.128;
  const cx=Math.round(e.x*w),cy=Math.round(e.y*h);
  const xmin=clamp(Math.floor(cx-marginX*w),0,w-1),xmax=clamp(Math.ceil(cx+marginX*w),0,w-1);
  const ymin=clamp(Math.floor(cy-marginY*h),0,h-1),ymax=clamp(Math.ceil(cy+marginY*h),0,h-1);
  const ca=Math.cos(angle),sa=Math.sin(angle);
  const flip=e.foot==='left'?-1:1;
  for(let iy=ymin;iy<=ymax;iy++){
   for(let ix=xmin;ix<=xmax;ix++){
    const dx=(ix+.5)/w-e.x,dy=(iy+.5)/h-e.y;
    const u=ca*dx+sa*dy,v=-sa*dx+ca*dy;
    // Heel, midfoot, ball and five toe impressions. Distinct lobes survive
    // in snow rather than drawing a generic circle per contact.
    const ellipse=(a:number,b:number,rx:number,ry:number)=>{
     const d=((u-a)/rx)**2+((v-b)/ry)**2;
     return clamp((1.14-d)*4,0,1);
    };
    const heel=ellipse(0,.014,sx*.69,sy*.56);
    const arch=ellipse(-flip*sx*.18,0,sx*.53,sy*.53);
    const ball=ellipse(flip*sx*.09,-sy*.49,sx*.98,sy*.52);
    let toes=0;
    for(let k=0;k<5;k++){
     const t=k/4;
     toes=Math.max(toes,ellipse((t-.5)*sx*1.52,
      -sy*(1.09-.14*Math.abs(t-.34)),sx*.20,sy*(.18-.027*k)));
    }
    const weight=Math.max(heel,arch*.82,ball,toes*.93);
    if(weight<=0)continue;
    const index=iy*w+ix;
    this.density[index]=Math.min(this.density[index],BASE-.88*weight);
    this.pixels[index]=Math.round(this.density[index]*255);
   }
  }
 }
 /** Snow keeps accumulating over time. A planted foot emits no new stamp. */
 step(nowMs:number,options:Partial<SnowfallOptions>={}){
  if(!Number.isFinite(nowMs)||nowMs<0)return false;
  if(this.stopped||options.paused){this.lastStepMs=nowMs;return false;}
  if(this.lastStepMs===null){this.lastStepMs=nowMs;return true;}
  const dt=clamp((nowMs-this.lastStepMs)/1000,0,.5);
  this.lastStepMs=nowMs;
  if(dt<=0)return false;
  this.presentationMs+=dt*1000;
  const o=snowfallOptions(options);
  // As snowfall increases, holes fill faster; recoverySeconds is
  // the approximate time constant, not a hard cut-off.
  const k=1-Math.exp(-dt/o.recoverySeconds*(.4+1.2*o.snowfall));
  for(let i=0;i<this.density.length;i++){
   const value=this.density[i];
   if(value>=BASE-.001)continue;
   const next=Math.min(BASE,value+(BASE-value)*k);
   this.density[i]=next;this.pixels[i]=Math.round(next*255);
  }
  return true;
 }
 /** Deterministic test-only observable footprint depression. */
 sample(x:number,y:number){
  const ix=clamp(Math.floor(x*this.width),0,this.width-1);
  const iy=clamp(Math.floor(y*this.height),0,this.height-1);
  return this.density[iy*this.width+ix];
 }
}
