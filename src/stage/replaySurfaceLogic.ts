import type {ReplayAnalysisSnapshot} from './VideoPoseGaitEngine.ts';
import type {ReplayGaitEvent} from './videoGaitAnalysis.ts';

export type ReplaySurface='BODY A'|'BODY B'|'FLOOR';
export type ReplayRecipe='none'|'contact-reveal'|'slide-hold'|'pivot-decay';
export type ReplayMask='silhouette'|'polygon'|'none';
export type ReplayBlend='source-over'|'screen'|'multiply'|'lighter';
export type ReplayLayer={
 id:string;name:string;assetId:string;visible:boolean;opacity:number;
 scale:number;x:number;y:number;rotation:number;blend:ReplayBlend;
 mask:ReplayMask;feather:number;points:[number,number][];recipe:ReplayRecipe;
};
export type ReplayComposition=Record<ReplaySurface,ReplayLayer[]>;
export const replaySurfaces:ReplaySurface[]=['BODY A','BODY B','FLOOR'];
export const replayPresetsKey='soma-s64-presets-v1';
export const replayLocalKey='soma-s654-replay-composer-v1';
export const mediaSourceId='soma-video-source';
const limit=(value:number,a:number,b:number)=>Math.min(b,Math.max(a,value));
const number=(raw:unknown,fallback:number)=>typeof raw==='number'&&Number.isFinite(raw)?raw:fallback;
export function makeReplayLayer(surface:ReplaySurface,id:string):ReplayLayer{
 return {id,name:surface==='FLOOR'?'Footprint layer':'Archive '+surface,
  assetId:mediaSourceId,visible:true,opacity:90,scale:100,x:0,y:0,rotation:0,
  blend:'source-over',mask:surface==='FLOOR'?'none':'silhouette',
  feather:surface==='FLOOR'?0:8,
  points:[[.2,.2],[.8,.2],[.8,.8],[.2,.8]],recipe:'none'};
}
export const defaultReplayComposition=():ReplayComposition=>({
 'BODY A':[makeReplayLayer('BODY A','body-a-default')],
 'BODY B':[makeReplayLayer('BODY B','body-b-default')],
 FLOOR:[makeReplayLayer('FLOOR','floor-default')]
});
export function normalizeReplayLayer(raw:unknown,surface:ReplaySurface,idx:number):ReplayLayer{
 const d=makeReplayLayer(surface,surface+'-'+idx);
 const x=raw&&typeof raw==='object'?raw as Record<string,unknown>:{};
 const recipe:ReplayRecipe=['none','contact-reveal','slide-hold','pivot-decay'].includes(String(x.recipe))?x.recipe as ReplayRecipe:'none';
 const mask:ReplayMask=['silhouette','polygon','none'].includes(String(x.mask))?x.mask as ReplayMask:d.mask;
 const blend:ReplayBlend=['source-over','screen','multiply','lighter'].includes(String(x.blend))?x.blend as ReplayBlend:'source-over';
 const points=Array.isArray(x.points)?x.points.filter((p):p is [number,number]=>
  Array.isArray(p)&&p.length===2&&p.every((v:unknown)=>typeof v==='number'&&Number.isFinite(v)&&v>=0&&v<=1)
 ).slice(0,16):[];
 return {...d,id:typeof x.id==='string'&&x.id.length<=100&&x.id.length>0?x.id:d.id,
  name:typeof x.name==='string'?x.name.slice(0,72):d.name,
  // S6.4 browser object URLs are session-only; use the video as a valid fallback.
  assetId:mediaSourceId,
  visible:x.visible!==false,opacity:limit(number(x.opacity,90),0,100),
  scale:limit(number(x.scale,100),20,300),
  x:limit(number(x.x,0),-150,150),y:limit(number(x.y,0),-150,150),
  rotation:limit(number(x.rotation,0),-360,360),blend,mask,
  feather:limit(number(x.feather,d.feather),0,30),
  points:points.length>=3?points:d.points,recipe};
}
export function normalizeReplayComposition(raw:unknown):ReplayComposition{
 const x=raw&&typeof raw==='object'?raw as Record<string,unknown>:{};
 return Object.fromEntries(replaySurfaces.map(surface=>{
  const values=Array.isArray(x[surface])?(x[surface] as unknown[]).slice(0,12):[];
  return [surface,values.length?values.map((layer,i)=>normalizeReplayLayer(layer,surface,i)):
   [makeReplayLayer(surface,surface+'-default')]];
 })) as ReplayComposition;
}
export function safeReplayFrame(enabled:boolean,snapshot:ReplayAnalysisSnapshot|null,
 currentMs:number,performerCount:1|2):boolean{
 if(!enabled||!snapshot||snapshot.ambiguous||!Number.isFinite(currentMs))return false;
 if(Math.abs(snapshot.atMs-currentMs)>380||snapshot.performers!==performerCount)return false;
 if(performerCount===2)return snapshot.people.length===2&&
  snapshot.people.some(p=>p.id==='A')&&snapshot.people.some(p=>p.id==='B');
 return snapshot.people.some(p=>p.id==='A');
}
export function replayEventEnvelope(events:ReplayGaitEvent[],surface:ReplaySurface,
 recipe:ReplayRecipe,atMs:number):number{
 if(recipe==='none')return 1;
 const expected=recipe==='contact-reveal'?'contact':recipe==='slide-hold'?'slide':'pivot';
 const owner=surface==='BODY A'?'A':surface==='BODY B'?'B':null;
 let mostRecent=-1;
 for(const e of events){
  if(e.kind!==expected||(owner&&e.performer!==owner)||e.atMs>atMs||e.atMs<0)continue;
  if(e.atMs>mostRecent)mostRecent=e.atMs;
 }
 if(mostRecent<0)return 0;
 const age=atMs-mostRecent;
 if(recipe==='contact-reveal')return limit(Math.min(1,age/200)*(1-age/3200),0,1);
 if(recipe==='slide-hold')return age<1600?1:limit(1-(age-1600)/800,0,1);
 return limit(1-age/2400,0,1);
}
export function illustrateFloorPoint(x:number,y:number):{x:number;y:number}{
 // Artistic layout only: no georeferencing, no metric floor data.
 return {x:limit(x,.035,.965),y:limit((y-.28)/.72,.035,.965)};
}
