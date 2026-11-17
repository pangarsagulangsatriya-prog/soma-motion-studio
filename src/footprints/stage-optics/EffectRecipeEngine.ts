/** S6.3 · Event-driven media treatment. Takes existing FloorSession and gait status.
 * No camera, gait inference, video decoding or projector output is created here.
 * Foot contacts and slide/pivot are camera ESTIMATES, not pressure sensors.
 */
import type {FootstepEvent} from '../spatial/events.ts';
import type {GaitMotion} from '../gait-analysis/index.ts';

export type RecipeEvent='contact'|'slide'|'pivot';
export type RecipeAction='reveal'|'hold'|'decay';
export type RecipeSurface='body'|'floor'|'both';
export type RecipeScope='all'|'A'|'B';
export type RecipeChannel='A'|'B';
export type RecipeRule={
 id:'contact'|'slide'|'pivot';enabled:boolean;action:RecipeAction;
 surface:RecipeSurface;scope:RecipeScope;
 attackMs:number;holdMs:number;decayMs:number;intensity:number;minConfidence:number;
};
export type EffectRecipeConfig={
 schema:'soma.effect-recipes';version:1;enabled:boolean;name:string;rules:RecipeRule[];
};
export type RecipeMotion={
 performerId:string;foot:'left'|'right';motion:GaitMotion;confidence:number;
};
export type RecipeFeed={
 events:readonly FootstepEvent[];motions:readonly RecipeMotion[];
 nowMs:number;contextKey:string;mode:'camera'|'simulation';
 trusted:boolean;primeExisting?:boolean;
};
export type RecipeGains={A:number;B:number};
export type EffectRecipeSnapshot={
 body:RecipeGains;floor:RecipeGains;holdVideo:{A:boolean;B:boolean};
 status:'active'|'blocked'|'off';reason:string;contacts:number;slides:number;pivots:number;
 recent:{event:RecipeEvent;slot:RecipeChannel;atMs:number;action:RecipeAction}[];
};
const createRule=(id:RecipeEvent,action:RecipeAction,surface:RecipeSurface,
 extra:Partial<RecipeRule>={}):RecipeRule=>({
 id,enabled:true,action,surface,scope:'all',
 attackMs:180,holdMs:450,decayMs:2000,intensity:1,minConfidence:.65,...extra
});
export const EFFECT_PRESETS={
 residue:{
  contact:createRule('contact','reveal','both',{attackMs:190,holdMs:600,decayMs:2200}),
  slide:createRule('slide','hold','floor',{holdMs:1300,decayMs:2800}),
  pivot:createRule('pivot','decay','body',{decayMs:900})
 },
 disappearing:{
  contact:createRule('contact','reveal','floor',{attackMs:140,holdMs:300,decayMs:1250}),
  slide:createRule('slide','decay','floor',{decayMs:750}),
  pivot:createRule('pivot','hold','body',{holdMs:1000})
 },
 exchange:{
  contact:createRule('contact','reveal','body',{attackMs:120,holdMs:900,decayMs:2400}),
  slide:createRule('slide','reveal','floor',{attackMs:300,holdMs:300,decayMs:3200}),
  pivot:createRule('pivot','decay','both',{decayMs:1500})
 }
} as const;
export type RecipePreset=keyof typeof EFFECT_PRESETS;
export const EFFECT_PRESET_LABELS:Record<RecipePreset,string>={
 residue:'Archive Residue',disappearing:'The Disappearing Path',exchange:'Body Exchange'
};
export function presetEffectRecipe(preset:RecipePreset='residue',enabled=false):EffectRecipeConfig{
 const p=EFFECT_PRESETS[preset];
 return {schema:'soma.effect-recipes',version:1,enabled,name:EFFECT_PRESET_LABELS[preset],
  rules:[{...p.contact},{...p.slide},{...p.pivot}]};
}
export const defaultEffectRecipe=()=>presetEffectRecipe('residue',false);
export function validateEffectRecipe(input:unknown):EffectRecipeConfig{
 const v=input as Partial<EffectRecipeConfig>|null;
 if(!v||v.schema!=='soma.effect-recipes'||v.version!==1||
  typeof v.enabled!=='boolean'||typeof v.name!=='string'||v.name.length>80||
  !Array.isArray(v.rules)||v.rules.length!==3)throw Error('Recipe media SOMA tidak valid.');
 const ids=new Set<RecipeEvent>();
 const rules=v.rules.map(r=>{
  if(!r||!['contact','slide','pivot'].includes(r.id)||
   ids.has(r.id)||typeof r.enabled!=='boolean'||
   !['reveal','hold','decay'].includes(r.action)||
   !['body','floor','both'].includes(r.surface)||
   !['all','A','B'].includes(r.scope)||
   !Number.isFinite(r.attackMs)||r.attackMs<0||r.attackMs>5000||
   !Number.isFinite(r.holdMs)||r.holdMs<0||r.holdMs>15000||
   !Number.isFinite(r.decayMs)||r.decayMs<100||r.decayMs>30000||
   !Number.isFinite(r.intensity)||r.intensity<0||r.intensity>1||
   !Number.isFinite(r.minConfidence)||r.minConfidence<.5||r.minConfidence>1)
   throw Error('Aturan event / Reveal / Hold / Decay di luar batas.');
  ids.add(r.id);return {...r};
 });
 if(ids.size!==3)return (()=>{throw Error('Recipe memerlukan Contact, Slide dan Pivot.');})();
 return {schema:'soma.effect-recipes',version:1,enabled:v.enabled,name:v.name,rules};
}
const channels=['A','B'] as const, surfaces=['body','floor'] as const;
type Envelope={startMs:number;from:number;peak:number;attackMs:number;holdMs:number;decayMs:number};
const zero=():RecipeGains=>({A:0,B:0});
const clamp=(n:number)=>Math.max(0,Math.min(1,n));
const value=(e:Envelope|null,now:number):number=>{
 if(!e)return 0;
 const t=Math.max(0,now-e.startMs);
 if(t<e.attackMs)return clamp(e.from+(e.peak-e.from)*t/Math.max(1,e.attackMs));
 if(t<e.attackMs+e.holdMs)return e.peak;
 const decay=(t-e.attackMs-e.holdMs)/Math.max(1,e.decayMs);
 return clamp(e.peak*(1-clamp(decay)));
};
const footSlot=(id:string):RecipeChannel|null=>
 id==='A'||id==='performer-1'?'A':id==='B'?'B':null;
const sig=(e:FootstepEvent|undefined)=>e?
 JSON.stringify([e.id,e.timestampMs,e.performerId,e.foot,e.kind]):'';
export class EffectRecipeEngine{
 private config=defaultEffectRecipe();
 private context='';
 private processed=0;
 private lastSignature='';
 private primed=false;
 private lastTime=-1;
 private started=false;
 private voices:Record<'body'|'floor',Record<RecipeChannel,Envelope|null>>={
  body:{A:null,B:null},floor:{A:null,B:null}
 };
 private videoHeldUntil={A:0,B:0};
 private activeMotion=new Map<string,'slide'|'pivot'>();
 private recent:EffectRecipeSnapshot['recent']=[];
 private counts={contacts:0,slides:0,pivots:0};
 setConfig(value:EffectRecipeConfig){
  const validated=validateEffectRecipe(value);
  if(JSON.stringify(this.config)!==JSON.stringify(validated)){
   this.config=validated;this.reset();
  }
 }
 reset(){
  this.context='';this.processed=0;this.lastSignature='';this.primed=false;
  this.lastTime=-1;this.started=false;this.clear();
 }
 private clear(){
  this.voices={body:{A:null,B:null},floor:{A:null,B:null}};
  this.videoHeldUntil={A:0,B:0};this.activeMotion.clear();
  this.recent=[];this.counts={contacts:0,slides:0,pivots:0};
 }
 private trigger(event:RecipeEvent,slot:RecipeChannel,confidence:number,at:number){
  const rule=this.config.rules.find(r=>r.id===event);
  if(!rule?.enabled||confidence<rule.minConfidence||
   (rule.scope!=='all'&&rule.scope!==slot))return;
  for(const surface of surfaces){
   if(rule.surface!=='both'&&rule.surface!==surface)continue;
   const current=value(this.voices[surface][slot],at);
   const gain=rule.action==='reveal'?rule.intensity:current;
   this.voices[surface][slot]=rule.action==='reveal'?
    {startMs:at,from:current,peak:gain,attackMs:rule.attackMs,
     holdMs:rule.holdMs,decayMs:rule.decayMs}:
    rule.action==='hold'?
    {startMs:at,from:current,peak:current,attackMs:0,
     holdMs:rule.holdMs,decayMs:rule.decayMs}:
    {startMs:at,from:current,peak:current,attackMs:0,
     holdMs:0,decayMs:rule.decayMs};
  }
  if(rule.action==='hold')
   this.videoHeldUntil[slot]=Math.max(this.videoHeldUntil[slot],at+rule.holdMs);
  if(event==='contact')this.counts.contacts++;
  if(event==='slide')this.counts.slides++;
  if(event==='pivot')this.counts.pivots++;
  this.recent.push({event,slot,atMs:at,action:rule.action});
  this.recent=this.recent.slice(-10);
 }
 /** Simulation-only manual cue; caller must explicitly gate its use. */
 preview(event:RecipeEvent,slot:RecipeChannel,nowMs:number,mode:'simulation'|'camera'){
  if(mode!=='simulation'||!this.config.enabled||!Number.isFinite(nowMs))
   throw Error('Cues manual hanya tersedia dalam mode Simulasi.');
  this.trigger(event,slot,1,nowMs);
 }
 /** Idempotent append-only reading of already processed real Footstep events.
  * Camera events observed before opening this panel are primed/skipped.
  * Tracking faults consume old events and clear light/hold state rather than
  * replaying a delayed bright flash after recovering camera.
  */
 sync(input:RecipeFeed):EffectRecipeSnapshot{
  const {events,motions,nowMs,contextKey,mode,trusted,primeExisting=false}=input;
  if(!Number.isFinite(nowMs)||nowMs<0||!contextKey)
   throw Error('Clock atau sesi recipe tidak valid.');
  const context=JSON.stringify([contextKey,mode]);
  const changed=context!==this.context||nowMs<this.lastTime||
   this.processed>events.length||
   (this.processed>0&&sig(events[this.processed-1])!==this.lastSignature);
  if(changed){this.reset();this.context=context;}
  this.lastTime=nowMs;
  if(!this.config.enabled)return this.snapshot(nowMs,'off','Recipe dimatikan.');
  if(!trusted){
   this.clear();this.processed=events.length;
   this.lastSignature=sig(events[this.processed-1]);this.primed=true;
   this.started=false;
   return this.snapshot(nowMs,'blocked','Tracking, kalibrasi, atau identitas tidak aman.');
  }
  if(!this.primed){
   this.primed=true;
   if(primeExisting){
    this.processed=events.length;this.lastSignature=sig(events[this.processed-1]);
   }
  }
  const rules=this.config.rules;
  // Maximum 100,000 events in FloorSession. Process them once and discard stale
  // events, without storing duplicate FloorSession data in the recipe engine.
  for(;this.processed<events.length;this.processed++){
   const e=events[this.processed];
   if(e.timestampMs>nowMs)break;
   this.lastSignature=sig(e);
   if(nowMs-e.timestampMs>800||e.source!==mode||
    e.positionBasis!==(mode==='camera'?'calibrated-estimate':'simulated'))continue;
   const slot=footSlot(e.performerId);
   if(!slot)continue;
   if(e.kind==='contact')this.trigger('contact',slot,e.confidence,nowMs);
   if(e.kind==='move'&&mode==='simulation'){
    const key=e.performerId+':'+e.foot;
    if(this.activeMotion.get(key)!=='slide'){
     this.activeMotion.set(key,'slide');this.trigger('slide',slot,e.confidence,nowMs);
    }
   }
   if(e.kind==='release'||e.kind==='swing')
    this.activeMotion.delete(e.performerId+':'+e.foot);
  }
  if(mode==='camera'){
   const encountered=new Set<string>();
   for(const m of motions){
    if(m.confidence<.5||!['A','B','performer-1'].includes(m.performerId))continue;
    const slot=footSlot(m.performerId);if(!slot)continue;
    const key=m.performerId+':'+m.foot;
    encountered.add(key);
    const next=m.motion==='pivot'?'pivot':m.motion==='slide'?'slide':null;
    if(next&&this.activeMotion.get(key)!==next)
     this.trigger(next,slot,m.confidence,nowMs);
    if(next)this.activeMotion.set(key,next);else this.activeMotion.delete(key);
   }
   for(const key of this.activeMotion.keys())
    if(!encountered.has(key))this.activeMotion.delete(key);
  }
  this.started=true;
  return this.snapshot(nowMs,'active','Recipe membaca event Footprints dan gait saat ini.');
 }
 snapshot(nowMs:number,status:EffectRecipeSnapshot['status']='active',reason='Preview recipe aktif.'):EffectRecipeSnapshot{
  if(status!=='active'||!this.config.enabled)return {
   body:zero(),floor:zero(),holdVideo:{A:false,B:false},
   status,reason,contacts:this.counts.contacts,slides:this.counts.slides,
   pivots:this.counts.pivots,recent:this.recent.slice()
  };
  return {body:{A:value(this.voices.body.A,nowMs),B:value(this.voices.body.B,nowMs)},
   floor:{A:value(this.voices.floor.A,nowMs),B:value(this.voices.floor.B,nowMs)},
   holdVideo:{A:nowMs<this.videoHeldUntil.A,B:nowMs<this.videoHeldUntil.B},
   status,reason,contacts:this.counts.contacts,slides:this.counts.slides,
   pivots:this.counts.pivots,recent:this.recent.slice()};
 }
 get settings(){return validateEffectRecipe(this.config);}
}
