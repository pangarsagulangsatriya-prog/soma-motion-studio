import {SkeletonMemory,SceneTransition,type Segment} from './studio/StageMemory';
import {MotionInk} from './studio/MotionInk';
import {hydraDefaults} from './studio/hydraConfig';
import {PALETTES} from './studio/liveVisual';
import {HydraPipeline} from './studio/HydraPipeline';
import {MaterialRenderer} from './studio/drawMaterial';
import {useEffect,useRef} from 'react';
import {FaceLandmarker} from '@mediapipe/tasks-vision';
import type {MotionFrame,Settings,VisualParams,Landmark} from './engine/types';
import {clamp} from './engine/motion';
const HAND=[[0,1],[1,2],[2,3],[3,4],[0,5],[5,6],[6,7],[7,8],[5,9],[9,10],[10,11],[11,12],[9,13],[13,14],[14,15],[15,16],[13,17],[17,18],[18,19],[19,20],[0,17]];
const BODY=[[11,12],[11,13],[13,15],[12,14],[14,16],[11,23],[12,24],[23,24],[23,25],[25,27],[24,26],[26,28],[27,29],[29,31],[28,30],[30,32]];
const FACE=[...FaceLandmarker.FACE_LANDMARKS_FACE_OVAL,...FaceLandmarker.FACE_LANDMARKS_LIPS,...FaceLandmarker.FACE_LANDMARKS_LEFT_EYE,...FaceLandmarker.FACE_LANDMARKS_RIGHT_EYE,...FaceLandmarker.FACE_LANDMARKS_LEFT_EYEBROW,...FaceLandmarker.FACE_LANDMARKS_RIGHT_EYEBROW].map(e=>[e.start,e.end]);
type Point={x:number;y:number};type Trail=Point&{t:number;size:number};type Particle=Point&{vx:number;vy:number;age:number;life:number;r:number};
export function VisualStage({frameRef,settingsRef,paramsRef,videoRef,trackingRef,metricsRef}:{frameRef:React.RefObject<MotionFrame>;settingsRef:React.RefObject<Settings>;paramsRef:React.RefObject<VisualParams>;videoRef:React.RefObject<HTMLVideoElement|null>;trackingRef:React.RefObject<boolean>;metricsRef:React.RefObject<{fps:number;particles:number}>}){
 const canvas=useRef<HTMLCanvasElement>(null);
 useEffect(()=>{
  const material=new MaterialRenderer();const hydra=new HydraPipeline();const inkLayer=new MotionInk();const echoLayer=new SkeletonMemory();const transition=new SceneTransition();
  let raf=0,last=0,lastSample=-1,lastGood:MotionFrame|null=null,prevStyle='',prevInput='',counter=0,metricTime=0,seed=12345,spawnCarry=0;
  const trails=new Map<number,Trail[]>();let particles:Particle[]=[];let previousPoint:Point|null=null;
  const rand=()=>{seed=(seed*1664525+1013904223)>>>0;return seed/4294967296;};
  const draw=(now:number)=>{
   raf=requestAnimationFrame(draw);const c=canvas.current;if(!c)return;const s=settingsRef.current,p=paramsRef.current,f=frameRef.current;
   const rect=c.getBoundingClientRect();if(!rect.width||!rect.height)return;const w=rect.width,h=rect.height,dpr=Math.min(window.devicePixelRatio||1,1.75);
   if(c.width!==Math.round(w*dpr)||c.height!==Math.round(h*dpr)){c.width=Math.round(w*dpr);c.height=Math.round(h*dpr);}
   const ctx=c.getContext('2d')!;ctx.setTransform(dpr,0,0,dpr,0,0);ctx.clearRect(0,0,w,h);ctx.lineCap='round';ctx.lineJoin='round';
   const dt=Math.min(.05,Math.max(.001,(now-last)/1000||.016));last=now;
   if(prevStyle!==s.visual.style||prevInput!==s.input){trails.clear();particles=[];previousPoint=null;lastGood=null;prevStyle=s.visual.style;prevInput=s.input;lastSample=-1;}
   const live=f.tracked&&now-f.time<450;if(live)lastGood=f;
   const valid=live?f:lastGood;const fade=live?1:valid?clamp(1-(now-valid.time)/500):0;
   const vid=videoRef.current,scale=Math.min(w/(vid?.videoWidth||640),h/(vid?.videoHeight||480)),vw=(vid?.videoWidth||640)*scale,vh=(vid?.videoHeight||480)*scale;
   const project=(a:Landmark):Point=>({x:(w-vw)/2+(s.mirror?1-a.x:a.x)*vw,y:(h-vh)/2+a.y*vh});
   const anchors:Point[]=[];
   if(valid){if(valid.source==='mouse')anchors.push({x:valid.features.x*w,y:(1-valid.features.y)*h});else if(valid.hands.length)valid.hands.forEach(hand=>[4,8,12,16,20].forEach(i=>anchors.push(project(hand[i]))));else if(valid.pose.length)[15,16,11,12].forEach(i=>{const a=valid.pose[i];if((a.visibility??1)>.5)anchors.push(project(a));});else if(valid.face.length)[1,33,263,13,14,152].forEach(i=>anchors.push(project(valid.face[i])));}
   const primary=anchors[1]??anchors[0];const showVisual=s.visual.enabled&&s.output!=='sound';
   const hydraActive=hydra.render(ctx,s,f,anchors,live,w,h,now,dt,vid,material);
   if(!hydraActive&&(!(s.hydra?.enabled??true)||showVisual))material.draw(ctx,(s.hydra?.enabled??true)?{...s,visual:{...s.visual,color:PALETTES[s.hydra?.palette??'spectrum'].colors[0]}}:s,f,anchors,live,w,h,now,dt,(vid?.videoWidth||640)/(vid?.videoHeight||480));
   if(!showVisual){trails.clear();particles=[];previousPoint=null;}
   if(showVisual&&!hydraActive){
    ctx.strokeStyle=s.visual.color;ctx.fillStyle=s.visual.color;
    if(live&&f.time!==lastSample){
     for(let i=0;i<anchors.length;i++){const a=trails.get(i)??[];a.push({...anchors[i],t:now,size:p.size});if(a.length>190)a.shift();trails.set(i,a);}lastSample=f.time;
    }
    for(const [i,a]of trails){while(a.length&&now-a[0].t>s.visual.life*1000)a.shift();if(!a.length)trails.delete(i);}
    if(s.visual.style==='trail'){
     for(const a of trails.values()){for(let i=1;i<a.length;i++){const q=a[i],old=a[i-1];ctx.globalAlpha=Math.pow(clamp(1-(now-q.t)/(s.visual.life*1000)),1.4)*.8;ctx.lineWidth=(.7+q.size*7)*(1-p.tension*.65);ctx.beginPath();ctx.moveTo(old.x,old.y);ctx.lineTo(q.x,q.y);ctx.stroke();}}
    }
    if(s.visual.style==='fiber'&&primary&&fade>0){
     const count=Math.floor(12+p.density*42),r=(30+p.spread*Math.min(w,h)*.4)*(1-p.tension*.7);
     const second=anchors.length>5?anchors[6]:anchors.length>1?anchors[anchors.length-1]:{x:primary.x-Math.cos(p.rotation*Math.PI)*r,y:primary.y+r*.7};
     const dx=second.x-primary.x,dy=second.y-primary.y,len=Math.max(1,Math.hypot(dx,dy)),nx=-dy/len,ny=dx/len;
     for(let i=0;i<count;i++){const u=i/(count-1)-.5;const arc=u*r*2;ctx.lineWidth=.45+p.size*1.6;ctx.globalAlpha=(.13+(1-Math.abs(u)*2)*.58)*fade;ctx.beginPath();ctx.moveTo(primary.x+nx*u*8,primary.y+ny*u*8);ctx.bezierCurveTo(primary.x+dx*.2+nx*arc,primary.y+dy*.2+ny*arc,second.x-dx*.2+nx*arc,second.y-dy*.2+ny*arc,second.x-nx*u*8,second.y-ny*u*8);ctx.stroke();}
     // Secondary filaments follow the remaining real anchor points.
     if(anchors.length>2)for(let i=0;i<anchors.length-1;i++){ctx.globalAlpha=.18*fade;ctx.lineWidth=.7;ctx.beginPath();ctx.moveTo(anchors[i].x,anchors[i].y);ctx.quadraticCurveTo(primary.x,primary.y-r*.3,anchors[i+1].x,anchors[i+1].y);ctx.stroke();}
    }
    if(s.visual.style==='particles'){
     if(live&&primary){spawnCarry+=dt*(20+p.energy*200)*(.25+p.density);const count=Math.min(30,Math.floor(spawnCarry));spawnCarry-=count;const velocity=previousPoint?{x:(primary.x-previousPoint.x)/dt,y:(primary.y-previousPoint.y)/dt}:{x:0,y:0};
      for(let i=0;i<count&&particles.length<700;i++){const a=rand()*Math.PI*2,v=(15+rand()*100)*p.energy;particles.push({x:primary.x+(rand()-.5)*8,y:primary.y+(rand()-.5)*8,vx:velocity.x*.15+Math.cos(a)*v,vy:velocity.y*.15+Math.sin(a)*v,age:0,life:s.visual.life*(.5+rand()*.5),r:.6+rand()*p.size*4});}previousPoint=primary;
     }else previousPoint=null;
     particles=particles.filter(a=>a.age<a.life);for(const a of particles){a.age+=dt;const drag=Math.exp(-dt*(1+p.tension*4));a.vx*=drag;a.vy*=drag;a.x+=a.vx*dt;a.y+=a.vy*dt;ctx.globalAlpha=Math.pow(clamp(1-a.age/a.life),1.5)*.85;ctx.beginPath();ctx.arc(a.x,a.y,a.r,0,Math.PI*2);ctx.fill();}
    }
    if(s.visual.style==='planes'&&primary&&fade>0){
     const count=Math.round(3+p.density*9),radius=(25+p.size*Math.min(w,h)*.23)*(1-p.tension*.7);ctx.save();ctx.translate(primary.x,primary.y);ctx.rotate(p.rotation*Math.PI*.7);
     for(let i=0;i<count;i++){const ratio=.25+(i+1)/count;const rx=radius*ratio*(.7+p.spread),ry=radius*ratio;ctx.globalAlpha=(.12+.45*(1-i/count))*fade;ctx.lineWidth=.6+p.energy*1.5;ctx.beginPath();ctx.moveTo(-rx,ry*.4);ctx.lineTo(-rx*.55,-ry);ctx.lineTo(rx*.8,-ry*.6);ctx.lineTo(rx,ry*.8);ctx.closePath();ctx.stroke();if(i===count-1){ctx.globalAlpha=.035*fade;ctx.fill();}ctx.rotate((p.tension-.5)*.13);}
     ctx.restore();
    }
   }
   const hc={...hydraDefaults(),...s.hydra};
   ctx.globalAlpha=1;transition.apply(ctx,`${hc.enabled}:${hc.preset}:${hc.typography}:${hc.code}`,hc.transition,now,w,h,showVisual,hc.reset);
   const lines:Segment[]=[];
   const collect=(points:Landmark[],edges:number[][])=>{for(const [a,b]of edges){if(!points[a]||!points[b]||(points[a].visibility??1)<.5||(points[b].visibility??1)<.5)continue;const q=project(points[a]),r=project(points[b]);lines.push([q.x/w,q.y/h,r.x/w,r.y/h]);}};
   if(live){f.hands.forEach(hand=>collect(hand,HAND));if(f.pose.length)collect(f.pose,BODY);if(f.face.length)collect(f.face,FACE);if(f.source==='mouse'&&primary){lines.push([primary.x/w-.015,primary.y/h,primary.x/w+.015,primary.y/h],[primary.x/w,primary.y/h-.02,primary.x/w,primary.y/h+.02]);}}
   echoLayer.draw(ctx,hc,lines,live,s.input+String(s.mirror),f.time,now,w,h,showVisual);
   inkLayer.draw(ctx,hc,anchors,live,s.input+String(s.mirror),f.time,f.features.speed,w,h,dt,showVisual);
   if(trackingRef.current&&valid&&fade>0){
    const lum=parseInt(s.layers.background.slice(1,3),16)*.299+parseInt(s.layers.background.slice(3,5),16)*.587+parseInt(s.layers.background.slice(5,7),16)*.114;const ink=lum>145&&!s.layers.camera?'#243029':PALETTES[hc.palette].colors[0];
    ctx.globalAlpha=fade;ctx.strokeStyle=ink;ctx.fillStyle=ink;ctx.lineWidth=2;
    const skeleton=(points:Landmark[],edges:number[][],dots:boolean)=>{for(const [a,b]of edges){if(!points[a]||!points[b]||(points[a].visibility??1)<.5||(points[b].visibility??1)<.5)continue;const q=project(points[a]),r=project(points[b]);ctx.beginPath();ctx.moveTo(q.x,q.y);ctx.lineTo(r.x,r.y);ctx.strokeStyle='#07100ded';ctx.lineWidth=5;ctx.stroke();ctx.strokeStyle=ink;ctx.lineWidth=2;ctx.stroke();}if(dots)points.forEach(a=>{if((a.visibility??1)<.5)return;const q=project(a);ctx.beginPath();ctx.arc(q.x,q.y,3,0,Math.PI*2);ctx.fill();ctx.strokeStyle='#07100d';ctx.lineWidth=1;ctx.stroke();ctx.strokeStyle=ink;});};
    valid.hands.forEach(hand=>skeleton(hand,HAND,true));if(valid.pose.length)skeleton(valid.pose,BODY,true);if(valid.face.length)skeleton(valid.face,FACE,false);
    if(valid.source==='mouse'&&primary){ctx.beginPath();ctx.arc(primary.x,primary.y,valid.features.open?15:7,0,Math.PI*2);ctx.moveTo(primary.x-23,primary.y);ctx.lineTo(primary.x-18,primary.y);ctx.moveTo(primary.x+18,primary.y);ctx.lineTo(primary.x+23,primary.y);ctx.stroke();}
   }
   ctx.globalAlpha=1;counter++;if(now-metricTime>700){metricsRef.current={fps:Math.round(counter*1000/(now-metricTime)),particles:particles.length};counter=0;metricTime=now;}
  };raf=requestAnimationFrame(draw);return()=>{cancelAnimationFrame(raf);material.dispose();hydra.dispose();};
 },[frameRef,settingsRef,paramsRef,videoRef,trackingRef,metricsRef]);
 return <canvas ref={canvas} className="tracking-overlay generative-canvas" aria-label="Kanvas gerak dan visual generatif"/>;
}
export function VisualGlyph({style}:{style:string}){
 return <svg viewBox="0 0 100 60" fill="none" aria-hidden="true">{style==='trail'?Array.from({length:4},(_,i)=><path key={i} d={`M${5+i*2} ${45-i*4} C30 ${65-i*10} 30 ${-10+i*8} 53 ${19+i*3} S75 ${60-i*6} 94 ${11+i*5}`} stroke="currentColor" strokeWidth={1+i*.4} opacity={.2+i*.2}/>):style==='fiber'?Array.from({length:12},(_,i)=><path key={i} d={`M15 40 C${25+i*3} ${-20+i*8} ${75-i*2} ${-5+i*7} 85 17`} stroke="currentColor" strokeWidth=".7" opacity=".65"/>):style==='particles'?Array.from({length:32},(_,i)=><circle key={i} cx={10+(i*29%83)} cy={8+(i*17%45)} r={.6+(i%4)*.4} fill="currentColor" opacity={.25+(i%5)*.15}/>):Array.from({length:6},(_,i)=><path key={i} d={`M${16+i*3} ${43-i*2} L${30+i*2} ${8+i*2} L${86-i*3} ${18+i} L${72-i*2} ${52-i*2} Z`} stroke="currentColor" strokeWidth=".8" opacity={.2+i*.12}/>)}</svg>;
}
