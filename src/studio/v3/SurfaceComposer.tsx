import {useEffect,useRef,useState} from 'react';
import type {ChangeEvent,PointerEvent} from 'react';
import './SurfaceComposer.css';

type Surface='BODY A'|'BODY B'|'FLOOR';
type Mask='silhouette'|'polygon'|'none';
type Layer={id:string;name:string;mediaId:string;visible:boolean;opacity:number;scale:number;x:number;y:number;rotation:number;blend:GlobalCompositeOperation;mask:Mask;feather:number;points:[number,number][];recipe:string};
type Media={id:string;name:string;kind:'image'|'video';url:string;mime:string};
type Composition=Record<Surface,Layer[]>;
type Snapshot={version:1;composition:Composition;selected:Surface};
const surfaces:Surface[]=['BODY A','BODY B','FLOOR'];
const key='soma-s64-composer-v1';
const presetKey='soma-s64-presets-v1';
const makeLayer=(mediaId='',name='Layer'):Layer=>({id:crypto.randomUUID(),name,mediaId,visible:true,opacity:100,scale:100,x:0,y:0,rotation:0,blend:'source-over',mask:'none',feather:0,points:[[.2,.2],[.8,.2],[.8,.8],[.2,.8]],recipe:'none'});
const initial=():Composition=>({'BODY A':[makeLayer('', 'Body A archive')],'BODY B':[makeLayer('', 'Body B archive')],FLOOR:[makeLayer('', 'Floor path')]});
const valid=(v:unknown):v is Snapshot=>{if(!v||typeof v!=='object')return false;const x=v as Snapshot;return x.version===1&&surfaces.includes(x.selected)&&surfaces.every(s=>Array.isArray(x.composition?.[s])&&x.composition[s].length<=24&&x.composition[s].every(l=>l&&typeof l.id==='string'&&typeof l.name==='string'&&typeof l.mediaId==='string'&&typeof l.opacity==='number'&&typeof l.scale==='number'&&Array.isArray(l.points)));};
type Props={bodyCanvas:React.RefObject<HTMLCanvasElement|null>;floorCanvas:React.RefObject<HTMLCanvasElement|null>;cameraOn:boolean;performerCount:1|2;floorReady:boolean;floorEvents:()=>{id:string;kind:string;performerId:string;timestampMs:number}[];identitySafe:boolean;onClose:()=>void};
export function SurfaceComposer({bodyCanvas,floorCanvas,cameraOn,performerCount,floorReady,floorEvents,identitySafe,onClose}:Props){
 const [selected,setSelected]=useState<Surface>('BODY A');
 const [composition,setComposition]=useState<Composition>(()=>{try{const p=JSON.parse(localStorage.getItem(key)||'null');return valid(p)?p.composition:initial();}catch{return initial();}});
 const [media,setMedia]=useState<Media[]>([]);
 const [selectedLayer,setSelectedLayer]=useState(0);
 const [presets,setPresets]=useState<{name:string;snapshot:Snapshot}[]>(()=>{try{const p=JSON.parse(localStorage.getItem(presetKey)||'[]');return Array.isArray(p)?p.filter(x=>x?.name&&valid(x.snapshot)).slice(0,30):[];}catch{return [];}});
 const [presetName,setPresetName]=useState('New composition');
 const [editMask,setEditMask]=useState(false);
 const [outputOpen,setOutputOpen]=useState(false);
 const [hint,setHint]=useState('');
 const [blackout,setBlackout]=useState(true);
 const [previewLive,setPreviewLive]=useState(true);
 const [testEvent,setTestEvent]=useState<'contact'|'move'|'release'|null>(null);
 const effectClock=useRef(new Map<string,{started:number;kind:string}>());
 const seenEvents=useRef(new Set<string>());
 const surfaceBuffers=useRef(new Map<string,HTMLCanvasElement>());
 const floorEventsRef=useRef(floorEvents);floorEventsRef.current=floorEvents;
 const [eventInfo,setEventInfo]=useState('Belum ada event gerak.');
 
 const canvas=useRef<HTMLCanvasElement>(null);
 const mediaEls=useRef(new Map<string,HTMLImageElement|HTMLVideoElement>());
 const popup=useRef<Window|null>(null);
 const selectedRef=useRef(selected),compositionRef=useRef(composition);
 selectedRef.current=selected;compositionRef.current=composition;
 const layers=composition[selected],layer=layers[selectedLayer]||layers[0];
 const patch=(p:Partial<Layer>)=>setComposition(c=>({...c,[selected]:c[selected].map((l,i)=>i===selectedLayer?{...l,...p}:l)}));
 useEffect(()=>{try{localStorage.setItem(key,JSON.stringify({version:1,selected,composition}));}catch{}},[composition,selected]);
 useEffect(()=>()=>{media.forEach(m=>URL.revokeObjectURL(m.url));},[media]);
 useEffect(()=>{for(const m of media){if(mediaEls.current.has(m.id))continue;if(m.kind==='image'){const img=new Image();img.src=m.url;mediaEls.current.set(m.id,img);}else{const video=document.createElement('video');video.src=m.url;video.loop=true;video.muted=true;video.playsInline=true;void video.play().catch(()=>{});mediaEls.current.set(m.id,video);}}},[media]);
 const upload=(e:ChangeEvent<HTMLInputElement>)=>{const files=Array.from(e.target.files||[]).filter(f=>f.type.startsWith('image/')||f.type.startsWith('video/'));setMedia(old=>[...old,...files.map(f=>({id:crypto.randomUUID(),name:f.name.slice(0,90),kind:f.type.startsWith('video/')?'video' as const:'image' as const,url:URL.createObjectURL(f),mime:f.type}))].slice(0,48));e.target.value='';};
 const render=(ctx:CanvasRenderingContext2D,s:Surface,w:number,h:number)=>{
  ctx.setTransform(1,0,0,1,0,0);ctx.globalCompositeOperation='source-over';ctx.globalAlpha=1;ctx.fillStyle='#000';ctx.fillRect(0,0,w,h);
  if(blackout||!previewLive)return;
  const base=s==='FLOOR'?floorCanvas.current:bodyCanvas.current;
  const validSurface=s==='FLOOR'?floorReady:cameraOn&&(performerCount===1?s==='BODY A':identitySafe&&s==='BODY A');
  // Body A/B separation cannot be derived from a union mask. Fail closed for ambiguous 2-person assignments.
  if(!validSurface)return;
  const now=performance.now();
  for(const l of compositionRef.current[s]||[]){
   if(!l.visible)continue;
   const el=mediaEls.current.get(l.mediaId);
   if(!el||(el instanceof HTMLImageElement?!(el.complete&&el.naturalWidth):el.readyState<2))continue;
   const surfaceKey=s+':'+l.id;
   let layerCanvas=surfaceBuffers.current.get(surfaceKey);
   if(!layerCanvas){layerCanvas=document.createElement('canvas');surfaceBuffers.current.set(surfaceKey,layerCanvas);}
   if(layerCanvas.width!==w)layerCanvas.width=w;if(layerCanvas.height!==h)layerCanvas.height=h;
   const g=layerCanvas.getContext('2d');if(!g)continue;
   g.clearRect(0,0,w,h);
   g.save();g.translate(w*(.5+l.x/100),h*(.5+l.y/100));g.rotate(l.rotation*Math.PI/180);g.scale(l.scale/100,l.scale/100);
   g.drawImage(el,-w/2,-h/2,w,h);g.restore();
   if(l.mask!=='none'){
    const mask=document.createElement('canvas');mask.width=w;mask.height=h;
    const m=mask.getContext('2d');if(!m)continue;
    if(l.mask==='polygon'&&l.points.length>=3){
     m.fillStyle='white';m.beginPath();
     l.points.forEach(([x,y],i)=>i?m.lineTo(x*w,y*h):m.moveTo(x*w,y*h));m.closePath();m.fill();
    }else if(l.mask==='silhouette'&&s!=='FLOOR'&&base){
     m.drawImage(base,0,0,w,h);
     const raw=m.getImageData(0,0,w,h);
     for(let i=0;i<raw.data.length;i+=4){
      const lum=Math.max(raw.data[i],raw.data[i+1],raw.data[i+2]);
      raw.data[i]=255;raw.data[i+1]=255;raw.data[i+2]=255;raw.data[i+3]=lum;
     }
     m.putImageData(raw,0,0);
    }else continue;
    if(l.feather>0){
     const blurred=document.createElement('canvas');blurred.width=w;blurred.height=h;
     const b=blurred.getContext('2d');if(!b)continue;
     b.filter='blur('+Math.min(35,Math.max(0,l.feather))+'px)';
     b.drawImage(mask,0,0);
     m.clearRect(0,0,w,h);
     m.drawImage(blurred,0,0);
    }
    g.globalCompositeOperation='destination-in';g.drawImage(mask,0,0);
    g.globalCompositeOperation='source-over';
   }
   let envelope=1;
   const cue=effectClock.current.get(l.id);
   if(l.recipe!=='none'){
    if(!cue)envelope=0;
    else{
     const age=now-cue.started;
     if(l.recipe==='contact-reveal')envelope=Math.min(1,age/250)*Math.max(0,1-age/3000);
     if(l.recipe==='slide-hold')envelope=age<1500?1:Math.max(0,1-(age-1500)/750);
     if(l.recipe==='pivot-decay')envelope=Math.max(0,1-age/2200);
    }
   }
   ctx.save();ctx.globalAlpha=Math.min(1,Math.max(0,l.opacity/100*envelope));ctx.globalCompositeOperation=l.blend;
   ctx.drawImage(layerCanvas,0,0);ctx.restore();
  }
 };
 useEffect(()=>{let raf=0;const tick=()=>{const c=canvas.current;if(c){const ctx=c.getContext('2d');if(ctx)render(ctx,selectedRef.current,c.width,c.height);}raf=requestAnimationFrame(tick);};raf=requestAnimationFrame(tick);return()=>cancelAnimationFrame(raf);},[]);
 useEffect(()=>{
  if(!previewLive||blackout)return;
  let id=0;
  const tick=()=>{
   const events=floorEventsRef.current();
   for(const event of events.slice(-80)){
    if(seenEvents.current.has(event.id))continue;
    seenEvents.current.add(event.id);
    if(seenEvents.current.size>1000)seenEvents.current.clear();
    const match=event.kind==='contact'?'contact-reveal':event.kind==='move'?'slide-hold':event.kind==='release'?'pivot-decay':null;
    if(match){
     for(const surface of surfaces)for(const layer of compositionRef.current[surface])
      if(layer.recipe===match&&(surface==='FLOOR'||(surface==='BODY A'&&event.performerId==='performer-1')||(surface==='BODY B'&&event.performerId==='B')))
       effectClock.current.set(layer.id,{started:performance.now(),kind:event.kind});
     setEventInfo(event.kind+' · '+event.performerId+' · '+event.id.slice(0,8));
    }
   }
   id=window.setTimeout(tick,85);
  };tick();return()=>clearTimeout(id);
 },[previewLive,blackout]);
 const triggerTest=(kind:'contact'|'move'|'release')=>{
  const recipe=kind==='contact'?'contact-reveal':kind==='move'?'slide-hold':'pivot-decay';
  for(const surface of surfaces)for(const item of compositionRef.current[surface])
   if(item.recipe===recipe)effectClock.current.set(item.id,{started:performance.now(),kind});
  setTestEvent(kind);setEventInfo('SIMULASI '+kind+' (tidak dikirim ke tracking)');
 };
 const points=(e:PointerEvent<HTMLCanvasElement>)=>{if(!editMask||!layer)return;const rect=e.currentTarget.getBoundingClientRect();const x=Math.max(0,Math.min(1,(e.clientX-rect.left)/rect.width));const y=Math.max(0,Math.min(1,(e.clientY-rect.top)/rect.height));const pts=layer.points.slice();let index=pts.findIndex(p=>Math.hypot((p[0]-x)*rect.width,(p[1]-y)*rect.height)<24);if(index<0){if(pts.length>=16)return;pts.push([x,y]);}else pts[index]=[x,y];patch({points:pts,mask:'polygon'});};
 const savePreset=()=>{const name=presetName.trim().slice(0,60);if(!name)return;const next=[{name,snapshot:{version:1 as const,selected,composition:structuredClone(composition)}},...presets.filter(p=>p.name!==name)].slice(0,30);setPresets(next);localStorage.setItem(presetKey,JSON.stringify(next));setHint('Preset tersimpan di perangkat ini.');};
 const exportConfig=()=>{const blob=new Blob([JSON.stringify({version:1,selected,composition},null,2)],{type:'application/json'});const a=document.createElement('a');a.href=URL.createObjectURL(blob);a.download='soma-s64-composition.json';a.click();setTimeout(()=>URL.revokeObjectURL(a.href),1000);};
 const importConfig=async(e:ChangeEvent<HTMLInputElement>)=>{const f=e.target.files?.[0];if(!f)return;try{if(f.size>200000)throw Error('File terlalu besar');const x=JSON.parse(await f.text());if(!valid(x))throw Error('Konfigurasi tidak sesuai');setComposition(x.composition);setSelected(x.selected);setSelectedLayer(0);setHint('Konfigurasi dimuat. File media perlu dipilih lagi pada sesi baru.');}catch(err){setHint(String(err));}e.target.value='';};
 const openPreview=()=>{const win=window.open('','soma-s64-preview','width=960,height=540');if(!win){setHint('Izinkan popup untuk membuka preview.');return;}popup.current=win;win.document.body.style.cssText='margin:0;background:black';const c=win.document.createElement('canvas');c.width=1280;c.height=720;c.style.cssText='width:100vw;height:100vh;object-fit:contain';win.document.body.replaceChildren(c);setOutputOpen(true);};
 useEffect(()=>{if(!outputOpen)return;let raf=0;const tick=()=>{const win=popup.current;if(!win||win.closed){setOutputOpen(false);return;}const c=win.document.querySelector('canvas');const ctx=c?.getContext('2d');if(ctx&&c)render(ctx,selectedRef.current,c.width,c.height);raf=requestAnimationFrame(tick);};raf=requestAnimationFrame(tick);return()=>cancelAnimationFrame(raf);},[outputOpen]);
 return <div className="s64-root" role="region" aria-label="Interactive Surface Composer">
  <div className="s64-heading"><div><small>SOMA / S6.4</small><h2>Interactive Surface Composer</h2><p>Assign media, edit mask, arrange layers. Preview terpisah dari output proyektor fisik; Stage Output QA tetap mengontrol perangkat.</p></div><button onClick={onClose}>Tutup</button></div>
  <div className="s64-safety"><label><input type="checkbox" checked={!blackout} onChange={e=>setBlackout(!e.target.checked)}/> Preview aktif</label><label><input type="checkbox" checked={previewLive} onChange={e=>setPreviewLive(e.target.checked)}/> Live frames</label><button onClick={()=>setBlackout(true)}>BLACKOUT Preview</button><span>{eventInfo}</span></div>
  <div className="s64-layout">
   <aside className="s64-column"><h3>Surface Navigator</h3>{surfaces.map(s=><button key={s} className={selected===s?'active':''} onClick={()=>{setSelected(s);setSelectedLayer(0);}}>{s}<small>{composition[s].length} layer</small></button>)}<h3>Media Library</h3><label className="s64-upload">+ Import image / video<input type="file" multiple accept="image/*,video/*" onChange={upload}/></label><div className="s64-media-list">{media.map(m=><button key={m.id} onClick={()=>patch({mediaId:m.id,name:m.name})}>{m.kind==='image'?<img src={m.url} alt=""/>:<span>VIDEO</span>}<span>{m.name}</span></button>)}</div><small>Media tetap lokal di browser. Pilih ulang berkas setelah reload.</small></aside>
   <section className="s64-center"><div className="s64-stage"><canvas width={960} height={540} ref={canvas} onPointerDown={points} aria-label="Visual preview composer"/>{editMask&&layer?.mask==='polygon'&&<svg viewBox="0 0 960 540" preserveAspectRatio="none">{layer.points.map(([x,y],i)=><circle key={i} cx={x*960} cy={y*540} r="9" fill="#84dacb"/>)}<polygon points={layer.points.map(p=>p[0]*960+','+p[1]*540).join(' ')} fill="#84dacb" fillOpacity=".1" stroke="#84dacb" strokeDasharray="6 5"/></svg>}</div><div className="s64-bar"><span>{selected} · {cameraOn?'Camera connected':'Camera offline'} · {selected==='FLOOR'?(floorReady?'Floor verified':'Floor not ready'):performerCount+' performer(s)'}</span><button onClick={()=>setEditMask(!editMask)}>{editMask?'Selesai edit':'Edit mask'}</button><button onClick={openPreview}>Buka preview terpisah</button></div><div className='s64-test-events'><button onClick={()=>triggerTest('contact')}>Test Contact</button><button onClick={()=>triggerTest('move')}>Test Slide</button><button onClick={()=>triggerTest('release')}>Test Pivot</button><small>{testEvent?'Simulasi terakhir: '+testEvent:''}</small></div><h3>Layer Stack</h3>{layers.map((l,i)=><div className={'s64-layer '+(i===selectedLayer?'active':'')} key={l.id}><button onClick={()=>setSelectedLayer(i)}>{i+1}. {l.name}</button><button onClick={()=>setComposition(c=>({...c,[selected]:c[selected].map((x,j)=>j===i?{...x,visible:!x.visible}:x)}))}>{l.visible?'Visible':'Hidden'}</button><button disabled={i===0} onClick={()=>setComposition(c=>{const a=[...c[selected]];[a[i-1],a[i]]=[a[i],a[i-1]];return {...c,[selected]:a};})}>↑</button><button disabled={i===layers.length-1} onClick={()=>setComposition(c=>{const a=[...c[selected]];[a[i],a[i+1]]=[a[i+1],a[i]];return {...c,[selected]:a};})}>↓</button></div>)}<button onClick={()=>{setComposition(c=>({...c,[selected]:[...c[selected],makeLayer()]}));setSelectedLayer(layers.length);}}>+ Layer</button><button disabled={layers.length<=1} onClick={()=>{setComposition(c=>({...c,[selected]:c[selected].filter((_,i)=>i!==selectedLayer)}));setSelectedLayer(0);}}>Hapus layer</button></section>
   <aside className="s64-column"><h3>Layer Inspector</h3><label>Mask<select value={layer?.mask} onChange={e=>patch({mask:e.target.value as Mask})}><option value="none">None</option><option value="silhouette">Body silhouette</option><option value="polygon">Polygon</option></select></label><label>Opacity <input type="range" min="0" max="100" value={layer?.opacity??100} onChange={e=>patch({opacity:+e.target.value})}/>{layer?.opacity}%</label><label>Scale <input type="range" min="20" max="300" value={layer?.scale??100} onChange={e=>patch({scale:+e.target.value})}/>{layer?.scale}%</label>{(['x','y','rotation','feather'] as const).map(k=><label key={k}>{k}<input type="number" value={layer?.[k]??0} onChange={e=>patch({[k]:+e.target.value})}/></label>)}<label>Blend<select value={layer?.blend} onChange={e=>patch({blend:e.target.value as GlobalCompositeOperation})}><option value="source-over">Normal</option><option value="screen">Screen</option><option value="multiply">Multiply</option><option value="lighter">Add</option></select></label><label>Effect Recipe<select value={layer?.recipe} onChange={e=>patch({recipe:e.target.value})}><option value="none">None</option><option value="contact-reveal">Contact → Reveal</option><option value="slide-hold">Slide → Hold</option><option value="pivot-decay">Pivot → Decay</option></select></label><small>Event kontak dan gerak dibaca dari FloorSession. Slide memakai event move dan Pivot memakai release sebagai fallback sementara, bukan klasifikasi pivot terverifikasi.</small><h3>Preset System</h3><input value={presetName} onChange={e=>setPresetName(e.target.value)} placeholder="Nama preset"/><button onClick={savePreset}>Simpan preset</button><select defaultValue="" onChange={e=>{const p=presets.find(p=>p.name===e.target.value);if(p){setComposition(structuredClone(p.snapshot.composition));setSelected(p.snapshot.selected);setSelectedLayer(0);}}}><option value="">Pilih preset</option>{presets.map(p=><option key={p.name} value={p.name}>{p.name}</option>)}</select><button onClick={exportConfig}>Ekspor JSON</button><label className="s64-upload">Impor JSON<input type="file" accept=".json,application/json" onChange={importConfig}/></label>{hint&&<p role="status">{hint}</p>}</aside>
  </div>
 </div>;
}
