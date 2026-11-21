import {useEffect,useRef,useState,type RefObject} from 'react';
import {Maximize2,Minimize2} from 'lucide-react';
import {cueToFinalSurface,type FinalPreviewSurface} from './performFinalPreviewModel.ts';
import type {PerformView} from './performCueModel.ts';
import './perform-final-preview.css';

type Props={
 floorRaster:RefObject<HTMLCanvasElement|null>;
 bodyRaster:RefObject<HTMLCanvasElement|null>;
 inputRaster:RefObject<HTMLCanvasElement|null>;
 sourceLabel:string;sourceReady:boolean;mapReady:boolean;
 skeletonVisible:boolean;onSkeletonChange:(visible:boolean)=>void;
 cueView:PerformView;cueIndex:number;
};

export function PerformFinalPreview({floorRaster,bodyRaster,inputRaster,sourceLabel,
 sourceReady,mapReady,skeletonVisible,onSkeletonChange,cueView,cueIndex}:Props){
 const [surface,setSurface]=useState<FinalPreviewSurface>(()=>cueToFinalSurface(cueView));
 const [full,setFull]=useState(false);
 const [fullscreenError,setFullscreenError]=useState('');
 const viewport=useRef<HTMLDivElement>(null);
 const output=useRef<HTMLCanvasElement>(null);
 const camera=useRef<HTMLCanvasElement>(null);

 // Cue transport changes which completed artwork is inspected, never physical QA.
 useEffect(()=>setSurface(cueToFinalSurface(cueView)),[cueView,cueIndex]);
 useEffect(()=>{
  const sync=()=>setFull(document.fullscreenElement===viewport.current);
  const onEscape=(event:KeyboardEvent)=>{
   if(event.key!=='Escape'||document.fullscreenElement!==viewport.current)return;
   event.preventDefault();
   void document.exitFullscreen().catch(()=>setFullscreenError('Gagal keluar dari fullscreen.'));
  };
  document.addEventListener('fullscreenchange',sync);
  document.addEventListener('keydown',onEscape,true);
  return()=>{
   document.removeEventListener('fullscreenchange',sync);
   document.removeEventListener('keydown',onEscape,true);
  };
 },[]);
 const fullscreen=()=>{
  const target=viewport.current;if(!target)return;
  setFullscreenError('');
  const task=document.fullscreenElement===target
   ?document.exitFullscreen():target.requestFullscreen?.();
  if(!task){setFullscreenError('Fullscreen belum didukung oleh browser ini.');return;}
  void task.catch(()=>setFullscreenError('Browser memblokir fullscreen. Periksa izin layar.'));
 };

 useEffect(()=>{
  let raf=0,last=0;
  const draw=(now:number)=>{
   raf=requestAnimationFrame(draw);
   if(now-last<1000/30)return;
   last=now;
   const main=output.current,cam=camera.current;
   const ctx=main?.getContext('2d'),cg=cam?.getContext('2d');
   if(ctx&&main){
    ctx.setTransform(1,0,0,1,0,0);
    ctx.globalCompositeOperation='source-over';
    ctx.globalAlpha=1;
    ctx.fillStyle='#000';ctx.fillRect(0,0,main.width,main.height);
    const paint=(canvas:HTMLCanvasElement|null,x:number,w:number)=>{
     if(!canvas||canvas.width<16||canvas.height<16)return;
     const scale=Math.min(w/canvas.width,main.height/canvas.height);
     const dw=canvas.width*scale,dh=canvas.height*scale;
     try{ctx.drawImage(canvas,x+(w-dw)/2,(main.height-dh)/2,dw,dh);}
     catch{ /* source switching */ }
    };
    if(sourceReady){
     if(surface==='split'){
      paint(bodyRaster.current,0,main.width/2);
      paint(floorRaster.current,main.width/2,main.width/2);
     }else paint(surface==='body'?bodyRaster.current:floorRaster.current,0,main.width);
    }
   }
   if(cg&&cam){
    cg.setTransform(1,0,0,1,0,0);cg.globalAlpha=1;cg.globalCompositeOperation='source-over';
    cg.fillStyle='#000';cg.fillRect(0,0,cam.width,cam.height);
    const src=inputRaster.current;
    if(sourceReady&&src&&src.width>0&&src.height>0){
     const scale=Math.min(cam.width/src.width,cam.height/src.height);
     const w=src.width*scale,h=src.height*scale;
     try{cg.drawImage(src,(cam.width-w)/2,(cam.height-h)/2,w,h);}catch{ /* stream switch */ }
    }
   }
  };
  raf=requestAnimationFrame(draw);
  return()=>cancelAnimationFrame(raf);
 },[surface,sourceReady,floorRaster,bodyRaster,inputRaster]);

 return <section className="pf-final" aria-label="Perform Final Preview">
  <header className="pf-final-top">
   <div className="pf-final-title"><strong>Final Preview</strong>
    <span>{sourceReady?mapReady?'Visual Compose · QA Map lengkap':'Visual Compose · QA Map diperlukan':'Menunggu sumber Track'}</span>
   </div>
   <div className="pf-final-tools">
    <div className="pf-final-tabs" role="group" aria-label="Pilih visual final">
     {([['floor','FLOOR'],['body','BODY'],['split','SPLIT']] as const).map(([id,label])=>
      <button type="button" key={id} aria-pressed={surface===id}
       onClick={()=>setSurface(id)}>{label}</button>)}
    </div>
    <button type="button" className="pf-final-fullscreen"
     onClick={fullscreen}
     aria-label={full?'Keluar fullscreen Final Preview':'Fullscreen Final Preview'}
     title={full?'Keluar dari layar penuh (Esc)':'Fullscreen hanya gambar visual, bukan output proyektor'}>
     {full?<Minimize2 size={16} aria-hidden="true"/>:<Maximize2 size={16} aria-hidden="true"/>}
     <span>{full?'Keluar':'Layar penuh'}</span>
    </button>
   </div>
  </header>
  <div ref={viewport} className="pf-final-viewport" aria-label="Bidang Fullscreen Final Preview">
   <canvas ref={output} width={1280} height={720}
    aria-label="Visual final hasil komposisi FLOOR dan BODY"
    data-final-surface={surface}/>
  </div>
  {fullscreenError&&<p className="pf-final-error" role="status">{fullscreenError}</p>}
  <div className="pf-final-input-strip">
   <div className="pf-final-camera-image">
    <canvas ref={camera} width={480} height={270}
     aria-label="Monitor kamera asli dari sumber Track"/>
   </div>
   <div className="pf-final-camera-controls">
    <strong>Kamera asli</strong>
    <small>{sourceLabel} · {sourceReady?'Input aktif':'Belum terhubung'}</small>
    <button type="button" aria-pressed={skeletonVisible}
     aria-label="Tampilkan Skeleton di kamera Perform"
     onClick={()=>onSkeletonChange(!skeletonVisible)}>
     Skeleton <span>{skeletonVisible?'ON':'OFF'}</span>
    </button>
   </div>
  </div>
  <footer className="pf-final-foot">
   <span>Pratinjau perangkat lunak · gambar dari Compose</span>
   <span>{mapReady?'Kalibrasi tersedia':'Periksa Track dan Map sebelum LIVE'}</span>
  </footer>
 </section>;
}
