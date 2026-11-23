import type {ActorChannel} from './ActorPaletteResolver.ts';
import type {ActorPathObservation,PathPoint} from './PathObservationRouter.ts';
import {validateContinuityBridge,type BridgeCandidate,type BridgeContext}
 from './ContinuityBridgeValidator.ts';

const dist=(a:PathPoint,b:PathPoint)=>Math.hypot(a.x-b.x,a.y-b.y);
export type ContinuityPhase='OBSERVED'|'SOFT_GAP'|'RECOVERING'|'HARD_CUT';
type Stat={acceptedBridges:number;rejectedBridges:number;cutReasons:Record<string,number>};
const newStat=():Stat=>({acceptedBridges:0,rejectedBridges:0,cutReasons:{}});
/** Single owner of temporary predicted points. A provisional point is never
 * exposed as a committed observation until a recovered foot validates it.
 */
export class ActorContinuityCoordinator{
 private candidates=new Map<ActorChannel,BridgeCandidate>();
 private phase:Record<ActorChannel,ContinuityPhase>={A:'OBSERVED',B:'OBSERVED'};
 private stats:Record<ActorChannel,Stat>={A:newStat(),B:newStat()};
 private next=0;
 reset(){
  this.candidates.clear();this.phase={A:'OBSERVED',B:'OBSERVED'};
  this.stats={A:newStat(),B:newStat()};this.next=0;
 }
 get diagnostics(){return {
  A:{phase:this.phase.A,...this.stats.A,pending:this.candidates.get('A')?.predicted.length??0},
  B:{phase:this.phase.B,...this.stats.B,pending:this.candidates.get('B')?.predicted.length??0}
 };}
 begin(start:ActorPathObservation,ctx:BridgeContext,tangent?:PathPoint){
  const actor=start.actorId;
  if(this.candidates.has(actor))return;
  this.candidates.set(actor,{
   id:actor+':'+start.epoch+':'+start.timeMs+':'+(++this.next),
   context:{...ctx},start,predicted:[],tangent
  });
  this.phase[actor]='SOFT_GAP';
 }
 append(actor:ActorChannel,point:ActorPathObservation):boolean{
  const c=this.candidates.get(actor);
  if(!c||c.predicted.length>=6||point.timeMs<=
    (c.predicted.at(-1)?.timeMs??c.start.timeMs)||
    point.timeMs-c.start.timeMs>250)return false;
  c.predicted.push({...point,footEvent:'none',motionBasis:'hip-short-gap'});
  return true;
 }
 get pendingCount(){return [...this.candidates.values()].reduce((s,c)=>s+c.predicted.length,0);}
 has(actor:ActorChannel){return this.candidates.has(actor);}
 recover(actor:ActorChannel,recovered:ActorPathObservation,ctx:BridgeContext):
  {observations:ActorPathObservation[];cutReason?:string}{
  const candidate=this.candidates.get(actor);
  if(!candidate){this.phase[actor]='OBSERVED';return {observations:[recovered]};}
  this.phase[actor]='RECOVERING';
  const result=validateContinuityBridge(candidate,recovered,ctx);
  this.candidates.delete(actor);
  if(!result.accepted){
   this.reject(actor,result.reason);
   return {observations:[recovered],cutReason:result.reason};
  }
  this.stats[actor].acceptedBridges++;
  this.phase[actor]='OBSERVED';
  return {observations:result.observations};
 }
 reject(actor:ActorChannel,reason:string){
  this.candidates.delete(actor);this.phase[actor]='HARD_CUT';
  const s=this.stats[actor];
  s.rejectedBridges++;s.cutReasons[reason]=(s.cutReasons[reason]??0)+1;
 }
 observe(actor:ActorChannel){
  if(!this.candidates.has(actor))this.phase[actor]='OBSERVED';
 }
}
