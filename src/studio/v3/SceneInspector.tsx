import {useEffect,useId,useState,type KeyboardEvent} from 'react';
import {nextTab} from './interaction';
import {SlidersHorizontal} from 'lucide-react';
import {hydraDefaults} from '../hydraConfig';
import {MaterialControls} from '../MaterialControls';
import {PALETTES,TEXT_STYLES,type Palette} from '../liveVisual';
import {palettes} from '../../footprints/pattern';
import type {FootprintConfig,FootprintStyle} from '../../footprints/StudioFootprints';
import type {Settings} from '../../engine/types';
import type {SceneId} from './ScenePicker';

type Tab='style'|'material'|'response';
export function SceneInspector({scene,settings:s,update,footprint:c,updateFootprint,onAdvanced}:{
 scene:SceneId;settings:Settings;update:(next:Partial<Settings>)=>void;
 footprint:FootprintConfig;updateFootprint:(next:Partial<FootprintConfig>)=>void;onAdvanced:()=>void;
}){
 const [tab,setTab]=useState<Tab>('style');
 const tabId=useId();
 const h={...hydraDefaults(),...s.hydra},isFoot=scene==='footprints';
 const visibleTabs:Tab[]=isFoot?['style','response']:['style','material','response'];
 const tabKeys=(e:KeyboardEvent<HTMLButtonElement>)=>{
  if(!['ArrowLeft','ArrowRight','Home','End'].includes(e.key))return;
  e.preventDefault();
  const next=e.key==='Home'?visibleTabs[0]:e.key==='End'?visibleTabs[visibleTabs.length-1]:nextTab(visibleTabs,tab,e.key==='ArrowRight'?1:-1);
  setTab(next);
  const index=visibleTabs.indexOf(next);
  e.currentTarget.parentElement?.querySelectorAll<HTMLButtonElement>('[role="tab"]')[index]?.focus();
 };
 useEffect(()=>{if(isFoot&&tab==='material')setTab('style');},[isFoot,tab]);
 const changeHydra=(patch:Partial<typeof h>)=>update({hydra:{...h,...patch}});
 const paletteChange=(index:number)=>{const p=palettes[index]??palettes[0];updateFootprint({palette:index,colors:{background:p[1],left:p[2],right:p[3]}});};
 const colorChange=(key:keyof FootprintConfig['colors'],value:string)=>updateFootprint({colors:{...c.colors,[key]:value}});
 return <div className="v3-scene-inspector" aria-label="Pengaturan scene">
  <div className="v3-inspector-title"><div><span>SCENE VISUAL</span><h2>{isFoot?'Footprints':scene==='liquid'?'Teks Cair':scene==='echo'?'Jejak Berulang':scene==='cut'?'Potongan':'Siluet × Teks'}</h2></div><button type="button" aria-label="Pengaturan lanjut" title="Pengaturan lanjut" onClick={onAdvanced}><SlidersHorizontal size={18}/></button></div>
  <div className="v3-inspector-tabs" role="tablist" aria-label="Kategori pengaturan">
   {([['style','Gaya'],['material','Bahan'],['response','Respons']] as const).filter(([id])=>visibleTabs.includes(id)).map(([id,name])=><button key={id} type="button" id={tabId+'-'+id} role="tab" aria-controls={tabId+'-panel'} aria-selected={tab===id} tabIndex={tab===id?0:-1} onKeyDown={tabKeys} onClick={()=>setTab(id)}>{name}</button>)}
  </div>
  <div id={tabId+"-panel"} className="v3-inspector-body" role="tabpanel" aria-labelledby={tabId+"-"+tab}>
   {isFoot&&tab==='material'&&<p>Footprints memakai gerak kaki sebagai sumber pola. Pilih Gaya untuk menyesuaikan tapak.</p>}
   {isFoot&&tab==='style'&&<>
    <span className="v3-setting-heading">BENTUK JEJAK</span>
    <div className="v3-style-options">
     {(['Campuran','Tapak','Garis','Titik'] as FootprintStyle[]).map(style=><button type="button" key={style} aria-pressed={c.style===style} onClick={()=>updateFootprint({style})}><b>{style}</b><small>{style==='Campuran'?'Tapak + garis':style==='Tapak'?'Cetak kaki':style==='Garis'?'Jalur gerak':'Titik gerak'}</small></button>)}
    </div>
    <label className="v3-control-label">Palet<select value={c.palette} onChange={e=>paletteChange(+e.target.value)}>{palettes.map((p,i)=><option key={p[0]} value={i}>{p[0]}</option>)}</select></label>
    <div className="v3-color-triplet">{([['background','Latar'],['left','Kiri'],['right','Kanan']] as const).map(([key,name])=><label key={key}>{name}<input aria-label={'Warna '+name} type="color" value={c.colors[key]} onChange={e=>colorChange(key,e.target.value)}/></label>)}</div>
   </>}
   {isFoot&&tab==='response'&&<>
    <label className="v3-slider">Ukuran tapak <output>{c.size}px</output><input type="range" min="12" max="90" value={c.size} onChange={e=>updateFootprint({size:+e.target.value})}/></label>
    <label className="v3-slider">Umur jejak <output>{c.life} dtk</output><input type="range" min="1" max="60" value={c.life} onChange={e=>updateFootprint({life:+e.target.value})}/></label>
    <label className="v3-slider">Jeda visual <output>{c.delay.toFixed(1)} dtk</output><input type="range" min="0" max="2" step=".1" value={c.delay} onChange={e=>updateFootprint({delay:+e.target.value})}/></label>
    <label className="v3-checkbox"><input type="checkbox" checked={c.showTrail} onChange={e=>updateFootprint({showTrail:e.target.checked})}/> Garis lintasan</label>
    <label className="v3-checkbox"><input type="checkbox" checked={c.showLive} onChange={e=>updateFootprint({showLive:e.target.checked})}/> Tampilkan kaki aktif</label>
    <small>Analisis langkah masih berupa perkiraan webcam. Gait dapat diatur di Advanced.</small>
   </>}
   {!isFoot&&tab==='style'&&<>
    <span className="v3-setting-heading">PALET VISUAL</span>
    <div className="v3-palette-grid">{Object.entries(PALETTES).map(([id,p])=><button type="button" key={id} aria-pressed={h.palette===id} onClick={()=>changeHydra({palette:id as Palette})}><span className="v3-swatch-row">{p.colors.map((x,i)=><i key={i} style={{background:x}}/>)}</span><span>{p.label}</span></button>)}</div>
    <label className="v3-control-label">Perilaku huruf<select value={h.typography} onChange={e=>changeHydra({typography:e.target.value as typeof h.typography})}>{TEXT_STYLES.map(([id,label])=><option key={id} value={id}>{label}</option>)}</select></label>
   </>}
   {!isFoot&&tab==='material'&&<MaterialControls settings={s} update={update}/>}
   {!isFoot&&tab==='response'&&<>
    <label className="v3-slider">Pengaruh gerak <output>{Math.round(h.motion*100)}%</output><input type="range" min="0" max="1" step=".01" value={h.motion} onChange={e=>changeHydra({motion:+e.target.value})}/></label>
    <label className="v3-slider">Kepadatan <output>{Math.round(h.density*100)}%</output><input type="range" min="0" max="1" step=".01" value={h.density} onChange={e=>changeHydra({density:+e.target.value})}/></label>
    <label className="v3-slider">Lama jejak <output>{h.trailLife.toFixed(1)} dtk</output><input type="range" min=".5" max="30" step=".5" value={h.trailLife} onChange={e=>changeHydra({trailLife:+e.target.value})}/></label>
    <label className="v3-control-label">Jejak<select value={h.trails} onChange={e=>changeHydra({trails:e.target.value as typeof h.trails})}><option value="fade">Memudar</option><option value="stack">Menumpuk</option><option value="off">Mati</option></select></label>
   </>}
  </div>
  <div className="v3-inspector-footer"><button type="button" onClick={onAdvanced}><SlidersHorizontal size={16}/> Pengaturan lengkap</button></div>
 </div>;
}
