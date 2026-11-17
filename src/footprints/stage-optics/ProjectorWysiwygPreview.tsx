import {useEffect,useRef,useState,type RefObject} from 'react';
import {artworkTransform} from '../../projection/artwork.ts';
import {stageSurfaceState,type StageSurface,type StageSurfacePlan,type SurfaceAssessment}
 from './DualSurfaceCalibration.ts';
import {previewCaption,previewSignal,type PreviewView}
 from './projectorWysiwygModel.ts';
import './projector-wysiwyg.css';

type Props={
 surface:StageSurface;plan:StageSurfacePlan;view:PreviewView;
 softwareMode:string;connected:boolean;qa:SurfaceAssessment;
 liveCanvas:RefObject<HTMLCanvasElement|null>;
 testCanvases:RefObject<Record<StageSurface,HTMLCanvasElement>|null>;
 viewport:{width:number;height:number;dpr:number}|null;
};

export function ProjectorWysiwygPreview({surface,plan,view,softwareMode,
 connected,qa,liveCanvas,testCanvases,viewport}:Props){
 const root=useRef<HTMLDivElement>(null);
 const drawing=useRef<HTMLCanvasElement>(null);
 const [size,setSize]=useState({width:480,height:270});
 const signal=previewSignal(view,softwareMode);
 const actualAspect=viewport?.width&&viewport.height?
  viewport.width/viewport.height:16/9;
 const config=stageSurfaceState(plan,'live',true).config;

 useEffect(()=>{
  const el=root.current;if(!el)return;
  const observe=new ResizeObserver(entries=>{
   const rect=entries[0]?.contentRect;
   if(rect&&rect.width>1&&rect.height>1){
    setSize(prev=>Math.abs(prev.width-rect.width)<.5&&Math.abs(prev.height-rect.height)<.5?
     prev:{width:rect.width,height:rect.height});
   }
  });
  observe.observe(el);
  return()=>observe.disconnect();
 },[]);

 useEffect(()=>{
  const canvas=drawing.current;
  if(!canvas)return;
  const ctx=canvas.getContext('2d');
  if(!ctx)return;
  let raf=0,last=-Infinity;
  const tick=(now:number)=>{
   raf=requestAnimationFrame(tick);
   if(now-last<100)return;last=now;
   ctx.setTransform(1,0,0,1,0,0);
   ctx.clearRect(0,0,canvas.width,canvas.height);
   if(signal==='blackout')return;
   const source=signal==='test'?testCanvases.current?.[surface]:liveCanvas.current;
   if(!source||source.width<16||source.height<16)return;
   try{ctx.drawImage(source,0,0,canvas.width,canvas.height);}catch{
    // A media/source switch can detach a canvas between frames.
   }
  };
  raf=requestAnimationFrame(tick);
  return()=>cancelAnimationFrame(raf);
 },[signal,surface,liveCanvas,testCanvases]);

 return <figure className="stage-wysiwyg-card" data-surface={surface}
  data-preview-signal={signal} data-preview-view={view}>
  <div className="stage-wysiwyg-card-head"><b>{surface==='body'?'BODY':'FLOOR'}</b>
   <span>{softwareMode.toUpperCase()} · {connected?'jendela terhubung':'output offline'}</span></div>
  <div className="stage-wysiwyg-viewport" ref={root}
   style={{aspectRatio:String(actualAspect)}} aria-label={'Preview proyeksi '+surface.toUpperCase()}>
   <canvas ref={drawing} width={480} height={270} aria-hidden="true"
    className="stage-wysiwyg-artwork"
    style={{
     opacity:config.brightness,
     transform:artworkTransform(config,size.width,size.height)
    }}/>
   {view==='draft'&&<svg className="stage-wysiwyg-guides"
    viewBox="0 0 1000 1000" preserveAspectRatio="none" aria-hidden="true">
    <polygon points={plan.projectorQuad.map(p=>[p.x*1000,p.y*1000].join(',')).join(' ')}
     fill="none" stroke="currentColor" strokeDasharray="11 8" strokeWidth="3"/>
    {plan.projectorQuad.map((p,i)=><g key={i}>
     <circle cx={p.x*1000} cy={p.y*1000} r="16" fill="#161e19"
      stroke="currentColor" strokeWidth="3"/>
     <text x={p.x*1000} y={p.y*1000+6} textAnchor="middle"
      fontSize="18" fill="currentColor">{i+1}</text>
    </g>)}
   </svg>}
   {signal==='blackout'&&<div className="stage-wysiwyg-blank" role="status">
    BLACKOUT <small>tidak ada frame yang diperintahkan</small>
   </div>}
  </div>
  <figcaption>
   <span>{previewCaption(view,softwareMode)}</span>
   <small>{Math.round(config.brightness*100)}% kecerahan software ·
    {plan.resolution} · QA {qa.count}/{qa.required}</small>
  </figcaption>
 </figure>;
}
