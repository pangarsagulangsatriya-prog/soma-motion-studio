import {HydraControls} from './studio/HydraControls';
import {MaterialControls} from './studio/MaterialControls';
import './studio/material.css';
import {AudioLines,Sparkles,Layers,ArrowUpRight,Volume2,VolumeX,Settings2,SlidersHorizontal,Save,FolderOpen,Camera,ScanLine,Eye,EyeOff,X} from 'lucide-react';
import {Range} from './components';
import {VisualGlyph} from './VisualStage';
import {CHARACTERS,VISUALS,characterPatch,type Settings,type Character,type VisualStyle,type Target} from './engine/types';
export type ControlTab='sound'|'visual'|'layers';
export function StudioControls({settings:s,update,tab,setTab,openModal,audioOn,muted,toggleAudio,clean,onClose,trackingLatched,toggleTracking,photoControls}:{photoControls?:React.ReactNode;settings:Settings;update:(p:Partial<Settings>)=>void;tab:ControlTab;setTab:(t:ControlTab)=>void;openModal:(s:'settings'|'mapping'|'visual-mapping'|'presets'|'save')=>void;audioOn:boolean;muted:boolean;toggleAudio:()=>void;clean:boolean;onClose:()=>void;trackingLatched:boolean;toggleTracking:()=>void}){
 const macro=(name:keyof Settings['macros'],v:number)=>update({macros:{...s.macros,[name]:v},...(name==='space'?{reverb:v*.85}:{})});
 const mapped=(o:Target)=>s.mappings.some(m=>m.enabled&&m.output===o);
 const selectCharacter=(character:Character)=>{const patch=characterPatch(character);if((character==='raw'||character==='metal')&&!s.mappings.some(m=>m.output==='roughness'))patch.mappings=[...s.mappings,{id:'roughness-motion',input:'speed',output:'roughness',min:.3,max:.95,curve:'linear',invert:false,sensitivity:1,smoothing:.06,threshold:0,enabled:true}];update(patch);};
 return <>
 <div className="controls-heading"><span>ATUR INSTRUMEN</span><div><button className="tool" aria-label="Preset tersimpan" onClick={()=>openModal('presets')}><FolderOpen size={15}/></button><button className="tool" aria-label="Simpan preset" onClick={()=>openModal('save')}><Save size={15}/></button>{clean&&<button className="tool" aria-label="Tutup pengaturan" onClick={onClose}><X size={17}/></button>}</div></div>
 <div className="control-tabs" role="tablist" aria-label="Pengaturan studio">{([['sound','Suara',AudioLines],['visual','Visual',Sparkles],['layers','Lapisan',Layers]] as const).map(([id,label,Icon])=><button key={id} role="tab" aria-selected={tab===id} className={tab===id?'active':''} onClick={()=>setTab(id)}><Icon size={15}/>{label}</button>)}</div>
 <div className="controls-content" role="tabpanel" aria-label={tab==='sound'?'Pengaturan suara':tab==='visual'?'Pengaturan visual':'Pengaturan lapisan'}>
 {tab==='sound'&&<>
  <div className="section-label">KARAKTER <span>{CHARACTERS[s.character].tag}</span></div>
  <div className="character-grid">{Object.entries(CHARACTERS).map(([key,c])=><button key={key} aria-pressed={s.character===key} className={`character-option ${s.character===key?'selected':''}`} onClick={()=>selectCharacter(key as Character)}><span className={`character-mark ${key}`}><i/><i/><i/><i/><i/></span><b>{c.label}</b><span className="selected-indicator"/></button>)}</div>
  <p className="control-caption">{CHARACTERS[s.character].description}</p>
  <div className="macro-controls">{([['roughness','Kekasaran','roughness'],['weight','Berat','weight'],['brightness','Ketajaman','brightness'],['space','Ruang','reverb']] as const).map(([key,label,target])=><div key={key}><Range label={label} value={s.macros[key]} onChange={v=>macro(key,v)}/>{mapped(target)&&<button className="mapping-tag" onClick={()=>openModal('mapping')}><ScanLine size={10}/> Pemetaan gerak aktif <ArrowUpRight size={10}/></button>}</div>)}</div>
  <div className="master-control"><Range label="Master volume" value={s.master} onChange={v=>update({master:v})}/></div>
  <button className="settings-row" onClick={()=>openModal('mapping')}><SlidersHorizontal size={15}/><span>Pemetaan suara<small>{s.mappings.filter(m=>m.enabled).length} hubungan aktif</small></span><ArrowUpRight size={14}/></button>
  <button className="settings-row" onClick={()=>openModal('settings')}><Settings2 size={15}/><span>Sintesis & efek<small>Envelope, bentuk gelombang, tracking</small></span><ArrowUpRight size={14}/></button>
 </>}
 {tab==='visual'&&<>
  {photoControls}
  <HydraControls settings={s} update={update}/>
  <MaterialControls settings={s} update={update}/>
  {!(s.hydra?.enabled??true)&&<>
  <div className="section-label">BENTUK DARI GERAK <button className={`pill-toggle ${s.visual.enabled?'on':''}`} aria-pressed={s.visual.enabled} onClick={()=>update({visual:{...s.visual,enabled:!s.visual.enabled}})}>{s.visual.enabled?'Aktif':'Nonaktif'}</button></div>
  <div className="visual-grid">{Object.entries(VISUALS).map(([key,v])=><button key={key} className={s.visual.style===key?'selected':''} aria-pressed={s.visual.style===key} onClick={()=>update({visual:{...s.visual,style:key as VisualStyle,enabled:true}})}><VisualGlyph style={key}/><span>{v.label}<small>{v.tag.split(' / ')[0]}</small></span></button>)}</div>
  <p className="control-caption">{VISUALS[s.visual.style].description}</p>
  {s.output==='sound'&&<p className="inline-note">Pilih keluaran Visual atau Keduanya untuk menampilkan bentuk.</p>}
  <div className="color-field"><span>Warna garis</span><div>{['#cedf89','#e8e5d9','#d99870','#a3a4d9'].map(color=><button key={color} title={color} aria-label={`Warna visual ${color}`} aria-pressed={s.visual.color===color} className={s.visual.color===color?'selected':''} style={{background:color}} onClick={()=>update({visual:{...s.visual,color}})}/>)}<input aria-label="Warna visual kustom" type="color" value={s.visual.color} onChange={e=>update({visual:{...s.visual,color:e.target.value}})}/></div></div>
  <div className="macro-controls"><Range label="Kepadatan" value={s.visual.density} onChange={v=>update({visual:{...s.visual,density:v}})}/><Range label="Ukuran dasar" value={s.visual.size} onChange={v=>update({visual:{...s.visual,size:v}})}/><Range label="Durasi jejak" min={.3} max={6} step={.1} value={s.visual.life} display={`${s.visual.life.toFixed(1)} s`} onChange={v=>update({visual:{...s.visual,life:v}})}/></div>
  <p className="fine-print">Pemetaan aktif mengambil alih ukuran dan bentangan saat bergerak.</p>
  <button className="settings-row" onClick={()=>openModal('visual-mapping')}><SlidersHorizontal size={15}/><span>Pemetaan visual<small>{s.visual.mappings.filter(m=>m.enabled).length} hubungan aktif</small></span><ArrowUpRight size={14}/></button>
  </>}
 </>}
 {tab==='layers'&&<>
  <div className="section-label">LAPISAN KANVAS <span>INDEPENDEN</span></div>
  <button className="layer-row" aria-pressed={s.layers.camera} onClick={()=>update({layers:{...s.layers,camera:!s.layers.camera}})}><Camera size={17}/><span>Gambar kamera<small>{s.layers.camera?'Tampil di belakang visual':'Tersembunyi · deteksi tetap berjalan'}</small></span>{s.layers.camera?<Eye size={17}/>:<EyeOff size={17}/>}</button>
  <div className="tracking-control"><label>Garis tracking</label><div className="segmented compact">{([['off','Mati'],['detected','Deteksi'],['trigger','Pemicu']] as const).map(([id,label])=><button key={id} aria-pressed={s.layers.tracking===id} className={s.layers.tracking===id?'active':''} onClick={()=>update({layers:{...s.layers,tracking:id}})}>{label}</button>)}</div><p>{s.layers.tracking==='off'?'Pembacaan gerak tetap aktif.':s.layers.tracking==='detected'?'Garis mengikuti titik yang terlihat.':'T atau tombol Tracking menahan garis tampil / tersembunyi.'}</p>{s.layers.tracking==='trigger'&&<><button className="outline-button small" onClick={toggleTracking}><ScanLine size={14}/>{trackingLatched?'Sembunyikan garis':'Tampilkan garis'}<kbd>T</kbd></button><label className="check-field"><input type="checkbox" checked={s.layers.gestureTrigger} disabled={!['hands','mouse'].includes(s.input)} onChange={e=>update({layers:{...s.layers,gestureTrigger:e.target.checked}})}/> Tahan telapak 1,2 detik untuk memicu</label><p className="fine-print">Hands atau simulasi Mouse. Lepaskan telapak sebelum pemicu berikutnya.</p></>}</div>
  <div className="color-field"><span>Latar kanvas</span><div>{['#090c0b','#f1f0e8','#18211d'].map(color=><button key={color} aria-label={`Latar ${color}`} aria-pressed={s.layers.background===color} className={s.layers.background===color?'selected':''} style={{background:color}} onClick={()=>update({layers:{...s.layers,background:color}})}/>)}<input type="color" aria-label="Warna latar kustom" value={s.layers.background} onChange={e=>update({layers:{...s.layers,background:e.target.value}})}/></div></div>
  <label className="check-field mirror-check"><input type="checkbox" checked={s.mirror} onChange={e=>update({mirror:e.target.checked,calibration:null})}/> Cerminkan kamera & garis</label>
  <button className="settings-row" onClick={()=>openModal('settings')}><Settings2 size={15}/><span>Kamera & respons<small>Perangkat, sensitivitas, kalibrasi</small></span><ArrowUpRight size={14}/></button>
 </>}
 </div>
 <div className="controls-audio"><button className={`primary-button ${audioOn&&!muted&&s.output!=='visual'?'audio-enabled':''}`} disabled={s.output==='visual'} onClick={toggleAudio}>{audioOn&&!muted&&s.output!=='visual'?<Volume2 size={16}/>:<VolumeX size={16}/>} {s.output==='visual'?'Keluaran visual saja':muted?'Lanjutkan audio':audioOn?'Audio aktif':'Aktifkan audio'}<span>{audioOn&&!muted&&s.output!=='visual'?'●':'↗'}</span></button><small>{s.output==='visual'?'Gerakkan tubuh untuk memainkan gambar.':'Space untuk mute · visual tetap berjalan'}</small></div>
 </>;
}
