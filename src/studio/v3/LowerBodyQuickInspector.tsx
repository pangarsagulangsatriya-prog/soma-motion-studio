/** Quick Lower-Body Composer Inspector (Mask -> Look -> Style -> 8 Quick Presets).
 *  Designed for < 20s stage operation: calm, visual, zero jargon, Track-matched forest palette. */
import {useState} from 'react';
import {RotateCcw,Save} from 'lucide-react';
import {
 LOWER_BODY_COLOR_CHIPS,
 LOWER_BODY_LOOK_MODES,
 LOWER_BODY_MASK_PRESETS,
 LOWER_BODY_QUICK_PRESETS,
 LOWER_BODY_TEXTURES,
 applyLowerBodyQuickPreset,
 defaultLowerBodyState,
 updateLowerBodyStyle,
 type ComposeMonitorView,
 type LowerBodyComposerState,
 type SavedLowerBodyPreset
} from './composeLowerBodyModel.ts';
import type {SharedAsset} from './sharedAssetModel.ts';

interface Props{
 view:Exclude<ComposeMonitorView,'FLOOR'>;
 state:LowerBodyComposerState;
 onChange:(next:LowerBodyComposerState)=>void;
 savedPresets:readonly SavedLowerBodyPreset[];
 onSavePreset:(name:string)=>void;
 onApplySaved:(preset:SavedLowerBodyPreset)=>void;
 sharedAssets:readonly SharedAsset[];
}

export function LowerBodyQuickInspector({
 view,state,onChange,savedPresets,onSavePreset,onApplySaved,sharedAssets
}:Props){
 const [presetName,setPresetName]=useState('');
 const [saveOpen,setSaveOpen]=useState(false);

 const target:'A'|'B'|'BOTH'=view==='LEG A'?'A':view==='LEG B'?'B':state.activeTarget;
 const activeStyle=target==='B'?state.styleB:state.styleA;
 const isSkeleton=view==='SKELETON';

 const patchStyle=(patch:Parameters<typeof updateLowerBodyStyle>[2])=>{
  onChange(updateLowerBodyStyle(state,target,patch));
 };

 return <section className="lb-quick-inspector" aria-label="Pengaturan cepat lower-body">
  {/* Target A/B selector when viewing SPLIT, FOOT, or SKELETON */}
  {(view==='SPLIT'||view==='FOOT')&&<div className="lb-block">
   <div className="lb-block-head"><strong>Target</strong><span>{target==='BOTH'?'A & B':'Performer '+target}</span></div>
   <div className="lb-chip-row lb-cols-3" role="group" aria-label="Pilih target performer">
    {(['A','B','BOTH'] as const).map(t=><button key={t} type="button"
     aria-pressed={target===t}
     onClick={()=>onChange({...state,activeTarget:t})}>
     {t==='BOTH'?'A + B':'LEG '+t}
    </button>)}
   </div>
  </div>}

  {/* Skeleton Only options */}
  {isSkeleton&&<div className="lb-block">
   <div className="lb-block-head"><strong>Skeleton View</strong><span>{state.skeletonScope==='lower'?'Lower Body':'Full 33-Joint'}</span></div>
   <div className="lb-chip-row lb-cols-2" role="group" aria-label="Cakupan skeleton">
    <button type="button" aria-pressed={state.skeletonScope==='lower'}
     onClick={()=>onChange({...state,skeletonScope:'lower'})}>Lower Body</button>
    <button type="button" aria-pressed={state.skeletonScope==='full'}
     onClick={()=>onChange({...state,skeletonScope:'full'})}>Full 33-Joint</button>
   </div>
   <div className="lb-toggle-row">
    <label><input type="checkbox" checked={state.showCutoffLine}
     onChange={e=>onChange({...state,showCutoffLine:e.target.checked})}/> Garis batas paha</label>
    <label><input type="checkbox" checked={state.showConfidence}
     onChange={e=>onChange({...state,showConfidence:e.target.checked})}/> Confidence A/B</label>
   </div>
  </div>}

  {/* 1) Mask block */}
  <div className="lb-block">
   <div className="lb-block-head">
    <strong>Mask</strong>
    <span>{LOWER_BODY_MASK_PRESETS.find(m=>m.id===state.maskPreset)?.desc}</span>
   </div>
   <div className="lb-chip-row lb-cols-2" role="group" aria-label="Mode mask lower body">
    {LOWER_BODY_MASK_PRESETS.map(item=><button key={item.id} type="button"
     aria-pressed={state.maskPreset===item.id}
     title={item.desc}
     onClick={()=>onChange({...state,maskPreset:item.id})}>
     {item.label}
    </button>)}
   </div>
   {state.maskPreset==='custom'&&<label className="lb-slider">
    <span>Batas Paha · {Math.round(state.customCutoff*100)}%</span>
    <input type="range" min="15" max="65" step="1"
     value={Math.round(state.customCutoff*100)}
     onChange={e=>onChange({...state,customCutoff:Number(e.target.value)/100})}/>
   </label>}
   {!isSkeleton&&<label className="lb-slider">
    <span>Feather · {state.feather} px</span>
    <input type="range" min="0" max="24" step="1" value={state.feather}
     onChange={e=>onChange({...state,feather:Number(e.target.value)})}/>
   </label>}
  </div>

  {/* 2) Look block */}
  {!isSkeleton&&<div className="lb-block">
   <div className="lb-block-head"><strong>Look</strong><span>{LOWER_BODY_LOOK_MODES.find(l=>l.id===state.look)?.label}</span></div>
   <div className="lb-chip-row lb-cols-2" role="group" aria-label="Pilih mode visual kaki">
    {LOWER_BODY_LOOK_MODES.map(mode=><button key={mode.id} type="button"
     aria-pressed={state.look===mode.id}
     onClick={()=>onChange({...state,look:mode.id,activePresetId:'custom'})}>
     {mode.label}
    </button>)}
   </div>
  </div>}

  {/* 3) Style block (Color chips, Opacity, Brightness, Texture / Image) */}
  {!isSkeleton&&<div className="lb-block">
   <div className="lb-block-head">
    <strong>Style</strong>
    <span>{target==='BOTH'?'A & B':'LEG '+target}</span>
   </div>
   <div className="lb-color-row" role="group" aria-label="Pilih warna cepat">
    {LOWER_BODY_COLOR_CHIPS.map(chip=><button key={chip.id} type="button"
     className="lb-color-chip"
     aria-label={'Warna '+chip.label}
     aria-pressed={activeStyle.color.toLowerCase()===chip.hex.toLowerCase()}
     title={chip.label}
     onClick={()=>patchStyle({color:chip.hex})}>
     <span style={{background:chip.hex}} aria-hidden="true"/>
    </button>)}
    <label className="lb-color-picker" title="Warna kustom">
     <input type="color" aria-label="Pilih warna kustom" value={activeStyle.color}
      onChange={e=>patchStyle({color:e.target.value})}/>
    </label>
   </div>

   <div className="lb-sliders-grid">
    <label className="lb-slider">
     <span>Opacity · {Math.round(activeStyle.opacity*100)}%</span>
     <input type="range" min="15" max="100" step="1"
      value={Math.round(activeStyle.opacity*100)}
      onChange={e=>patchStyle({opacity:Number(e.target.value)/100})}/>
    </label>
    <label className="lb-slider">
     <span>Brightness · {Math.round(activeStyle.brightness*100)}%</span>
     <input type="range" min="40" max="155" step="5"
      value={Math.round(activeStyle.brightness*100)}
      onChange={e=>patchStyle({brightness:Number(e.target.value)/100})}/>
    </label>
   </div>

   {state.look==='texture'&&<>
    <div className="lb-chip-row lb-cols-4" role="group" aria-label="Pilih tekstur">
     {LOWER_BODY_TEXTURES.map(tex=><button key={tex.id} type="button"
      aria-pressed={activeStyle.texture===tex.id}
      onClick={()=>patchStyle({texture:tex.id})}>
      {tex.label}
     </button>)}
    </div>
    <label className="lb-slider">
     <span>Skala Tekstur · {Math.round(activeStyle.textureScale*100)}%</span>
     <input type="range" min="40" max="220" step="10"
      value={Math.round(activeStyle.textureScale*100)}
      onChange={e=>patchStyle({textureScale:Number(e.target.value)/100})}/>
    </label>
   </>}

   {state.look==='image'&&<label className="lb-select">
    <span>Arsip / Media Fill</span>
    <select value={activeStyle.mediaId} onChange={e=>patchStyle({mediaId:e.target.value})}>
     <option value="">Archive B/W Bawaan</option>
     {sharedAssets.map(a=><option key={a.id} value={a.id}>{a.name}</option>)}
    </select>
   </label>}
  </div>}

  {/* 4) Quick Presets (8 built-in + custom save/reset) */}
  {!isSkeleton&&<div className="lb-block">
   <div className="lb-block-head">
    <strong>Quick Presets</strong>
    <div className="lb-head-actions">
     <button type="button" className="lb-mini-btn" onClick={()=>setSaveOpen(v=>!v)} title="Simpan preset cepat">
      <Save size={11}/> Simpan
     </button>
     <button type="button" className="lb-mini-btn" onClick={()=>onChange(defaultLowerBodyState())} title="Reset ke default">
      <RotateCcw size={11}/> Reset
     </button>
    </div>
   </div>

   {saveOpen&&<div className="lb-save-row">
    <input type="text" maxLength={36} placeholder="Nama preset (mis. A Merah / B Biru)"
     value={presetName} onChange={e=>setPresetName(e.target.value)}/>
    <button type="button" onClick={()=>{onSavePreset(presetName);setPresetName('');setSaveOpen(false);}}>Simpan</button>
   </div>}

   <div className="lb-preset-grid" role="group" aria-label="Preset cepat lower body">
    {LOWER_BODY_QUICK_PRESETS.map(p=><button key={p.id} type="button"
     className="lb-preset-card"
     aria-pressed={state.activePresetId===p.id}
     onClick={()=>onChange(applyLowerBodyQuickPreset(state,p.id))}>
     <span className="lb-preset-swatch" style={{background:p.swatch}} aria-hidden="true"/>
     <b>{p.name}</b>
     <small>{p.short}</small>
    </button>)}
   </div>

   {savedPresets.length>0&&<div className="lb-saved-list">
    {savedPresets.map(item=><button key={item.id} type="button"
     onClick={()=>onApplySaved(item)}>
     ★ {item.name}
    </button>)}
   </div>}
  </div>}
 </section>;
}
