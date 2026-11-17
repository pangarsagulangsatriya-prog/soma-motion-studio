import type {Landmark} from '../engine/types.ts';
import type {VideoActorAssignment,VideoActorId,VideoActorState} from './videoAutoActorTracker.ts';
import type {TemporalFrame,TemporalActorSample,TemporalJoint} from './temporalJointIntelligence.ts';

/** Operator diagnostic: image-relative quantities, not calibrated motion capture. */
export type LimbName='left-arm'|'right-arm'|'left-leg'|'right-leg';
export type HandSide='left'|'right';
export type LimbPresence='visible'|'partial'|'missing';
export type HandPresence='visible'|'recent'|'missing'|'ambiguous'|'unavailable';
export type FingerName='thumb'|'index'|'middle'|'ring'|'pinky';
export type FingerDetail={name:FingerName;bendDeg:number|null;tipX:number|null;tipY:number|null};
export type LimbDetail={
 name:LimbName;presence:LimbPresence;visibleJoints:number;requiredJoints:number;
 angleDeg:number|null;tipSpeed:number|null;
 tipVelocityX:number|null;tipVelocityY:number|null;
};
export type HandDetail={
 side:HandSide;presence:HandPresence;observedAtMs:number|null;
 /** 21 observed MediaPipe hand landmarks; never extrapolated. */
 landmarks:Landmark[];fingers:FingerDetail[];pinchRatio:number|null;
 wristX:number|null;wristY:number|null;wristSpeed:number|null;
};
export type LimbRelation={
 side:HandSide;handToHip2D:number|null;armLegAlignment:number|null;
};
export type ActorLimbDetail={
 id:VideoActorId;presence:string;limbs:LimbDetail[];hands:HandDetail[];
 relations:LimbRelation[];
};
export type HandLimbFrame={
 atMs:number;handScanned:boolean;handModelAvailable:boolean;
 rawHandsDetected:number;matchedHands:number;actors:ActorLimbDetail[];
};
export type RawHandDetection={rawIndex:number;landmarks:Landmark[]};
export type HandSlot={actor:VideoActorId;side:HandSide;wristX:number;wristY:number};
export type HandMatch={actor:VideoActorId;side:HandSide;rawIndex:number;landmarks:Landmark[]};
export type HandMatchResult={matches:HandMatch[];ambiguous:HandSlot[];unassigned:number[]};
export const HAND_LIMB_MAX_FRAMES=360;
export const HAND_SCAN_INTERVAL_MS=130;
export const HAND_RECENT_MS=220;
const GATE=.16;
const AMBIGUITY=.042;
const FINGERS=[
 {name:'thumb' as const,mcp:2,pip:3,dip:4,tip:4},
 {name:'index' as const,mcp:5,pip:6,dip:7,tip:8},
 {name:'middle' as const,mcp:9,pip:10,dip:11,tip:12},
 {name:'ring' as const,mcp:13,pip:14,dip:15,tip:16},
 {name:'pinky' as const,mcp:17,pip:18,dip:19,tip:20}
];
const LIMBS=[
 {name:'left-arm' as const,indices:[11,13,15],vertex:13,tip:15},
 {name:'right-arm' as const,indices:[12,14,16],vertex:14,tip:16},
 {name:'left-leg' as const,indices:[23,25,27,29,31],vertex:25,tip:27},
 {name:'right-leg' as const,indices:[24,26,28,30,32],vertex:26,tip:28}
];
const length=(x:number,y:number)=>Math.hypot(x,y);
const dist=(a:{x:number;y:number},b:{x:number;y:number})=>length(a.x-b.x,a.y-b.y);
const valid=(p:Landmark|undefined,requireVisibility=true):p is Landmark=>
 !!p&&Number.isFinite(p.x)&&Number.isFinite(p.y)&&Number.isFinite(p.z)&&
 p.x>=0&&p.x<=1&&p.y>=0&&p.y<=1&&
 (!requireVisibility||p.visibility===undefined||Number.isFinite(p.visibility)&&p.visibility>=.5);
const finite=(n:number|null|undefined)=>n!==null&&n!==undefined&&Number.isFinite(n);
export function handAngle2D(a:Landmark|undefined,b:Landmark|undefined,c:Landmark|undefined):number|null{
 if(!valid(a,false)||!valid(b,false)||!valid(c,false))return null;
 const ux=a.x-b.x,uy=a.y-b.y,vx=c.x-b.x,vy=c.y-b.y;
 const lu=length(ux,uy),lv=length(vx,vy);
 if(lu<.00001||lv<.00001)return null;
 return Math.acos(Math.max(-1,Math.min(1,(ux*vx+uy*vy)/(lu*lv))))*180/Math.PI;
}
export function findActorHandSlots(assignments:readonly VideoActorAssignment[]):HandSlot[]{
 const slots:HandSlot[]=[];
 for(const actor of assignments){
  for(const [side,index] of [['left',15],['right',16]] as const){
   const p=actor.pose[index];
   if(valid(p))slots.push({actor:actor.id,side,wristX:p.x,wristY:p.y});
  }
 }
 return slots;
}
/** Global matching. Reject ambiguous overlaps rather than attaching a hand to the wrong actor.
 * Raw MediaPipe hand list ordering and its selfie-handedness labels are never trusted.
 */
export function matchHandsToActors(
 hands:readonly RawHandDetection[],slots:readonly HandSlot[]):HandMatchResult{
 const proposed:Array<{hand:RawHandDetection;slot:HandSlot;d:number}>=[];
 const ambiguous:HandSlot[]=[];
 const unassigned:number[]=[];
 for(const hand of hands.slice(0,4)){
  if(hand.landmarks.length<21||!valid(hand.landmarks[0],false)){
   unassigned.push(hand.rawIndex);continue;
  }
  const p=hand.landmarks[0];
  const candidates=slots.map(slot=>({slot,d:dist(p,{x:slot.wristX,y:slot.wristY})}))
   .filter(c=>c.d<=GATE).sort((a,b)=>a.d-b.d);
  if(!candidates.length){unassigned.push(hand.rawIndex);continue;}
  if(candidates.length>1&&candidates[1].d-candidates[0].d<AMBIGUITY){
   for(const c of candidates.filter(c=>c.d-candidates[0].d<AMBIGUITY)){
    if(!ambiguous.includes(c.slot))ambiguous.push(c.slot);
   }
   unassigned.push(hand.rawIndex);continue;
  }
  proposed.push({hand,slot:candidates[0].slot,d:candidates[0].d});
 }
 const matched:HandMatch[]=[];
 const used=new Set<number>();
 for(const slot of slots){
  if(ambiguous.includes(slot))continue;
  const candidates=proposed.filter(p=>p.slot===slot).sort((a,b)=>a.d-b.d);
  if(!candidates.length)continue;
  if(candidates.length>1&&candidates[1].d-candidates[0].d<AMBIGUITY){
   ambiguous.push(slot);
   for(const item of candidates)unassigned.push(item.hand.rawIndex);
   continue;
  }
  const chosen=candidates[0];
  if(used.has(chosen.hand.rawIndex))continue;
  used.add(chosen.hand.rawIndex);
  matched.push({actor:slot.actor,side:slot.side,rawIndex:chosen.hand.rawIndex,
   landmarks:chosen.hand.landmarks.map(p=>({...p}))});
 }
 for(const item of proposed)if(!used.has(item.hand.rawIndex)&&
  !unassigned.includes(item.hand.rawIndex))unassigned.push(item.hand.rawIndex);
 return {matches:matched,ambiguous,unassigned};
}
export function handFingers(landmarks:readonly Landmark[]):FingerDetail[]{
 return FINGERS.map(f=>{
  const m=landmarks[f.mcp],p=landmarks[f.pip],d=landmarks[f.dip],tip=landmarks[f.tip];
  const angle=handAngle2D(m,p,d);
  return {name:f.name,bendDeg:angle===null?null:Math.max(0,180-angle),
   tipX:valid(tip,false)?tip.x:null,tipY:valid(tip,false)?tip.y:null};
 });
}
export function handPinchRatio(landmarks:readonly Landmark[]):number|null{
 const thumb=landmarks[4],index=landmarks[8],a=landmarks[5],b=landmarks[17];
 if(!valid(thumb,false)||!valid(index,false)||!valid(a,false)||!valid(b,false))return null;
 const scale=dist(a,b);
 return scale>.0001?dist(thumb,index)/scale:null;
}
function joint(map:Map<number,TemporalJoint>,index:number):TemporalJoint|undefined{return map.get(index);}
function getLimb(spec:typeof LIMBS[number],map:Map<number,TemporalJoint>,
 angles:TemporalActorSample['angles']):LimbDetail{
 const count=spec.indices.filter(i=>map.has(i)).length;
 const endpoint=map.get(spec.tip);
 return {name:spec.name,
  presence:count===0?'missing':count===spec.indices.length?'visible':'partial',
  visibleJoints:count,requiredJoints:spec.indices.length,
  angleDeg:angles.find(a=>a.joint===spec.vertex)?.degrees??null,
  tipSpeed:endpoint?.speed??null,
  tipVelocityX:endpoint?.vx??null,tipVelocityY:endpoint?.vy??null};
}
function relation(side:HandSide,map:Map<number,TemporalJoint>):LimbRelation{
 const wrist=map.get(side==='left'?15:16),hip=map.get(side==='left'?23:24),
 ankle=map.get(side==='left'?27:28);
 const handToHip2D=wrist&&hip?dist(
  {x:wrist.smoothX,y:wrist.smoothY},{x:hip.smoothX,y:hip.smoothY}):null;
 const wx=wrist?.vx,wy=wrist?.vy,ax=ankle?.vx,ay=ankle?.vy;
 const sw=finite(wx)&&finite(wy)?length(wx!,wy!):0,
  sa=finite(ax)&&finite(ay)?length(ax!,ay!):0;
 const armLegAlignment=sw>.0005&&sa>.0005?
  Math.max(-1,Math.min(1,(wx!*ax!+wy!*ay!)/(sw*sa))):null;
 return {side,handToHip2D,armLegAlignment};
}
function missingHand(side:HandSide,presence:HandPresence,atMs:number|null=null):HandDetail{
 return {side,presence,observedAtMs:atMs,landmarks:[],fingers:[],pinchRatio:null,
  wristX:null,wristY:null,wristSpeed:null};
}
function copyFrame(frame:HandLimbFrame):HandLimbFrame{
 return {...frame,actors:frame.actors.map(actor=>({
  ...actor,limbs:actor.limbs.map(l=>({...l})),
  hands:actor.hands.map(h=>({...h,landmarks:h.landmarks.map(p=>({...p})),
   fingers:h.fingers.map(f=>({...f}))})),
  relations:actor.relations.map(r=>({...r}))
 }))};
}
export class HandLimbDetailAnalyzer{
 private history:HandLimbFrame[]=[];
 private lastTime=-1;
 private lastHands=new Map<string,HandDetail>();
 reset(){this.history=[];this.lastTime=-1;this.lastHands.clear();}
 get latest():HandLimbFrame|null{const v=this.history.at(-1);return v?copyFrame(v):null;}
 get window():HandLimbFrame[]{return this.history.map(copyFrame);}
 observe(assignments:readonly VideoActorAssignment[],actorStates:readonly VideoActorState[],
 temporal:TemporalFrame,atMs:number,options:{
  hands:readonly RawHandDetection[]|null;handModelAvailable:boolean
 }):HandLimbFrame{
  if(!Number.isFinite(atMs)||atMs<0||this.lastTime>=atMs)
   throw Error('Waktu observasi hand/limb tidak valid.');
  if(this.lastTime>=0&&atMs-this.lastTime>450)this.lastHands.clear();
  const scan=options.hands!==null;
  const matched=scan?matchHandsToActors(options.hands!,findActorHandSlots(assignments)):
   {matches:[] as HandMatch[],ambiguous:[] as HandSlot[],unassigned:[] as number[]};
  const actors=(['A','B'] as const).map((id):ActorLimbDetail=>{
   const pose=temporal.actors.find(item=>item.id===id);
   const joints=new Map((pose?.joints??[]).map(j=>[j.index,j]));
   const limbs=LIMBS.map(spec=>getLimb(spec,joints,pose?.angles??[]));
   const hands=(['left','right'] as const).map(side=>{
    const key=id+':'+side;
    const current=matched.matches.find(h=>h.actor===id&&h.side===side);
    const uncertain=matched.ambiguous.some(slot=>slot.actor===id&&slot.side===side);
    if(scan){
     this.lastHands.delete(key);
     if(current){
      const indices=current.landmarks,anchor=indices[0];
      const hand={
       side,presence:'visible' as const,observedAtMs:atMs,
       landmarks:indices.map(p=>({...p})),fingers:handFingers(indices),
       pinchRatio:handPinchRatio(indices),wristX:valid(anchor,false)?anchor.x:null,
       wristY:valid(anchor,false)?anchor.y:null,
       wristSpeed:joints.get(side==='left'?15:16)?.speed??null
      };
      this.lastHands.set(key,hand);return hand;
     }
     return missingHand(side,uncertain?'ambiguous':
      options.handModelAvailable?'missing':'unavailable');
    }
    if(!options.handModelAvailable)return missingHand(side,'unavailable');
    // A recently sampled hand may be held solely for display; it is clearly
    // marked as "recent", never a new measurement or inferred coordinate.
    const old=this.lastHands.get(key);
    if(old&&old.observedAtMs!==null&&atMs-old.observedAtMs<=HAND_RECENT_MS&&
     pose?.presence==='visible')return {...old,presence:'recent' as const,
      landmarks:old.landmarks.map(p=>({...p})),fingers:old.fingers.map(f=>({...f}))};
    return missingHand(side,'missing');
   });
   return {id,presence:pose?.presence??actorStates.find(a=>a.id===id)?.presence??'not-detected',
    limbs,hands,relations:['left','right'].map(side=>relation(side as HandSide,joints))};
  });
  const frame={atMs,handScanned:scan,handModelAvailable:options.handModelAvailable,
   rawHandsDetected:scan?(options.hands?.length??0):0,
   matchedHands:scan?matched.matches.length:0,actors};
  this.history.push(frame);
  if(this.history.length>HAND_LIMB_MAX_FRAMES)this.history.shift();
  this.lastTime=atMs;
  return copyFrame(frame);
 }
}
export const handLimbStatusLabel=(status:HandPresence)=>({
 visible:'Terbaca',recent:'Sampel terakhir',missing:'Tidak terlihat',
 ambiguous:'Belum pasti',unavailable:'Model tidak tersedia'
})[status];
