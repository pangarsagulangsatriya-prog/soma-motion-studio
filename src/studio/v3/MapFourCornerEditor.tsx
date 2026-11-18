import {useEffect,useRef,useState,type PointerEvent} from 'react';
import type {Quad} from '../../projection/geometry.ts';
import {moveMapCorner,normalizedPointer,type MapCornerIndex,type MapQuadGroup} from './mapCornerModel.ts';
import './map-r1.css';
type Props={sourceQuad:Quad;projectorQuad:Quad;onCommit:(group:MapQuadGroup,quad:Quad)=>void;};
export function MapFourCornerEditor({sourceQuad,projectorQuad,onCommit}:Props){
 const [group,setGroup]=useState<MapQuadGroup>('projectorQuad');
 const [draft,setDraft]=useState<Quad>(projectorQuad);
 const [dragging,setDragging]=useState<MapCornerIndex|null>(null);
 const [error,setError]=useState('');
 const el=useRef<SVGSVGElement>(null);
 const current=group==='sourceQuad'?sourceQuad:projectorQuad;
 const currentRef=useRef(draft);currentRef.current=draft;
 useEffect(()=>{if(dragging===null)setDraft(current.map(p=>({...p})) as Quad);},[sourceQuad,projectorQuad,group,dragging]);
 const coord=(e:PointerEvent<SVGSVGElement>)=>{
  const rect=e.currentTarget.getBoundingClientRect();
  const svgX=(e.clientX-rect.left)/rect.width*1000,svgY=(e.clientY-rect.top)/rect.height*1000;
  return normalizedPointer(svgX,svgY,1000,1000);
 };
 const move=(e:PointerEvent<SVGSVGElement>)=>{
  if(dragging===null)return;
  const point=coord(e);if(!point)return;
  const next=moveMapCorner(currentRef.current,dragging,point);currentRef.current=next;setDraft(next);
 };
 const finish=(e:PointerEvent<SVGSVGElement>)=>{
  if(dragging===null)return;
  const point=coord(e);
  const next=point?moveMapCorner(currentRef.current,dragging,point):currentRef.current;
  setDragging(null);
  try{onCommit(group,next);setDraft(next);setError('');}catch(err){
   setDraft(current);setError(err instanceof Error?err.message:'Quad tidak valid.');}
  if(e.currentTarget.hasPointerCapture(e.pointerId))e.currentTarget.releasePointerCapture(e.pointerId);
 };
 return <section className="map-r1-editor" aria-label="Editor visual empat titik">
  <header><strong>FOUR-CORNER EDITOR</strong><span>Source UV → Projector UV</span></header>
  <div className="map-r1-switch" role="group" aria-label="Bidang quad">
   {(['sourceQuad','projectorQuad'] as const).map(key=><button type="button" key={key}
    aria-pressed={group===key} onClick={()=>{setDragging(null);setGroup(key);setError('');}}>
    {key==='sourceQuad'?'SOURCE':'PROJECTOR'}</button>)}
  </div>
  <svg ref={el} className="map-r1-quad" viewBox="0 0 1000 1000" role="img"
   aria-label={'Drag titik '+group+' pada preview persegi normalisasi'}
   onPointerMove={move} onPointerUp={finish} onPointerCancel={e=>{
    if(dragging!==null){setDragging(null);setDraft(current);setError('');}
    if(e.currentTarget.hasPointerCapture(e.pointerId))e.currentTarget.releasePointerCapture(e.pointerId);
   }}>
   <rect width="1000" height="1000" fill="#0b1414"/>
   {[.25,.5,.75].map(n=><g key={n} stroke="#364546" strokeWidth="2">
    <line x1={1000*n} y1="0" x2={1000*n} y2="1000"/>
    <line x1="0" y1={1000*n} x2="1000" y2={1000*n}/></g>)}
   <polygon points={draft.map(p=>p.x*1000+','+p.y*1000).join(' ')}
    fill="#71b0a0" fillOpacity=".13" stroke="#b3f1d1" strokeWidth="6" strokeLinejoin="round"/>
   {draft.map((point,index)=><g key={index} transform={'translate('+point.x*1000+','+point.y*1000+')'}>
    <circle r="36" fill="#1d403c" stroke="#d6f4e0" strokeWidth="5"
     style={{cursor:'grab',touchAction:'none'}} onPointerDown={e=>{
      e.stopPropagation();e.preventDefault();
      e.currentTarget.ownerSVGElement?.setPointerCapture(e.pointerId);
      currentRef.current=draft;
      setDragging(index as MapCornerIndex);
    }}/>
    <text textAnchor="middle" dominantBaseline="middle" fill="#effbf0" fontSize="34" pointerEvents="none">{index+1}</text>
   </g>)}
  </svg>
  <p>1 kiri atas · 2 kanan atas · 3 kanan bawah · 4 kiri bawah. Geser titik, lalu lepaskan. Semua perubahan mewajibkan blackout dan QA fisik ulang.</p>
  {error&&<p role="alert">{error}</p>}
  <div className="map-r1-corners">{draft.map((p,i)=><label key={i}>Titik {i+1}
   <span>X {p.x.toFixed(3)} / Y {p.y.toFixed(3)}</span></label>)}</div>
 </section>;
}
