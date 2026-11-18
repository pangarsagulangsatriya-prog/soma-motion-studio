/** Local supervised UAT. Software output state cannot measure photons.
 * The operator explicitly confirms a visible, correctly aligned floor effect. */
export const PROJECTION_SETUP_START_KEY='soma-v3-5-setup-start-ms';
export const PROJECTION_SETUP_RESULTS_KEY='soma-v3-5-setup-uat-results';
export const FIRST_SETUP_TARGET_MS=600_000;
export type SetupBenchRecord={
 schema:'soma.projection-setup-uat';version:1;startedAt:string;
 finishedAt:string;elapsedMs:number;targetMs:number;passedTarget:boolean;
 observedByOperator:true;softwareLiveAtFinish:true;
 scope:'FLOOR';notes:string;
};
type ReadStore=Pick<Storage,'getItem'>;
type WriteStore=Pick<Storage,'getItem'|'setItem'>;
export function readSetupStart(store:ReadStore,now:number):number|null{
 try{
  const value=Number(store.getItem(PROJECTION_SETUP_START_KEY));
  return Number.isFinite(value)&&value>0&&value<=now&&now-value<3_600_000?value:null;
 }catch{return null;}
}
export function startSetupBench(store:WriteStore,now:number,reset=false):number|null{
 if(!Number.isFinite(now)||now<=0)return null;
 try{
  const prior=reset?null:readSetupStart(store,now);
  if(prior!==null)return prior;
  store.setItem(PROJECTION_SETUP_START_KEY,String(Math.round(now)));
  return Math.round(now);
 }catch{return null;}
}
export function finishSetupBench(input:{
 startStore:ReadStore;resultsStore:WriteStore;
 now:number;softwareLive:boolean;operatorObserved:boolean;notes?:string;
}):SetupBenchRecord{
 const start=readSetupStart(input.startStore,input.now);
 if(start===null)throw Error('Mulai timer Setup terlebih dahulu.');
 if(!input.softwareLive||!input.operatorObserved)
  throw Error('Lihat efek lantai pada perangkat, lalu konfirmasi pengukuran fisik.');
 const elapsedMs=Math.round(input.now-start);
 const record:SetupBenchRecord={
  schema:'soma.projection-setup-uat',version:1,
  startedAt:new Date(start).toISOString(),finishedAt:new Date(input.now).toISOString(),
  elapsedMs,targetMs:FIRST_SETUP_TARGET_MS,passedTarget:elapsedMs<FIRST_SETUP_TARGET_MS,
  observedByOperator:true,softwareLiveAtFinish:true,
  scope:'FLOOR',notes:(input.notes??'').trim().slice(0,180)
 };
 let old:SetupBenchRecord[]=[];
 try{
  const parsed=JSON.parse(input.resultsStore.getItem(PROJECTION_SETUP_RESULTS_KEY)??'[]');
  if(Array.isArray(parsed))old=parsed.slice(0,19).filter(r=>
   r?.schema==='soma.projection-setup-uat'&&r?.version===1);
 }catch{}
 input.resultsStore.setItem(PROJECTION_SETUP_RESULTS_KEY,JSON.stringify([record,...old]));
 return record;
}
