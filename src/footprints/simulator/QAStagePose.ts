import type {FootstepEvent} from '../spatial/events.ts';
import {initialPerformers,type PuppetPerformer} from './scene3d.ts';
import {qaFaultAt,QA_DURATION_MS,type QAScenario} from './QAScenario.ts';

type TimeState={lastContact:FootstepEvent|null;lastLift:FootstepEvent|null;nextContact:FootstepEvent|null};
const key=(e:FootstepEvent)=>e.performerId+':'+e.foot;
const lerp=(a:number,b:number,t:number)=>a+(b-a)*t;
const heading=(a:number,b:number,t:number)=>a+
 Math.atan2(Math.sin(b-a),Math.cos(b-a))*t;
/**
 * Interpolated visual pose for QA playback. Does not change measured/saved
 * footprint events and does not simulate ground-reaction forces.
 */
export function qaPuppetPoseAt(scenario:QAScenario,timeMs:number):PuppetPerformer[]{
 const t=Math.min(QA_DURATION_MS,Math.max(0,timeMs));
 const rigs=initialPerformers(scenario.floor);
 const track=new Map<string,TimeState>();
 for(const event of scenario.session.events){
  if(event.kind!=='contact'&&event.kind!=='release'&&event.kind!=='swing')continue;
  const k=key(event);
  let state=track.get(k);
  if(!state){state={lastContact:null,lastLift:null,nextContact:null};track.set(k,state);}
  if(event.timestampMs<=t){
   if(event.kind==='contact'){state.lastContact=event;state.lastLift=null;}
   else state.lastLift=event;
  }else if(event.kind==='contact'&&state.nextContact===null){
   state.nextContact=event;
  }
 }
 for(const rig of rigs){
  for(const side of ['left','right'] as const){
   const state=track.get(rig.id+':'+side);if(!state)continue;
   const f=rig[side],base=state.lastContact??state.nextContact;
   if(base){f.positionM={...base.positionM};f.headingRad=base.headingRad;}
   if(!state.lastLift||!state.nextContact)continue;
   const start=state.lastLift,end=state.nextContact;
   if(end.timestampMs<=start.timestampMs)continue;
   // A synthetic tracking loss freezes the body instead of interpolating
   // across a period where we intentionally have no confidence in contact.
   const fault=qaFaultAt(t,scenario.faultsEnabled);
   if(fault&&['tracking-loss','identity-crossing','camera-change'].includes(fault.id))continue;
   const phase=Math.max(0,Math.min(1,(t-start.timestampMs)/(end.timestampMs-start.timestampMs)));
   const origin=state.lastContact?.positionM??end.positionM;
   f.positionM={xM:lerp(origin.xM,end.positionM.xM,phase),
    yM:lerp(origin.yM,end.positionM.yM,phase)};
   f.headingRad=heading(state.lastContact?.headingRad??end.headingRad,end.headingRad,phase);
   f.heightM=.40*Math.sin(Math.PI*phase);
  }
 }
 return rigs;
}
