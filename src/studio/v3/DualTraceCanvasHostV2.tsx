import type {RefObject} from 'react';
import type {DualTraceV2Mode} from '../../footprints/dual-trace/DualTraceV2Renderer.ts';

type Props={
 mainRef:RefObject<HTMLCanvasElement|null>;
 footDebugRef:RefObject<HTMLCanvasElement|null>;
 upperDebugRef:RefObject<HTMLCanvasElement|null>;
 fullscreenRef:RefObject<HTMLDivElement|null>;
 display:DualTraceV2Mode;
 hasUpper:boolean;sourceIsFootOnly:boolean;
 onClearFoot:()=>void;onClearUpper:()=>void;onClearBoth:()=>void;
 onExportUpper:()=>void;
};
export function DualTraceCanvasHostV2(p:Props){
 const split=p.display==='split-debug';
 const full=()=>{
  const target=p.fullscreenRef.current;
  if(!target)return;
  if(document.fullscreenElement===target){void document.exitFullscreen();return;}
  void target.requestFullscreen?.();
 };
 return <div className="lt-beta-frame lt-v3-stage dual-trace-host dual-v2-host"
  ref={p.fullscreenRef} data-dual-trace="v2" data-display={p.display}
  aria-label="Dual Trace V2 — satu kanvas lukisan">
  <div className="dual-v2-topbar">
   <strong>{split?'Pisah · pemeriksaan kanal':'Satu kanvas · Garis + Tapak + Gesture'}</strong>
   <button type="button" onClick={full}>Layar penuh</button>
  </div>
  <div className="dual-v2-canvas-wrap" data-hidden={split?'true':'false'}>
   <canvas ref={p.mainRef} width={1600} height={900}
    aria-label="Dual Trace V2 — lukisan gabungan"/>
  </div>
  {split&&<div className="dual-v2-debug-layout">
   <section className="dual-v2-debug-pane" aria-label="Debug Foot Path dan Footprints">
    <strong>FOOT PATH + TAPAK</strong>
    <canvas ref={p.footDebugRef} width={1600} height={900}
     aria-label="Kanal kaki — debug"/>
   </section>
   <section className="dual-v2-debug-pane" aria-label="Debug Head dan Shoulder">
    <strong>HEAD &amp; SHOULDER</strong>
    <canvas ref={p.upperDebugRef} width={1600} height={900}
     aria-label="Kanal gesture — debug"/>
   </section>
  </div>}
  <div className="dual-v2-footer">
   <span>{p.hasUpper?'Dua kanal pose terhubung':p.sourceIsFootOnly?
    'Simulasi kaki · gesture belum tersedia':'Menunggu pose kepala/bahu'}</span>
   <div>
    <button type="button" onClick={p.onClearFoot}>Bersihkan kaki</button>
    <button type="button" onClick={p.onClearUpper}>Bersihkan gesture</button>
    <button type="button" onClick={p.onClearBoth}>Bersihkan semua</button>
    <button type="button" onClick={p.onExportUpper}>PNG gesture</button>
   </div>
  </div>
 </div>;
}
