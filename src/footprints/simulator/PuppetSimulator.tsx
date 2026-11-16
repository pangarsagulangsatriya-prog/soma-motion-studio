import {useEffect,useMemo,useRef,useState,type PointerEvent as ReactPointerEvent,type WheelEvent as ReactWheelEvent,type KeyboardEvent as ReactKeyboardEvent} from 'react';
import {Download,Footprints,Move3D,Pause,Play,RotateCcw,X} from 'lucide-react';
import {defaultFloorSpace,type FloorPoint,type FloorSpace} from '../spatial/coordinates.ts';
import {validateFloorSession,type FootSide,type FootstepEvent} from '../spatial/events.ts';
import {drawPuppetScene} from './draw3d.ts';
import {floorArtworkSVG,floorArtworkSummary} from './floor-artwork.ts';
import {DirectPuppetSession,replayPoseAt} from './puppet-controller.ts';
import {clamp,clampOnFloor,hitFoot,initialCamera,project3D,unprojectFloor,type OrbitCamera} from './scene3d.ts';
import './simulator.css';

type Selection={performerId:string;foot:FootSide};
type Drag={pointerId:number;kind:'foot'|'orbit';last:{x:number;y:number};
 which?:Selection;origin?:FloorPoint};
type Playback='edit'|'playing'|'paused';
const startFloor=defaultFloorSpace(8,6);
const stageSizes=[{name:'8 × 6 meter',widthM:8,depthM:6},{name:'6 × 4 meter',widthM:6,depthM:4},{name:'10 × 7 meter',widthM:10,depthM:7}];
function saveBlob(content:Blob,name:string){
 const url=URL.createObjectURL(content),a=document.createElement('a');
 a.href=url;a.download=name;document.body.appendChild(a);a.click();a.remove();
 window.setTimeout(()=>URL.revokeObjectURL(url),30000);
}
export function PuppetSimulator({onClose}:{onClose:()=>void}){
 const dialog=useRef<HTMLDialogElement>(null),canvas=useRef<HTMLCanvasElement>(null);
 const sessionRef=useRef<DirectPuppetSession>(new DirectPuppetSession(startFloor));
 const origin=useRef(0),drag=useRef<Drag|null>(null),fileInput=useRef<HTMLInputElement>(null);
 const [floor,setFloor]=useState<FloorSpace>(startFloor);
 const [camera,setCamera]=useState<OrbitCamera>(initialCamera);
 const [count,setCount]=useState<1|2>(1);
 const [selected,setSelected]=useState<Selection>({performerId:'A',foot:'left'});
 const [version,setVersion]=useState(0),[notice,setNotice]=useState('Klik dan geser kaki untuk membuat satu langkah.');
 const [mode,setMode]=useState<Playback>('edit'),[playhead,setPlayhead]=useState(0);
 const [grid,setGrid]=useState(true);
 const model=sessionRef.current,session=model.session;
 const duration=model.durationMs,displayEvents=mode==='edit'?model.events:model.events.filter(e=>e.timestampMs<=playhead);
 const displayRigs=mode==='edit'?model.performers:replayPoseAt(floor,model.events,playhead);
 const stats=floorArtworkSummary(session);
 const svg=useMemo(()=>floorArtworkSVG({...session,events:displayEvents},{
  width:960,height:720,showGrid:grid
 }),[version,playhead,mode,grid]);
 const refresh=()=>{setVersion(v=>v+1);setMode('edit');setPlayhead(0);};
 const time=()=>performance.now()-origin.current;
 useEffect(()=>{
  origin.current=performance.now();
  dialog.current?.showModal();
  return ()=>{dialog.current?.close();};
 },[]);
 useEffect(()=>{
  if(mode!=='playing')return;
  const begun=performance.now()-playhead;
  let raf=0;
  const tick=(now:number)=>{
   const t=Math.min(duration,now-begun);
   setPlayhead(t);
   if(t>=duration){setMode('paused');return;}
   raf=requestAnimationFrame(tick);
  };
  raf=requestAnimationFrame(tick);
  return ()=>cancelAnimationFrame(raf);
 },[mode,duration]);
 useEffect(()=>{
  const el=canvas.current;if(!el)return;
  const paint=()=>{
   const rect=el.getBoundingClientRect(),w=rect.width,h=rect.height;
   if(w<=0||h<=0)return;
   const dpr=Math.min(2,window.devicePixelRatio||1);
   el.width=Math.max(1,Math.round(w*dpr));el.height=Math.max(1,Math.round(h*dpr));
   const ctx=el.getContext('2d');if(!ctx)return;
   ctx.setTransform(dpr,0,0,dpr,0,0);
   drawPuppetScene(ctx,w,h,floor,camera,displayRigs,count,displayEvents,selected,grid);
  };
  paint();
  const observer=new ResizeObserver(paint);observer.observe(el);
  return ()=>observer.disconnect();
 },[floor,camera,version,count,selected,mode,playhead,grid]);
 const xy=(e:ReactPointerEvent<HTMLCanvasElement>)=>{
  const r=e.currentTarget.getBoundingClientRect();
  return {x:e.clientX-r.left,y:e.clientY-r.top,w:r.width,h:r.height};
 };
 const lift=(which:Selection=selected)=>{
  if(mode!=='edit')setMode('edit');
  if(model.lift(which,time())){refresh();setNotice('Kaki '+(which.foot==='left'?'kiri':'kanan')+' terangkat. Geser, lalu turunkan.');}
 };
 const land=(which:Selection=selected)=>{
  if(model.land(which,time())){refresh();setNotice('Satu jejak kontak dicetak di lantai.');}
 };
 const step=(which:Selection,dx:number,dy:number)=>{
  const foot=model.getFoot(which);if(!foot)return;
  if(foot.heightM<.01)model.lift(which,time());
  const point=clampOnFloor({xM:foot.positionM.xM+dx,yM:foot.positionM.yM+dy},floor);
  model.move(which,point,time());refresh();
 };
 const onPointerDown=(e:ReactPointerEvent<HTMLCanvasElement>)=>{
  if(mode!=='edit'){setMode('edit');setPlayhead(0);}
  const q=xy(e);
  const chosen=hitFoot({x:q.x,y:q.y},model.performers,count,camera,floor,q.w,q.h);
  e.currentTarget.setPointerCapture(e.pointerId);
  if(chosen){
   setSelected(chosen);
   const foot=model.getFoot(chosen);
   drag.current={pointerId:e.pointerId,kind:'foot',which:chosen,
    origin:foot?{...foot.positionM}:undefined,last:{x:q.x,y:q.y}};
   if(foot?.heightM===0)model.lift(chosen,time());
   refresh();
  }else drag.current={pointerId:e.pointerId,kind:'orbit',last:{x:q.x,y:q.y}};
 };
 const onPointerMove=(e:ReactPointerEvent<HTMLCanvasElement>)=>{
  const d=drag.current;if(!d||d.pointerId!==e.pointerId)return;
  const q=xy(e),dx=q.x-d.last.x,dy=q.y-d.last.y;
  if(d.kind==='orbit')setCamera(c=>({
   ...c,yawRad:c.yawRad+dx*.006,
   elevationRad:clamp(c.elevationRad-dy*.006,.25,1.42)
  }));
  else if(d.which){
   const point=unprojectFloor(q,camera,floor,q.w,q.h);
   if(point&&model.move(d.which,point,time()))refresh();
  }
  d.last={x:q.x,y:q.y};
 };
 const onPointerUp=(e:ReactPointerEvent<HTMLCanvasElement>)=>{
  const d=drag.current;if(!d||d.pointerId!==e.pointerId)return;
  if(d.kind==='foot'&&d.which)land(d.which);
  drag.current=null;
  if(e.currentTarget.hasPointerCapture(e.pointerId))e.currentTarget.releasePointerCapture(e.pointerId);
 };
 const onPointerCancel=(e:ReactPointerEvent<HTMLCanvasElement>)=>{
  const d=drag.current;if(!d||d.pointerId!==e.pointerId)return;
  if(d.kind==='foot'&&d.which&&d.origin)model.cancelLift(d.which,d.origin);
  drag.current=null;refresh();
 };
 const onWheel=(e:ReactWheelEvent<HTMLCanvasElement>)=>{
  e.preventDefault();
  setCamera(c=>({...c,distanceM:clamp(c.distanceM*(e.deltaY>0?1.08:.92),7,23)}));
 };
 const onKeyDown=(e:ReactKeyboardEvent<HTMLDialogElement>)=>{
  if((e.target as HTMLElement).closest('button,input,select,textarea'))return;
  const key=e.key.toLowerCase();
  if(key==='1'||key==='2'){e.preventDefault();setSelected(s=>({...s,foot:key==='1'?'left':'right'}));return;}
  if(key==='3'&&count===2){e.preventDefault();setSelected({performerId:'B',foot:'left'});return;}
  if(![' ','w','a','s','d','q','e'].includes(key))return;
  e.preventDefault();e.stopPropagation();
  if(key===' '){const foot=model.getFoot(selected);foot&&foot.heightM>.01?land():lift();return;}
  if(key==='q'||key==='e'){
   if(model.rotate(selected,key==='q'?-Math.PI/12:Math.PI/12,time()))refresh();
   return;
  }
  step(selected,key==='a'?-.16:key==='d'?.16:0,key==='w'?.16:key==='s'?-.16:0);
 };
 const exportJSON=()=>saveBlob(new Blob([JSON.stringify(model.session,null,2)],{type:'application/json'}),'SOMA-FLOOR-SESSION-v3.json');
 const exportSVG=()=>saveBlob(new Blob([floorArtworkSVG(model.session,{showGrid:false})],{type:'image/svg+xml'}),'SOMA-FLOOR-PATTERN.svg');
 const exportPNG=async()=>{
  const image=new Image();
  const uri=URL.createObjectURL(new Blob([floorArtworkSVG(model.session,{showGrid:false})],{type:'image/svg+xml'}));
  try{
   await new Promise<void>((resolve,reject)=>{image.onload=()=>resolve();image.onerror=()=>reject(Error('Gagal membuat PNG'));image.src=uri;});
   const c=document.createElement('canvas');c.width=960;c.height=720;
   const ctx=c.getContext('2d');if(!ctx)throw Error('Canvas ekspor tidak tersedia.');
   ctx.drawImage(image,0,0);
   const blob=await new Promise<Blob>((resolve,reject)=>c.toBlob(b=>b?resolve(b):reject(Error('PNG gagal disimpan')),'image/png'));
   saveBlob(blob,'SOMA-FLOOR-PATTERN.png');
  }catch(err){setNotice(err instanceof Error?err.message:'PNG gagal dibuat.');}
  finally{URL.revokeObjectURL(uri);}
 };
 const onImport=async(file:File)=>{
  try{
   const imported=validateFloorSession(JSON.parse(await file.text()));
   if(model.events.length&&!window.confirm('Buka sesi baru? Jejak sesi saat ini akan diganti.'))return;
   model.importSession(imported);setFloor(imported.floor);setCount(2);
   setCamera(initialCamera());setSelected({performerId:'A',foot:'left'});
   refresh();setNotice('Sesi V3 terbuka. Mode Replay tersedia.');
  }catch(err){setNotice(err instanceof Error?err.message:'Data sesi tidak dapat dibaca.');}
 };
 const changeStage=(value:string)=>{
  const s=stageSizes.find(x=>x.name===value);if(!s)return;
  if(model.events.length&&!window.confirm('Mengganti lantai akan menghapus jejak sesi saat ini. Lanjutkan?'))return;
  const f=defaultFloorSpace(s.widthM,s.depthM);
  model.setFloor(f);setFloor(f);setCamera(initialCamera());
  refresh();setNotice('Lantai simulasi diganti. Belum dikalibrasi ke proyektor fisik.');
 };
 const reset=()=>{
  if(model.events.length&&!window.confirm('Hapus semua jejak sesi simulasi?'))return;
  model.clear();setSelected({performerId:'A',foot:'left'});refresh();setNotice('Sesi simulasi dibersihkan.');
 };
 const play=()=>{
  if(!model.events.length){setNotice('Buat beberapa langkah lebih dulu.');return;}
  if(mode==='playing'){setMode('paused');return;}
  if(mode==='edit')setPlayhead(0);
  setMode('playing');
 };
 return <dialog ref={dialog} className="puppet-dialog" onCancel={e=>{e.preventDefault();onClose();}}
  onKeyDown={onKeyDown} aria-label="Footprints 3D Direct Puppet Simulator">
  <header className="puppet-header">
   <div><span className="puppet-kicker">SOMA / FOOTPRINTS · S5.1</span>
    <h2><Move3D size={21}/> 3D Direct Puppet <small>Tanpa kamera</small></h2></div>
   <button type="button" className="puppet-close" onClick={onClose} aria-label="Tutup simulator"><X size={21}/></button>
  </header>
  <div className="puppet-toolbar">
   <label>AREA LANTAI<select value={stageSizes.find(s=>s.widthM===floor.widthM&&s.depthM===floor.depthM)?.name??''}
    onChange={e=>changeStage(e.target.value)}>{stageSizes.map(s=><option key={s.name}>{s.name}</option>)}</select></label>
   <label>PERFORMER <select value={count} onChange={e=>{const n=+e.target.value as 1|2;setCount(n);if(n===1&&selected.performerId==='B')setSelected({performerId:'A',foot:'left'});}}>
    <option value={1}>1 performer</option><option value={2}>2 performer</option></select></label>
   <label className="puppet-check"><input type="checkbox" checked={grid} onChange={e=>setGrid(e.target.checked)}/> Grid lantai</label>
   <span className="puppet-inline-state">SOURCE: SIMULATION · FLOOR SPACE (METER)</span>
  </div>
  <div className="puppet-layout">
   <section className="puppet-viewport" aria-label="Kontrol tubuh virtual 3D">
    <div className="puppet-view-label"><span>3D LOWER BODY / ORBIT VIEW</span><span>DRAG TO WALK</span></div>
    <canvas ref={canvas} tabIndex={0} aria-label="Kanvas simulator 3D. Klik dan geser telapak kaki untuk melangkah. Geser ruang kosong untuk memutar kamera."
     onPointerDown={onPointerDown} onPointerMove={onPointerMove}
     onPointerUp={onPointerUp} onPointerCancel={onPointerCancel} onWheel={onWheel}/>
    <div className="puppet-view-footer">
     <span>Geser kaki = angkat → pindah → turunkan</span>
     <button type="button" onClick={()=>setCamera(initialCamera())}>Reset sudut pandang</button>
    </div>
   </section>
   <aside className="puppet-side">
    <section className="puppet-floor">
     <div className="puppet-section-title"><Footprints size={17}/><b>FLOOR PREVIEW</b><span>{stats.contacts} jejak</span></div>
     <div className="puppet-floor-svg" dangerouslySetInnerHTML={{__html:svg}} aria-label="Pratinjau dua dimensi jejak kaki di lantai"/>
     <p>Bidang hitam = lantai virtual. Jejak muncul saat kaki turun.</p>
    </section>
    <section className="puppet-controls">
     <div className="puppet-section-title"><b>DIRECT PUPPET</b><span>{selected.performerId} · {selected.foot==='left'?'Kiri':'Kanan'}</span></div>
     <div className="puppet-foot-pick">
      {model.performers.slice(0,count).flatMap(p=>(['left','right'] as const).map(foot=>
       <button key={p.id+foot} type="button" aria-pressed={selected.performerId===p.id&&selected.foot===foot}
        onClick={()=>setSelected({performerId:p.id,foot})}>{p.id} · {foot==='left'?'Kaki kiri':'Kaki kanan'}</button>))}
     </div>
     <div className="puppet-step-buttons">
      <button type="button" disabled={!!model.getFoot(selected)?.heightM} onClick={()=>lift()}>Angkat</button>
      <button type="button" disabled={!model.getFoot(selected)?.heightM} onClick={()=>land()} className="puppet-accent">Turunkan · cetak jejak</button>
     </div>
     <div className="puppet-step-grid">
      <button type="button" onClick={()=>step(selected,0,.16)}>↑</button>
      <button type="button" onClick={()=>step(selected,-.16,0)}>←</button>
      <button type="button" onClick={()=>step(selected,0,-.16)}>↓</button>
      <button type="button" onClick={()=>step(selected,.16,0)}>→</button>
     </div>
     <div className="puppet-step-buttons">
      <button type="button" onClick={()=>{model.rotate(selected,-Math.PI/12,time());refresh();}}>Putar −15°</button>
      <button type="button" onClick={()=>{model.rotate(selected,Math.PI/12,time());refresh();}}>Putar +15°</button>
     </div>
     <div className="puppet-readout">
      {(()=>{const foot=model.getFoot(selected);return foot
       ?`X ${foot.positionM.xM.toFixed(2)}m · Y ${foot.positionM.yM.toFixed(2)}m · Z ${foot.heightM.toFixed(2)}m`
       :'Pilih kaki';})()}
     </div>
     <p className="puppet-key-hint">Keyboard: <kbd>1</kbd> kiri <kbd>2</kbd> kanan · <kbd>Space</kbd> angkat/turun · <kbd>WASD</kbd> geser · <kbd>Q/E</kbd> putar</p>
    </section>
    <section className="puppet-session">
     <div className="puppet-section-title"><b>SESSION / REPLAY</b><span>{model.events.length} event</span></div>
     <div className="puppet-step-buttons">
      <button type="button" onClick={play} disabled={!model.events.length}>{mode==='playing'?<Pause size={16}/>:<Play size={16}/>} {mode==='playing'?'Jeda':'Putar ulang'}</button>
      <button type="button" onClick={()=>{setMode('edit');setPlayhead(0);}}>Edit langsung</button>
      <button type="button" onClick={reset}><RotateCcw size={15}/> Bersihkan</button>
     </div>
     {mode!=='edit'&&<label className="puppet-timeline">Timeline
      <input type="range" min={0} max={Math.max(1,duration)} value={Math.min(duration,playhead)}
       onChange={e=>{setMode('paused');setPlayhead(+e.target.value);}}/>
      <output>{Math.round(playhead)} / {Math.round(duration)} ms</output>
     </label>}
     <div className="puppet-export">
      <button type="button" disabled={!model.events.length} onClick={exportJSON}><Download size={15}/> JSON</button>
      <button type="button" disabled={stats.contacts===0} onClick={exportSVG}>SVG</button>
      <button type="button" disabled={stats.contacts===0} onClick={()=>void exportPNG()}>PNG</button>
      <button type="button" onClick={()=>fileInput.current?.click()}>Buka sesi</button>
     </div>
     <input ref={fileInput} hidden type="file" accept=".json,application/json"
      onChange={e=>{const f=e.target.files?.[0];if(f)void onImport(f);e.target.value='';}}/>
     <p>Ekspor JSON menyimpan event kaki dalam meter. SVG/PNG hanya menampilkan jejak pada lantai virtual.</p>
    </section>
   </aside>
  </div>
  <footer className="puppet-footer"><span role="status">{notice}</span>
   <span>3D SOFTWARE RENDER · CAMERA OFF · PROJECTOR DISCONNECTED</span></footer>
 </dialog>;
}
