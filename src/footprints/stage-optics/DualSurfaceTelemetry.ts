/**
 * UX03 — read-only telemetry from the existing S5.7.4 output router.
 * Browser commands and optical authority remain owned by DualSurfaceRoutingPanel.
 * This store reports software state, never observed projector photons.
 */
export type DualSurfaceId='body'|'floor';
export type DualMode='offline'|'blackout'|'test'|'live'|'feed';
export type DualQA='incomplete'|'needs-adjustment'|'within-provisional-target';
export type DualSurfaceState={
 surface:DualSurfaceId;reported:boolean;opened:boolean;connected:boolean;
 mode:DualMode;qa:DualQA;reason:string;sampledAtMs:number;
};
const empty=(surface:DualSurfaceId):DualSurfaceState=>({
 surface,reported:false,opened:false,connected:false,mode:'offline',
 qa:'incomplete',reason:'Panel output belum dibuka.',sampledAtMs:0
});
let current:Record<DualSurfaceId,DualSurfaceState>={body:empty('body'),floor:empty('floor')};
const watchers=new Set<()=>void>();
let owner:string|null=null;
function announce(){for(const cb of watchers)cb();}
export function claimDualOutputStatus(instance:string){
 if(!instance)throw Error('Session output diperlukan.');
 owner=instance;
 current={body:empty('body'),floor:empty('floor')};announce();
}
/** Do not allow stale callbacks from a previous, unmounted output panel. */
export function reportDualOutputStatus(instance:string,next:DualSurfaceState){
 if(!instance||instance!==owner)return;
 if(!Number.isFinite(next.sampledAtMs)||next.sampledAtMs<0)return;
 const previous=current[next.surface];
 if(!previous||next.sampledAtMs<previous.sampledAtMs)return;
 current={...current,[next.surface]:{...next}};
 announce();
}
export function releaseDualOutputStatus(instance:string){
 if(!instance||owner!==instance)return;
 owner=null;current={body:empty('body'),floor:empty('floor')};announce();
}
export function readDualOutputStatus():Record<DualSurfaceId,DualSurfaceState>{
 return {body:{...current.body},floor:{...current.floor}};
}
export function watchDualOutputStatus(callback:()=>void):()=>void{
 watchers.add(callback);return()=>{watchers.delete(callback);};
}
/** If dispatch stops, no previous Live lamp may remain labeled fresh. */
export function verifiedDualStatus(state:DualSurfaceState,now:number,maxAgeMs=900):DualSurfaceState{
 if(!state.reported||!Number.isFinite(now)||!Number.isFinite(state.sampledAtMs)||
  state.sampledAtMs<0||now-state.sampledAtMs<0||
  now-state.sampledAtMs>maxAgeMs)
  return {...state,connected:false,mode:'offline',
   reason:state.reported?'Status output kedaluwarsa; periksa jendela proyektor.':'Panel output belum dibuka.'};
 if(!state.connected)return {...state,mode:'offline'};
 return {...state};
}
