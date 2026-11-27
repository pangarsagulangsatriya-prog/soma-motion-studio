import {useEffect,useRef,type RefObject} from 'react';
import {drawSkeletonBodies} from '../stage/fullBodySkeleton.ts';
import type {F3MotionFrame,F3StageFrame} from './F3Types.ts';

type Props={
 mode:'input'|'motion'|'perform';
 videoA:RefObject<HTMLVideoElement|null>;
 videoB:RefObject<HTMLVideoElement|null>;
 motion:RefObject<F3MotionFrame|null>;
 stage:RefObject<F3StageFrame>;
 showSkeleton:boolean;
};

function paintSource(canvas:HTMLCanvasElement,video:HTMLVideoElement|null,pose:F3MotionFrame|null,
 showSkeleton:boolean,crop?:{x:number;y:number;width:number;height:number}){
 const ctx=canvas.getContext('2d',{alpha:false});
 if(!ctx)return;
 const w=canvas.width,h=canvas.height;
 ctx.fillStyle='#030705';ctx.fillRect(0,0,w,h);
 const notice=(label:string)=>{
  ctx.fillStyle='#b6c9b7';ctx.font='500 24px system-ui';ctx.textAlign='center';
  ctx.fillText(label,w/2,h/2);
 };
 if(!video||video.readyState<2||video.videoWidth<=0||video.videoHeight<=0){
  notice('Menunggu frame kamera');return;
 }
 if(video.paused){notice('Video dijeda · sambungkan ulang');return;}
 let sx=0,sy=0,sw=video.videoWidth,sh=video.videoHeight;
 if(crop&&crop.width>0&&crop.height>0&&crop.x>=0&&crop.y>=0&&
  crop.x+crop.width<=sw&&crop.y+crop.height<=sh){
  sx=crop.x;sy=crop.y;sw=crop.width;sh=crop.height;
 }
 const scale=Math.min(w/sw,h/sh),dw=sw*scale,dh=sh*scale,dx=(w-dw)/2,dy=(h-dh)/2;
 try{ctx.drawImage(video,sx,sy,sw,sh,dx,dy,dw,dh);}catch{notice('Frame tidak dapat dibaca');return;}
 if(!showSkeleton||!pose||!pose.fresh||pose.pose.length<33||
   performance.now()-pose.timestamp>850)return;
 ctx.save();
 drawSkeletonBodies(ctx,[pose.pose],{x:dx,y:dy,width:dw,height:dh},
  {labels:false,lineWidth:2.4,minVisibility:.45});
 ctx.restore();
}

export function F3VideoMonitor({mode,videoA,videoB,motion,stage,showSkeleton}:Props){
 const aCanvas=useRef<HTMLCanvasElement>(null),bCanvas=useRef<HTMLCanvasElement>(null);
 useEffect(()=>{
  let raf=0,previous=0,stopped=false;
  const draw=(time:number)=>{
   if(stopped)return;
   raf=requestAnimationFrame(draw);
   if(time-previous<50)return;
   previous=time;
   const a=aCanvas.current,b=bCanvas.current;
   if(a)paintSource(a,videoA.current,motion.current,(mode==='motion'||mode==='perform')&&showSkeleton);
   if(b)paintSource(b,videoB.current,null,false,mode==='motion'?stage.current.cameraB.crop:undefined);
  };
  raf=requestAnimationFrame(draw);
  return()=>{stopped=true;cancelAnimationFrame(raf);};
 },[mode,videoA,videoB,motion,stage,showSkeleton]);
 return <div className={'f3-monitor-pair f3-monitor-'+mode}>
  <section className="f3-monitor-tile">
   <header><strong>Kamera A · Aktor</strong><small>{mode==='perform'?'Preview operator':mode==='motion'?(showSkeleton?'Skeleton aktif':'Video asli'):'Input asli'}</small></header>
   <canvas ref={aCanvas} width={960} height={540} aria-label={mode==='motion'?'Monitor Kamera A dengan pilihan skeleton':'Monitor sumber Kamera A'}/>
  </section>
  {mode!=='perform'&&<section className="f3-monitor-tile">
   <header><strong>Kamera B · Kaki penonton</strong><small>{mode==='motion'?'Crop live':'Input asli'}</small></header>
   <canvas ref={bCanvas} width={960} height={540} aria-label="Monitor sumber Kamera B"/>
  </section>}
 </div>;
}
