import {defaultFloorSpace,insideFloor,validateFloorSpace,type FloorPoint,type FloorSpace} from '../spatial/coordinates.ts';
import {createFloorSession,FootstepEventEngine,validateFootstepEvent,validateFloorSession,type FloorSession,type FootSide,type FootstepEvent} from '../spatial/events.ts';
import {clampOnFloor,initialPerformers,type PuppetPerformer} from './scene3d.ts';

type Selection={performerId:string;foot:FootSide};
const clone=<T>(value:T):T=>structuredClone(value);
export class DirectPuppetSession{
 floor:FloorSpace;
 performers:PuppetPerformer[];
 events:FootstepEvent[]=[];
 engine:FootstepEventEngine;
 private serial=0;
 private clock=0;
 private firstMotionAt:number|null=null;
 constructor(floor:FloorSpace=defaultFloorSpace()){
  this.floor=validateFloorSpace(floor);
  this.performers=initialPerformers(floor);
  this.engine=new FootstepEventEngine(floor);
 }
 get session():FloorSession{return createFloorSession(this.floor,this.events);}
 get durationMs(){return this.events.at(-1)?.timestampMs??0;}
 getFoot(which:Selection){const p=this.performers.find(p=>p.id===which.performerId);return p?.[which.foot]??null;}
 private next(nowMs:number){
  if(this.firstMotionAt===null)this.firstMotionAt=Number.isFinite(nowMs)?nowMs:0;
  const relative=Number.isFinite(nowMs)?Math.floor(nowMs-this.firstMotionAt):0;
  this.clock=Math.max(this.clock+1,relative);return this.clock;
 }
 private add(observed:FootstepEvent[]){
  for(const ev of observed){
   this.serial+=1;
   this.events.push(validateFootstepEvent({...ev,id:'sim-'+this.serial},this.floor));
  }
 }
 private observe(which:Selection,phase:'swing'|'stance',nowMs:number){
  const f=this.getFoot(which);if(!f)throw Error('Performer dan kaki tidak ditemukan.');
  const t=this.next(nowMs);
  const events=this.engine.observe({
   ...which,timestampMs:t,phase,positionM:clone(f.positionM),
   headingRad:f.headingRad,source:'simulation',positionBasis:'simulated',confidence:1
  });
  this.add(events);
  return t;
 }
 lift(which:Selection,nowMs:number){
  const f=this.getFoot(which);if(!f)return false;
  if(f.heightM>.005)return false;
  f.heightM=.38;
  this.observe(which,'swing',nowMs);return true;
 }
 move(which:Selection,point:FloorPoint,nowMs:number){
  const f=this.getFoot(which);if(!f||f.heightM<=.005)return false;
  if(!insideFloor(this.floor,point))return false;
  const next=clampOnFloor(point,this.floor),distance=Math.hypot(next.xM-f.positionM.xM,next.yM-f.positionM.yM);
  if(distance<.015)return false;
  f.positionM=next;
  const t=this.observe(which,'swing',nowMs);
  this.serial+=1;
  this.events.push(validateFootstepEvent({
   id:'sim-'+this.serial,performerId:which.performerId,foot:which.foot,
   kind:'swing',timestampMs:t,positionM:clone(next),headingRad:f.headingRad,
   source:'simulation',positionBasis:'simulated',confidence:1,joinPrevious:false
  },this.floor));
  return true;
 }
 rotate(which:Selection,radians:number,nowMs:number){
  const f=this.getFoot(which);if(!f||!Number.isFinite(radians))return false;
  f.headingRad+=radians;
  if(f.heightM>.005)this.moveHeading(which,nowMs);
  return true;
 }
 private moveHeading(which:Selection,nowMs:number){
  const f=this.getFoot(which)!;
  const t=this.observe(which,'swing',nowMs);
  this.serial++;
  this.events.push(validateFootstepEvent({
   id:'sim-'+this.serial,performerId:which.performerId,foot:which.foot,
   kind:'swing',timestampMs:t,positionM:clone(f.positionM),headingRad:f.headingRad,
   source:'simulation',positionBasis:'simulated',confidence:1,joinPrevious:false
  },this.floor));
 }
 land(which:Selection,nowMs:number){
  const f=this.getFoot(which);if(!f||f.heightM<=.005)return false;
  f.heightM=0;
  this.observe(which,'stance',nowMs);
  return true;
 }
 cancelLift(which:Selection,old:FloorPoint){
  const f=this.getFoot(which);if(!f)return;
  f.heightM=0;f.positionM=clone(old);
  this.engine.loseTracking(which.performerId,which.foot);
  // The lift was observed; no contact is added after an interrupted drag.
 }
 clear(){this.engine.reset();this.serial=0;this.clock=0;this.firstMotionAt=null;this.events=[];this.performers=initialPerformers(this.floor);}
 setFloor(floor:FloorSpace){this.floor=validateFloorSpace(floor);this.engine=new FootstepEventEngine(this.floor);this.clear();}
 importSession(raw:unknown){
  const s=validateFloorSession(raw);
  // Import replaces the working session; it never guesses physical calibration.
  this.floor=s.floor;this.events=clone(s.events);
  this.performers=initialPerformers(this.floor);
  this.engine=new FootstepEventEngine(this.floor);
  this.clock=this.durationMs;this.firstMotionAt=null;
  this.serial=this.events.length+100000;
 }
}
/** Reconstruct an approximate puppet pose from recorded swing/landing events. */
export function replayPoseAt(floor:FloorSpace,events:FootstepEvent[],timeMs:number):PuppetPerformer[]{
 const rigs=initialPerformers(floor);
 for(const ev of events){
  if(ev.timestampMs>timeMs)break;
  const rig=rigs.find(r=>r.id===ev.performerId);if(!rig)continue;
  const foot=rig[ev.foot];foot.positionM=clone(ev.positionM);foot.headingRad=ev.headingRad;
  if(ev.kind==='swing'||ev.kind==='release')foot.heightM=.38;
  else if(ev.kind==='contact'||ev.kind==='move')foot.heightM=0;
 }
 return rigs;
}
