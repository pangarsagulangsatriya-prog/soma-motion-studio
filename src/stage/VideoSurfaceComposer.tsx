import {useEffect,useRef,useState,type ChangeEvent,type PointerEvent,type RefObject} from 'react';
import type {Landmark} from '../engine/types.ts';
import type {ReplayAnalysisSnapshot} from './VideoPoseGaitEngine.ts';
import {
 defaultReplayComposition,illustrateFloorPoint,makeReplayLayer,mediaSourceId,
 normalizeReplayComposition,replayEventEnvelope,replayLocalKey,replayPresetsKey,
 replaySurfaces,safeReplayFrame,
 type ReplayComposition,type ReplayLayer,type ReplaySurface,type ReplayRecipe
} from './replaySurfaceLogic.ts';
import './replay-surface-composer.css';

type ArchiveAsset={id:string;name:string;type:'image'|'video';url:string};
type StoredPreset={name:string;composition:ReplayComposition};
type LivePreset={name:string;snapshot:{composition:unknown}};
type Props={
 videoRef:RefObject<HTMLVideoElement|null>;active:boolean;
 snapshot:ReplayAnalysisSnapshot|null;performers:1|2;fileKey:string;
};
const replaySavedKey='soma-s654-replay-presets-v1';
const loadReplay=():ReplayComposition=>{
 try{const saved=JSON.parse(localStorage.getItem(replayLocalKey)||'null');
  return saved?.version===1?normalizeReplayComposition(saved.composition):defaultReplayComposition();
 }catch{return defaultReplayComposition();}
};
const getReplayPresets=():StoredPreset[]=>{
 try{const v=JSON.parse(localStorage.getItem(replaySavedKey)||'[]') as StoredPreset[];
  return Array.isArray(v)?v.filter(p=>typeof p.name==='string'&&p.composition).slice(0,24):[];
 }catch{return [];}
};
const getLivePresets=():LivePreset[]=>{
 try{const v=JSON.parse(localStorage.getItem(replayPresetsKey)||'[]') as LivePreset[];
  return Array.isArray(v)?v.filter(p=>typeof p.name==='string'&&p.snapshot?.composition).slice(0,24):[];
 }catch{return [];}
};
function drawMask(ctx:CanvasRenderingContext2D,landmarks:Landmark[],w:number,h:number){
 const p=(i:number)=>landmarks[i];
 if(landmarks.length<33||![23,24,25,26,27,28,29,30,31,32].every(i=>{
  const a=p(i);return a&&Number.isFinite(a.x)&&Number.isFinite(a.y)&&(a.visibility??1)>.52;
 }))return false;
 const hip=Math.hypot((p(23).x-p(24).x)*w,(p(23).y-p(24).y)*h);
 const width=Math.max(10,Math.min(75,hip*.46));
 ctx.save();ctx.strokeStyle='#fff';ctx.fillStyle='#fff';
 ctx.lineCap='round';ctx.lineJoin='round';
 for(const ids of [[23,25,27,29,31],[24,26,28,30,32]]){
  ctx.beginPath();ids.forEach((idx,j)=>{const a=p(idx);if(j===0)ctx.moveTo(a.x*w,a.y*h);else ctx.lineTo(a.x*w,a.y*h);});
  ctx.lineWidth=width;ctx.stroke();
 }
 const midX=(p(23).x+p(24).x)*w/2,midY=(p(23).y+p(24).y)*h/2;
 ctx.beginPath();ctx.ellipse(midX,midY,Math.max(width,hip*.56),width*.73,0,0,Math.PI*2);ctx.fill();
 ctx.restore();return true;
}
function polygonMask(ctx:CanvasRenderingContext2D,points:[number,number][],w:number,h:number){
 if(points.length<3)return false;
 ctx.beginPath();
 points.forEach(([x,y],i)=>i?ctx.lineTo(x*w,y*h):ctx.moveTo(x*w,y*h));
 ctx.closePath();ctx.fillStyle='#fff';ctx.fill();return true;
}
function drawFloor(ctx:CanvasRenderingContext2D,snap:ReplayAnalysisSnapshot,w:number,h:number,now:number){
 ctx.save();
 ctx.strokeStyle='rgba(181,206,176,.12)';ctx.lineWidth=1;
 for(let x=0;x<=10;x++){ctx.beginPath();ctx.moveTo(w*x/10,0);ctx.lineTo(w*x/10,h);ctx.stroke();}
 for(let y=0;y<=6;y++){ctx.beginPath();ctx.moveTo(0,h*y/6);ctx.lineTo(w,h*y/6);ctx.stroke();}
 const events=snap.events.filter(e=>e.atMs<=now&&e.atMs>=now-6500&&e.confidence>=.55);
 for(const e of events){
  const center=illustrateFloorPoint(e.x,e.y);
  const fade=Math.max(0,1-(now-e.atMs)/6500);
  const px=center.x*w,py=center.y*h;
  ctx.save();ctx.translate(px,py);ctx.rotate(Number.isFinite(e.headingRad)?e.headingRad:0);
  ctx.strokeStyle=e.performer==='A'?'rgba(207,236,174,'+(fade*.75)+')':'rgba(131,211,223,'+(fade*.75)+')';
  ctx.fillStyle=e.performer==='A'?'rgba(207,236,174,'+(fade*.19)+')':'rgba(131,211,223,'+(fade*.19)+')';
  if(e.kind==='contact'){ctx.beginPath();ctx.ellipse(0,0,10,19,e.foot==='left'?-.2:.2,0,Math.PI*2);ctx.fill();ctx.stroke();}
  else if(e.kind==='slide'){
   ctx.beginPath();ctx.moveTo(-18,0);ctx.lineTo(18,0);ctx.stroke();
  }else if(e.kind==='pivot'){
   ctx.beginPath();ctx.arc(0,0,17,-Math.PI*.65,Math.PI*.7);ctx.stroke();
  }else{ctx.beginPath();ctx.arc(0,0,4,0,Math.PI*2);ctx.fill();}
  ctx.restore();
 }
 ctx.restore();
}
export function VideoSurfaceComposer({videoRef,active,snapshot,performers,fileKey}:Props){
 const [composition,setComposition]=useState<ReplayComposition>(loadReplay);
 const [surface,setSurface]=useState<ReplaySurface>('BODY A');
 const [layerIndex,setLayerIndex]=useState(0);
 const [assets,setAssets]=useState<ArchiveAsset[]>([]);
 const [presets,setPresets]=useState<StoredPreset[]>(getReplayPresets);
 const [livePresets,setLivePresets]=useState<LivePreset[]>(getLivePresets);
 const [presetName,setPresetName]=useState('Replay composition');
 const [preview,setPreview]=useState(true);
 const [drawingPolygon,setDrawingPolygon]=useState(false);
 const [notice,setNotice]=useState('Preview eksperimen memakai koordinat video 2D; tidak tersambung ke proyektor.');
 const buffers=useRef(new Map<string,HTMLCanvasElement>());
 const loaded=useRef(new Map<string,HTMLImageElement|HTMLVideoElement>());
 const urls=useRef(new Set<string>());
 const canvases=useRef<Record<ReplaySurface,HTMLCanvasElement|null>>({'BODY A':null,'BODY B':null,FLOOR:null});
 const snapshotRef=useRef(snapshot),compositionRef=useRef(composition),activeRef=useRef(active),previewRef=useRef(preview);
 const surfaceRef=useRef(surface),indexRef=useRef(layerIndex),drawingRef=useRef(drawingPolygon);
 surfaceRef.current=surface;indexRef.current=layerIndex;drawingRef.current=drawingPolygon;
 const performersRef=useRef(performers);
 snapshotRef.current=snapshot;compositionRef.current=composition;activeRef.current=active;
 previewRef.current=preview;performersRef.current=performers;
 const layers=composition[surface],selected=layers[Math.min(layerIndex,layers.length-1)];
 const patch=(fields:Partial<ReplayLayer>)=>{
  setComposition(prev=>({...prev,[surface]:prev[surface].map((value,index)=>index===layerIndex?{...value,...fields}:value)}));
 };
 useEffect(()=>{try{localStorage.setItem(replayLocalKey,JSON.stringify({version:1,composition}));}catch{}},[composition]);
 useEffect(()=>{setPresets(getReplayPresets());setLivePresets(getLivePresets());},[]);
 useEffect(()=>{
  for(const asset of assets){
   if(loaded.current.has(asset.id))continue;
   if(asset.type==='image'){
    const image=new Image();image.src=asset.url;loaded.current.set(asset.id,image);
   }else{
    const video=document.createElement('video');video.src=asset.url;video.loop=true;
    video.muted=true;video.playsInline=true;video.preload='auto';
    loaded.current.set(asset.id,video);void video.play().catch(()=>{});
   }
  }
 },[assets]);
 useEffect(()=>()=>{
  for(const obj of loaded.current.values())if(obj instanceof HTMLVideoElement)obj.pause();
  for(const url of urls.current)URL.revokeObjectURL(url);
  loaded.current.clear();urls.current.clear();
 },[]);
 const upload=(e:ChangeEvent<HTMLInputElement>)=>{
  const files=Array.from(e.target.files??[]).filter(f=>
   (f.type.startsWith('image/')||f.type.startsWith('video/'))&&f.size<=250*1024*1024);
  const newAssets=files.map(f=>{
   const url=URL.createObjectURL(f);urls.current.add(url);
   return {id:crypto.randomUUID(),name:f.name.slice(0,90),
    type:f.type.startsWith('video/')?'video' as const:'image' as const,url};
  });
  setAssets(old=>[...old,...newAssets].slice(0,24));
  if(newAssets.length)patch({assetId:newAssets[0].id});
  if(!newAssets.length)setNotice('Pilih gambar/video dengan ukuran maksimal 250 MB.');
  e.target.value='';
 };
 const findAsset=(id:string):CanvasImageSource|null=>{
  if(id===mediaSourceId)return videoRef.current;
  const source=loaded.current.get(id);
  if(source instanceof HTMLImageElement)return source.complete&&source.naturalWidth?source:null;
  if(source instanceof HTMLVideoElement){
   const master=videoRef.current;
   if(source.readyState<2||!master)return null;
   if(Number.isFinite(source.duration)&&source.duration>0){
    const at=((master.currentTime%source.duration)+source.duration)%source.duration;
    if(Math.abs(at-source.currentTime)>.17){try{source.currentTime=at;}catch{/* decoder seek pending */}}
   }
   if(master.paused&&!source.paused)source.pause();
   else if(!master.paused&&source.paused)void source.play().catch(()=>{});
   return source.readyState>=2?source:null;
  }
  return null;
 };
 const renderSurface=(target:HTMLCanvasElement,s:ReplaySurface)=>{
  const w=target.width,h=target.height,ctx=target.getContext('2d');if(!ctx)return;
  ctx.setTransform(1,0,0,1,0,0);ctx.globalCompositeOperation='source-over';
  ctx.globalAlpha=1;ctx.fillStyle='#070b09';ctx.fillRect(0,0,w,h);
  const video=videoRef.current,snap=snapshotRef.current;
  const currentMs=(video?.currentTime??0)*1000;
  if(!previewRef.current||!video||video.seeking||
   !safeReplayFrame(activeRef.current,snap,currentMs,performersRef.current))return;
  if(!snap)return;
  const id=s==='BODY A'?'A':s==='BODY B'?'B':null;
  const person=id?snap.people.find(p=>p.id===id):null;
  if(id&&!person)return;
  for(const layer of compositionRef.current[s]){
   if(!layer.visible)continue;
   const alpha=replayEventEnvelope(snap.events,s,layer.recipe,currentMs)*layer.opacity/100;
   if(alpha<=0)continue;
   if(s==='FLOOR'&&!layer.assetId){
    ctx.save();ctx.globalAlpha=alpha;
    if(layer.mask==='polygon'&&layer.points.length>=3){
     ctx.beginPath();layer.points.forEach(([x,y],i)=>i?ctx.lineTo(x*w,y*h):ctx.moveTo(x*w,y*h));ctx.closePath();ctx.clip();
    }
    drawFloor(ctx,snap,w,h,currentMs);ctx.restore();continue;
   }
   if(!layer.assetId)continue;
   const media=findAsset(layer.assetId);
   if(!media)continue;
   const cacheKey=s+':'+layer.id;
   let off=buffers.current.get(cacheKey);
   if(!off){off=document.createElement('canvas');buffers.current.set(cacheKey,off);}
   if(off.width!==w)off.width=w;if(off.height!==h)off.height=h;
   const g=off.getContext('2d');if(!g)continue;
   g.setTransform(1,0,0,1,0,0);g.globalCompositeOperation='source-over';g.globalAlpha=1;
   g.clearRect(0,0,w,h);g.save();
   g.translate(w*(.5+layer.x/100),h*(.5+layer.y/100));
   g.rotate(layer.rotation*Math.PI/180);g.scale(layer.scale/100,layer.scale/100);
   try{g.drawImage(media,-w/2,-h/2,w,h);}catch{g.restore();continue;}
   g.restore();
   if(person||layer.mask==='polygon'){
    const mask=document.createElement('canvas');mask.width=w;mask.height=h;
    const maskCtx=mask.getContext('2d');if(!maskCtx)continue;
    if(person&&!drawMask(maskCtx,person.landmarks,w,h))continue;
    if(layer.mask==='polygon'){
     const polygon=document.createElement('canvas');polygon.width=w;polygon.height=h;
     const pg=polygon.getContext('2d');if(!pg||!polygonMask(pg,layer.points,w,h))continue;
     if(person){maskCtx.globalCompositeOperation='destination-in';maskCtx.drawImage(polygon,0,0);}
     else maskCtx.drawImage(polygon,0,0);
     maskCtx.globalCompositeOperation='source-over';
    }
    if(layer.feather>0){
     const smooth=document.createElement('canvas');smooth.width=w;smooth.height=h;
     const sc=smooth.getContext('2d');
     if(sc){sc.filter='blur('+Math.max(0,Math.min(30,layer.feather))+'px)';sc.drawImage(mask,0,0);
      maskCtx.clearRect(0,0,w,h);maskCtx.drawImage(smooth,0,0);}
    }
    g.globalCompositeOperation='destination-in';g.drawImage(mask,0,0);g.globalCompositeOperation='source-over';
   }
   ctx.save();ctx.globalAlpha=alpha;ctx.globalCompositeOperation=layer.blend;
   ctx.drawImage(off,0,0);ctx.restore();
  }
  if(drawingRef.current&&surfaceRef.current===s){
   const layer=compositionRef.current[s][indexRef.current];
   if(layer){
    ctx.save();ctx.lineWidth=2;ctx.strokeStyle='#90f6de';ctx.fillStyle='#c9ffef';
    ctx.beginPath();layer.points.forEach(([x,y],i)=>{
     if(i===0)ctx.moveTo(x*w,y*h);else ctx.lineTo(x*w,y*h);
    });ctx.stroke();
    for(const [x,y] of layer.points){ctx.beginPath();ctx.arc(x*w,y*h,5,0,Math.PI*2);ctx.fill();}
    ctx.restore();
   }
  }
 };
 const editPolygonPoint=(e:PointerEvent<HTMLCanvasElement>,target:ReplaySurface)=>{
  if(!drawingPolygon||target!==surface||selected.points.length>=12)return;
  e.stopPropagation();e.preventDefault();
  const rect=e.currentTarget.getBoundingClientRect();
  const x=Math.max(0,Math.min(1,(e.clientX-rect.left)/rect.width));
  const y=Math.max(0,Math.min(1,(e.clientY-rect.top)/rect.height));
  patch({mask:'polygon',points:[...selected.points,[x,y]]});
 };
 useEffect(()=>{
  let raf=0,last=-1;
  const tick=(now:number)=>{
   raf=requestAnimationFrame(tick);if(now-last<1000/20)return;last=now;
   for(const s of replaySurfaces){const target=canvases.current[s];if(target)renderSurface(target,s);}
  };raf=requestAnimationFrame(tick);
  return()=>cancelAnimationFrame(raf);
 },[]);
 useEffect(()=>{buffers.current.clear();},[fileKey]);
 const add=()=>{
  setComposition(old=>({...old,[surface]:[...old[surface].slice(0,11),makeReplayLayer(surface,crypto.randomUUID())]}));
  setLayerIndex(Math.min(layers.length,11));
 };
 const remove=()=>{
  if(layers.length<=1)return;
  setComposition(old=>({...old,[surface]:old[surface].filter((_,index)=>index!==layerIndex)}));
  setLayerIndex(0);
 };
 const shift=(direction:-1|1)=>{
  const next=layerIndex+direction;
  if(next<0||next>=layers.length)return;
  setComposition(old=>{
   const values=old[surface].slice();
   [values[layerIndex],values[next]]=[values[next],values[layerIndex]];
   return {...old,[surface]:values};
  });
  setLayerIndex(next);
 };
 const savePreset=()=>{
  const name=presetName.trim().slice(0,60);if(!name)return;
  const next=[{name,composition:structuredClone(composition)},...presets.filter(p=>p.name!==name)].slice(0,24);
  try{localStorage.setItem(replaySavedKey,JSON.stringify(next));setPresets(next);setNotice('Preset replay tersimpan lokal. Media perlu dipilih ulang pada sesi browser baru.');}
  catch{setNotice('Gagal menyimpan preset browser.');}
 };
 const importLive=(index:number)=>{
  const preset=livePresets[index];if(!preset)return;
  setComposition(normalizeReplayComposition(preset.snapshot.composition));
  setLayerIndex(0);setNotice('Pengaturan S6.4 dimuat. Sumber media sementara memakai video MP4; arsip bisa dipilih ulang.');
 };
 const useReplayPreset=(index:number)=>{
  const preset=presets[index];if(!preset)return;
  setComposition(normalizeReplayComposition(preset.composition));setLayerIndex(0);
  setNotice('Preset replay dimuat. Media sementara memakai sumber video agar tidak merujuk URL lama.');
 };
 const exportJson=()=>{
  const data={schema:'soma.replay-surface-composition',version:1,
   source:'video-local',coordinateBasis:'illustrative-2d',
   composition,assets:assets.map(({id,name,type})=>({id,name,type})),
   note:'Berkas media tidak disertakan. Output ini bukan proyeksi fisik.'};
  const blob=new Blob([JSON.stringify(data,null,2)],{type:'application/json'});
  const url=URL.createObjectURL(blob);const a=document.createElement('a');
  a.href=url;a.download='SOMA-VIDEO-SURFACE-COMPOSER.json';a.click();
  window.setTimeout(()=>URL.revokeObjectURL(url),1500);
 };
 return <section className="vsc-root" aria-label="Video to BODY and FLOOR Composer">
  <div className="vsc-heading"><div><small>S6.5.4 / REPLAY SURFACE COMPOSER</small>
   <h3>BODY A/B + FLOOR</h3>
   <p>Arsip bergerak mengikuti tubuh dalam video. Pola lantai menunjukkan posisi ilustratif dari event kaki.</p></div>
   <button type="button" onClick={()=>setPreview(v=>!v)}
    aria-pressed={preview}>{preview?'Blackout preview':'Aktifkan preview'}</button>
  </div>
  <div className="vsc-previews">
   {replaySurfaces.map(s=><button type="button" key={s} className={surface===s?'selected':''}
    onClick={()=>{setSurface(s);setLayerIndex(0);setDrawingPolygon(false);}}>
    <span>{s} <small>{composition[s].length} layer</small></span>
    <canvas ref={node=>{canvases.current[s]=node;}} onPointerDown={e=>editPolygonPoint(e,s)}
     width={640} height={360}
     aria-label={'Preview '+s+' dari replay MP4'}/>
   </button>)}
  </div>
  <p className="vsc-state" role="status">{!active?'Aktifkan analisis Pose / Gait terlebih dahulu.':
   !snapshot?'Menunggu frame analisis.':
   snapshot.ambiguous?'Identitas performer tidak stabil. Preview ditahan.':
   snapshot.people.length<performers?'Masukkan semua performer ke dalam video.':
   !preview?'Blackout preview lokal aktif.':'Video replay aktif · koordinat ilustratif 2D.'}</p>
  <div className="vsc-settings">
   <div className="vsc-panel">
    <h4>Media Library</h4>
    <label className="vsc-upload">Import arsip gambar / video
     <input type="file" accept="image/*,video/*" multiple onChange={upload}/></label>
    <small>File tetap di browser, maksimal 250 MB per media.</small>
    <label>Media layer
     <select value={selected?.assetId??''} onChange={e=>patch({assetId:e.target.value})}>
      <option value="">Kosong / hanya footprint</option>
      <option value={mediaSourceId}>Gunakan MP4 sumber gerak</option>
      {assets.map(a=><option key={a.id} value={a.id}>{a.name}</option>)}
     </select>
    </label>
    <h4>Layer Stack — {surface}</h4>
    <div className="vsc-layer-list">
     {layers.map((layer,i)=><button type="button" key={layer.id}
      className={layerIndex===i?'selected':''} onClick={()=>setLayerIndex(i)}>
      {i+1}. {layer.name} {layer.visible?'':'(hidden)'}
     </button>)}
    </div>
    <div className="vsc-actions"><button type="button" disabled={layers.length>=12} onClick={add}>+ Layer</button>
     <button type="button" disabled={layers.length<=1} onClick={remove}>Hapus</button>
     <button type="button" disabled={layerIndex===0} onClick={()=>shift(-1)}>↑</button>
     <button type="button" disabled={layerIndex===layers.length-1} onClick={()=>shift(1)}>↓</button></div>
   </div>
   <div className="vsc-panel">
    <h4>Inspector — {surface}</h4>
    <label>Nama layer <input type="text" maxLength={72} value={selected.name}
     onChange={e=>patch({name:e.target.value})}/></label>
    <label className="vsc-check"><input type="checkbox" checked={selected.visible}
     onChange={e=>patch({visible:e.target.checked})}/> Tampilkan layer</label>
    <label>Effect recipe <select value={selected.recipe}
     onChange={e=>patch({recipe:e.target.value as ReplayRecipe})}>
     <option value="none">Always visible</option>
     <option value="contact-reveal">Contact → Reveal</option>
     <option value="slide-hold">Slide → Hold</option>
     <option value="pivot-decay">Pivot → Decay</option>
    </select></label>
    <label>Mask <select value={selected.mask}
     onChange={e=>patch({mask:e.target.value as ReplayLayer['mask']})}>
     <option value="silhouette">Body approximation</option>
     <option value="polygon">Custom polygon</option>
     <option value="none">None (BODY tetap dibatasi)</option>
    </select></label>
    <div className="vsc-actions">
     <button type="button" aria-pressed={drawingPolygon}
      onClick={()=>{
       if(!drawingPolygon){patch({mask:'polygon',points:[]});setDrawingPolygon(true);}
       else if(selected.points.length>=3)setDrawingPolygon(false);
       else setNotice('Mask polygon memerlukan minimal 3 titik.');
      }}>{drawingPolygon?'Selesai gambar polygon':'Gambar polygon di preview'}</button>
     {drawingPolygon&&<button type="button" onClick={()=>patch({points:[]})}>Hapus titik</button>}
    </div>
    {drawingPolygon&&<small>Klik preview {surface} untuk menambahkan 3–12 titik. Saat memilih preview lain, editor berhenti. Saat ini: {selected.points.length} titik.</small>}
    {(['opacity','scale','x','y','rotation','feather'] as const).map(field=>
     <label key={field}>{field} <input type="number" value={selected[field]}
      step={field==='opacity'?5:1}
      min={field==='opacity'||field==='feather'?0:field==='scale'?20:field==='rotation'?-360:-150}
      max={field==='opacity'?100:field==='scale'?300:field==='feather'?30:field==='rotation'?360:150}
      onChange={e=>patch({[field]:Number(e.target.value)})}/></label>)}
    <label>Blend mode <select value={selected.blend}
     onChange={e=>patch({blend:e.target.value as ReplayLayer['blend']})}>
     <option value="source-over">Normal</option><option value="screen">Screen</option>
     <option value="multiply">Multiply</option><option value="lighter">Add</option>
    </select></label>
   </div>
   <div className="vsc-panel">
    <h4>Presets</h4>
    <label>Nama preset <input value={presetName} onChange={e=>setPresetName(e.target.value)} maxLength={60}/></label>
    <button type="button" onClick={savePreset}>Simpan preset replay</button>
    <label>Muat preset replay <select defaultValue=""
     onChange={e=>{useReplayPreset(Number(e.target.value));e.target.value='';}}>
     <option value="">Pilih preset</option>
     {presets.map((p,i)=><option value={i} key={p.name}>{p.name}</option>)}
    </select></label>
    <label>Impor pengaturan S6.4 <select defaultValue=""
     onChange={e=>{importLive(Number(e.target.value));e.target.value='';}}>
     <option value="">Pilih preset Surface Composer</option>
     {livePresets.map((p,i)=><option value={i} key={p.name}>{p.name}</option>)}
    </select></label>
    <button type="button" onClick={exportJson}>Ekspor JSON</button>
    <p>{notice}</p>
   </div>
  </div>
  <p className="vsc-disclaimer">BODY memakai mask kaki perkiraan dari landmark, bukan segmentasi piksel penuh. FLOOR menempatkan jejak menurut posisi dalam gambar. Tidak ada konversi ke meter, homography, maupun akses output fisik.</p>
 </section>;
}
