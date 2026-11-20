import {useEffect,useRef} from 'react';
import type {RefObject} from 'react';
import {ArtisticFootprintRuntime} from '../../footprints/scenes/ArtisticFootprintRuntime.ts';
import {FootprintGpuMaterialRuntime} from '../../footprints/scenes/FootprintGpuMaterialRuntime.ts';
import type {FootMotionEventV2} from '../../footprints/scenes/FootMotionEventV2.ts';
import {normalizeHydraFootprintSettings,type HydraFootprintSettings} from '../../footprints/scenes/hydraFootprintModel.ts';
import {flagshipHydraPatch,type FlagshipRecipe} from './flagshipVisualModel.ts';

const THUMBNAIL_FPS=12;
const thumbnailSettings=(recipe:FlagshipRecipe,live?:HydraFootprintSettings)=>
 normalizeHydraFootprintSettings({...flagshipHydraPatch(recipe.id),...live,quality:'low'});
function sampleArchive(canvas:HTMLCanvasElement,time:number){
 const c=canvas.getContext('2d');if(!c)return;
 const w=canvas.width,h=canvas.height;
 c.fillStyle='#d0d0c4';c.fillRect(0,0,w,h);
 c.fillStyle='#89918d';c.fillRect(0,0,w,h*.39);
 c.fillStyle='#202a28';c.fillRect(0,h*.39,w,h*.035);
 c.fillStyle='#53655e';
 for(let i=0;i<33;i++){
  const y=h*.45+i*i*.29;
  if(y>h)break;
  const drift=Math.sin(i*.37+time*.04)*2;
  c.fillRect(0,y+drift,w,Math.max(.6,i*.06));
 }
 c.strokeStyle='#302d26';c.lineWidth=3;c.beginPath();
 c.moveTo(w*.48,h);c.lineTo(w*.52,h*.40);c.stroke();
}
const makeEvent=(i:number,kind:'contact'|'slide'|'pivot',atMs:number):FootMotionEventV2=>{
 const actorId=i%2?'B':'A',foot=i%2?'right':'left';
 return {schema:'soma.foot-motion-event',version:2,eventId:'fv04-'+i+'-'+kind,
  originEventId:'fv04-'+i,sessionId:'fv04-demo',generation:0,
  actorId,foot,kind,source:'simulator',x:.22+((i*7)%11)*.051,
  y:.25+((i*3)%8)*.068,atMs,speed:.5,confidence:1,
  verified:kind==='contact',verification:kind==='contact'?'simulated':'unverified',
  coordinateBasis:'simulated'};
};

/** Real, throttled WebGL material preview. Active cards may mirror the actual
 * Stage Hydra output, while inactive cards render synthetic contact/slide/pivot
 * with the production material shader. No second Hydra instance is created.
 */
export function FlagshipLivePreview({recipe,active,settings,stageCanvas,stageStatus}:{
 recipe:FlagshipRecipe;active:boolean;settings?:HydraFootprintSettings;
 stageCanvas?:RefObject<HTMLCanvasElement|null>;stageStatus?:string;
}){
 const outputRef=useRef<HTMLCanvasElement>(null);
 const liveSettingsRef=useRef(settings);liveSettingsRef.current=settings;
 const stageRef=useRef(stageCanvas);stageRef.current=stageCanvas;
 const activeRef=useRef(active);activeRef.current=active;
 const statusRef=useRef(stageStatus);statusRef.current=stageStatus;
 useEffect(()=>{
  const canvas=outputRef.current;if(!canvas)return;
  const context=canvas.getContext('2d');if(!context)return;
  const source=document.createElement('canvas');source.width=320;source.height=180;
  const artistic=new ArtisticFootprintRuntime();
  let material:FootprintGpuMaterialRuntime|null=null;
  try{material=new FootprintGpuMaterialRuntime(document.createElement('canvas'));}
  catch{material=null;}
  let frame=0,last=-Infinity,iteration=0,lastEvent=-Infinity;
  let visible=true,disposed=false;
  const observer=typeof IntersectionObserver==='undefined'?null:new IntersectionObserver(entries=>{
   visible=entries[0]?.isIntersecting??false;
  },{threshold:.05});
  observer?.observe(canvas);
  const render=(now:number)=>{
   if(disposed)return;
   frame=requestAnimationFrame(render);
   if(document.visibilityState==='hidden'||!visible||now-last<1000/THUMBNAIL_FPS)return;
   last=now;
   const live=stageRef.current?.current;
   if(activeRef.current&&statusRef.current==='ready'&&live&&live.width>0&&live.height>0){
    context.drawImage(live,0,0,canvas.width,canvas.height);
    canvas.dataset.previewSource='stage';return;
   }
   const events:FootMotionEventV2[]=[];
   if(now-lastEvent>=710){
    lastEvent=now;iteration++;
    events.push(makeEvent(iteration,'contact',now));
    if(iteration>1)events.push(makeEvent(iteration,'slide',now));
    if(iteration%3===0)events.push(makeEvent(iteration,'pivot',now));
   }
   if(recipe.id==='rift')sampleArchive(source,now/1000);
   else{
    artistic.ingest(events,0,now);
    artistic.paint(source,now,{style:recipe.artwork==='off'?'trace':recipe.artwork,
     view:'both',treatment:'artistic',intensity:.9,persistence:recipe.id==='echo'?.93:.75});
   }
   try{
    const gpu=material?.paint(source,events,0,now,
     thumbnailSettings(recipe,activeRef.current?liveSettingsRef.current:undefined));
    context.drawImage(gpu??source,0,0,canvas.width,canvas.height);
    canvas.dataset.previewSource=gpu?'gpu':'fallback';
   }catch{
    material?.dispose();material=null;
    context.drawImage(source,0,0,canvas.width,canvas.height);
    canvas.dataset.previewSource='fallback';
   }
  };
  frame=requestAnimationFrame(render);
  return()=>{disposed=true;cancelAnimationFrame(frame);observer?.disconnect();material?.dispose();};
 },[recipe]);
 return <canvas ref={outputRef} className="cp08-scene-frame fv04-live-canvas" width={240}
  height={135} role="img" aria-label={'Preview bergerak '+recipe.title}/>;
}
