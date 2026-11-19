/** VC-02: deterministic, pure footprint event store.
 * Coordinates are normalized to the preview surface until FLOOR map is calibrated.
 * No camera, projector, or browser APIs; safe for tests and offline rehearsals.
 */
export type FootSide='left'|'right';
export type PerformerId='A'|'B';
export type FootEventKind='contact'|'slide'|'pivot'|'release';
export type FootprintEvent={
 id:string;performerId:PerformerId;foot:FootSide;kind:FootEventKind;
 atMs:number;x:number;y:number;headingDeg:number;confidence:number;
 trackingState:'tracked'|'estimated'|'lost';
};
export type FootprintStamp={
 eventId:string;performerId:PerformerId;foot:FootSide;
 x:number;y:number;headingDeg:number;createdAtMs:number;
 releasedAtMs:number|null;
};
export type FootprintState={
 imprints:FootprintStamp[];active:Partial<Record<`${PerformerId}:${FootSide}`,string>>;
 seenIds:string[];lastEvent:FootEventKind|null;
};
export type FootprintTiming={holdMs:number;decayMs:number};
export const emptyFootprintState=():FootprintState=>({imprints:[],active:{},seenIds:[],lastEvent:null});
const clamp=(x:number)=>Math.max(0,Math.min(1,x));
const finite=(x:number)=>Number.isFinite(x);
const trackKey=(event:FootprintEvent)=>`${event.performerId}:${event.foot}` as const;
export function applyFootprintEvent(state:FootprintState,event:FootprintEvent,maxImprints=120):FootprintState{
 if(!event.id||state.seenIds.includes(event.id))return state;
 if(event.trackingState==='lost'||event.confidence<.6||![event.x,event.y,event.headingDeg,event.atMs].every(finite))return state;
 const key=trackKey(event),activeId=state.active[key];
 const seenIds=[...state.seenIds.slice(-399),event.id];
 const next:FootprintState={imprints:state.imprints,active:{...state.active},seenIds,lastEvent:event.kind};
 if(event.kind==='contact'){
  // Transition-only stamping: planted feet must never produce imprints every frame.
  if(activeId)return {...next,lastEvent:'contact'};
  next.imprints=[...state.imprints,{eventId:event.id,performerId:event.performerId,
   foot:event.foot,x:clamp(event.x),y:clamp(event.y),headingDeg:event.headingDeg,
   createdAtMs:event.atMs,releasedAtMs:null}].slice(-maxImprints);
  next.active[key]=event.id;
 }else if(event.kind==='release'){
  if(!activeId)return next;
  next.imprints=state.imprints.map(stamp=>stamp.eventId===activeId?
   {...stamp,releasedAtMs:event.atMs}:stamp);
  delete next.active[key];
 }else if(activeId){
  next.imprints=state.imprints.map(stamp=>stamp.eventId===activeId?
   {...stamp,x:event.kind==='slide'?clamp(event.x):stamp.x,
    y:event.kind==='slide'?clamp(event.y):stamp.y,
    headingDeg:event.kind==='pivot'?event.headingDeg:stamp.headingDeg}:stamp);
 }
 return next;
}
export function footprintOpacity(stamp:FootprintStamp,nowMs:number,timing:FootprintTiming){
 // Hold while planted, then hold for a configurable duration after release.
 if(stamp.releasedAtMs===null)return 1;
 const age=Math.max(0,nowMs-stamp.releasedAtMs);
 if(age<=timing.holdMs)return 1;
 const fade=Math.max(1,timing.decayMs);
 return Math.max(0,1-(age-timing.holdMs)/fade);
}
export function pruneFootprints(state:FootprintState,nowMs:number,timing:FootprintTiming):FootprintState{
 const imprints=state.imprints.filter(s=>footprintOpacity(s,nowMs,timing)>0);
 return imprints.length===state.imprints.length?state:{...state,imprints};
}
export function makeDemoFootEvent(state:FootprintState,kind:FootEventKind,foot:FootSide,
 atMs:number,performerId:PerformerId='A'):FootprintEvent{
 const seq=state.seenIds.length+1,track=state.active[`${performerId}:${foot}`];
 const current=state.imprints.find(s=>s.eventId===track);
 return {id:`demo-${seq}-${atMs}`,performerId,foot,kind,atMs,confidence:1,trackingState:'tracked',
  x:current?kind==='slide'?clamp(current.x+.055):current.x:clamp(.22+(seq*13%56)/100),
  y:current?kind==='slide'?clamp(current.y-.035):current.y:clamp(.78-(seq*11%53)/100),
  headingDeg:kind==='pivot'?(current?.headingDeg??0)+30:foot==='left'?-12:12};
}
