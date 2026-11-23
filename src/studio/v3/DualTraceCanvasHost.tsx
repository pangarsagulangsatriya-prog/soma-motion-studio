import type {RefObject} from 'react';

type Props={
 enabled:boolean;footRef:RefObject<HTMLCanvasElement|null>;
 upperRef:RefObject<HTMLCanvasElement|null>;
 fullscreenRef:RefObject<HTMLDivElement|null>;
 footPaneRef:RefObject<HTMLDivElement|null>;
 upperPaneRef:RefObject<HTMLDivElement|null>;
 hasUpper:boolean;sourceIsFootOnly:boolean;
 onClearFoot:()=>void;onClearUpper:()=>void;onClearBoth:()=>void;
 onExportUpper:()=>void;
};
/** Presentation surfaces only: inference runs once in LineTrailsV3Stage.
 * Controls are outside the actual raster and hidden on physical fullscreen.
 */
export function DualTraceCanvasHost(p:Props){
 if(!p.enabled)return <div className="lt-beta-frame lt-v3-stage"
    ref={p.fullscreenRef} aria-label="Kanvas Garis V3, lintasan dua kaki">
  <canvas ref={p.footRef} width={1600} height={900}
   aria-label="Lintasan nyata kaki kiri dan kanan"/>
 </div>;
 const fullscreen=(target:HTMLDivElement|null)=>{
  if(!target)return;
  if(document.fullscreenElement===target){void document.exitFullscreen();return;}
  if(target.requestFullscreen)void target.requestFullscreen();
 };
 return <div className="lt-beta-frame lt-v3-stage dual-trace-host"
  ref={p.fullscreenRef} data-dual-trace="true" aria-label="Dual Trace dua kanvas">
  <div className="dual-trace-layout">
   <section className="dual-trace-pane" ref={p.footPaneRef}
    aria-label="Kanvas Foot Path">
    <div className="dual-trace-view-controls">
     <strong>FOOT PATH</strong>
     <div><button type="button" onClick={p.onClearFoot}>Clear Foot</button>
      <button type="button" onClick={()=>fullscreen(p.footPaneRef.current)}
       aria-label="Fullscreen Foot Path">Layar penuh</button></div>
    </div>
    <canvas ref={p.footRef} width={1600} height={900}
     aria-label="Foot Path — jejak dan jalur kaki"/>
   </section>
   <section className="dual-trace-pane" ref={p.upperPaneRef}
    aria-label="Kanvas Head & Shoulder">
    <div className="dual-trace-view-controls">
     <strong>HEAD &amp; SHOULDER</strong>
     <div><button type="button" onClick={p.onClearUpper}>Clear Gesture</button>
      <button type="button" onClick={()=>fullscreen(p.upperPaneRef.current)}
       aria-label="Fullscreen Head & Shoulder">Layar penuh</button></div>
    </div>
    <canvas ref={p.upperRef} width={1600} height={900}
     aria-label="Head & Shoulder — lukisan gestur"/>
    {(!p.hasUpper||p.sourceIsFootOnly)&&
     <span className="dual-trace-unavailable" role="status">
      {p.sourceIsFootOnly?'Pose kepala/bahu belum tersedia · demo kaki':
       'Menunggu pose kepala/bahu yang valid'}
     </span>}
   </section>
  </div>
  <div className="dual-trace-bottom-controls">
   <span>Dua kanvas · A merah / B arang · tinta menetap</span>
   <div><button type="button" onClick={p.onClearBoth}>Clear Both</button>
    <button type="button" onClick={p.onExportUpper}>PNG Gesture</button></div>
  </div>
 </div>;
}
