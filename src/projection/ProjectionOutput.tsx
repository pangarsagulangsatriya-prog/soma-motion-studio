import {useEffect,useRef} from 'react';
import {ProjectionRenderer} from './renderer';
import {projectionDefaults,validateProjection,type ProjectionState} from './model';
import {OUTPUT_TIMEOUT} from './channel';
import {artworkTransform} from './artwork';
import './projection.css';
 export default function ProjectionOutput({session,surface}:{session:string;surface?:'body'|'floor'}){
 const canvas=useRef<HTMLCanvasElement>(null),artwork=useRef<HTMLCanvasElement>(null);
 const resolumeFeed=typeof window!=='undefined'&&new URLSearchParams(window.location.search).get('feed')==='resolume';
 useEffect(()=>{
  document.title=resolumeFeed
   ?`SOMA / RESOLUME FEED · ${(surface??'body').toUpperCase()}`
   :surface?'SOMA / STAGE · '+surface.toUpperCase():'SOMA / PROJECTION · Output';const element=canvas.current!,color=artwork.current!,colorCtx=color.getContext('2d')!;const renderer=new ProjectionRenderer(element);let lastControl=0,lastMask=0,seq=-1,raf=0,usingArtwork=false;let state:ProjectionState={config:projectionDefaults(),transport:'blackout',pattern:false,blank:true,tracking:false,quality:0,sampleAge:0,reason:'',opacity:1,image:null};
  const channel=new BroadcastChannel(`soma-body-projection-${session}`);const send=(type:string)=>channel.postMessage({type,session,renderer:renderer.healthy?renderer.mode:'Konteks GPU hilang · buka ulang output',info:{width:element.width,height:element.height,viewportWidth:innerWidth,viewportHeight:innerHeight,dpr:devicePixelRatio,...renderer.metrics.snapshot()}});
  channel.onmessage=e=>{const m=e.data;if(m?.session!==session)return;if(m.type==='shutdown'){state={...state,blank:true};lastControl=0;color.style.display='none';renderer.render(null,true);}if(m.type==='control'){try{const c=m.control;if(!['live','hold','blackout'].includes(c.transport))return;const config=validateProjection({version:2,config:c.config});if(!Number.isFinite(c.opacity)||c.opacity<0||c.opacity>1)return;state={...state,...c,config,image:state.image};lastControl=performance.now();}catch{}}};
  const message=(e:MessageEvent)=>{
   const m=e.data;
   if(e.origin!==location.origin||e.source!==window.opener||m?.session!==session||!['mask','artwork'].includes(m.type)||!Number.isInteger(m.sequence)||m.sequence<=seq)return;
   if(m.type==='artwork'){
    const bmp=m.bitmap;
    if(typeof ImageBitmap==='undefined'||!(bmp instanceof ImageBitmap)||bmp.width<1||bmp.height<1||bmp.width>4096||bmp.height>4096)return;
    seq=m.sequence;
    if(color.width!==bmp.width||color.height!==bmp.height){color.width=bmp.width;color.height=bmp.height;}
    colorCtx.clearRect(0,0,color.width,color.height);colorCtx.drawImage(bmp,0,0);bmp.close();
    usingArtwork=true;lastMask=performance.now();
    window.opener?.postMessage({type:'frame-ack',session,sequence:seq},location.origin);
    return;
   }
   const {width,height,buffer}=m;
   if(!Number.isInteger(width)||!Number.isInteger(height)||width<1||height<1||width>512||height>512||!(buffer instanceof ArrayBuffer)||buffer.byteLength!==width*height||!Number.isFinite(m.aspect)||!Number.isFinite(m.time))return;
   const validBounds=(b:unknown)=>!b||typeof b==='object'&&['cx','cy','width','height'].every(k=>Number.isFinite((b as Record<string,number>)[k]))&&(b as {width:number}).width>0&&(b as {height:number}).height>0;
   if(!validBounds(m.rawBounds)||!validBounds(m.bounds)||(m.processed!==undefined&&typeof m.processed!=='boolean'))return;
   seq=m.sequence;usingArtwork=false;
   state={...state,image:{mask:{width,height,data:new Uint8Array(buffer)},time:m.time,aspect:m.aspect,rawBounds:m.rawBounds,bounds:m.bounds,processed:!!m.processed}};
   lastMask=performance.now();
   window.opener?.postMessage({type:'frame-ack',session,sequence:seq},location.origin);
  };
  const draw=()=>{
   const now=performance.now(),disconnected=!lastControl||now-lastControl>OUTPUT_TIMEOUT;
   if(usingArtwork){
    renderer.render(state.pattern?state:null,!state.pattern||disconnected);
    const enabled=!disconnected&&!state.blank&&!state.pattern&&state.transport!=='blackout'&&(state.transport==='hold'||now-lastMask<=1500);
    if(enabled){
     color.style.display='block';
     color.style.transform=artworkTransform(state.config,innerWidth,innerHeight);
     color.style.opacity=String(Math.min(1,Math.max(0,state.config.brightness*state.opacity)));
    }else color.style.display='none';
   }else{
    color.style.display='none';
    renderer.render(state,disconnected||(!state.pattern&&state.transport==='live'&&now-lastMask>1500));
   }
   raf=requestAnimationFrame(draw);
  };
  const fullscreen=()=>{if(document.fullscreenElement)void document.exitFullscreen();else void document.documentElement.requestFullscreen().catch(()=>{});};const key=(e:KeyboardEvent)=>{if(e.code==='KeyF'){e.preventDefault();fullscreen();}};
  const closed=()=>send('closed');window.addEventListener('message',message);window.addEventListener('pagehide',closed);document.addEventListener('keydown',key);element.addEventListener('dblclick',fullscreen);send('hello');const heartbeat=setInterval(()=>send('heartbeat'),650);raf=requestAnimationFrame(draw);
  return()=>{closed();clearInterval(heartbeat);cancelAnimationFrame(raf);channel.close();renderer.dispose();window.removeEventListener('message',message);window.removeEventListener('pagehide',closed);document.removeEventListener('keydown',key);element.removeEventListener('dblclick',fullscreen);};
 },[session,surface]);
 return <main className="body-projection-output"><canvas ref={canvas} aria-label="Output proyeksi bersih" tabIndex={0}/><canvas ref={artwork} aria-label="Output Footprints berwarna" style={{display:'none',position:'fixed',left:0,top:0,width:'100vw',height:'100vh',objectFit:'fill',pointerEvents:'none',transformOrigin:'0 0',zIndex:2}}/></main>;
}
