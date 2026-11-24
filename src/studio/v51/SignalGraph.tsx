import {useEffect,useMemo,useRef,useState,type PointerEvent as ReactPointerEvent,type CSSProperties,type ReactNode} from 'react';
import {Camera,Smartphone,Film,Footprints,Activity,Hand,Database,Monitor,Plus,ScanLine,Maximize,Minus,RefreshCw,Move,Link,Image,ChevronDown,Undo2,Redo2,Settings2,LocateFixed,Map as MapIcon,MousePointer2,StickyNote} from 'lucide-react';
import {ROLES,ROLE_NAMES,GRAPH,viewId,portFamily,portInfo,signalFresh,sourceAssignment,relatedEdges,viewportFit,viewportCenter,type Role,type Bindings,type Signals} from './SignalModel.ts';
import type {CueId,PortType} from '../v5/NodeGraphModel.ts';
import {compileCuePlan} from '../v5/NodeGraphModel.ts';
import type {HubCameraRecord} from '../v3/CameraHubRegistry.ts';
import {GROUPS,KEY as VIEW_KEY,loadDocument,frameBounds,groupMove,cueVisual,edgeVisual,type GroupId,type GroupMap} from '../v54/GraphViewModel.ts';
import '../v54/graph-editor.css';
type Point={x:number;y:number};
type Card={id:string;label:string;kind:string;x:number;y:number;w:number;h:number;detail:string;status:string;source?:HubCameraRecord;roles?:Role[]};
type Handle={key:string;type:PortType;direction:'in'|'out';label:string;role?:Role;sourceId?:string};
const W=180,H=66,SOURCE_H=124;
const POS_KEY='soma.signal-layout.v1';
const icons={camera:Camera,phone:Smartphone,media:Film,motion:Activity,gesture:Hand,foot:Footprints,trace:ScanLine,capture:Image,session:Database,output:Monitor,add:Plus};
const clamp=(n:number,min:number,max:number)=>Math.max(min,Math.min(max,n));
const loadPositions=():Record<string,Point>=>{try{const raw=JSON.parse(localStorage.getItem(POS_KEY)||'{}');return Object.fromEntries(Object.entries(raw).filter(([k,v])=>!k.startsWith('source:')&&v&&typeof v==='object'&&Number.isFinite((v as Point).x)&&Number.isFinite((v as Point).y)).map(([k,v])=>[k,{x:clamp((v as Point).x,0,2200),y:clamp((v as Point).y,0,2400)}]));}catch{return {};}};
type Props={editor?:boolean;records:HubCameraRecord[];bindings:Bindings;selected:string;onSelect:(id:string)=>void;onOpen?:(id:string)=>void;onQuick?:(id:string,rect:DOMRect)=>void;minimap?:boolean;onMinimap?:()=>void;next:CueId;running:CueId|null;signals:Signals;now:number;readySources:ReadonlySet<string>;status:Record<string,string>;details:Record<string,string>;preview:(id:string)=>ReactNode;onBind:(role:Role,id:string)=>void;locked:boolean;onNotice:(message:string)=>void};
export function SignalGraph(p:Props){
 const viewport=useRef<HTMLDivElement>(null);
 const [initial]=useState(loadDocument);
 const [positions,setPositions]=useState(()=>p.editor?initial.positions:loadPositions());
 const [groups,setGroups]=useState<GroupMap>(initial.groups);
 const [view,setView]=useState(()=>p.editor&&initial.viewport?initial.viewport:{x:0,y:0,z:1});
 type Snapshot={positions:Record<string,Point>;groups:GroupMap};
 const [history,setHistory]=useState<{past:Snapshot[];future:Snapshot[]}>({past:[],future:[]});
 const [tool,setTool]=useState<'select'|'hand'>('select');
 const [editing,setEditing]=useState<{id:GroupId;field:'title'|'note';value:string}|null>(null);
 const [groupSelected,setGroupSelected]=useState<GroupId|null>(null);
 const groupDrag=useRef<{id:GroupId;start:Point;members:Card[];meta:GroupMap[GroupId];resize:boolean;moved:boolean}|null>(null);
 const panSuppress=useRef(false);
 const [pointer,setPointer]=useState<Point|null>(null);
 const checkpoint=()=>setHistory(h=>({past:[...h.past,{positions,groups}].slice(-(p.editor?50:30)),future:[]}));
 const undo=()=>{const prior=history.past.at(-1);if(!prior)return;setPositions(prior.positions);setGroups(prior.groups);setHistory(h=>({past:h.past.slice(0,-1),future:[{positions,groups},...h.future].slice(0,50)}));setAuto(false);};
 const redo=()=>{const next=history.future[0];if(!next)return;setPositions(next.positions);setGroups(next.groups);setHistory(h=>({past:[...h.past,{positions,groups}].slice(-50),future:h.future.slice(1)}));setAuto(false);};
 const [auto,setAuto]=useState(()=>!p.editor||!initial.viewport),[space,setSpace]=useState(false),[wire,setWire]=useState<string|null>(null),[hover,setHover]=useState<string|null>(null);
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
  return result.map(n=>({...n,...(positions[n.id]??(p.editor&&n.roles?.length?positions[n.roles[0]]:undefined))}));
 },[p.records,p.bindings,p.readySources,p.status,p.details,positions,p.editor]);
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
 const frames=GROUPS.map(id=>({id,...frameBounds(cards,id,groups[id])}));
 const bounds={w:p.editor?Math.max(1,...frames.map(f=>f.x+f.w+20)):Math.max(1108,...cards.map(n=>n.x+n.w+20)),h:p.editor?Math.max(1,...frames.map(f=>f.y+f.h+20)):Math.max(680,...cards.map(n=>n.y+n.h+20))};
 const fit=()=>{setView(p.editor?viewportFit({w:Math.max(100,size.w-48),h:Math.max(100,size.h-48)},bounds):viewportFit(size,bounds));if(p.editor)setView(v=>({...v,x:v.x+42,y:v.y+24}));setAuto(true);};
 const startGroup=(e:ReactPointerEvent<HTMLElement>,id:GroupId,resize=false)=>{if(e.button!==0||tool==='hand'||space)return;e.stopPropagation();e.currentTarget.setPointerCapture(e.pointerId);const f=frames.find(x=>x.id===id)!;groupDrag.current={id,start:{x:e.clientX,y:e.clientY},members:f.members as Card[],meta:groups[id],resize,moved:false};setGroupSelected(id);};
 const moveGroup=(e:ReactPointerEvent<HTMLElement>)=>{const d=groupDrag.current;if(!d)return;const dx=(e.clientX-d.start.x)/view.z,dy=(e.clientY-d.start.y)/view.z;if(!d.moved&&Math.hypot(e.clientX-d.start.x,e.clientY-d.start.y)<4)return;if(!d.moved)checkpoint();d.moved=true;setAuto(false);if(d.resize)setGroups(old=>({...old,[d.id]:{...d.meta,extraW:clamp(d.meta.extraW+dx,0,500),extraH:clamp(d.meta.extraH+dy,0,500)}}));else setPositions(old=>({...old,...groupMove(d.members,dx,dy)}));};
 const endGroup=()=>{groupDrag.current=null;};
 const commitEdit=()=>{if(!editing)return;const value=editing.field==='title'?editing.value.trim().slice(0,60):editing.value.slice(0,240);if((value||editing.field==='note')&&value!==groups[editing.id][editing.field]){checkpoint();setGroups(old=>({...old,[editing.id]:{...old[editing.id],[editing.field]:value}}));}setEditing(null);};
 useEffect(()=>{const element=viewport.current;if(!element)return;const observer=new ResizeObserver(()=>{setSize({w:element.clientWidth,h:element.clientHeight});});observer.observe(element);return()=>observer.disconnect();},[]);
 useEffect(()=>{if(auto)fit();},[size.w,size.h,bounds.w,bounds.h,auto]);
 useEffect(()=>{if(p.editor)return;try{localStorage.setItem(POS_KEY,JSON.stringify(Object.fromEntries(Object.entries(positions).filter(([k])=>!k.startsWith('source:')))));}catch{}},[positions,p.editor]);
 useEffect(()=>{if(!p.editor)return;const timer=setTimeout(()=>{try{const persisted={...positions};for(const role of ROLES){const id=p.bindings[role];if(id&&positions['source:'+id])persisted[role]=positions['source:'+id];}localStorage.setItem(VIEW_KEY,JSON.stringify({schema:'soma.graph-view',version:1,positions:persisted,groups,viewport:view}));}catch{}},250);return()=>clearTimeout(timer);},[positions,groups,view,p.editor,p.bindings]);
 useEffect(()=>{if(!p.editor)return;setHover(null);setGroupSelected(null);setWire(null);setPointer(null);},[p.next,p.editor]);
 useEffect(()=>{const reset=()=>{setSpace(false);pan.current=null;groupDrag.current=null;drag.current=null;};const up=(e:KeyboardEvent)=>{if(e.code==='Space')setSpace(false);};window.addEventListener('blur',reset);window.addEventListener('keyup',up);return()=>{window.removeEventListener('blur',reset);window.removeEventListener('keyup',up);};},[]);
 useEffect(()=>{const element=viewport.current;if(!element)return;const wheel=(e:WheelEvent)=>{if((e.target as HTMLElement).closest('button,input,select,textarea,[contenteditable=true]'))return;e.preventDefault();if(p.editor&&!e.ctrlKey&&!e.metaKey){setAuto(false);const factor=e.deltaMode===1?16:e.deltaMode===2?element.clientHeight:1;setView(v=>({...v,x:v.x-e.deltaX*factor,y:v.y-e.deltaY*factor}));return;}const rect=element.getBoundingClientRect();const x=e.clientX-rect.left,y=e.clientY-rect.top;setAuto(false);setView(v=>{const z=clamp(v.z*Math.exp(-e.deltaY*.0015),.28,2);return {z,x:x-(x-v.x)*z/v.z,y:y-(y-v.y)*z/v.z};});};element.addEventListener('wheel',wheel,{passive:false});return()=>element.removeEventListener('wheel',wheel);},[p.editor]);
 const zoom=(mult:number)=>{setAuto(false);setView(v=>{const z=clamp(v.z*mult,.28,2);return {z,x:size.w/2-(size.w/2-v.x)*z/v.z,y:size.h/2-(size.h/2-v.y)*z/v.z};});};
 const startDrag=(e:ReactPointerEvent<HTMLButtonElement>,c:Card)=>{if(e.button!==0||space||(p.editor&&tool==='hand'))return;e.stopPropagation();e.currentTarget.setPointerCapture(e.pointerId);drag.current={id:c.id,start:{x:e.clientX,y:e.clientY},origin:{x:c.x,y:c.y},moved:false};if(!p.onOpen)p.onSelect(c.source?.id??c.id);};
 const moveDrag=(e:ReactPointerEvent<HTMLButtonElement>)=>{const d=drag.current;if(!d)return;const dx=(e.clientX-d.start.x)/view.z,dy=(e.clientY-d.start.y)/view.z;if(Math.hypot(e.clientX-d.start.x,e.clientY-d.start.y)<4&&!d.moved)return;if(!d.moved)checkpoint();d.moved=true;setAuto(false);setPositions(old=>({...old,[d.id]:{x:clamp(d.origin.x+dx,0,2200),y:clamp(d.origin.y+dy,0,2400)}}));};
 const suppressClick=useRef(false);
 const endDrag=()=>{suppressClick.current=!!drag.current?.moved;drag.current=null;};
 const choosePort=(c:Card,h:Handle)=>{
  if(p.editor&&(tool==='hand'||space))return;
  if(h.sourceId){if(p.locked){p.onNotice('Stop cue sebelum mengubah rute.');return;}setWire(w=>w===h.sourceId?null:h.sourceId!);return;}
  if(h.role&&wire){const result=sourceAssignment(p.bindings,h.role,wire);if(!result.ok){p.onNotice(result.reason);return;}p.onBind(h.role,wire);setWire(null);setPointer(null);return;}
  p.onNotice(h.role?'Pilih port video pada kamera, lalu port ini.':'Rute engine tetap. Ubah sumber kamera dari port video.');
  p.onSelect(c.source?.id??c.id);
 };
 const nextPlan=compileCuePlan(GRAPH,p.next);
 const runningPlan=p.running?compileCuePlan(GRAPH,p.running):null;
 const nextEdges=new Set(nextPlan.edges.map(e=>e.id)),runEdges=new Set(runningPlan?.edges.map(e=>e.id)||[]);
 const selectedView=ROLES.includes(p.selected as Role)?viewId(p.selected,p.bindings):p.records.some(r=>r.id===p.selected)?'source:'+p.selected:p.selected;
 const related=hover||selectedView;
 const highlighted=relatedEdges(related,p.bindings);
 const visual=cueVisual(p.next,p.running,p.bindings);
 const hand=p.editor&&(tool==='hand'||space);
 const focusSelected=()=>{const c=cardById.get(selectedView);if(c){setAuto(false);setView(viewportCenter({x:c.x+c.w/2,y:c.y+c.h/2},size,Math.max(view.z,.75)));}};
 const changeTool=(value:'select'|'hand')=>{setTool(value);setWire(null);setPointer(null);viewport.current?.focus();};
 const wireOrigin=wire&&cardById.has('source:'+wire)?coords('source:'+wire,'source-video','out'):null;
 const pointAt=(clientX:number,clientY:number)=>{const r=viewport.current?.getBoundingClientRect();return r?{x:(clientX-r.left-view.x)/view.z,y:(clientY-r.top-view.y)/view.z}:null;};
 return <div className={'sw-viewport'+(p.editor?' graph-v54':'')+(hand?' hand-mode':'')} data-tool={hand?'hand':'select'} ref={viewport} tabIndex={0} aria-label="Signal graph" onKeyDown={e=>{if(p.editor&&((e.target as HTMLElement).closest('input,textarea,select,[contenteditable=true]')))return;if(p.editor&&!e.ctrlKey&&!e.metaKey){if(e.key.toLowerCase()==='h'){e.preventDefault();changeTool('hand');return;}if(e.key.toLowerCase()==='v'){e.preventDefault();changeTool('select');return;}if(e.shiftKey&&(e.code==='Digit1'||e.code==='Digit2')){e.preventDefault();if(e.code==='Digit1')fit();else focusSelected();return;}}if(e.key===' '&&(e.target===e.currentTarget||p.editor)){e.preventDefault();setSpace(true);}if(e.key==='Escape'){setWire(null);setPointer(null);}if((e.ctrlKey||e.metaKey)&&e.key.toLowerCase()==='z'&&!(e.target as HTMLElement).closest('input,textarea,select')){e.preventDefault();if(e.shiftKey)redo();else undo();}if(e.target===e.currentTarget&&e.key==='+')zoom(1.15);if(e.target===e.currentTarget&&e.key==='-')zoom(1/1.15);}} onKeyUp={e=>{if(e.key===' ')setSpace(false);}} onBlur={()=>setSpace(false)}
 onPointerDownCapture={e=>{if(!p.editor)return;panSuppress.current=false;if(!(hand||e.button===1)||(e.target as HTMLElement).closest('.sw-graph-tools,.v54-tools,.sw-minimap,.sw-wire-hint,input,textarea'))return;if(e.button!==0&&e.button!==1)return;e.preventDefault();e.stopPropagation();e.currentTarget.focus();e.currentTarget.setPointerCapture(e.pointerId);pan.current={start:{x:e.clientX,y:e.clientY},origin:{x:view.x,y:view.y}};panSuppress.current=true;setAuto(false);}}
 onClickCapture={e=>{if(p.editor&&(hand||panSuppress.current)&&!(e.target as HTMLElement).closest('.v54-tools,.sw-graph-tools,.sw-minimap,.sw-wire-hint')){e.preventDefault();e.stopPropagation();panSuppress.current=false;}}}
 onDoubleClickCapture={e=>{if(hand){e.preventDefault();e.stopPropagation();}}}
 onLostPointerCapture={()=>{pan.current=null;}}
 onPointerDown={e=>{if(e.button===1||space||e.target===e.currentTarget||(e.target as HTMLElement).classList.contains('sw-scene')){e.preventDefault();e.currentTarget.setPointerCapture(e.pointerId);pan.current={start:{x:e.clientX,y:e.clientY},origin:{x:view.x,y:view.y}};setAuto(false);}}}
 onDragOver={e=>{if(wire){e.preventDefault();setPointer(pointAt(e.clientX,e.clientY));}}} onPointerMove={e=>{if(wire)setPointer(pointAt(e.clientX,e.clientY));if(pan.current)setView(v=>({...v,x:pan.current!.origin.x+e.clientX-pan.current!.start.x,y:pan.current!.origin.y+e.clientY-pan.current!.start.y}));}} onPointerUp={()=>{pan.current=null;}} onPointerCancel={()=>{pan.current=null;}}>
 {p.editor&&<div className="v54-tools" aria-label="Graph tools"><button title="Select (V)" aria-label="Select tool" aria-pressed={tool==="select"} onClick={()=>changeTool("select")}><MousePointer2 size={17}/></button><button title="Hand (H / Space)" aria-label="Hand tool" aria-pressed={tool==="hand"} onClick={()=>changeTool("hand")}><Hand size={17}/></button></div>}
 <div className="sw-graph-tools"><button title="Zoom out" aria-label="Zoom out" onClick={()=>zoom(1/1.15)}><Minus size={15}/></button><span>{Math.round(view.z*100)}%</span><button title="Zoom in" aria-label="Zoom in" onClick={()=>zoom(1.15)}><Plus size={15}/></button><button title="Fit graph" aria-label="Fit graph" onClick={fit}><Maximize size={15}/></button><button title="Reset layout" aria-label="Reset layout" onClick={()=>{if(p.editor&&!window.confirm("Reset posisi node? Nama dan catatan group tetap tersimpan."))return;checkpoint();setPositions({});setAuto(true);}}><RefreshCw size={14}/></button><button title="Undo layout" aria-label="Undo layout" disabled={!history.past.length} onClick={undo}><Undo2 size={14}/></button><button title="Redo layout" aria-label="Redo layout" disabled={!history.future.length} onClick={redo}><Redo2 size={14}/></button>{p.onOpen&&<><button aria-label="Focus selected node" title="Focus selected node" onClick={focusSelected}><LocateFixed size={14}/></button><button aria-label="Toggle minimap" title="Toggle minimap" aria-pressed={p.minimap!==false} onClick={p.onMinimap}><MapIcon size={14}/></button></>}</div>
 <div className="sw-legend"><span><i className="video"/>Video</span><span><i className="pose"/>Motion</span><span><i className="visual"/>Visual</span><span><i className="session"/>Session</span></div>
 {wire&&<div className="sw-wire-hint" role="status">Pilih port input kamera <button onClick={()=>{setWire(null);setPointer(null);}}>Batal</button></div>}
 <div className={'sw-scene'+(auto?' auto-fit':'')+(view.z<.55?' semantic-compact':'')} style={{width:bounds.w,height:bounds.h,transform:'translate('+view.x+'px,'+view.y+'px) scale('+view.z+')'}}>
 {!p.editor&&[[18,'SOURCES'],[240,'PROCESS'],[684,'SESSION'],[906,'OUTPUT']].map(([x,t])=><span key={t} className="sw-column" style={{left:Number(x),top:8}}>{t}</span>)}
 {p.editor&&frames.map(f=><div key={f.id} data-group={f.id} className={'v54-frame'+(groupSelected===f.id?' selected':'')} style={{left:f.x,top:f.y,width:f.w,height:f.h}}/>)}
 <svg className="sw-wires" width={bounds.w} height={bounds.h} aria-hidden="true">
 {edges.map(e=>{const a=coords(e.a,e.ak,'out'),b=coords(e.b,e.bk,'in'),dx=Math.max(38,Math.abs(b.x-a.x)*.45);const d='M'+a.x+' '+a.y+' C'+(a.x+dx)+' '+a.y+' '+(b.x-dx)+' '+b.y+' '+b.x+' '+b.y;const s=p.signals[e.id],fresh=runEdges.has(e.id)&&signalFresh(s,p.now),focused=highlighted.has(e.id);const stale=cardById.get(e.a)?.status==='stale'||cardById.get(e.b)?.status==='stale',failed=cardById.get(e.a)?.status==='error'||cardById.get(e.b)?.status==='error';const v=edgeVisual(nextEdges.has(e.id),runEdges.has(e.id),fresh,failed||stale||cardById.get(e.b)?.status==='blocked',focused);const cls='sw-edge '+portFamily(e.type)+(failed?' failed':stale?' stale':'')+(nextEdges.has(e.id)?' planned':'')+(p.editor&&runEdges.has(e.id)?' running':'')+((p.editor?v.delivered:fresh)?' delivered':'')+((p.editor?v.focused:focused)?' focused':'')+(p.editor&&v.muted?' muted':'');return <g key={e.id} data-edge={e.id}><path d={d} className={cls}/>{(p.editor?v.delivered:fresh&&!stale&&!failed)&&s.continuous&&<path d={d} className="sw-flow"/>}{(p.editor?v.delivered:fresh&&!stale&&!failed)&&!s.continuous&&<path key={s.seq} d={d} className="sw-pulse"/>}</g>;})}
 {wireOrigin&&pointer&&<path className="sw-pending-wire" d={'M'+wireOrigin.x+' '+wireOrigin.y+' C'+(wireOrigin.x+60)+' '+wireOrigin.y+' '+(pointer.x-60)+' '+pointer.y+' '+pointer.x+' '+pointer.y}/>}
 </svg>
 {cards.map(c=>{const Icon=icons[c.kind as keyof typeof icons]||Activity,selected=selectedView===c.id,relatedCue=nextPlan.nodes.some(n=>viewId(n.id,p.bindings)===c.id),runningCue=visual.runNodes.has(c.id),handles=portLists.get(c.id)||[];return <article key={c.id} data-node={c.id} data-state={c.status} className={'sw-node sw-node-'+c.kind+(selected?' is-selected':'')+(relatedCue?' is-planned':'')+(p.editor&&runningCue?' is-running':'')+(p.editor&&!relatedCue&&!runningCue&&c.id!=='add'?' is-muted':'')+(c.source?' has-source':'')} style={{left:c.x,top:c.y,width:c.w,height:c.h} as CSSProperties} onMouseEnter={()=>setHover(c.id)} onMouseLeave={()=>setHover(null)}>
 <button className="sw-node-title" aria-pressed={selected} title={c.label} onPointerDown={e=>startDrag(e,c)} onPointerMove={moveDrag} onPointerUp={endDrag} onPointerCancel={endDrag} onClick={()=>{if(p.editor&&hand)return;if(p.onOpen&&suppressClick.current){suppressClick.current=false;return;}const id=c.source?.id??c.id;if(c.kind==="add"&&p.onOpen)p.onOpen(id);else p.onSelect(id);}} onDoubleClick={()=>{if(!hand)p.onOpen?.(c.source?.id??c.id);}} onKeyDown={e=>{if(e.key==="Enter"&&p.onOpen){e.preventDefault();p.onOpen(c.source?.id??c.id);return;}if(!['ArrowUp','ArrowDown','ArrowLeft','ArrowRight'].includes(e.key))return;e.preventDefault();const dx=e.key==='ArrowLeft'?-12:e.key==='ArrowRight'?12:0,dy=e.key==='ArrowUp'?-12:e.key==='ArrowDown'?12:0;checkpoint();setAuto(false);setPositions(old=>({...old,[c.id]:{x:clamp(c.x+dx,0,2200),y:clamp(c.y+dy,0,2400)}}));}}>
 <Icon size={15}/><b>{c.label}</b>{c.kind!=='add'&&<i className={'sw-status-dot '+c.status} title={c.status} aria-label={c.status}/>}</button>
 {p.onQuick&&c.kind!=="add"&&<button className="sw-node-settings" aria-label={"Settings "+c.label} title={"Settings "+c.label} onClick={e=>{e.stopPropagation();p.onQuick?.(c.source?.id??c.id,e.currentTarget.getBoundingClientRect());}}><Settings2 size={13}/></button>}
 {c.source?<div className="sw-thumb">{p.preview(c.source.id)}</div>:c.kind==='camera'?<div className="sw-thumb sw-empty-thumb"><Camera size={19}/><small>Belum terhubung</small></div>:null}
 {c.kind!=='add'&&<div className="sw-node-meta"><span>{p.editor&&p.next==='F3B'&&p.running!=='F3A'&&c.id==='capture'?'Saved photos · '+c.detail:c.detail}</span>{c.source&&p.readySources.has(c.source.id)?<small>{Math.round(c.source.fps)} fps</small>:c.source?<small>{c.status==='connecting'?'Connecting':c.status==='error'?'Error':c.status==='stale'?'Stale':'Offline'}</small>:null}</div>}
 {c.id==='session'&&<div className="sw-node-extra">Record · Saved · Replay</div>}
 {c.id==='capture'&&<div className="sw-node-extra">{p.editor&&p.next==='F3B'&&p.running!=='F3A'?'Photo Bank':'Camera + Gesture'}</div>}
 {c.kind==='output'&&<div className="sw-node-extra">Monitor ↗</div>}
 {handles.map(h=>{const pt=coords(c.id,h.key,h.direction);return <button key={h.key} className={'sw-port '+portFamily(h.type)+' '+h.direction+(wire&&h.role?(sourceAssignment(p.bindings,h.role,wire).ok?' compatible':' incompatible'):'')+(wire&&h.sourceId===wire?' picked':'')} style={{top:pt.y-c.y}} title={(h.role?ROLE_NAMES[h.role]+' · ':'')+h.label+' ('+h.type+')'} aria-label={(h.direction==='in'?'Input ':'Output ')+(h.role?ROLE_NAMES[h.role]:c.label+' '+h.label)} draggable={!!h.sourceId&&!p.locked&&!hand} onDragStart={e=>{if(!h.sourceId)return;e.dataTransfer.setData('text/plain',h.sourceId);setWire(h.sourceId);}} onDragEnd={()=>{setWire(null);setPointer(null);}} onDragOver={e=>{if(h.role&&wire&&!p.locked)e.preventDefault();}} onDrop={e=>{e.preventDefault();if(h.role&&wire&&!p.locked){const result=sourceAssignment(p.bindings,h.role,wire);if(result.ok)p.onBind(h.role,wire);else p.onNotice(result.reason);}setWire(null);setPointer(null);}} onClick={()=>choosePort(c,h)}/>;})}
 </article>;})}
 {p.editor&&frames.map(f=><div key={f.id} className="v54-frame-overlay" style={{left:f.x,top:f.y,width:f.w,height:f.h}}>
 <header className="v54-frame-header">
 {editing?.id===f.id&&editing.field==='title'?<input autoFocus aria-label={'Rename '+groups[f.id].title} value={editing.value} maxLength={60} onChange={e=>setEditing({...editing,value:e.target.value})} onBlur={commitEdit} onKeyDown={e=>{if(e.key==='Enter'){e.preventDefault();commitEdit();}}}/>:<button className="v54-group-title" title="Drag group · double-click to rename" aria-label={'Group '+groups[f.id].title} onPointerDown={e=>startGroup(e,f.id)} onPointerMove={moveGroup} onPointerUp={endGroup} onPointerCancel={endGroup} onLostPointerCapture={endGroup} onDoubleClick={()=>{if(!hand)setEditing({id:f.id,field:'title',value:groups[f.id].title});}} onKeyDown={e=>{if(e.key==='Enter'){e.preventDefault();setEditing({id:f.id,field:'title',value:groups[f.id].title});}}}>{groups[f.id].title}</button>}
 <button title="Edit group note" aria-label={'Note '+groups[f.id].title} onClick={()=>{setEditing({id:f.id,field:'note',value:groups[f.id].note});}}><StickyNote size={14}/></button>
 </header>
 {editing?.id===f.id&&editing.field==='note'?<div className="v54-note-editor"><textarea autoFocus aria-label={'Note text '+groups[f.id].title} maxLength={240} value={editing.value} onChange={e=>setEditing({...editing,value:e.target.value})}/><button onClick={commitEdit}>Save</button><button onClick={()=>setEditing(null)}>Cancel</button></div>:groups[f.id].note&&<button className="v54-note" onClick={()=>setEditing({id:f.id,field:'note',value:groups[f.id].note})}>{groups[f.id].note}</button>}
 <button className="v54-frame-resize" aria-label={'Resize '+groups[f.id].title} title="Resize group" onPointerDown={e=>startGroup(e,f.id,true)} onPointerMove={moveGroup} onPointerUp={endGroup} onPointerCancel={endGroup} onLostPointerCapture={endGroup}/>
 </div>)}
 </div>
 {p.minimap!==false&&<button className="sw-minimap" aria-label="Minimap: pindah viewport" title="Klik untuk pindah viewport" onClick={e=>{const r=e.currentTarget.getBoundingClientRect();const x=(e.clientX-r.left)/r.width*bounds.w,y=(e.clientY-r.top)/r.height*bounds.h;setAuto(false);setView(viewportCenter({x,y},size,view.z));}}><svg viewBox={'0 0 '+bounds.w+' '+bounds.h} preserveAspectRatio="none" aria-hidden="true">{cards.map(c=><rect key={c.id} x={c.x} y={c.y} width={c.w} height={c.h} rx={8} fill={c.id===selectedView?'#A7D4A8':'#53665A'}/>)}<rect x={-view.x/view.z} y={-view.y/view.z} width={size.w/view.z} height={size.h/view.z} fill="none" stroke="#D4E8BF" strokeWidth={10}/></svg></button>}
 </div>;
}
