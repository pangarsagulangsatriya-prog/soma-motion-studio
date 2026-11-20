import {useEffect,useRef} from 'react';
import type {RefObject} from 'react';
import {ArtisticFootprintRuntime} from '../../footprints/scenes/ArtisticFootprintRuntime.ts';
import type {HydraFootprintSettings} from '../../footprints/scenes/hydraFootprintModel.ts';
import {syntheticSceneEvents} from './composeSceneEngine.ts';
import type {FlagshipRecipe} from './flagshipVisualModel.ts';

// The Stage owns the ONLY active WebGL2 material pass and Hydra context.
// Inactive browser cards use inexpensive 2D motion samples (6 FPS) and never
// allocate extra WebGL contexts. The active card mirrors the real Stage output.
export const THUMBNAIL_FPS=6;
function sampleArchive(canvas:HTMLCanvasElement,time:number){
 const c=canvas.getContext('2d');if(!c)return;
 const w=canvas.width,h=canvas.height;
 c.fillStyle='#c9c9bd';c.fillRect(0,0,w,h);
 c.fillStyle='#7d8e84';c.fillRect(0,0,w,h*.36);
 c.fillStyle='#242a25';c.fillRect(0,h*.36,w,h*.045);
 for(let i=0;i<24;i++){
  const y=h*.45+i*i*.38;
  if(y>h)break;
  c.fillStyle=i%2?'#5c6a5d':'#9ba58f';
  c.fillRect(0,y+Math.sin(time*.4+i*.37)*1.4,w,Math.max(1,i*.07));
 }
 c.strokeStyle='#3f3831';c.lineWidth=3;c.beginPath();
 c.moveTo(w*.47,h);c.lineTo(w*.51,h*.4);c.stroke();
}
export function FlagshipLivePreview({recipe,active,settings,stageCanvas,stageStatus}:{
 recipe:FlagshipRecipe;active:boolean;settings?:HydraFootprintSettings;
 stageCanvas?:RefObject<HTMLCanvasElement|null>;stageStatus?:string;
}){
 const outputRef=useRef<HTMLCanvasElement>(null);
 const stageRef=useRef(stageCanvas);stageRef.current=stageCanvas;
 const activeRef=useRef(active);activeRef.current=active;
 const statusRef=useRef(stageStatus);statusRef.current=stageStatus;
 const settingsRef=useRef(settings);settingsRef.current=settings;
 useEffect(()=>{
  const canvas=outputRef.current;if(!canvas)return;
  const ctx=canvas.getContext('2d');if(!ctx)return;
  const sample=document.createElement('canvas');sample.width=240;sample.height=135;
  const artistic=new ArtisticFootprintRuntime();
  const events=syntheticSceneEvents();
  // ArtisticFootprintRuntime measures expiry against the timestamp passed to
  // paint(). The fixed CP-08 sample times (100-860 ms) expired immediately on
  // real browser clocks, leaving all flagship thumbnail canvases black.
  const thumbnailEpoch=performance.now();
  artistic.ingest(events,0,thumbnailEpoch);
  let raf=0,last=-Infinity,visible=true,disposed=false;
  const observer=typeof IntersectionObserver==='undefined'?null:new IntersectionObserver(entries=>{
   visible=entries[0]?.isIntersecting??false;
  },{threshold:.05});
  observer?.observe(canvas);
  const render=(now:number)=>{
   if(disposed)return;
   raf=requestAnimationFrame(render);
   if(document.visibilityState==='hidden'||!visible||now-last<1000/THUMBNAIL_FPS)return;
   last=now;
   const live=stageRef.current?.current;
   if(activeRef.current&&statusRef.current==='ready'&&live&&live.width&&live.height){
    ctx.drawImage(live,0,0,canvas.width,canvas.height);
    canvas.dataset.previewSource='stage';return;
   }
   // Distinguish thumbnails from the final GPU image explicitly.
   if(recipe.id==='rift')sampleArchive(sample,now/1000);
   else {
    // Refresh the preview sequence before it expires during a long session;
    // these are DEMO marks, never injected into Track or the projection bus.
    if(now-thumbnailEpoch>18000){
     artistic.ingest(events.map((event,i)=>({...event,
      eventId:event.eventId+':'+Math.floor((now-thumbnailEpoch)/18000),
      atMs:now+i*.001})),0,now);
    }
    artistic.paint(sample,now,{style:recipe.artwork==='off'?'trace':recipe.artwork,
     view:'both',treatment:'artistic',
     intensity:Math.max(.2,settingsRef.current?.mix??recipe.mix),
     persistence:recipe.id==='echo'?.92:.75});
   }
   ctx.clearRect(0,0,canvas.width,canvas.height);
   ctx.drawImage(sample,0,0,canvas.width,canvas.height);
   canvas.dataset.previewSource='sample';
  };
  raf=requestAnimationFrame(render);
  return()=>{disposed=true;cancelAnimationFrame(raf);observer?.disconnect();};
 },[recipe]);
 return <canvas ref={outputRef} className="cp08-scene-frame fv04-live-canvas" width={240}
  height={135} role="img" aria-label={'Preview bergerak '+recipe.title}/>;
}
