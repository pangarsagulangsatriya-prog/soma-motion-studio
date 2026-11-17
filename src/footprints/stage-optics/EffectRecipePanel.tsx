import type {EffectRecipeConfig,EffectRecipeSnapshot,RecipeAction,
 RecipeEvent,RecipePreset,RecipeRule,RecipeSurface,RecipeScope} from './EffectRecipeEngine.ts';
import {EFFECT_PRESET_LABELS,presetEffectRecipe,validateEffectRecipe} from './EffectRecipeEngine.ts';

const triggers=['contact','slide','pivot'] as const;
const triggerLabel:Record<RecipeEvent,string>={contact:'Contact · telapak mendarat',
 slide:'Slide · telapak bergeser',pivot:'Pivot · telapak berputar'};
const behavior:Record<RecipeAction,string>={reveal:'Reveal · muncul',hold:'Hold · tertahan',
 decay:'Decay · memudar'};
const surface:Record<RecipeSurface,string>={body:'BODY · arsip di tubuh',
 floor:'FLOOR · fragmen di pad',both:'BODY + FLOOR'};
const performer:Record<RecipeScope,string>={all:'A dan B',A:'A saja',B:'B saja'};
const fmt=(v:number)=>Math.round(v*100)+'%';
export function EffectRecipePanel({config,view,source,onChange,onReset,onPreview,onExport}:{
 config:EffectRecipeConfig;view:EffectRecipeSnapshot;source:'live'|'simulation';
 onChange:(next:EffectRecipeConfig)=>void;onReset:()=>void;
 onPreview:(event:RecipeEvent,slot:'A'|'B')=>void;onExport:()=>void;
}){
 const update=(event:RecipeEvent,patch:Partial<RecipeRule>)=>{
  try{
   onChange(validateEffectRecipe({...config,rules:config.rules.map(r=>
    r.id===event?{...r,...patch}:r)}));
  }catch{/* constrained slider/select edits are validated before save */}
 };
 return <section className="archive-recipes" aria-label="S6.3 Effect Recipe Engine">
  <div className="archive-recipes-header">
   <div><small>S6.3 / MOVEMENT → MEDIA</small><h3>Effect Recipe Engine</h3></div>
   <label className="archive-map-check">
    <input type="checkbox" checked={config.enabled} onChange={e=>
     onChange({...config,enabled:e.target.checked})}/>
    Aktifkan recipe</label>
  </div>
  <p>Event Contact, Slide, dan Pivot dari engine kaki SOMA mengatur kemunculan dan durasi arsip. Setiap performer memakai media A/B sendiri. Kamera, mask, dan output proyektor tetap memakai jalur sebelumnya.</p>
  <div className="archive-recipes-presets">
   {(Object.keys(EFFECT_PRESET_LABELS) as RecipePreset[]).map(id=>
    <button key={id} type="button"
     aria-pressed={config.name===EFFECT_PRESET_LABELS[id]}
     onClick={()=>onChange(presetEffectRecipe(id,config.enabled))}>
     {EFFECT_PRESET_LABELS[id]}</button>)}
  </div>
  <div className="archive-recipes-rules">
   {triggers.map(id=>{
    const r=config.rules.find(rule=>rule.id===id)!;
    return <div className="archive-recipes-rule" key={id}>
     <header><strong>{triggerLabel[id]}</strong>
      <label className="archive-map-check"><input type="checkbox" checked={r.enabled}
       onChange={e=>update(id,{enabled:e.target.checked})}/> Gunakan</label></header>
     <div className="archive-recipes-fields">
      <label>Perlakuan media
       <select value={r.action} onChange={e=>
        update(id,{action:e.target.value as RecipeAction})}>
        {(Object.keys(behavior) as RecipeAction[]).map(a=>
         <option key={a} value={a}>{behavior[a]}</option>)}
       </select></label>
      <label>Permukaan
       <select value={r.surface} onChange={e=>
        update(id,{surface:e.target.value as RecipeSurface})}>
        {(Object.keys(surface) as RecipeSurface[]).map(s=>
         <option key={s} value={s}>{surface[s]}</option>)}
       </select></label>
      <label>Performer
       <select value={r.scope} onChange={e=>
        update(id,{scope:e.target.value as RecipeScope})}>
        {(Object.keys(performer) as RecipeScope[]).map(k=>
         <option key={k} value={k}>{performer[k]}</option>)}
       </select></label>
      <label>Intensitas · {fmt(r.intensity)}
       <input type="range" min="0" max="1" step=".05" value={r.intensity}
        onChange={e=>update(id,{intensity:Number(e.target.value)})}/></label>
      <label>Reveal / attack · {r.attackMs} ms
       <input type="range" min="0" max="2500" step="50" value={r.attackMs}
        onChange={e=>update(id,{attackMs:Number(e.target.value)})}/></label>
      <label>Hold · {r.holdMs} ms
       <input type="range" min="0" max="8000" step="100" value={r.holdMs}
        onChange={e=>update(id,{holdMs:Number(e.target.value)})}/></label>
      <label>Decay · {r.decayMs} ms
       <input type="range" min="100" max="15000" step="100" value={r.decayMs}
        onChange={e=>update(id,{decayMs:Number(e.target.value)})}/></label>
      <label>Minimal confidence · {fmt(r.minConfidence)}
       <input type="range" min=".5" max="1" step=".05" value={r.minConfidence}
        onChange={e=>update(id,{minConfidence:Number(e.target.value)})}/></label>
     </div>
    </div>;
   })}
  </div>
  <div className="archive-recipes-status" role="status">
   <strong>{config.enabled?view.status.toUpperCase():'OFF'} · {view.reason}</strong>
   <div><span>Contact <b>{view.contacts}</b></span><span>Slide <b>{view.slides}</b></span>
    <span>Pivot <b>{view.pivots}</b></span>
    <span>BODY A/B <b>{fmt(view.body.A)} / {fmt(view.body.B)}</b></span>
    <span>FLOOR A/B <b>{fmt(view.floor.A)} / {fmt(view.floor.B)}</b></span></div>
  </div>
  <div className="archive-recipes-actions">
   <button type="button" onClick={onReset}>Reset envelope dan riwayat</button>
   <button type="button" onClick={onExport}>Ekspor recipe JSON</button>
  </div>
  <details className="archive-recipes-sim" open={source==='simulation'}>
   <summary>Simulasi event · uji resep tanpa kamera</summary>
   <p>Kontrol berikut hanya memicu envelope pada preview lokal. Tidak menambahkan event ke FloorSession dan tidak dapat menyalakan proyektor fisik.</p>
   {triggers.map(event=><div key={event} className="archive-recipes-cues">
    <strong>{triggerLabel[event]}</strong>
    {(['A','B'] as const).map(slot=>
     <button key={slot} type="button" disabled={!config.enabled||source!=='simulation'}
      onClick={()=>onPreview(event,slot)}>Preview {slot}</button>)}
   </div>)}
  </details>
  <p className="archive-map-caution">Estimasi CONTACT/SLIDE/PIVOT bersumber dari kamera monokular. Pivot dipicu sekali saat kategori gait berubah, agar gerak statis tidak menyalakan efek berulang. Bila tracking atau identitas A/B bermasalah, media recipe masuk Blackout dan event lama dilewati.</p>
 </section>;
}
