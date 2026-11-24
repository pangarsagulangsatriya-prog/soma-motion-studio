import {useEffect,useRef,useState,type ReactNode,type RefObject,type PointerEvent as RP} from 'react';
import {Pin,PinOff,X,GripHorizontal,Maximize2} from 'lucide-react';
import {clampPanel,type Rect,type Mode} from './AdaptiveModel.ts';
export function AdaptiveInspector({mode,title,rect,onRect,onClose,onDock,canDock,graph,children}:{mode:Mode;title:string;rect:Rect;onRect:(r:Rect)=>void;onClose:()=>void;onDock:()=>void;canDock:boolean;graph:RefObject<HTMLElement|null>;children:ReactNode}){
 const [size,setSize]=useState({w:900,h:650});
 const [draft,setDraft]=useState<Rect|null>(null);
 const latest=useRef<Rect|null>(null);
 const drag=useRef<{origin:Rect;x:number;y:number;resize:boolean;id:number}|null>(null);
 useEffect(()=>{const e=graph.current;if(!e)return;const update=()=>setSize({w:e.clientWidth,h:e.clientHeight});const ro=new ResizeObserver(update);ro.observe(e);update();return()=>ro.disconnect();},[graph]);
 const box=clampPanel(draft??rect,size.w,size.h);
 const begin=(e:RP<HTMLElement>,resize:boolean)=>{if(mode!=='floating'||e.button!==0)return;e.preventDefault();e.currentTarget.setPointerCapture(e.pointerId);drag.current={origin:box,x:e.clientX,y:e.clientY,resize,id:e.pointerId};latest.current=null;};
 const move=(e:RP<HTMLElement>)=>{const d=drag.current;if(!d||d.id!==e.pointerId)return;const dx=e.clientX-d.x,dy=e.clientY-d.y;const r=clampPanel(d.resize?{...d.origin,width:d.origin.width+dx,height:d.origin.height+dy}:{...d.origin,x:d.origin.x+dx,y:d.origin.y+dy},size.w,size.h);latest.current=r;setDraft(r);};
 const finish=()=>{if(!drag.current)return;if(latest.current)onRect(latest.current);drag.current=null;latest.current=null;setDraft(null);};
 return <section className={'sw-inspector adaptive-inspector '+mode} aria-label="Inspector" hidden={mode==='closed'} style={mode==='docked'?undefined:{left:box.x,top:box.y,width:box.width,height:box.height}} data-mode={mode}>
  <header className="adaptive-panel-header"><div className="adaptive-panel-grip" onPointerDown={e=>begin(e,false)} onPointerMove={move} onPointerUp={finish} onPointerCancel={finish} onLostPointerCapture={finish} tabIndex={0} aria-label="Move inspector with arrow keys" onKeyDown={e=>{if(mode!=='floating'||!e.key.startsWith('Arrow'))return;e.preventDefault();onRect(clampPanel({...box,x:box.x+(e.key==='ArrowRight'?20:e.key==='ArrowLeft'?-20:0),y:box.y+(e.key==='ArrowDown'?20:e.key==='ArrowUp'?-20:0)},size.w,size.h));}}><GripHorizontal size={15}/><b>{title}</b></div>
   <button disabled={!canDock} title={canDock?(mode==='docked'?'Undock inspector':'Dock inspector'):'Layar terlalu sempit untuk dock'} aria-label={mode==='docked'?'Undock inspector':'Dock inspector'} onClick={onDock}>{mode==='docked'?<PinOff size={15}/>:<Pin size={15}/>}</button>
   <button title="Close inspector" aria-label="Close inspector" onClick={onClose}><X size={16}/></button>
  </header>
  <div className="sw-inspector-body">{children}</div>
  {mode==='floating'&&<button className="adaptive-resize" title="Resize inspector (arrow keys)" aria-label="Resize inspector" onPointerDown={e=>begin(e,true)} onPointerMove={move} onPointerUp={finish} onPointerCancel={finish} onLostPointerCapture={finish} onKeyDown={e=>{if(!e.key.startsWith('Arrow'))return;e.preventDefault();onRect(clampPanel({...box,width:box.width+(e.key==='ArrowRight'?20:e.key==='ArrowLeft'?-20:0),height:box.height+(e.key==='ArrowDown'?20:e.key==='ArrowUp'?-20:0)},size.w,size.h));}}><Maximize2 size={13}/></button>}
 </section>;
}
