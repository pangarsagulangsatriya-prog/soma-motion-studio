import {useEffect,useMemo,useRef,useState,type PointerEvent as ReactPointerEvent,type CSSProperties,type ReactNode} from 'react';
import {Camera,Smartphone,Film,Footprints,Activity,Hand,Database,Monitor,Plus,ScanLine,Maximize,Minus,RefreshCw,Move,Link,Image,ChevronDown} from 'lucide-react';
import {ROLES,ROLE_NAMES,GRAPH,viewId,portFamily,portInfo,signalFresh,type Role,type Bindings,type Signals} from './SignalModel.ts';
import type {CueId,PortType} from '../v5/NodeGraphModel.ts';
import {compileCuePlan} from '../v5/NodeGraphModel.ts';
import type {HubCameraRecord} from '../v3/CameraHubRegistry.ts';
type Point={x:number;y:number};
type Card={id:string;label:string;kind:string;x:number;y:number;w:number;h:number;detail:string;status:string;source?:HubCameraRecord;roles?:Role[]};
type Handle={key:string;type:PortType;direction:'in'|'out';label:string;role?:Role;sourceId?:string};
const W=180,H=66,SOURCE_H=124;
const POS_KEY='soma.signal-layout.v1';
const icons={camera:Camera,phone:Smartphone,media:Film,motion:Activity,gesture:Hand,foot:Footprints,trace:ScanLine,capture:Image,session:Database,output:Monitor,add:Plus};
const clamp=(n:number,min:number,max:number)=>Math.max(min,Math.min(max,n));
const loadPositions=():Record<string,Point>=>{try{const raw=JSON.parse(localStorage.getItem(POS_KEY)||'{}');return Object.fromEntries(Object.entries(raw).filter(([k,v])=>!k.startsWith('source:')&&v&&typeof v==='object'&&Number.isFinite((v as Point).x)&&Number.isFinite((v as Point).y)).map(([k,v])=>[k,{x:clamp((v as Point).x,0,2200),y:clamp((v as Point).y,0,2400)}]));}catch{return {};}};
type Props={records:HubCameraRecord[];bindings:Bindings;selected:string;onSelect:(id:string)=>void;next:CueId;running:CueId|null;signals:Signals;now:number;readySources:ReadonlySet<string>;status:Record<string,string>;details:Record<string,string>;preview:(id:string)=>ReactNode;onBind:(role:Role,id:string)=>void;locked:boolean;onNotice:(message:string)=>void};
export function SignalGraph(p:Props){
 const viewport=useRef<HTMLDivElement>(null);
 const [positions,setPositions]=useState(loadPositions);
 const [view,setView]=useState({x:0,y:0,z:1});
 const [auto,setAuto]=useState(true),[space,setSpace]=useState(false),[wire,setWire]=useState<string|null>(null),[hover,setHover]=useState<string|null>(null);
 const drag=useRef<{id:string;start:Point;origin:Point;moved:boolean}|null>(null);
 const pan=useRef<{start:Point;origin:Point}|null>(null);
 const [size,setSize]=useState({w:900,h:650});
 const cards=useMemo(()=>{
  const result:Card[]=[];
  const sourceCards:Array<{id:string;label:string;roles:Role[];source?:HubCameraRecord}>=[];
  for(const role of ROLES){const id=p.bindings[role],source=p.records.find(r=>r.id===id);
   if(source){const key='source:'+id;const old=sourceCards.find(n=>n.id===key);if(old)old.roles.push(role);else sourceCards.push({id:key,label:source.name,roles:[role],source});}
   else sourceCards.push({id:role,label:ROLE_NAMES[role],roles:[role]});
  }
  for(const source of p.records)if(!sourceCards.some(n=>n.source?.id===source.id))sourceCards.push({id:'source:'+source.id,label:source.name,source,roles:[]});
  sourceCards.forEach((n,i)=>{const ready=n.source&&p.readySources.has(n.source.id),phase=n.source?.phase;
   result.push({...n,kind:n.source?.kind==='phone'?'phone':'camera',x:18,y:38+i*146,w:W,h:SOURCE_H,
    detail:n.source?(n.roles.map(r=>ROLE_NAMES[r]).join(' / ')||'Belum dirutekan'):'Pilih sumber',
    status:!n.source?'empty':ready?'ready':phase==='connecting'?'connecting':phase==='error'?'error':phase==='live'||phase==='stale'?'stale':'idle'});
  });
  const ay=38+sourceCards.length*146;
  result.push({id:'archive',label:'Archive',kind:'media',x:18,y:ay,w:W,h:H,detail:p.details.archive||'Pilih media',status:p.status.archive||'idle'});
  result.push({id:'add',label:'Tambah kamera',kind:'add',x:18,y:ay+86,w:W,h:42,detail:'',status:'idle'});
  const defs=[['pose','Motion','motion',240,52],['hand','Gesture','gesture',240,326],['foot','Footprint','foot',462,38],['trace','Dual Trace','trace',462,142],['capture','Photo Capture','capture',462,318],['session','Session','session',684,292],['floor','Floor','output',906,40],['canvas','Canvas','output',906,228]] as const;
  defs.forEach(([id,label,kind,x,y])=>result.push({id,label,kind,x,y,w:W,h:id==='session'?106:id==='capture'?102:id==='floor'||id==='canvas'?100:H,detail:p.details[id]||'',status:p.status[id]||'idle'}));
  return result.map(n=>({...n,...positions[n.id]}));
 },[p.records,p.bindings,p.readySources,p.status,p.details,positions]);
 const cardById=new Map(cards.map(n=>[n.id,n]));
 const portLists=new Map<string,Handle[]>();
 const handlesFor=(id:string)=>{if(!portLists.has(id))portLists.set(id,[]);return portLists.get(id)!;};
 const addHandle=(id:string,h:Handle)=>{const list=handlesFor(id);if(!list.some(x=>x.key===h.key))list.push(h);};
 const roleTargets:Record<string,Role>={'pose:video':'cam1','capture:video':'cam2','hand:video':'cam3'};
 const edges=GRAPH.edges.flatMap(e=>{
  const a=viewId(e.from.nodeId,p.bindings),b=viewId(e.to.nodeId,p.bindings);
  if(a===b||!cardById.has(a)||!cardById.has(b))return [];
  const type=portInfo(e.from.nodeId,e.from.port,'outputs');if(!type)return [];
  const source=ROLES.includes(e.from.nodeId as Role);
  const ak=source?'source-video':e.from.nodeId+':'+e.from.port,bk=e.to.nodeId+':'+e.to.port;
  addHandle(a,{key:ak,type,direction:'out',label:source?'Video':e.from.port,sourceId:source?p.bindings[e.from.nodeId as Role]||undefined:undefined});
  addHandle(b,{key:bk,type,direction:'in',label:bk,role:roleTargets[bk]});
  return [{...e,a,b,ak,bk,type}];
 });
 for(const c of cards)if(c.source)addHandle(c.id,{key:'source-video',type:'video',direction:'out',label:'Video',sourceId:c.source.id});
 const coords=(id:string,key:string,direction:'in'|'out')=>{
  const c=cardById.get(id)!;const list=(portLists.get(id)||[]).filter(h=>h.direction===direction);const index=list.findIndex(h=>h.key===key);
  return {x:c.x+(direction==='out'?c.w:0),y:c.y+Math.min(c.h-10,Math.max(18,(index+1)*c.h/(list.length+1)))};
 };
 const bounds={w:Math.max(1108,...cards.map(n=>n.x+n.w+20)),h:Math.max(680,...cards.map(n=>n.y+n.h+20))};
 const fit=()=>{const z=clamp(Math.min((size.w-28)/bounds.w,(size.h-34)/bounds.h),.28,1.15);setView({z,x:(size.w-bounds.w*z)/2,y:(size.h-bounds.h*z)/2});setAuto(true);};
 useEffect(()=>{const element=viewport.current;if(!element)return;const observer=new ResizeObserver(()=>{setSize({w:element.clientWidth,h:element.clientHeight});});observer.observe(element);return()=>observer.disconnect();},[]);
 useEffect(()=>{if(auto)fit();},[size.w,size.h,bounds.w,bounds.h,auto]);
 useEffect(()=>{try{localStorage.setItem(POS_KEY,JSON.stringify(Object.fromEntries(Object.entries(positions).filter(([k])=>!k.startsWith('source:')))));}catch{}},[positions]);
 useEffect(()=>{const element=viewport.current;if(!element)return;const wheel=(e:WheelEvent)=>{if((e.target as HTMLElement).closest('button,input,select'))return;e.preventDefault();const rect=element.getBoundingClientRect();const x=e.clientX-rect.left,y=e.clientY-rect.top;setAuto(false);setView(v=>{const z=clamp(v.z*Math.exp(-e.deltaY*.0015),.28,2);return {z,x:x-(x-v.x)*z/v.z,y:y-(y-v.y)*z/v.z};});};element.addEventListener('wheel',wheel,{passive:false});return()=>element.removeEventListener('wheel',wheel);},[]);
 const zoom=(mult:number)=>{setAuto(false);setView(v=>{const z=clamp(v.z*mult,.28,2);return {z,x:size.w/2-(size.w/2-v.x)*z/v.z,y:size.h/2-(size.h/2-v.y)*z/v.z};});};
 const startDrag=(e:ReactPointerEvent<HTMLButtonElement>,c:Card)=>{if(e.button!==0||space)return;e.stopPropagation();e.currentTarget.setPointerCapture(e.pointerId);drag.current={id:c.id,start:{x:e.clientX,y:e.clientY},origin:{x:c.x,y:c.y},moved:false};p.onSelect(c.source?.id??c.id);};
 const moveDrag=(e:ReactPointerEvent<HTMLButtonElement>)=>{const d=drag.current;if(!d)return;const dx=(e.clientX-d.start.x)/view.z,dy=(e.clientY-d.start.y)/view.z;if(Math.hypot(dx,dy)<4&&!d.moved)return;d.moved=true;setAuto(false);setPositions(old=>({...old,[d.id]:{x:clamp(d.origin.x+dx,0,2200),y:clamp(d.origin.y+dy,0,2400)}}));};
 const endDrag=()=>{drag.current=null;};
 const choosePort=(c:Card,h:Handle)=>{
  if(h.sourceId){if(p.locked){p.onNotice('Stop cue sebelum mengubah rute.');return;}setWire(w=>w===h.sourceId?null:h.sourceId!);return;}
  if(h.role&&wire){p.onBind(h.role,wire);setWire(null);return;}
  p.onNotice(h.role?'Pilih port video pada kamera, lalu port ini.':'Rute engine tetap. Ubah sumber kamera dari port video.');
  p.onSelect(c.source?.id??c.id);
 };
 const nextPlan=compileCuePlan(GRAPH,p.next);
 const runningPlan=p.running?compileCuePlan(GRAPH,p.running):null;
 const nextEdges=new Set(nextPlan.edges.map(e=>e.id)),runEdges=new Set(runningPlan?.edges.map(e=>e.id)||[]);
 const selectedView=ROLES.includes(p.selected as Role)?viewId(p.selected,p.bindings):p.records.some(r=>r.id===p.selected)?'source:'+p.selected:p.selected;
 const related=hover||selectedView;
 return <div className="sw-viewport" ref={viewport} tabIndex={0} aria-label="Signal graph" onKeyDown={e=>{if(e.key===' '&&e.target===e.currentTarget){e.preventDefault();setSpace(true);}if(e.key==='Escape')setWire(null);if(e.target===e.currentTarget&&e.key==='+')zoom(1.15);if(e.target===e.currentTarget&&e.key==='-')zoom(1/1.15);}} onKeyUp={e=>{if(e.key===' ')setSpace(false);}} onBlur={()=>setSpace(false)}
 onPointerDown={e=>{if(e.button===1||space||e.target===e.currentTarget||(e.target as HTMLElement).classList.contains('sw-scene')){e.preventDefault();e.currentTarget.setPointerCapture(e.pointerId);pan.current={start:{x:e.clientX,y:e.clientY},origin:{x:view.x,y:view.y}};setAuto(false);}}}
 onPointerMove={e=>{if(pan.current)setView(v=>({...v,x:pan.current!.origin.x+e.clientX-pan.current!.start.x,y:pan.current!.origin.y+e.clientY-pan.current!.start.y}));}} onPointerUp={()=>{pan.current=null;}} onPointerCancel={()=>{pan.current=null;}}>
 <div className="sw-graph-tools"><button title="Zoom out" aria-label="Zoom out" onClick={()=>zoom(1/1.15)}><Minus size={15}/></button><span>{Math.round(view.z*100)}%</span><button title="Zoom in" aria-label="Zoom in" onClick={()=>zoom(1.15)}><Plus size={15}/></button><button title="Fit graph" aria-label="Fit graph" onClick={fit}><Maximize size={15}/></button><button title="Reset layout" aria-label="Reset layout" onClick={()=>{setPositions({});setAuto(true);}}><RefreshCw size={14}/></button></div>
 <div className="sw-legend"><span><i className="video"/>Video</span><span><i className="pose"/>Motion</span><span><i className="visual"/>Visual</span><span><i className="session"/>Session</span></div>
 {wire&&<div className="sw-wire-hint" role="status">Pilih port input kamera <button onClick={()=>setWire(null)}>Batal</button></div>}
 <div className="sw-scene" style={{width:bounds.w,height:bounds.h,transform:'translate('+view.x+'px,'+view.y+'px) scale('+view.z+')'}}>
 {[[18,'SOURCES'],[240,'PROCESS'],[684,'SESSION'],[906,'OUTPUT']].map(([x,t])=><span key={t} className="sw-column" style={{left:Number(x),top:8}}>{t}</span>)}
 <svg className="sw-wires" width={bounds.w} height={bounds.h} aria-hidden="true">
 {edges.map(e=>{const a=coords(e.a,e.ak,'out'),b=coords(e.b,e.bk,'in'),dx=Math.max(38,Math.abs(b.x-a.x)*.45);const d='M'+a.x+' '+a.y+' C'+(a.x+dx)+' '+a.y+' '+(b.x-dx)+' '+b.y+' '+b.x+' '+b.y;const s=p.signals[e.id],fresh=runEdges.has(e.id)&&signalFresh(s,p.now),focused=e.a===related||e.b===related;const cls='sw-edge '+portFamily(e.type)+(nextEdges.has(e.id)?' planned':'')+(fresh?' delivered':'')+(focused?' focused':'');return <g key={e.id}><path d={d} className={cls}/>{fresh&&s.continuous&&<path d={d} className="sw-flow"/>}{fresh&&!s.continuous&&<path key={s.seq} d={d} className="sw-pulse"/>}</g>;})}
 </svg>
 {cards.map(c=>{const Icon=icons[c.kind as keyof typeof icons]||Activity,selected=selectedView===c.id,relatedCue=nextPlan.nodes.some(n=>viewId(n.id,p.bindings)===c.id),handles=portLists.get(c.id)||[];return <article key={c.id} data-node={c.id} data-state={c.status} className={'sw-node sw-node-'+c.kind+(selected?' is-selected':'')+(relatedCue?' is-planned':'')+(c.source?' has-source':'')} style={{left:c.x,top:c.y,width:c.w,height:c.h} as CSSProperties} onMouseEnter={()=>setHover(c.id)} onMouseLeave={()=>setHover(null)}>
 <button className="sw-node-title" aria-pressed={selected} title={c.label} onPointerDown={e=>startDrag(e,c)} onPointerMove={moveDrag} onPointerUp={endDrag} onPointerCancel={endDrag} onClick={()=>p.onSelect(c.source?.id??c.id)} onKeyDown={e=>{if(!['ArrowUp','ArrowDown','ArrowLeft','ArrowRight'].includes(e.key))return;e.preventDefault();const dx=e.key==='ArrowLeft'?-12:e.key==='ArrowRight'?12:0,dy=e.key==='ArrowUp'?-12:e.key==='ArrowDown'?12:0;setAuto(false);setPositions(old=>({...old,[c.id]:{x:Math.max(0,c.x+dx),y:Math.max(0,c.y+dy)}}));}}>
 <Icon size={15}/><b>{c.label}</b>{c.kind!=='add'&&<i className={'sw-status-dot '+c.status} title={c.status}/>}</button>
 {c.source?<div className="sw-thumb">{p.preview(c.source.id)}</div>:c.kind==='camera'?<div className="sw-thumb sw-empty-thumb"><Camera size={19}/><small>Belum terhubung</small></div>:null}
 {c.kind!=='add'&&<div className="sw-node-meta"><span>{c.detail}</span>{c.source&&p.readySources.has(c.source.id)?<small>{Math.round(c.source.fps)} fps</small>:null}</div>}
 {c.id==='session'&&<div className="sw-node-extra">Record · Saved · Replay</div>}
 {c.id==='capture'&&<div className="sw-node-extra">Camera + Gesture</div>}
 {c.kind==='output'&&<div className="sw-node-extra">Monitor ↗</div>}
 {handles.map(h=>{const pt=coords(c.id,h.key,h.direction);return <button key={h.key} className={'sw-port '+portFamily(h.type)+' '+h.direction+(wire&&h.role?' compatible':'')+(wire&&h.sourceId===wire?' picked':'')} style={{top:pt.y-c.y}} title={(h.role?ROLE_NAMES[h.role]+' · ':'')+h.label+' ('+h.type+')'} aria-label={(h.direction==='in'?'Input ':'Output ')+(h.role?ROLE_NAMES[h.role]:c.label+' '+h.label)} draggable={!!h.sourceId&&!p.locked} onDragStart={e=>{if(!h.sourceId)return;e.dataTransfer.setData('text/plain',h.sourceId);setWire(h.sourceId);}} onDragEnd={()=>setWire(null)} onDragOver={e=>{if(h.role&&wire&&!p.locked)e.preventDefault();}} onDrop={e=>{e.preventDefault();if(h.role&&wire&&!p.locked)p.onBind(h.role,wire);setWire(null);}} onClick={()=>choosePort(c,h)}/>;})}
 </article>;})}
 </div>
 <div className="sw-graph-hint"><Move size={12}/> Tarik node · Space + drag · Scroll zoom</div>
 </div>;
}
