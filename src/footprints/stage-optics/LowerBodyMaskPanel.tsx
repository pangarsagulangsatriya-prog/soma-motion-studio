import {useEffect,useRef,useState,type RefObject} from 'react';
import {Activity,Eye,Pause,Play,ShieldAlert} from 'lucide-react';
import type {MotionFrame} from '../../engine/types.ts';
import {buildLowerBodyMask,LOWER_BODY_MASK_DEFAULTS,
 sampleLowerBodyFrame,type LowerBodyMaskResult} from './LowerBodyMaskEngine.ts';
import './lower-body-mask.css';

type Props={frameRef:RefObject<MotionFrame>;cameraOn:boolean;performerCount:1|2;
 identityAmbiguous:boolean};
const stateLabel:Record<LowerBodyMaskResult['status'],string>={
 ready:'MASK READY',missing:'TRACKING INCOMPLETE',
 ambiguous:'OVERLAP / BLACKOUT',stale:'STALE / BLACKOUT',
 invalid:'INVALID / BLACKOUT'
};
export function LowerBodyMaskPanel({frameRef,cameraOn,performerCount,identityAmbiguous}:Props){
 const canvas=useRef<HTMLCanvasElement>(null),scratch=useRef<HTMLCanvasElement|null>(null);
 const phaseRef=useRef(0),lastTime=useRef(0);
 const [source,setSource]=useState<'simulation'|'live'>('simulation');
 const [playing,setPlaying]=useState(true),[overlap,setOverlap]=useState(false);
 const [feather,setFeather]=useState(2),[torso,setTorso]=useState(.19);
 const [requireSegmentation,setRequireSegmentation]=useState(false);
 const [status,setStatus]=useState('SIMULATION ONLY · mask belum tersambung ke proyektor');
 const [coverage,setCoverage]=useState(0),[cutoffInfo,setCutoffInfo]=useState('');
 const sourceRef=useRef(source),playingRef=useRef(playing),overlapRef=useRef(overlap);
 const configRef=useRef({feather,torso,requireSegmentation});
 sourceRef.current=source;playingRef.current=playing;overlapRef.current=overlap;
 configRef.current={feather,torso,requireSegmentation};
 useEffect(()=>{
  const c=canvas.current;if(!c)return;
  const ctx=c.getContext('2d');if(!ctx)return;
  const small=document.createElement('canvas');scratch.current=small;
  const smallCtx=small.getContext('2d');
  if(!smallCtx)return;
  let raf=0,lastPaint=0,lastStatus='';
  const draw=(now:number)=>{
   raf=requestAnimationFrame(draw);
   if(now-lastPaint<1000/20)return;
   const dt=lastTime.current?Math.min(100,now-lastTime.current):0;
   lastTime.current=now;lastPaint=now;
   if(sourceRef.current==='simulation'&&playingRef.current)
    phaseRef.current=(phaseRef.current+dt/840)%(Math.PI*2);
   const fromLive=sourceRef.current==='live';
   const frame=fromLive?cameraOn?frameRef.current:null:
    sampleLowerBodyFrame(now,performerCount,phaseRef.current,overlapRef.current);
   const options={...LOWER_BODY_MASK_DEFAULTS,performers:performerCount,
    featherPx:configRef.current.feather,torsoExtension:configRef.current.torso,
    requireSegmentation:configRef.current.requireSegmentation};
   const mask=buildLowerBodyMask(frame,options,now,fromLive?'camera':'simulation');
   const blocked=fromLive&&identityAmbiguous&&performerCount===2;
   ctx.fillStyle='#020403';ctx.fillRect(0,0,c.width,c.height);
   if(mask.status==='ready'&&!blocked){
    if(small.width!==mask.mask.width)small.width=mask.mask.width;
    if(small.height!==mask.mask.height)small.height=mask.mask.height;
    const img=smallCtx.createImageData(mask.mask.width,mask.mask.height);
    let visible=0;
    for(let i=0;i<mask.mask.data.length;i++){
     const alpha=mask.mask.data[i];
     if(alpha>20)visible++;
     const off=i*4;img.data[off]=211;img.data[off+1]=217;
     img.data[off+2]=201;img.data[off+3]=alpha;
    }
    smallCtx.putImageData(img,0,0);
    ctx.imageSmoothingEnabled=true;ctx.drawImage(small,0,0,c.width,c.height);
    setCoverage(previous=>Math.abs(previous-visible/mask.mask.data.length)<.01?
     previous:visible/mask.mask.data.length);
   }else{
    setCoverage(previous=>previous===0?previous:0);
   }
   const label=blocked?'Identitas A/B ambigu dari tracker. Mask dipadamkan.':
    mask.status==='ready'?mask.reason:mask.reason;
   const nextStatus=(blocked?'ambiguous':mask.status)+'|'+label;
   if(nextStatus!==lastStatus){lastStatus=nextStatus;
    setStatus((blocked?'OVERLAP / BLACKOUT':stateLabel[mask.status])+' · '+label);
   }
   setCutoffInfo(mask.status==='ready'&&!blocked?
    'Batas mengikuti pinggul dan lereng bahu setiap pose; bukan tinggi meter hasil kalibrasi.':
    'Output tetap hitam sampai pose aman.');
  };
  raf=requestAnimationFrame(draw);
  return()=>{cancelAnimationFrame(raf);lastTime.current=0;scratch.current=null;};
 },[frameRef,cameraOn,performerCount,identityAmbiguous]);
 return <section className="lower-mask" aria-label="S5.7.1 Lower Body Mask Engine">
  <div className="live-floor-heading"><Eye size={15}/> S5.7.1 / LOWER-BODY MASK</div>
  <p>Pratinjau transparansi tubuh bagian pinggang, paha, betis, dan telapak.
   Tidak ada arsip video atau cahaya yang dikirim ke proyektor pada tahap ini.</p>
  <div className="lower-mask-view">
   <canvas ref={canvas} width={640} height={480}
    aria-label="Pratinjau putih di atas hitam: hasil mask pinggang sampai telapak"/>
   <div className="lower-mask-legend">
    <span>{source==='simulation'?'SIMULATED POSES':'LIVE CAMERA POSES'}</span>
    <span>{performerCount} performer</span>
   </div>
  </div>
  <div className="lower-mask-controls">
   <label>Sumber preview
    <select value={source} onChange={e=>setSource(e.target.value as 'simulation'|'live')}>
     <option value="simulation">Simulasi dua tubuh / tanpa kamera</option>
     <option value="live">Frame SOMA Body yang aktif</option>
    </select>
   </label>
   {source==='simulation'?<div className="lower-mask-inline">
    <button type="button" onClick={()=>setPlaying(v=>!v)}>
     {playing?<Pause size={13}/>:<Play size={13}/>} {playing?'Jeda':'Gerakkan'}
    </button>
    <label className="lower-mask-check"><input type="checkbox" checked={overlap}
     onChange={e=>setOverlap(e.target.checked)}/> Uji tubuh beririsan</label>
   </div>:<p>{cameraOn?'Kamera SOMA aktif.':'Kamera belum aktif. Mulai Body pada panel utama.'}
    Mode live membaca frame kamera yang sudah ada.</p>}
   <label>Feather ke dalam mask · {feather} px
    <input type="range" min="0" max="6" step="1" value={feather}
     onChange={e=>setFeather(Number(e.target.value))}/>
   </label>
   <label>Perluasan ke perut dari pinggul · {Math.round(torso*100)}% tinggi torso
    <input type="range" min="0" max=".35" step=".01" value={torso}
     onChange={e=>setTorso(Number(e.target.value))}/>
   </label>
   <label className="lower-mask-check"><input type="checkbox" checked={requireSegmentation}
    onChange={e=>setRequireSegmentation(e.target.checked)}/>
    Wajibkan segmentasi (fail-black saat tidak tersedia)</label>
  </div>
  <div className="lower-mask-metrics">
   <div><Activity size={14}/> {status}</div>
   <div>Area mask aktif: <strong>{(coverage*100).toFixed(1)}%</strong> frame
    <span>{cutoffInfo}</span></div>
   <div><ShieldAlert size={14}/> Dua performer saat bersilangan bisa saling menutup.
    Jika geometri bertumpuk, seluruh mask dihentikan untuk mencegah cahaya salah sasaran.</div>
  </div>
  <p className="lower-mask-note">Mask ini memakai geometri landmark dan segmentasi gabungan bila tersedia;
   segmentasi belum memisahkan identitas A/B. Preview kamera belum dikoreksi ke posisi
   optik proyektor dan belum menghasilkan video mapping tubuh 3D.</p>
 </section>;
}
