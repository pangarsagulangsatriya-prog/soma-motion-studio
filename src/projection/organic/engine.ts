import type {MotionFrame} from '../../engine/types.ts';
import type {BodyMask} from '../../studio/bodyField.ts';
import type {ProjectionImage,ProjectionState} from '../model.ts';
import {organicDefaults,validateOrganic,type OrganicConfig} from './config.ts';
import {TemporalHistory,copyFrame,reduceMask,type OrganicFrame} from './history.ts';
import {flatLayer,shapeLayer,sliceRect,intersectCrop,landmarkAnchor,type OrganicLayer} from './shape.ts';
import {CPUCompositor,type BodyCompositor} from './compositor.ts';
type Stamp={mask:BodyMask;time:number};
export type OrganicStatus={backend:string;historyFrames:number;historyBytes:number;historyMs:number;residueCount:number;frozen:boolean;partner:boolean;waiting:boolean;actualDelayMs:number;renderMs:number;layers:number};
export type OrganicSurface={texture:BodyMask;alphaMask:BodyMask;renderTimestamp:number;geometry:{mode:OrganicConfig['mode'];anchor:{x:number;y:number};factor:number;separation:number;sourceTimestamp:number}};
export const emptyOrganicStatus=():OrganicStatus=>({backend:'Belum aktif',historyFrames:0,historyBytes:0,historyMs:0,residueCount:0,frozen:false,partner:false,waiting:false,actualDelayMs:0,renderMs:0,layers:0});
/** Shapes and history share one camera clock. Finished masks pass through Sprint 2 calibration. */
export class OrganicBodyEngine{
 readonly history=new TemporalHistory();config=organicDefaults();private current:OrganicFrame|null=null;private reference:OrganicFrame|null=null;private frozen:ProjectionImage|null=null;private hold:ProjectionImage|null=null;private stamps:Stamp[]=[];private lastStamp=-Infinity;private lastState:ProjectionState|null=null;private lastResult:ProjectionImage|null=null;private transition:Stamp|null=null;private lastTime=0;private factor=1;private separation=0;private transport='blackout';private lastLayers=0;private waiting=false;private actualDelay=0;
 readonly compositor:BodyCompositor;
 constructor(compositor:BodyCompositor=new CPUCompositor()){this.compositor=compositor;}
 configure(value:OrganicConfig,now:number,transition=false){const c=validateOrganic(value);if(transition||c.enabled!==this.config.enabled||c.mode!==this.config.mode){const previous=this.capture();this.transition=previous&&c.enabled&&c.transitionMs>0?{mask:previous.mask,time:now}:null;this.factor=1;}if(this.config.residue&&!c.residue)this.clearResidue();this.config=c;}
 ingest(image:ProjectionImage|null,frame:MotionFrame){
  if(!image||image.time!==frame.time||!frame.tracked||this.current?.time===image.time)return;
  const next:OrganicFrame={...image,pose:frame.pose.slice(0,33).map(p=>({...p})),velocity:{x:0,y:0},drive:Math.max(0,Math.min(1,Math.max(frame.features.armRaise||0,frame.features.speed||0)))};
  if(this.current&&image.time>this.current.time&&image.time-this.current.time<450){const before=landmarkAnchor(this.current,this.config.anchor),after=landmarkAnchor(next,this.config.anchor),dt=(image.time-this.current.time)/1000;next.velocity={x:Math.max(-4,Math.min(4,(after.x-before.x)/dt)),y:Math.max(-4,Math.min(4,(after.y-before.y)/dt))};}
  this.current=next;this.history.push(next);
 }
 private capture():ProjectionImage|null{
  if(!this.lastResult||!this.lastState)return null;
  if(this.lastResult.processed)return {...this.lastResult,mask:{...this.lastResult.mask,data:this.lastResult.mask.data.slice()}};
  if(!this.current)return null;const neutral={...this.config,mode:'normal' as const};return {...this.current,mask:this.compositor.render([shapeLayer(this.current,neutral,this.lastState.config,1)]),processed:true,rawBounds:undefined,bounds:undefined};
 }
 freeze(){this.frozen=this.capture();if(this.current)this.reference=copyFrame(this.current);return !!this.frozen;}
 release(){this.frozen=null;this.transition=null;}
 capturePartner(){this.reference=this.current?copyFrame(this.current):null;return !!this.reference;}
 clearResidue(){this.stamps=[];this.lastStamp=-Infinity;}
 reset(){this.history.clear();this.current=null;this.reference=null;this.frozen=null;this.hold=null;this.clearResidue();this.transition=null;this.lastResult=null;this.lastState=null;this.lastTime=0;this.factor=1;this.separation=0;this.config=organicDefaults();}
 private at(now:number,delay:number){return delay<=0?this.current:this.history.sample(now-delay);}
 private layers(state:ProjectionState,now:number):OrganicLayer[]{
  const c=this.config,layers:OrganicLayer[]=[],count=c.echo?c.echoCount:1;
  const liveOpacity=state.blank?0:state.opacity;
  this.waiting=false;this.actualDelay=0;
  for(let echo=0;echo<count;echo++){
   const delay=c.delayMs+echo*c.echoSpacingMs,frame=c.mode==='merge'&&echo===0?this.current:this.at(now,delay);if(!frame){if(echo===0)this.waiting=true;continue;}
   if(echo===0)this.actualDelay=Math.max(0,now-frame.time);
   const opacity=Math.pow(1-c.echoFade,echo)*liveOpacity;
   if(c.mode==='split'){
    const slices=c.splitMode==='anatomical'?3:c.slices;
    for(let i=0;i<slices;i++){const f=this.at(now,delay+i*c.sliceDelayMs);if(!f)continue;const l=shapeLayer(f,c,state.config,1,opacity),rect=sliceRect(f,c.splitMode,i,slices);l.crop=intersectCrop(l.crop,rect);const amount=(i-(slices-1)/2)*this.separation;l.offset[c.offsetAxis==='horizontal'?'x':'y']=amount;layers.push(l);}
   }else layers.push(shapeLayer(frame,c,state.config,this.factor,opacity));
  }
  if(c.mode==='merge'&&this.current){const other=c.mergeSource==='frozen'?this.reference:this.at(now,c.delayMs),main=layers[0];if(other){const l=shapeLayer(other,{...c,mode:'normal'},state.config,1,c.mergeBlend*liveOpacity),a=this.current.bounds,b=other.bounds;if(a&&b&&state.config.motion==='follow')l.offset={x:(a.cx-b.cx)*c.mergePull,y:(a.cy-b.cy)*c.mergePull};if(c.mergeMethod==='interpolate'&&main)main.opacity*=1-c.mergeBlend;layers.push(l);}}
  return layers;
 }
 process(state:ProjectionState,now:number):ProjectionState{
  this.lastState=state;
  if(state.transport==='hold'&&this.transport!=='hold')this.hold=this.capture();if(state.transport!=='hold')this.hold=null;this.transport=state.transport;
  // Inactive Organic preserves the original Sprint 2 rendering path exactly.
  if(!this.config.enabled&&!this.frozen){this.lastResult=state.image;return state;}
  if(state.pattern||state.transport==='blackout')return state;
  const fixed=state.transport==='hold'?this.hold:this.frozen;
  if(fixed){this.lastResult=fixed;return {...state,image:fixed,blank:false,opacity:1};}
  const c=this.config,dt=this.lastTime?Math.min(150,Math.max(0,now-this.lastTime)):33;this.lastTime=now;
  const target=c.mode==='stretch'?1+(c.intensity-1)*(c.control==='motion'?(this.current?.drive??0):1):c.mode==='shrink'?1-(1-c.shrink)*(c.control==='motion'?(this.current?.drive??0):1):1;
  this.factor+=(target-this.factor)*(1-Math.exp(-dt/c.recoveryMs));this.separation+=((c.mode==='split'?c.separation:0)-this.separation)*(1-Math.exp(-dt/c.rejoinMs));
  const layers=this.layers(state,now);this.lastLayers=layers.length;let body=this.compositor.render(layers,undefined,c.mode==='merge'&&c.mergeMethod==='interpolate');
  if(this.transition){const t=Math.max(0,Math.min(1,(now-this.transition.time)/Math.max(1,c.transitionMs)));if(t<1)body=this.compositor.render([flatLayer(this.transition.mask,1-t),flatLayer(body,t)],undefined,true);else this.transition=null;}
  this.stamps=this.stamps.filter(s=>now-s.time<c.residueMs);
  if(c.residue&&state.tracking&&!state.blank&&now-this.lastStamp>=Math.max(200,c.residueMs/24)){this.stamps.push({mask:reduceMask(body),time:now});if(this.stamps.length>24)this.stamps.shift();this.lastStamp=now;}
  if(c.residue&&this.stamps.length){const trails=this.stamps.map(s=>flatLayer(s.mask,c.residueFade?Math.max(0,1-(now-s.time)/c.residueMs):1));let clip:BodyMask|undefined;if(c.residueSpace==='body'){clip=this.current&&state.tracking?this.compositor.render([shapeLayer(this.current,{...c,mode:'normal'},state.config,1)]):{width:1,height:1,data:new Uint8Array([0])};}const residue=this.compositor.render(trails,clip);body=this.compositor.render([flatLayer(residue),flatLayer(body)]);this.lastLayers+=trails.length;}
  const image:ProjectionImage={mask:body,aspect:this.current?.aspect??state.image?.aspect??4/3,time:now,processed:true};this.lastResult=image;
  return {...state,image,blank:this.waiting&&!this.stamps.length||(!state.tracking&&state.config.recovery==='blackout'&&!this.stamps.length),opacity:1};
 }
 status(renderMs=0):OrganicStatus{return {backend:this.compositor.mode,historyFrames:this.history.length,historyBytes:this.history.bytes,historyMs:this.history.spanMs,residueCount:this.stamps.length,frozen:!!this.frozen,partner:!!this.reference,waiting:this.waiting,actualDelayMs:this.actualDelay,renderMs,layers:this.lastLayers};}
 get surface():OrganicSurface|null{const image=this.lastResult;if(!image)return null;return {texture:image.mask,alphaMask:image.mask,renderTimestamp:image.time,geometry:{mode:this.config.mode,anchor:this.current?landmarkAnchor(this.current,this.config.anchor):{x:.5,y:.5},factor:this.factor,separation:this.separation,sourceTimestamp:this.current?.time??0}};}
 dispose(){this.reset();this.compositor.dispose();}
}
