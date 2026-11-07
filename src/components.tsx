import {useEffect,useRef,type ReactNode} from 'react';
import {X,SlidersHorizontal,AudioLines,MoveUpRight,Hand,PersonStanding,Drum,Waypoints} from 'lucide-react';
import type {Mode,MotionFrame,Settings} from './engine/types';
import type {AudioEngine} from './engine/audio';
export const MODES:{id:Mode;name:string;description:string;number:string;icon:typeof Hand}[]=[{id:'theremin',name:'Theremin',description:'Tangan, nada, udara.',number:'01',icon:Hand},{id:'drone',name:'Body Drone',description:'Tubuh membentuk tekstur.',number:'02',icon:PersonStanding},{id:'percussion',name:'Gesture Percussion',description:'Gerak menjadi ritme.',number:'03',icon:Drum},{id:'lab',name:'Performance Lab',description:'Rangkai aturan bunyimu.',number:'04',icon:Waypoints}];
export function Range({label,value,min=0,max=1,step=.01,onChange,display}:{label:string;value:number;min?:number;max?:number;step?:number;onChange:(v:number)=>void;display?:string}){return <label className="range-label"><span>{label}<output>{display??`${Math.round(value*100)}%`}</output></span><input aria-label={label} type="range" min={min} max={max} step={step} value={value} onChange={e=>onChange(Number(e.target.value))} style={{'--fill':`${(value-min)/(max-min)*100}%`} as React.CSSProperties}/></label>}
export function Modal({title,children,onClose,wide=false}:{title:string;children:ReactNode;onClose:()=>void;wide?:boolean}){
 const ref=useRef<HTMLDialogElement>(null);
 useEffect(()=>{ref.current?.showModal();return()=>ref.current?.close();},[]);
 return <dialog ref={ref} className={`modal ${wide?'wide':''}`} onCancel={onClose} onClick={e=>{if(e.target===ref.current)onClose();}}><div className="modal-head"><div><span className="eyebrow">SOMA / STUDIO</span><h2>{title}</h2></div><button className="icon-button" onClick={onClose} aria-label="Tutup"><X size={20}/></button></div><div className="modal-body">{children}</div></dialog>
}
export function WaveIcon({kind}:{kind:string}){let d='M2 12 C8 -4 12 -4 18 12 S28 28 34 12 S44 -4 50 12';if(kind==='triangle')d='M2 16L14 3 26 23 38 3 50 16';if(kind==='sawtooth')d='M2 22L17 3V22L33 3V22L49 3V22';if(kind==='square')d='M2 22V4H14V22H26V4H38V22H50';return <svg width="50" height="26" viewBox="0 0 52 26" fill="none" aria-hidden="true"><path d={d} stroke="currentColor" strokeWidth="1.5" strokeLinejoin="round"/></svg>}
const CONNECTIONS=[[0,1],[1,2],[2,3],[3,4],[0,5],[5,6],[6,7],[7,8],[5,9],[9,10],[10,11],[11,12],[9,13],[13,14],[14,15],[15,16],[13,17],[17,18],[18,19],[19,20],[0,17]];
const BODY=[[11,12],[11,13],[13,15],[12,14],[14,16],[11,23],[12,24],[23,24],[23,25],[25,27],[24,26],[26,28],[27,29],[29,31],[28,30],[30,32]];
export function TrackingCanvas({frameRef,settingsRef,videoRef}:{frameRef:React.RefObject<MotionFrame>;settingsRef:React.RefObject<Settings>;videoRef:React.RefObject<HTMLVideoElement|null>}){
 const ref=useRef<HTMLCanvasElement>(null);
 useEffect(()=>{let raf=0;let last=0;const trails:{x:number;y:number;t:number}[]=[];const draw=(time:number)=>{
  const c=ref.current;if(!c)return;const box=c.getBoundingClientRect(),ratio=devicePixelRatio||1;if(c.width!==Math.round(box.width*ratio)||c.height!==Math.round(box.height*ratio)){c.width=Math.round(box.width*ratio);c.height=Math.round(box.height*ratio);}const ctx=c.getContext('2d')!;ctx.setTransform(ratio,0,0,ratio,0,0);ctx.clearRect(0,0,box.width,box.height);const f=frameRef.current,s=settingsRef.current;
  const vid=videoRef.current;const scale=Math.min(box.width/(vid?.videoWidth||640),box.height/(vid?.videoHeight||480));const vw=(vid?.videoWidth||640)*scale,vh=(vid?.videoHeight||480)*scale;
  const pt=(p:{x:number;y:number})=>({x:(box.width-vw)/2+(s.mirror?1-p.x:p.x)*vw,y:(box.height-vh)/2+p.y*vh});
  if(f.tracked&&time-f.time<450){
   const mouse=f.source==='mouse';const p={x:f.features.x*box.width,y:(1-f.features.y)*box.height};
   if(time-last>35){trails.push({...p,t:time});last=time;}while(trails.length&&time-trails[0].t>700)trails.shift();
   if(trails.length>1){ctx.beginPath();trails.forEach((q,i)=>i?ctx.lineTo(q.x,q.y):ctx.moveTo(q.x,q.y));ctx.strokeStyle='rgba(206,223,137,.23)';ctx.lineWidth=2;ctx.stroke();}
   const skeleton=(points:MotionFrame['pose'],edges:number[][])=>{ctx.strokeStyle='rgba(245,247,238,.8)';ctx.lineWidth=1.5;for(const [a,b]of edges){if(!points[a]||!points[b]||(points[a].visibility??1)<.5||(points[b].visibility??1)<.5)continue;const p=pt(points[a]),q=pt(points[b]);ctx.beginPath();ctx.moveTo(p.x,p.y);ctx.lineTo(q.x,q.y);ctx.stroke();}points.forEach((raw,i)=>{if((raw.visibility??1)<.5)return;const p=pt(raw);ctx.beginPath();ctx.arc(p.x,p.y,i===8?5:2.5,0,Math.PI*2);ctx.fillStyle=i===8?'#cedf89':'#f3f3e9';ctx.fill();});};
   f.hands.forEach(h=>skeleton(h,CONNECTIONS));if(f.pose.length)skeleton(f.pose,BODY);
   if(mouse){ctx.strokeStyle='rgba(206,223,137,.18)';ctx.lineWidth=1;ctx.beginPath();ctx.moveTo(p.x,0);ctx.lineTo(p.x,box.height);ctx.moveTo(0,p.y);ctx.lineTo(box.width,p.y);ctx.stroke();ctx.beginPath();ctx.arc(p.x,p.y,f.features.open?29:17,0,2*Math.PI);ctx.strokeStyle='#cedf89';ctx.stroke();ctx.beginPath();ctx.arc(p.x,p.y,5,0,2*Math.PI);ctx.fillStyle='#cedf89';ctx.fill();ctx.fillStyle='#cedf89';ctx.font='11px monospace';ctx.fillText(`${Math.round(f.features.x*100)} / ${Math.round(f.features.y*100)}`,p.x+40,p.y+4);}
  }else trails.length=0;raf=requestAnimationFrame(draw);
 };raf=requestAnimationFrame(draw);return()=>cancelAnimationFrame(raf);},[frameRef,settingsRef,videoRef]);
 return <canvas ref={ref} className="tracking-overlay" aria-hidden="true"/>;
}
export function AudioMonitor({engine,enabled,onLevel}:{engine:AudioEngine;enabled:boolean;onLevel:(v:number)=>void}){
 const ref=useRef<HTMLCanvasElement>(null);const levelRef=useRef(onLevel);levelRef.current=onLevel;
 useEffect(()=>{let raf=0,last=0;const wave=new Uint8Array(2048),freq=new Uint8Array(1024);const draw=(t:number)=>{const c=ref.current;if(!c)return;const rect=c.getBoundingClientRect(),dpr=devicePixelRatio||1;const w=rect.width,h=rect.height;if(c.width!==Math.round(w*dpr)||c.height!==Math.round(h*dpr)){c.width=Math.round(w*dpr);c.height=Math.round(h*dpr);}const x=c.getContext('2d')!;x.setTransform(dpr,0,0,dpr,0,0);x.clearRect(0,0,w,h);
  x.strokeStyle='#2b2e28';x.lineWidth=1;for(let i=0;i<4;i++){x.beginPath();x.moveTo(0,12+i*(h-24)/3);x.lineTo(w,12+i*(h-24)/3);x.stroke();}
  if(engine.analyser&&enabled){engine.analyser.getByteTimeDomainData(wave);engine.analyser.getByteFrequencyData(freq);}else{wave.fill(128);freq.fill(0);}
  const end=w*.7;x.beginPath();x.strokeStyle=enabled?'#cedf89':'#565b50';x.lineWidth=1.3;for(let i=0;i<wave.length;i+=3){const px=i/(wave.length-1)*end,py=h/2+((wave[i]-128)/128)*(h*.43);i?x.lineTo(px,py):x.moveTo(px,py);}x.stroke();
  for(let i=0;i<36;i++){const v=freq[Math.floor(Math.pow(i/35,2)*500)]/255;x.fillStyle=enabled?'#9ca876':'#3a3e35';x.fillRect(end+22+i*((w-end-22)/36),h-12-Math.max(1,v*(h-24)),Math.max(1,(w-end-22)/36-3),Math.max(1,v*(h-24)));}
  if(t-last>100){last=t;const rms=Math.sqrt(wave.reduce((a,b)=>a+Math.pow((b-128)/128,2),0)/wave.length);levelRef.current(rms);}raf=requestAnimationFrame(draw);
 };raf=requestAnimationFrame(draw);return()=>cancelAnimationFrame(raf);},[engine,enabled]);
 return <canvas ref={ref} className="audio-canvas" aria-label="Gelombang dan spektrum audio langsung"/>;
}
export function IdleArt(){return <svg className="idle-art" viewBox="0 0 210 190" fill="none" aria-hidden="true"><circle cx="105" cy="95" r="78" stroke="#33392d" strokeDasharray="2 6"/><circle cx="105" cy="95" r="58" stroke="#282d25"/><path d="M81 154 64 126 48 107Q42 96 52 94Q57 92 63 99L78 112 69 68Q67 57 74 55Q82 53 85 65L94 96 90 42Q89 32 96 31Q105 29 106 42L110 92 117 39Q118 29 126 32Q133 33 131 45L127 95 139 59Q143 47 150 52Q156 56 152 66L139 119Q135 140 125 153" stroke="#909b79" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round"/><path d="M93 121 109 110 126 118M109 110 110 92M93 121 78 112M109 110 106 151" stroke="#59634c"/><g fill="#cedf89"><circle cx="96" cy="33" r="2.8"/><circle cx="125" cy="34" r="2.8"/><circle cx="148" cy="55" r="2.8"/><circle cx="74" cy="58" r="2.8"/><circle cx="51" cy="98" r="2.8"/><circle cx="109" cy="110" r="3"/></g><path d="M18 43V19H42M168 19H192V43M18 146V170H42M168 170H192V146" stroke="#4d5640"/></svg>}
export const StudioIcon=AudioLines;
export const ControlsIcon=SlidersHorizontal;
export const ArrowIcon=MoveUpRight;
