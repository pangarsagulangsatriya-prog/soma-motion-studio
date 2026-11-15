import {forwardRef,useEffect,useImperativeHandle,useRef,type RefObject} from 'react';
import type {MotionFrame,Settings} from '../engine/types';
import {download} from '../engine/recording';
import {drawFoot} from './glyph';
import {nextImprint} from './spacing';
import {palettes,patternSVG,smoothSample,type Sample,type Recipe} from './pattern';
import './studio-footprints.css';

export type FootprintStyle='Tapak'|'Garis'|'Titik'|'Campuran';
export type FootprintConfig={
 style:FootprintStyle; palette:number; size:number; life:number; delay:number;
 showLive:boolean; showTrail:boolean; hold:boolean; colors:{background:string;left:string;right:string};
};
export const footprintDefaults=():FootprintConfig=>({
 style:'Campuran',palette:0,size:32,life:22,delay:0,showLive:true,showTrail:true,hold:false,
 colors:{background:palettes[0][1],left:palettes[0][2],right:palettes[0][3]}
});
export type FootprintsHandle={
 clearView:()=>void;newSession:()=>void;exportPNG:()=>Promise<void>;
 exportSVG:()=>void;exportJSON:()=>void;count:()=>number;
};
type Props={
 active:boolean;frameRef:RefObject<MotionFrame>;videoRef:RefObject<HTMLVideoElement|null>;
 settingsRef:RefObject<Settings>;trackingRef:RefObject<boolean>;
 canvasRef:RefObject<HTMLCanvasElement|null>;config:FootprintConfig;onNotice:(s:string)=>void;
};
/** Shares the single SOMA Body MotionFrame and camera. No second tracker, camera or output window. */
export const StudioFootprints=forwardRef<FootprintsHandle,Props>(function StudioFootprints(props,ref){
 const {canvasRef}=props;
 const live=useRef<(Sample|null)[]>([null,null]);
 const lastPrint=useRef<(Sample|null)[]>([null,null]);
 const view=useRef<Sample[]>([]);
 const session=useRef<Sample[]>([]);
 const elapsed=useRef(0);
 const lastFrame=useRef(-1);
 const latest=useRef(props);latest.current=props;
 const recipe=():Recipe=>{
  const p=latest.current;
  return {style:p.config.style,palette:p.config.palette,mirror:p.settingsRef.current.mirror,
   size:p.config.size,showTrail:p.config.showTrail,colors:p.config.colors};
 };
 const requireSamples=()=>{if(!session.current.length)throw Error('Belum ada jejak kaki. Nyalakan kamera Body lalu berjalan di dalam bingkai.');};
 const saveSVG=()=>{try{requireSamples();download(new Blob([patternSVG(session.current,recipe())],{type:'image/svg+xml'}),'SOMA_FOOTPRINTS_PATTERN.svg');latest.current.onNotice('SVG pola kaki tersimpan.');}catch(e){latest.current.onNotice((e as Error).message);}};
 const saveJSON=()=>{try{requireSamples();const payload={schema:'soma.footprints.session',version:2,coordinateSpace:'stage-normalized',calibrated:false,
  source:'body-pose',recipe:recipe(),samples:session.current};download(new Blob([JSON.stringify(payload)],{type:'application/json'}),'SOMA_FOOTPRINTS_SESSION.json');latest.current.onNotice('Data sesi Footprints tersimpan.');}catch(e){latest.current.onNotice((e as Error).message);}};
 const savePNG=async()=>{try{requireSamples();const svg=patternSVG(session.current,recipe());const url=URL.createObjectURL(new Blob([svg],{type:'image/svg+xml'}));try{const img=new Image();img.src=url;await img.decode();const canvas=document.createElement('canvas');canvas.width=1280;canvas.height=720;canvas.getContext('2d')?.drawImage(img,0,0);const blob=await new Promise<Blob>((resolve,reject)=>canvas.toBlob(b=>b?resolve(b):reject(Error('Gagal memproses PNG.')),'image/png'));download(blob,'SOMA_FOOTPRINTS_PATTERN.png');latest.current.onNotice('PNG pola sepanjang sesi tersimpan.');}finally{URL.revokeObjectURL(url);}}catch(e){latest.current.onNotice((e as Error).message);}};
 useImperativeHandle(ref,()=>({
  clearView:()=>{view.current=[];live.current=[null,null];lastPrint.current=[null,null];},
  newSession:()=>{view.current=[];session.current=[];live.current=[null,null];lastPrint.current=[null,null];elapsed.current=0;lastFrame.current=-1;latest.current.onNotice('Sesi Footprints baru dimulai.');},
  exportPNG:savePNG,exportSVG:saveSVG,exportJSON:saveJSON,count:()=>session.current.length
 }));
 useEffect(()=>{
  let raf=0,prior=performance.now(),renderAt=0;
  const tick=(now:number)=>{
   raf=requestAnimationFrame(tick);
   const p=latest.current,f=p.frameRef.current,c=p.config;
   const dt=Math.min(75,Math.max(0,now-prior));prior=now;
   if(!p.active)return;
   if(!c.hold)elapsed.current+=dt;
   const clock=elapsed.current;
   if(!c.hold&&f.source==='camera'&&f.time!==lastFrame.current){
    lastFrame.current=f.time;
    const valid=f.tracked&&f.pose.length>=33&&f.time<=now&&now-f.time<350;
    const video=p.videoRef.current;
    const aspect=video?.videoWidth&&video?.videoHeight?video.videoWidth/video.videoHeight:4/3;
    const factorX=Math.min(1,aspect/(16/9)),factorY=Math.min(1,(16/9)/aspect);
    for(let side=0;side<2;side++){
     const heel=f.pose[29+side],toe=f.pose[31+side];
     if(!valid||!heel||!toe||(heel.visibility??0)<.55||(toe.visibility??0)<.55){
      live.current[side]=null;lastPrint.current[side]=null;continue;
     }
     const raw={x:(heel.x+toe.x)/2,y:(heel.y+toe.y)/2};
     const foot={x:(1-factorX)/2+raw.x*factorX,y:(1-factorY)/2+raw.y*factorY};
     if(!Number.isFinite(foot.x)||!Number.isFinite(foot.y)||foot.x<0||foot.x>1||foot.y<0||foot.y>1){
      live.current[side]=null;lastPrint.current[side]=null;continue;
     }
     const heading=Math.atan2((toe.y-heel.y)*factorY*720,(toe.x-heel.x)*factorX*1280);
     const mark=smoothSample(live.current[side],foot,clock,heading,side);
     mark.stamp=nextImprint(lastPrint.current[side],mark,c.size);
     if(mark.stamp)lastPrint.current[side]={...mark};
     live.current[side]=mark;view.current.push(mark);
     if(session.current.length<100000)session.current.push({...mark});
    }
   }
   if(!c.hold&&now-f.time>400){live.current=[null,null];lastPrint.current=[null,null];}
   view.current=view.current.filter(m=>clock-m.t<(c.life+c.delay)*1000).slice(-12000);
   if(now-renderAt<1000/30)return;renderAt=now;
   const target=p.canvasRef.current;if(!target)return;
   const ctx=target.getContext('2d');if(!ctx)return;
   const w=target.width,h=target.height;
   ctx.setTransform(1,0,0,1,0,0);ctx.clearRect(0,0,w,h);
   const palette=c.colors;
   if(!p.settingsRef.current.layers.camera){ctx.fillStyle=palette.background;ctx.fillRect(0,0,w,h);}
   const mirror=p.settingsRef.current.mirror;
   const xy=(m:Sample)=>({x:(mirror?1-m.x:m.x)*w,y:m.y*h});
   const prev:(Sample|null)[]=[null,null];
   for(const m of view.current){
    const age=clock-m.t-c.delay*1000;if(age<0)continue;
    const alpha=Math.max(0,1-age/(c.life*1000));
    const color=m.side?palette.right:palette.left;
    ctx.globalAlpha=alpha;ctx.strokeStyle=color;ctx.fillStyle=color;
    const q=xy(m),old=prev[m.side];
    if((c.showTrail||c.style==='Garis'||c.style==='Campuran')&&old&&m.join){
     const a=xy(old);ctx.lineWidth=2.3;ctx.lineCap='round';ctx.beginPath();ctx.moveTo(a.x,a.y);ctx.lineTo(q.x,q.y);ctx.stroke();
    }
    if((c.style==='Tapak'||c.style==='Campuran')&&m.stamp)drawFoot(ctx,q.x,q.y,mirror?Math.PI-m.heading:m.heading,m.side,c.size);
    else if(c.style==='Titik'){ctx.beginPath();ctx.arc(q.x,q.y,2.8,0,Math.PI*2);ctx.fill();}
    prev[m.side]=m;
   }
   if(c.showLive)for(const m of live.current)if(m){
    const q=xy(m);ctx.globalAlpha=.9;ctx.fillStyle=m.side?palette.right:palette.left;
    drawFoot(ctx,q.x,q.y,mirror?Math.PI-m.heading:m.heading,m.side,c.size*.8);
   }
   if(p.trackingRef.current&&f.tracked&&now-f.time<350){
    const links=[[23,25],[25,27],[27,29],[29,31],[24,26],[26,28],[28,30],[30,32]];
     const cameraAspect=(p.videoRef.current?.videoWidth||640)/(p.videoRef.current?.videoHeight||480);
     const factorX=Math.min(1,cameraAspect/(16/9)),factorY=Math.min(1,(16/9)/cameraAspect);

    const point=(i:number)=>f.pose[i];ctx.globalAlpha=.7;ctx.strokeStyle='#D4E7DD';ctx.lineWidth=1.5;
    for(const [a,b]of links){const x=point(a),y=point(b);if(!x||!y||(x.visibility??0)<.55||(y.visibility??0)<.55)continue;
     const one={x:(1-factorX)/2+x.x*factorX,y:(1-factorY)/2+x.y*factorY};
     const two={x:(1-factorX)/2+y.x*factorX,y:(1-factorY)/2+y.y*factorY};
     ctx.beginPath();ctx.moveTo((mirror?1-one.x:one.x)*w,one.y*h);ctx.lineTo((mirror?1-two.x:two.x)*w,two.y*h);ctx.stroke();
    }
   }
   ctx.globalAlpha=1;
  };
  raf=requestAnimationFrame(tick);return()=>cancelAnimationFrame(raf);
 },[]);
 return <canvas ref={canvasRef} width={1280} height={720} className="tracking-overlay studio-footprints-canvas" aria-label="Footprints: jejak kaki dari gerak tubuh" style={{display:props.active?'block':'none'}}/>;
});
