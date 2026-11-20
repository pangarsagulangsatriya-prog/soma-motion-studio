import {useEffect,useRef,useState,type KeyboardEvent,type PointerEvent,type RefObject} from 'react';
import {RotateCcw} from 'lucide-react';
import type {Quad} from '../../projection/geometry.ts';
import {moveMapCorner,normalizedPointer,type MapCornerIndex,type MapQuadGroup} from './mapCornerModel.ts';
import './map-r1.css';

export type AlignmentOverlay='grid'|'crosshair'|'checker'|'off';
const CORNER_TAGS=['TL','TR','BR','BL'] as const;
const CORNER_NAMES=['Kiri Atas','Kanan Atas','Kanan Bawah','Kiri Bawah'] as const;

type Props={
 sourceQuad:Quad;
 projectorQuad:Quad;
 onCommit:(group:MapQuadGroup,quad:Quad)=>void;
 onReset?:(group:MapQuadGroup)=>void;
 previewCanvas?:RefObject<HTMLCanvasElement|null>;
};

export function MapFourCornerEditor({sourceQuad,projectorQuad,onCommit,onReset,previewCanvas}:Props){
 const [group,setGroup]=useState<MapQuadGroup>('projectorQuad');
 const [draft,setDraft]=useState<Quad>(projectorQuad);
 const [dragging,setDragging]=useState<MapCornerIndex|null>(null);
 const [selectedCorner,setSelectedCorner]=useState<MapCornerIndex>(0);
 const [overlay,setOverlay]=useState<AlignmentOverlay>('grid');
 const [error,setError]=useState('');
 const el=useRef<SVGSVGElement>(null);
 const backdropRef=useRef<HTMLCanvasElement>(null);
 const current=group==='sourceQuad'?sourceQuad:projectorQuad;
 const currentRef=useRef(draft);currentRef.current=draft;

 useEffect(()=>{if(dragging===null)setDraft(current.map(p=>({...p})) as Quad);},[sourceQuad,projectorQuad,group,dragging]);

 // Mirror live FLOOR/BODY raster onto the warp canvas backdrop (~15 fps) so operators align against real imagery.
 useEffect(()=>{
  const target=backdropRef.current;
  if(!target||!previewCanvas)return;
  const ctx=target.getContext('2d');
  if(!ctx)return;
  let timer=0;
  const paint=()=>{
   const src=previewCanvas.current;
   ctx.clearRect(0,0,target.width,target.height);
   ctx.fillStyle='#08100c';
   ctx.fillRect(0,0,target.width,target.height);
   if(src&&src.width>0&&src.height>0){
    ctx.save();
    ctx.globalAlpha=0.78;
    ctx.drawImage(src,0,0,target.width,target.height);
    ctx.restore();
   }
  };
  paint();
  timer=window.setInterval(paint,66);
  return()=>window.clearInterval(timer);
 },[previewCanvas]);

 const commitQuad=(next:Quad)=>{
  try{onCommit(group,next);setDraft(next);setError('');}
  catch(err){setDraft(current);setError(err instanceof Error?err.message:'Quad tidak valid.');}
 };

 const PAD=55,SPAN=1000+PAD*2;
 const coord=(e:PointerEvent<SVGSVGElement>)=>{
  const rect=e.currentTarget.getBoundingClientRect();
  const svgX=(e.clientX-rect.left)/rect.width*SPAN-PAD;
  const svgY=(e.clientY-rect.top)/rect.height*SPAN-PAD;
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
  commitQuad(next);
  if(e.currentTarget.hasPointerCapture(e.pointerId))e.currentTarget.releasePointerCapture(e.pointerId);
 };

 const handleKeyNudge=(e:KeyboardEvent<SVGSVGElement|HTMLButtonElement>)=>{
  const step=e.shiftKey?0.015:0.002;
  let dx=0,dy=0;
  if(e.key==='ArrowLeft')dx=-step;
  else if(e.key==='ArrowRight')dx=step;
  else if(e.key==='ArrowUp')dy=-step;
  else if(e.key==='ArrowDown')dy=step;
  else if(e.key>='1'&&e.key<='4'){
   e.preventDefault();
   setSelectedCorner((Number(e.key)-1) as MapCornerIndex);
   return;
  }else return;
  e.preventDefault();
  const p=currentRef.current[selectedCorner];
  const next=moveMapCorner(currentRef.current,selectedCorner,{x:p.x+dx,y:p.y+dy});
  currentRef.current=next;
  commitQuad(next);
 };

 const cx=(draft[0].x+draft[1].x+draft[2].x+draft[3].x)*250;
 const cy=(draft[0].y+draft[1].y+draft[2].y+draft[3].y)*250;

 return <section className="map-r1-editor" aria-label="Editor visual empat titik">
  <header>
   <div className="map-r1-title">
    <strong>WARP 4 SUDUT</strong>
    <span>{group==='projectorQuad'?'Target Proyektor UV':'Bidang Sumber UV'}</span>
   </div>
   {onReset&&<button type="button" className="map-r1-reset"
    onClick={()=>{setDragging(null);setError('');onReset(group);}}
    title="Kembalikan empat sudut ke persegi penuh (0–1)">
    <RotateCcw size={12}/> Reset Quad
   </button>}
  </header>

  <div className="map-r1-toolbar">
   <div className="map-r1-switch" role="group" aria-label="Bidang quad">
    {(['projectorQuad','sourceQuad'] as const).map(key=><button type="button" key={key}
     aria-pressed={group===key} onClick={()=>{setDragging(null);setGroup(key);setError('');}}>
     {key==='sourceQuad'?'SOURCE':'PROJECTOR'}</button>)}
   </div>
   <div className="map-r1-overlay-switch" role="group" aria-label="Pola bantu kalibrasi">
    {([['grid','Grid'],['crosshair','Cross'],['checker','Catur'],['off','Off']] as const).map(([id,label])=>
     <button type="button" key={id} aria-pressed={overlay===id} onClick={()=>setOverlay(id)}>{label}</button>)}
   </div>
  </div>

  <div className="map-r1-stage">
   <canvas ref={backdropRef} width={512} height={512} className="map-r1-backdrop" aria-hidden="true"/>
   <svg ref={el} className="map-r1-quad" viewBox="-55 -55 1110 1110" role="img" tabIndex={0}
    aria-label={'Drag titik '+group+' pada preview persegi normalisasi, atau gunakan panah keyboard untuk geser presisi'}
    onKeyDown={handleKeyNudge}
    onPointerMove={move} onPointerUp={finish} onPointerCancel={e=>{
     if(dragging!==null){setDragging(null);setDraft(current);setError('');}
     if(e.currentTarget.hasPointerCapture(e.pointerId))e.currentTarget.releasePointerCapture(e.pointerId);
    }}>
    <rect x="0" y="0" width="1000" height="1000" fill="none" stroke="#3c5546" strokeWidth="2.5"/>
    {overlay==='checker'&&<g fill="#d6ead7" fillOpacity=".14">
     {Array.from({length:64},(_,k)=>{
      const r=Math.floor(k/8),c=k%8;
      return (r+c)%2===0?<rect key={k} x={c*125} y={r*125} width={125} height={125}/>:null;
     })}
    </g>}
    {overlay==='grid'&&<>
     {[.125,.375,.625,.875].map(n=><g key={'f'+n} stroke="#3c5446" strokeOpacity=".45" strokeWidth="1.5">
      <line x1={1000*n} y1="0" x2={1000*n} y2="1000"/>
      <line x1="0" y1={1000*n} x2="1000" y2={1000*n}/></g>)}
     {[.25,.5,.75].map(n=><g key={'m'+n} stroke="#5d7f6a" strokeOpacity=".65" strokeWidth="2">
      <line x1={1000*n} y1="0" x2={1000*n} y2="1000"/>
      <line x1="0" y1={1000*n} x2="1000" y2={1000*n}/></g>)}
    </>}
    {overlay==='crosshair'&&<g stroke="#7da88d" strokeOpacity=".6" strokeWidth="2" fill="none">
     <line x1="500" y1="0" x2="500" y2="1000"/>
     <line x1="0" y1="500" x2="1000" y2="500"/>
     <line x1="0" y1="0" x2="1000" y2="1000" strokeDasharray="10 10"/>
     <line x1="1000" y1="0" x2="0" y2="1000" strokeDasharray="10 10"/>
     <circle cx="500" cy="500" r="180"/>
     <circle cx="500" cy="500" r="360" strokeDasharray="6 8"/>
    </g>}

    {/* Quad keystone diagonals and centroid target */}
    <line x1={draft[0].x*1000} y1={draft[0].y*1000} x2={draft[2].x*1000} y2={draft[2].y*1000}
     stroke="#9ad9b4" strokeOpacity=".35" strokeWidth="2.5" strokeDasharray="8 8"/>
    <line x1={draft[1].x*1000} y1={draft[1].y*1000} x2={draft[3].x*1000} y2={draft[3].y*1000}
     stroke="#9ad9b4" strokeOpacity=".35" strokeWidth="2.5" strokeDasharray="8 8"/>
    <g transform={'translate('+cx+','+cy+')'} stroke="#cde3a5" strokeWidth="2.5" fill="none" pointerEvents="none">
     <circle r="14" strokeOpacity=".8"/>
     <line x1="-22" y1="0" x2="22" y2="0"/>
     <line x1="0" y1="-22" x2="0" y2="22"/>
    </g>

    <polygon points={draft.map(p=>p.x*1000+','+p.y*1000).join(' ')}
     fill="#82c49e" fillOpacity=".12" stroke="#cde3a5" strokeWidth="5" strokeLinejoin="round"/>

    {draft.map((point,index)=>{
     const isSelected=selectedCorner===index;
     const isDragging=dragging===index;
     return <g key={index} transform={'translate('+point.x*1000+','+point.y*1000+')'}>
      {isSelected&&<circle r="46" fill="none" stroke="#e4f5be" strokeWidth="3" strokeDasharray="7 5" pointerEvents="none"/>}
      <circle r="34" fill={isDragging?'#3f7351':isSelected?'#29513a':'#162c21'}
       stroke={isSelected?'#eefad3':'#b8d8be'} strokeWidth={isSelected?5:4}
       style={{cursor:'grab',touchAction:'none'}} onPointerDown={e=>{
        e.stopPropagation();e.preventDefault();
        e.currentTarget.ownerSVGElement?.focus({preventScroll:true});
        e.currentTarget.ownerSVGElement?.setPointerCapture(e.pointerId);
        currentRef.current=draft;
        setSelectedCorner(index as MapCornerIndex);
        setDragging(index as MapCornerIndex);
       }}/>
      <text textAnchor="middle" dominantBaseline="middle" fill="#f3fbf0" fontSize="30" fontWeight="700" pointerEvents="none">{index+1}</text>
     </g>;
    })}
   </svg>
  </div>

  <p className="map-r1-hint">Seret sudut 1–4 atau klik sudut lalu tekan panah keyboard (<kbd>Shift</kbd> = langkah besar). Perubahan otomatis memicu Blackout &amp; QA ulang.</p>
  {error&&<p className="map-r1-error" role="alert">{error}</p>}

  <div className="map-r1-corner-bar" role="group" aria-label="Pilih sudut aktif untuk geser presisi">
   <div className="map-r1-corner-picks">
    {draft.map((_,i)=><button type="button" key={i} className="map-r1-corner-pick"
     aria-pressed={selectedCorner===i}
     onClick={()=>{setSelectedCorner(i as MapCornerIndex);el.current?.focus({preventScroll:true});}}
     onKeyDown={handleKeyNudge}>{i+1} · {CORNER_TAGS[i]}</button>)}
   </div>
   <span className="map-r1-corner-uv">
    {CORNER_NAMES[selectedCorner]} · X {draft[selectedCorner].x.toFixed(3)} · Y {draft[selectedCorner].y.toFixed(3)}
   </span>
  </div>
 </section>;
}
