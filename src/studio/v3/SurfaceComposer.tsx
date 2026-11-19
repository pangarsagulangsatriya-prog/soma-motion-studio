import {useEffect,useRef,useState} from 'react';
import type {ChangeEvent,PointerEvent,RefObject,KeyboardEvent} from 'react';
import type {MotionFrame} from '../../engine/types.ts';
import type {Projection} from '../../projection/useProjection.ts';
import type {MultiPoseGaitRouter} from '../../footprints/live/MultiPoseGaitRouter.ts';
import type {LiveFloorTrackingEngine} from '../../footprints/live/LiveFloorTrackingEngine.ts';
import {cameraBinding,cameraBindingKey} from '../../footprints/live/LiveFloorTrackingEngine.ts';
import {buildLowerBodyMask,LOWER_BODY_MASK_DEFAULTS} from '../../footprints/stage-optics/LowerBodyMaskEngine.ts';
import {DualSurfaceRoutingPanel,type StageRouteInput} from '../../footprints/stage-optics/DualSurfaceRoutingPanel.tsx';
import {SOFTWARE_PREVIEW_BLACKOUT_EVENT} from './stagePreviewCommands.ts';
import './SurfaceComposer.css';
import type {FloorSceneId} from '../../footprints/scenes/sceneRegistry.ts';
import {COMPOSE_SCENES} from './composeWorkspaceModel.ts';
import {canRenderComposeSurface} from './composePreviewGate.ts';
import {catalogRecipe,catalogThumbnailSvg} from '../../footprints/scenes/artisticCatalog.ts';
import {HYDRA_FOOTPRINT_STYLES,type HydraFootprintSettings} from '../../footprints/scenes/hydraFootprintModel.ts';
import './vis-r3-gallery.css';
import type {FootMotionEventV2} from '../../footprints/scenes/FootMotionEventV2.ts';
import {MOTION_RECIPE_TRIGGERS,MOTION_RECIPE_TREATMENTS,normalizeMotionRecipeRule,
 resolveMotionRecipeCue,motionRecipeEnvelope,type MotionRecipeRule,type MotionRecipeCue} from '../../footprints/scenes/motionRecipeModel.ts';
import './vis-r4-recipe.css';
import './ux-r3-compose.css';
import {useCompositionHistory} from './useCompositionHistory.ts';
import {FootprintDemo,LegDemo} from './MappingStudioDemo.tsx';
import {applyFootprintEvent,emptyFootprintState,makeDemoFootEvent,pruneFootprints,type FootprintState,type FootSide,type FootEventKind} from './footprintEventStore.ts';
import {MappingStudioFootprintControls} from './MappingStudioFootprintControls.tsx';
import type {FootprintConfig} from '../../footprints/StudioFootprints.tsx';

type Surface='BODY A'|'BODY B'|'FLOOR';
type Mask='silhouette'|'polygon'|'none';
type Layer={id:string;name:string;mediaId:string;visible:boolean;opacity:number;scale:number;x:number;y:number;rotation:number;blend:GlobalCompositeOperation;mask:Mask;feather:number;points:[number,number][];recipe:string;motionRecipe?:MotionRecipeRule};
type Media={id:string;name:string;kind:'image'|'video';url:string;mime:string};
type Composition=Record<Surface,Layer[]>;
type Snapshot={version:1;composition:Composition;selected:Surface};
const surfaces:Surface[]=['BODY A','BODY B','FLOOR'];
const key='soma-s64-composer-v1';
const presetKey='soma-s64-presets-v1';
const makeLayer=(mediaId='',name='Layer'):Layer=>({id:crypto.randomUUID(),name,mediaId,visible:true,opacity:100,scale:100,x:0,y:0,rotation:0,blend:'source-over',mask:'none',feather:0,points:[[.2,.2],[.8,.2],[.8,.8],[.2,.8]],recipe:'none'});
const initial=():Composition=>({'BODY A':[makeLayer('', 'Body A archive')],'BODY B':[makeLayer('', 'Body B archive')],FLOOR:[makeLayer('', 'Floor path')]});
const valid=(v:unknown):v is Snapshot=>{if(!v||typeof v!=='object')return false;const x=v as Snapshot;return x.version===1&&surfaces.includes(x.selected)&&surfaces.every(s=>Array.isArray(x.composition?.[s])&&x.composition[s].length<=24&&x.composition[s].every(l=>l&&typeof l.id==='string'&&typeof l.name==='string'&&typeof l.mediaId==='string'&&typeof l.opacity==='number'&&typeof l.scale==='number'&&Array.isArray(l.points)));};
type Props={
 footprint?:FootprintConfig;
 updateFootprint?:(patch:Partial<FootprintConfig>)=>void;
 bodyCanvas:RefObject<HTMLCanvasElement|null>;floorCanvas:RefObject<HTMLCanvasElement|null>;
 visualFloorCanvas?:RefObject<HTMLCanvasElement|null>;previewFloorEnabled?:boolean;
 /** Software-only composited FLOOR overlay in the shared three-monitor shell. */
 composePreviewCanvas?:RefObject<HTMLCanvasElement|null>;
 archiveHydraCanvas?:RefObject<HTMLCanvasElement|null>;
 onArchiveHydraChange?:(enabled:boolean)=>void;
 hydraSettings?:HydraFootprintSettings;
 onHydraSettingsChange?:(patch:Partial<HydraFootprintSettings>)=>void;
 hydraStatus?:string;previewResumeRevision?:number;previewBlackout?:boolean;
 frameRef:RefObject<MotionFrame>;videoRef:RefObject<HTMLVideoElement|null>;
 router:MultiPoseGaitRouter;floorTracker:LiveFloorTrackingEngine;projection:Projection;
 cameraOn:boolean;bodySelected:boolean;performerCount:1|2;floorReady:boolean;
 floorEvents:()=>{id:string;kind:string;performerId:string;timestampMs:number}[];
 motionEvents?:()=>readonly FootMotionEventV2[];
 motionSession?:()=>string;
 identitySafe:boolean;onClose:()=>void;initialOutputQA?:boolean;experimentLocked?:boolean;
 embedded?:boolean;mapMode?:boolean;sceneId?:'footprints'|FloorSceneId;onSceneChange?:(id:'footprints'|FloorSceneId)=>void;
};
export function SurfaceComposer({footprint,updateFootprint,frameRef,videoRef,router,floorTracker,projection,floorCanvas,cameraOn,bodySelected,performerCount,floorReady,floorEvents,identitySafe,onClose,experimentLocked=false,embedded=false,mapMode=false,sceneId='footprints',onSceneChange,visualFloorCanvas,previewFloorEnabled=false,composePreviewCanvas,motionEvents,motionSession,archiveHydraCanvas,onArchiveHydraChange,hydraSettings,onHydraSettingsChange,hydraStatus,previewResumeRevision=0,previewBlackout=false}:Props){
 const [selected,setSelected]=useState<Surface>('FLOOR');
 const [previewArrangement,setPreviewArrangement]=useState<'surface'|'split'>('surface');
 const previewArrangementRef=useRef(previewArrangement);previewArrangementRef.current=previewArrangement;
 const splitScratch=useRef<{body:HTMLCanvasElement;floor:HTMLCanvasElement}|null>(null);
 const history=useCompositionHistory<Composition>(()=>{try{const p=JSON.parse(localStorage.getItem(key)||'null');return valid(p)?p.composition:initial();}catch{return initial();}});
 const composition=history.value,setComposition=history.set;
 const [inspectorTab,setInspectorTab]=useState<'scene'|'layer'|'object'>('scene');
 const [dragLayer,setDragLayer]=useState<number|null>(null);
 const [dropLayer,setDropLayer]=useState<number|null>(null);
 const [resetArmed,setResetArmed]=useState(false);
 const [saveStatus,setSaveStatus]=useState('Tersimpan lokal');
 const [loadingMedia,setLoadingMedia]=useState(0);
 const [media,setMedia]=useState<Media[]>([]);
 const [archiveHydra,setArchiveHydra]=useState(false);
 const archiveReadyRef=useRef(false);
 const onArchiveHydraChangeRef=useRef(onArchiveHydraChange);
 onArchiveHydraChangeRef.current=onArchiveHydraChange;
 const [selectedLayer,setSelectedLayer]=useState(0);
 const [presets,setPresets]=useState<{name:string;snapshot:Snapshot}[]>(()=>{try{const p=JSON.parse(localStorage.getItem(presetKey)||'[]');return Array.isArray(p)?p.filter(x=>x?.name&&valid(x.snapshot)).slice(0,30):[];}catch{return [];}});
 const [presetName,setPresetName]=useState('New composition');
 const [editMask,setEditMask]=useState(false);
 const [outputOpen,setOutputOpen]=useState(false);
 const [bodyStatus,setBodyStatus]=useState('Menunggu frame tubuh.');
 const [hint,setHint]=useState('');
 // Software preview starts enabled in Compose. Physical output still requires the existing routing/QA panel.
 const [blackout,setBlackout]=useState(previewBlackout);
 const [previewLive,setPreviewLive]=useState(true);
 useEffect(()=>{
  const onGlobalBlackout=()=>setBlackout(true);
  window.addEventListener(SOFTWARE_PREVIEW_BLACKOUT_EVENT,onGlobalBlackout);
  return()=>window.removeEventListener(SOFTWARE_PREVIEW_BLACKOUT_EVENT,onGlobalBlackout);
 },[]);
 useEffect(()=>{if(previewBlackout)setBlackout(true);},[previewBlackout]);
 useEffect(()=>{if(previewResumeRevision>0&&!previewBlackout){setBlackout(false);setPreviewLive(true);}},[previewResumeRevision,previewBlackout]);
 const [testEvent,setTestEvent]=useState<'contact'|'move'|'release'|null>(null);
 const [demoFootprints,setDemoFootprints]=useState<FootprintState>(emptyFootprintState);
 const [demoNowMs,setDemoNowMs]=useState(()=>performance.now());
 const [demoFoot,setDemoFoot]=useState<FootSide>('left');
 const rehearsalEvent=(kind:FootEventKind,foot:FootSide=demoFoot)=>{
  const atMs=performance.now();
  setDemoFootprints(previous=>{
   const active=previous.active[('A:'+foot) as 'A:left'|'A:right'];
   let next=previous;
   // The operator's Step button advances a distinct contact: release the previous stamp.
   if(kind==='contact'&&active){
    next=applyFootprintEvent(next,makeDemoFootEvent(next,'release',foot,atMs-.01));
   }
   return applyFootprintEvent(next,makeDemoFootEvent(next,kind,foot,atMs));
  });
  setDemoFoot(foot);
  triggerTest(kind==='slide'?'move':kind==='pivot'?'release':'contact');
 };
 useEffect(()=>{
  if(cameraOn||blackout||previewBlackout||!previewLive)return;
  const timer=window.setInterval(()=>{
   const now=performance.now();
   setDemoNowMs(now);
   setDemoFootprints(previous=>pruneFootprints(previous,now,{holdMs:0,decayMs:(footprint?.life??8)*1000}));
  },120);
  return()=>window.clearInterval(timer);
 },[cameraOn,blackout,previewBlackout,previewLive,footprint?.life]);
 const effectClock=useRef(new Map<string,{started:number;kind:string}>());
 const motionClocks=useRef(new Map<string,MotionRecipeCue>());
 const seenMotionEvents=useRef(new Set<string>());
 const activeMotionSession=useRef<string|null>(null);
 const seenEvents=useRef(new Set<string>());
 const surfaceBuffers=useRef(new Map<string,HTMLCanvasElement>());
 const bodyOutput=useRef<HTMLCanvasElement>(null);
 const floorOutput=useRef<HTMLCanvasElement>(null);
 const stageRoute=useRef<StageRouteInput|null>(null);
 const maskCache=useRef<{at:number;A:HTMLCanvasElement|null;B:HTMLCanvasElement|null;safe:boolean;reason:string;union:ReturnType<typeof buildLowerBodyMask>['mask']|null}>({at:-1,A:null,B:null,safe:false,reason:'Tracking belum siap.',union:null});
 const maskScratch=useRef<{A:HTMLCanvasElement;B:HTMLCanvasElement}|null>(null);
 const outputReadyRef=useRef({body:false,floor:false});
 
 const floorEventsRef=useRef(floorEvents);floorEventsRef.current=floorEvents;
 const motionEventsRef=useRef(motionEvents);motionEventsRef.current=motionEvents;
 const motionSessionRef=useRef(motionSession);motionSessionRef.current=motionSession;
 const [eventInfo,setEventInfo]=useState('Menunggu trigger layer.');
 
 const canvas=useRef<HTMLCanvasElement>(null);
 const frameRefLive=useRef(frameRef);frameRefLive.current=frameRef;
 const videoRefLive=useRef(videoRef);videoRefLive.current=videoRef;
 const routerRef=useRef(router);routerRef.current=router;
 const floorRef=useRef(floorTracker);floorRef.current=floorTracker;
 const cameraOnRef=useRef(cameraOn);cameraOnRef.current=cameraOn;
 const bodySelectedRef=useRef(bodySelected);bodySelectedRef.current=bodySelected;
 const performerRef=useRef(performerCount);performerRef.current=performerCount;
 const floorReadyRef=useRef(floorReady);floorReadyRef.current=floorReady;
 const identitySafeRef=useRef(identitySafe);identitySafeRef.current=identitySafe;
 const blackoutRef=useRef(blackout);blackoutRef.current=blackout;
 const previewLiveRef=useRef(previewLive);previewLiveRef.current=previewLive;
 
 const mediaEls=useRef(new Map<string,HTMLImageElement|HTMLVideoElement>());
 const popup=useRef<Window|null>(null);
 const selectedRef=useRef(selected),compositionRef=useRef(composition);
 selectedRef.current=selected;compositionRef.current=composition;
 const layers=composition[selected],layer=layers[selectedLayer]||layers[0];
 const patch=(p:Partial<Layer>)=>setComposition(c=>({...c,[selected]:c[selected].map((l,i)=>i===selectedLayer?{...l,...p}:l)}));
 useEffect(()=>{
  try{
   localStorage.setItem(key,JSON.stringify({version:1,selected,composition}));
   setSaveStatus('Tersimpan lokal');
  }catch{setSaveStatus('Penyimpanan gagal');}
 },[composition,selected]);
 const performUndo=()=>{if(history.undo()){setResetArmed(false);setSaveStatus('Perubahan dibatalkan');}};
 const performRedo=()=>{if(history.redo()){setResetArmed(false);setSaveStatus('Perubahan dikembalikan');}};
 const resetComposition=()=>{
  if(!resetArmed){setResetArmed(true);return;}
  setComposition(initial());setSelected('FLOOR');setSelectedLayer(0);
  setEditMask(false);setResetArmed(false);setInspectorTab('scene');
  setHint('Komposisi direset. Gunakan Undo untuk mengembalikan layer sebelumnya.');
 };
 const onComposerKeys=(event:KeyboardEvent<HTMLDivElement>)=>{
  const target=event.target as HTMLElement;
  const editing=!!target.closest('input,textarea,select,[contenteditable="true"]');
  const buttonFocused=!!target.closest('button,summary');
  if(event.key==='Escape'&&resetArmed){setResetArmed(false);event.stopPropagation();return;}
  if(editing||event.altKey)return;
  if((event.metaKey||event.ctrlKey)&&event.key.toLowerCase()==='z'){
   event.preventDefault();
   if(event.shiftKey)performRedo();else performUndo();
  }else if((event.metaKey||event.ctrlKey)&&event.key.toLowerCase()==='y'){
   event.preventDefault();performRedo();
  }else if((event.key==='Delete'||event.key==='Backspace')&&!buttonFocused&&layers.length>1){
   event.preventDefault();
   setComposition(state=>({...state,[selected]:state[selected].filter((_,i)=>i!==selectedLayer)}));
   setSelectedLayer(i=>Math.max(0,i-1));
  }
 };
 const onInspectorPointerDown=(event:PointerEvent<HTMLElement>)=>{
  if((event.target as HTMLElement).closest('input[type="range"]'))history.beginGroup();
 };
 const onInspectorPointerEnd=()=>history.endGroup();
 const onInspectorKeyDown=(event:KeyboardEvent<HTMLElement>)=>{
  if((event.target as HTMLElement).closest('input[type="range"]')&&
   ['ArrowLeft','ArrowRight','ArrowUp','ArrowDown','Home','End'].includes(event.key))
   history.beginGroup();
 };
 const onInspectorKeyUp=()=>history.endGroup();
 useEffect(()=>{return()=>{for(const item of mediaEls.current.values())if(item instanceof HTMLVideoElement)item.pause();};},[]);
 useEffect(()=>{
  for(const m of media){
   if(mediaEls.current.has(m.id))continue;
   setLoadingMedia(n=>n+1);
   const done=()=>setLoadingMedia(n=>Math.max(0,n-1));
   if(m.kind==='image'){
    const img=new Image();
    img.onload=done;img.onerror=()=>{done();setHint('Gagal membaca '+m.name);};
    mediaEls.current.set(m.id,img);img.src=m.url;
   }else{
    const video=document.createElement('video');
    video.onloadeddata=done;video.onerror=()=>{done();setHint('Gagal membaca '+m.name);};
    video.src=m.url;video.loop=true;video.muted=true;video.playsInline=true;
    mediaEls.current.set(m.id,video);
    void video.play().catch(()=>{});
   }
  }
 },[media]);
 const upload=(e:ChangeEvent<HTMLInputElement>)=>{const files=Array.from(e.target.files||[]).filter(f=>f.type.startsWith('image/')||f.type.startsWith('video/'));setMedia(old=>[...old,...files.map(f=>({id:crypto.randomUUID(),name:f.name.slice(0,90),kind:f.type.startsWith('video/')?'video' as const:'image' as const,url:URL.createObjectURL(f),mime:f.type}))].slice(0,48));e.target.value='';};
 const maskImage=(data:Uint8Array,width:number,height:number,canvas:HTMLCanvasElement)=>{
  if(canvas.width!==width)canvas.width=width;if(canvas.height!==height)canvas.height=height;
  const ctx=canvas.getContext('2d');if(!ctx)return;
  const img=ctx.createImageData(width,height);
  for(let i=0;i<data.length;i++){const k=i*4;img.data[k]=255;img.data[k+1]=255;img.data[k+2]=255;img.data[k+3]=data[i];}
  ctx.putImageData(img,0,0);
 };
 const updateMasks=(now:number)=>{
  const frame=frameRefLive.current.current,ids=routerRef.current.status,count=performerRef.current;
  const validClock=frame?.source==='camera'&&frame.tracked&&frame.time>0&&now-frame.time>=0&&now-frame.time<350;
  const key=cameraBindingKey(cameraBinding(videoRefLive.current.current));
  const bindingSafe=!!key&&key===floorRef.current.boundCamera;
  const idsSafe=count===1||(!ids.ambiguous&&ids.mode===2&&ids.visible.includes('A')&&ids.visible.includes('B')&&ids.observedFrameTime===frame.time&&ids.poseIndices.A!==null&&ids.poseIndices.B!==null&&ids.poseIndices.A!==ids.poseIndices.B);
  const safe=!!(cameraOnRef.current&&bodySelectedRef.current&&floorReadyRef.current&&bindingSafe&&validClock&&identitySafeRef.current&&idsSafe);
  if(!safe){
   maskCache.current={at:-1,A:null,B:null,safe:false,reason:!cameraOnRef.current?'Kamera mati':!floorReadyRef.current||!bindingSafe?'Kalibrasi kamera/lantai belum cocok':!validClock?'Frame kedaluwarsa':'Identitas A/B ambigu',union:null};
   return;
  }
  // Identical source frame: reuse safe per-pose masks while preserving identity routing.
  if(maskCache.current.at===frame.time&&maskCache.current.safe)return;
  const result=buildLowerBodyMask(frame,{...LOWER_BODY_MASK_DEFAULTS,performers:count,requireSegmentation:true},now,'camera');
  if(result.status!=='ready'){
   maskCache.current={at:-1,A:null,B:null,safe:false,reason:result.reason,union:null};
   return;
  }
  if(!maskScratch.current)maskScratch.current={A:document.createElement('canvas'),B:document.createElement('canvas')};
  const indexA=count===1?0:ids.poseIndices.A;
  const indexB=count===2?ids.poseIndices.B:null;
  const a=indexA===null?null:result.perPoseMasks[indexA];
  const b=indexB===null?null:result.perPoseMasks[indexB];
  if(!a||(count===2&&!b)){
   maskCache.current={at:-1,A:null,B:null,safe:false,reason:'Mask A/B belum terpisah.',union:null};return;
  }
  maskImage(a.data,a.width,a.height,maskScratch.current.A);
  if(b)maskImage(b.data,b.width,b.height,maskScratch.current.B);
  maskCache.current={at:frame.time,A:maskScratch.current.A,B:b?maskScratch.current.B:null,safe:true,reason:'Mask performer terpisah dan identitas cocok.',union:result.mask};
 };
 const readyMedia=(s:Surface)=>{
  return compositionRef.current[s].some(l=>{
   if(!l.visible||!l.mediaId)return false;
   const item=mediaEls.current.get(l.mediaId);
   return !!item&&(item instanceof HTMLImageElement?item.complete&&item.naturalWidth>0:item.readyState>=2);
  });
 };
 const render=(ctx:CanvasRenderingContext2D,s:Surface,w:number,h:number,clear=true,physical=false)=>{
  ctx.setTransform(1,0,0,1,0,0);ctx.globalCompositeOperation='source-over';ctx.globalAlpha=1;
  if(clear){ctx.fillStyle='#000';ctx.fillRect(0,0,w,h);}
  if(blackoutRef.current||!previewLiveRef.current)return;
  const body=s!=='FLOOR';
  const currentMask=s==='BODY A'?maskCache.current.A:s==='BODY B'?maskCache.current.B:null;
  if(!canRenderComposeSurface({surface:s,physical,floorReady:floorReadyRef.current,
   bodyMaskSafe:maskCache.current.safe,bodyMaskPresent:!!currentMask}))return;
  // Reuse the clean Footprints FLOOR raster when no imported media is
  // selected. Presence/touch diagnostics are in another software-only canvas.
  // Hardware projection remains under the existing five-point QA gate.
  if(s==='FLOOR'&&!readyMedia('FLOOR')){
   const source=floorCanvas.current;
   const softwareSource=!physical&&previewFloorEnabled?visualFloorCanvas?.current??source:source;
   if(softwareSource&&softwareSource.width>=16&&softwareSource.height>=16)ctx.drawImage(softwareSource,0,0,w,h);
   return;
  }
  const now=performance.now();
  for(const layer of compositionRef.current[s]||[]){
   if(!layer.visible)continue;
   const el=mediaEls.current.get(layer.mediaId);
   if(!el||(el instanceof HTMLImageElement?!(el.complete&&el.naturalWidth):el.readyState<2))continue;
   const key=s+':'+layer.id;
   let off=surfaceBuffers.current.get(key);
   if(!off){off=document.createElement('canvas');surfaceBuffers.current.set(key,off);}
   if(off.width!==w)off.width=w;if(off.height!==h)off.height=h;
   const g=off.getContext('2d');if(!g)continue;
   g.setTransform(1,0,0,1,0,0);g.globalCompositeOperation='source-over';g.globalAlpha=1;g.clearRect(0,0,w,h);
   g.save();g.translate(w*(.5+layer.x/100),h*(.5+layer.y/100));
   g.rotate(layer.rotation*Math.PI/180);g.scale(layer.scale/100,layer.scale/100);
   try{g.drawImage(el,-w/2,-h/2,w,h);}catch{g.restore();continue;}
   g.restore();
   const clipNeeded=body||layer.mask==='polygon';
   if(clipNeeded){
    let clip:HTMLCanvasElement|null=null;
    if(layer.mask==='polygon'&&layer.points.length>=3){
     clip=document.createElement('canvas');clip.width=w;clip.height=h;
     const c=clip.getContext('2d');
     if(c){c.fillStyle='#fff';c.beginPath();
      layer.points.forEach(([x,y],i)=>i?c.lineTo(x*w,y*h):c.moveTo(x*w,y*h));
      c.closePath();c.fill();
      if(layer.feather>0){
       const blurred=document.createElement('canvas');blurred.width=w;blurred.height=h;
       const blur=blurred.getContext('2d');
       if(blur){blur.filter='blur('+Math.min(35,Math.max(0,layer.feather))+'px)';blur.drawImage(clip,0,0);clip=blurred;}
      }
     }
    }
    if(clip){g.globalCompositeOperation='destination-in';g.drawImage(clip,0,0,w,h);}
    if(body&&currentMask){g.globalCompositeOperation='destination-in';g.drawImage(currentMask,0,0,w,h);}
    g.globalCompositeOperation='source-over';
   }
   let envelope=1;
   const rawCue=effectClock.current.get(layer.id);
   const cue=physical&&rawCue?.kind.startsWith('simulation:')?undefined:rawCue;
   if(layer.recipe==='motion-v2'){
    envelope=physical||!identitySafeRef.current?0:motionRecipeEnvelope(motionClocks.current.get(layer.id)??null,now);
   }else if(layer.recipe!=='none'){
    if(!cue)envelope=0;
    else{const age=now-cue.started;
     if(layer.recipe==='contact-reveal')envelope=Math.min(1,age/250)*Math.max(0,1-age/3000);
     if(layer.recipe==='slide-hold')envelope=age<1500?1:Math.max(0,1-(age-1500)/750);
     if(layer.recipe==='pivot-decay')envelope=Math.max(0,1-age/2200);
    }
   }
   ctx.save();ctx.globalAlpha=Math.min(1,Math.max(0,layer.opacity/100*envelope));
   ctx.globalCompositeOperation=layer.blend;
   const motionCue=layer.recipe==='motion-v2'?motionClocks.current.get(layer.id):undefined;
   if(!physical&&motionCue?.treatment==='distort'&&envelope>0){
    const wobble=4*envelope*Math.sin((now-motionCue.started)/90);
    ctx.translate(wobble,-wobble*.6);ctx.drawImage(off,0,0);
   }else ctx.drawImage(off,0,0);
   ctx.restore();
  }
 };
 useEffect(()=>{
  let raf=0,last=0,lastText='';
  const tick=(now:number)=>{
   raf=requestAnimationFrame(tick);
   if(now-last<1000/24)return;
   last=now;updateMasks(now);
   const body=bodyOutput.current,floor=floorOutput.current;
   if(body){const ctx=body.getContext('2d');if(ctx){
    render(ctx,'BODY A',body.width,body.height,true,true);
    if(performerRef.current===2)render(ctx,'BODY B',body.width,body.height,false,true);
   }}
   if(floor){const ctx=floor.getContext('2d');if(ctx)render(ctx,'FLOOR',floor.width,floor.height,true,true);}
   // CP-03: paint imported composition layers over the live FLOOR monitor.
   // The source scene remains visible underneath transparent pixels. This is
   // only a software preview: StageRoute/Map QA and projector routing remain untouched.
   const previewOverlay=composePreviewCanvas?.current;
   if(previewOverlay){
    const ctx=previewOverlay.getContext('2d');
    if(ctx){
     ctx.setTransform(1,0,0,1,0,0);
     ctx.globalCompositeOperation='source-over';ctx.globalAlpha=1;
     ctx.clearRect(0,0,previewOverlay.width,previewOverlay.height);
     if(readyMedia('FLOOR')&&!blackoutRef.current&&previewLiveRef.current)
      render(ctx,'FLOOR',previewOverlay.width,previewOverlay.height,false,false);
    }
   }
   const archiveReady=archiveHydra&&!blackoutRef.current&&previewLiveRef.current&&readyMedia('FLOOR')&&!!archiveHydraCanvas;
   if(archiveReady&&archiveHydraCanvas){
    if(!archiveHydraCanvas.current)archiveHydraCanvas.current=document.createElement('canvas');
    const archive=archiveHydraCanvas.current;
    if(archive.width!==640)archive.width=640;if(archive.height!==360)archive.height=360;
    const archiveCtx=archive.getContext('2d');if(archiveCtx)render(archiveCtx,'FLOOR',640,360,true,false);
   }
   if(archiveReadyRef.current!==archiveReady){archiveReadyRef.current=archiveReady;onArchiveHydraChangeRef.current?.(archiveReady);}
   const preview=canvas.current;
   if(preview){const ctx=preview.getContext('2d');if(ctx){
    if(previewArrangementRef.current==='split'){
     if(!splitScratch.current)splitScratch.current={body:document.createElement('canvas'),floor:document.createElement('canvas')};
     const pair=splitScratch.current;
     for(const c of [pair.body,pair.floor]){if(c.width!==640)c.width=640;if(c.height!==540)c.height=540;}
     const bc=pair.body.getContext('2d'),fc=pair.floor.getContext('2d');
     if(bc){render(bc,'BODY A',640,540,true,false);if(performerRef.current===2)render(bc,'BODY B',640,540,false,false);}
     if(fc)render(fc,'FLOOR',640,540,true,false);
     ctx.setTransform(1,0,0,1,0,0);ctx.fillStyle='#000';ctx.fillRect(0,0,preview.width,preview.height);
     ctx.drawImage(pair.body,0,0,preview.width/2,preview.height);
     ctx.drawImage(pair.floor,preview.width/2,0,preview.width/2,preview.height);
     ctx.fillStyle='#c8dbc9';ctx.font='13px sans-serif';ctx.fillText('BODY A/B',16,24);ctx.fillText('FLOOR',preview.width/2+16,24);
    }else render(ctx,selectedRef.current,preview.width,preview.height);
   }}
   const masks=maskCache.current;
   const live=previewLiveRef.current&&!blackoutRef.current;
   const cameraKey=floorRef.current.boundCamera;
   const floorKey=floorReadyRef.current?JSON.stringify([floorRef.current.calibrationData,cameraKey,performerRef.current]):null;
   const bodyMedia=masks.safe&&readyMedia('BODY A')&&(performerRef.current===1||readyMedia('BODY B'));
   const defaultFloor=floorCanvas.current;
   const floorMedia=floorReadyRef.current&&
    (readyMedia('FLOOR')||!!(defaultFloor&&defaultFloor.width>=16&&defaultFloor.height>=16));
   const cameraSafe=live&&masks.safe&&!!cameraKey;
   outputReadyRef.current={body:cameraSafe&&bodyMedia,floor:cameraSafe&&floorMedia};
   stageRoute.current={
    mode:'live',frameAtMs:cameraSafe?masks.at:0,computedAtMs:now,
    cameraSafe,bodyMediaReady:outputReadyRef.current.body,
    bridgeSafe:outputReadyRef.current.floor,mask:cameraSafe?masks.union:null,
    cameraKey:cameraSafe?cameraKey:null,floorKey:cameraSafe?floorKey:null
   };
   const status=(!live?'Preview blackout':masks.reason)+
    (masks.safe?' · '+(performerRef.current===2?'BODY A/B':'BODY A')+' siap':'');
   if(status!==lastText){lastText=status;setBodyStatus(status);}
  };raf=requestAnimationFrame(tick);
  return()=>{cancelAnimationFrame(raf);stageRoute.current=null;};
 },[]);
 useEffect(()=>{
  if(!previewLive||blackout||!motionEvents)return;
  let timeout=0;
  const consume=()=>{
   const events=motionEventsRef.current?.()??[];
   const session=motionSessionRef.current?.()??'unknown';
   if(activeMotionSession.current!==session){
    activeMotionSession.current=session;motionClocks.current.clear();seenMotionEvents.current.clear();
    // Do not re-trigger historical contacts when opening Compose or switching source.
    for(const old of events)seenMotionEvents.current.add(old.eventId);
    timeout=window.setTimeout(consume,85);return;
   }
   for(const event of events.slice(-120)){
    if(seenMotionEvents.current.has(event.eventId))continue;
    seenMotionEvents.current.add(event.eventId);
    if(seenMotionEvents.current.size>1500){
     const recent=new Set(events.map(x=>x.eventId));
     seenMotionEvents.current=new Set([...seenMotionEvents.current].filter(id=>recent.has(id)));
    }
    const now=performance.now();
    // CP-03: the unified F0 event bus also drives existing preview-only
    // Contact/Slide/Pivot recipes for MP4 and synthetic rehearsal sources.
    // This never enters the physical FloorSession or projector route.
    if(event.source==='video'||event.source==='simulator'||event.source==='touch'){
     const legacyRecipe=event.kind==='contact'&&event.verified?'contact-reveal':
      event.kind==='slide'?'slide-hold':
      event.kind==='pivot'||event.kind==='release'?'pivot-decay':null;
     if(legacyRecipe){
      for(const item of compositionRef.current.FLOOR){
       if(item.recipe===legacyRecipe)
        effectClock.current.set(item.id,{started:now,kind:'simulation:'+event.kind});
      }
      setEventInfo(event.kind+' · '+event.actorId+' · preview only');
     }
    }
    for(const surface of surfaces)for(const item of compositionRef.current[surface]){
     if(item.recipe!=='motion-v2')continue;
     const cue=resolveMotionRecipeCue(event,normalizeMotionRecipeRule(item.motionRecipe),surface,now,identitySafeRef.current);
     if(!cue)continue;
     motionClocks.current.set(item.id,cue);
     setEventInfo(cue.kind+' · '+cue.actorId+' · '+cue.surface+(cue.verified?' · verified':' · unverified'));
    }
   }
   timeout=window.setTimeout(consume,85);
  };
  consume();return()=>clearTimeout(timeout);
 },[previewLive,blackout,!!motionEvents]);
 useEffect(()=>{
  if(!previewLive||blackout)return;
  let id=0;
  const tick=()=>{
   const events=floorEventsRef.current();
   for(const event of events.slice(-80)){
    if(seenEvents.current.has(event.id))continue;
    seenEvents.current.add(event.id);
    if(seenEvents.current.size>1000)seenEvents.current.clear();
    const match=event.kind==='contact'?'contact-reveal':event.kind==='move'?'slide-hold':event.kind==='release'?'pivot-decay':null;
    if(match){
     for(const surface of surfaces)for(const layer of compositionRef.current[surface])
      if(layer.recipe===match&&(surface==='FLOOR'||(surface==='BODY A'&&(event.performerId==='performer-1'||event.performerId==='A'))||(surface==='BODY B'&&event.performerId==='B')))
       effectClock.current.set(layer.id,{started:performance.now(),kind:event.kind});
     setEventInfo(event.kind+' · '+event.performerId+' · '+event.id.slice(0,8));
    }
   }
   id=window.setTimeout(tick,85);
  };tick();return()=>clearTimeout(id);
 },[previewLive,blackout]);
 const triggerTest=(kind:'contact'|'move'|'release')=>{
  const recipe=kind==='contact'?'contact-reveal':kind==='move'?'slide-hold':'pivot-decay';
  for(const surface of surfaces)for(const item of compositionRef.current[surface])
   if(item.recipe===recipe)effectClock.current.set(item.id,{started:performance.now(),kind:'simulation:'+kind});
  setTestEvent(kind);setEventInfo('SIMULASI '+kind+' (tidak dikirim ke tracking)');
 };
 const points=(e:PointerEvent<HTMLCanvasElement>)=>{if(!editMask||!layer)return;const rect=e.currentTarget.getBoundingClientRect();const x=Math.max(0,Math.min(1,(e.clientX-rect.left)/rect.width));const y=Math.max(0,Math.min(1,(e.clientY-rect.top)/rect.height));const pts=layer.points.slice();let index=pts.findIndex(p=>Math.hypot((p[0]-x)*rect.width,(p[1]-y)*rect.height)<24);if(index<0){if(pts.length>=16)return;pts.push([x,y]);}else pts[index]=[x,y];patch({points:pts,mask:'polygon'});};
 const savePreset=()=>{const name=presetName.trim().slice(0,60);if(!name)return;const next=[{name,snapshot:{version:1 as const,selected,composition:structuredClone(composition)}},...presets.filter(p=>p.name!==name)].slice(0,30);setPresets(next);localStorage.setItem(presetKey,JSON.stringify(next));setHint('Preset tersimpan di perangkat ini.');};
 const exportConfig=()=>{const blob=new Blob([JSON.stringify({version:1,selected,composition},null,2)],{type:'application/json'});const a=document.createElement('a');a.href=URL.createObjectURL(blob);a.download='soma-s64-composition.json';a.click();setTimeout(()=>URL.revokeObjectURL(a.href),1000);};
 const importConfig=async(e:ChangeEvent<HTMLInputElement>)=>{const f=e.target.files?.[0];if(!f)return;try{if(f.size>200000)throw Error('File terlalu besar');const x=JSON.parse(await f.text());if(!valid(x))throw Error('Konfigurasi tidak sesuai');setComposition(x.composition);setSelected(x.selected);setSelectedLayer(0);setHint('Konfigurasi dimuat. File media perlu dipilih lagi pada sesi baru.');}catch(err){setHint(String(err));}e.target.value='';};
 useEffect(()=>()=>{onArchiveHydraChangeRef.current?.(false);},[]);
 const openPreview=()=>{const win=window.open('','soma-s64-preview','width=960,height=540');if(!win){setHint('Izinkan popup untuk membuka preview.');return;}popup.current=win;win.document.body.style.cssText='margin:0;background:black';const c=win.document.createElement('canvas');c.width=1280;c.height=720;c.style.cssText='width:100vw;height:100vh;object-fit:contain';win.document.body.replaceChildren(c);setOutputOpen(true);};
 useEffect(()=>{if(!outputOpen)return;let raf=0;const tick=()=>{const win=popup.current;if(!win||win.closed){setOutputOpen(false);return;}const c=win.document.querySelector('canvas');const ctx=c?.getContext('2d');if(ctx&&c)render(ctx,selectedRef.current,c.width,c.height);raf=requestAnimationFrame(tick);};raf=requestAnimationFrame(tick);return()=>cancelAnimationFrame(raf);},[outputOpen,blackout,previewLive,floorReady,cameraOn,performerCount,identitySafe]);
 if(mapMode)return <section className="map-r1-workspace" role="region" aria-label="Map — kalibrasi dan QA output">
  <header><div><h2>Map</h2></div></header>
  <p role="status">{bodyStatus} · FLOOR {floorReady?'terkonfirmasi':'belum terkalibrasi'} · Status cahaya wajib diperiksa fisik</p>
  <canvas ref={bodyOutput} width={160} height={90} hidden aria-label="Map BODY output raster"/>
  <canvas ref={floorOutput} width={640} height={360} hidden aria-label="Map FLOOR output raster"/>
  <DualSurfaceRoutingPanel frameRef={stageRoute} bodyCanvas={bodyOutput}
   floorCanvas={floorOutput} legacyProjection={projection} experimentLocked={experimentLocked}/>
 </section>;
 return <div className={'s64-root msv4-root'+(embedded?' s64-embedded':'')} data-mask-edit={editMask}
  role="region" tabIndex={0} aria-label="Compose Workspace — media dan layer" onKeyDown={onComposerKeys}>
  <div className="s64-heading"><div><small>COMPOSE / MAPPING STUDIO</small><h2>{selected==='FLOOR'?'Footprint Studio':'Leg Surface Studio'}</h2><small>{selected==='FLOOR'?'Shape · timing · material · stage placement':'Dynamic lower-body mapping · A/B'}</small></div>
   <div className="cp04-command-bar" role="group" aria-label="Riwayat komposisi">
    <span className="cp04-save-status" role="status">{loadingMedia>0?'Memuat '+loadingMedia+' media…':saveStatus}</span>
    <button type="button" disabled={!history.canUndo} onClick={performUndo}
     title="Undo · Ctrl/Cmd+Z" aria-label="Batalkan perubahan">Undo</button>
    <button type="button" disabled={!history.canRedo} onClick={performRedo}
     title="Redo · Ctrl/Cmd+Shift+Z" aria-label="Ulangi perubahan">Redo</button>
    <button type="button" className={resetArmed?'cp04-reset-confirm':'cp04-reset'}
     onClick={resetComposition} aria-label={resetArmed?'Konfirmasi reset komposisi':'Reset komposisi'}
     title={resetArmed?'Klik lagi untuk mereset komposisi':'Hanya reset layer dan parameter; tidak mengubah kamera atau proyektor'}>
     {resetArmed?'Konfirmasi reset':'Reset'}
    </button>
    {resetArmed&&<button type="button" onClick={()=>setResetArmed(false)}>Batal</button>}
   </div></div>
  <div className="s64-safety"><label><input type="checkbox" checked={!blackout} disabled={previewBlackout}
   onChange={e=>setBlackout(!e.target.checked)}/> Preview</label>
   <span>Layer trigger · {eventInfo}</span>
   <details className="soma-ia-display-options"><summary>Display</summary>
    <label><input type="checkbox" checked={previewLive}
     onChange={e=>setPreviewLive(e.target.checked)}/> Live frames</label>
    <button type="button" onClick={()=>setBlackout(true)}>Padam preview</button>
   </details></div>
  <div className="s64-runtime-status" role="status">{bodyStatus} · FLOOR {floorReady?'siap':'preview saja'}</div>
  <div className="s64-layout" data-inspector-tab={inspectorTab}>
   <aside className="s64-column cp02-library"><h3>Scene Library</h3><div className="msv4-browser-meta">BROWSER / SCENES · MEDIA · LAYERS</div><div className="uxr3-scene-library" role="group" aria-label="Scene FLOOR">
     {COMPOSE_SCENES.map(scene=><button type="button" key={scene.id} className="uxr3-scene-card" aria-pressed={sceneId===scene.id}
       onClick={()=>{onSceneChange?.(scene.id);setSelected('FLOOR');setSelectedLayer(0);setInspectorTab('scene');setPreviewArrangement('surface');setResetArmed(false);}} title={"Pilih scene "+scene.name}>
       <img className="visr3-scene-thumb"
        src={'data:image/svg+xml,'+encodeURIComponent(catalogThumbnailSvg(catalogRecipe(scene.id)))}
        alt="" aria-hidden="true"/>
       <span className="visr3-scene-copy"><strong>{scene.name}</strong>
        <small>{catalogRecipe(scene.id).subtitle}</small></span>
      </button>)}
     </div><details className="soma-ia-media"><summary>Media {loadingMedia>0?'· Memuat…':'· '+media.length}</summary><label className="visr4-archive-row">
 <input type="checkbox" checked={archiveHydra}
  onChange={e=>{setArchiveHydra(e.target.checked);if(!e.target.checked)onArchiveHydraChangeRef.current?.(false);}}/>
 Process FLOOR archive media with Hydra (software preview)</label>
 <small>{archiveHydra?'Pilih layer FLOOR berisi gambar/video. Media diproses oleh instance Hydra yang sama.':'Hydra media preview tidak aktif.'}</small><label className="s64-upload">+ Import image / video<input type="file" multiple accept="image/*,video/*" onChange={upload}/></label><div className="s64-media-list">{media.map(m=><button key={m.id} onClick={()=>{patch({mediaId:m.id,name:m.name});setInspectorTab('layer');}}>{m.kind==='image'?<img src={m.url} alt=""/>:<span>VIDEO</span>}<span>{m.name}</span></button>)}</div><small>Media lokal · pilih ulang setelah reload</small></details></aside>
   <section className="s64-center cp02-editor"><div className="uxr3-compose-preview-bar"><strong>STAGE MONITOR <small>· Layer target / Workspace 01</small></strong><div role="group" aria-label="Pilih bidang preview">
     {surfaces.map(surface=><button key={surface} type="button" aria-pressed={previewArrangement==="surface"&&selected===surface} onClick={()=>{setSelected(surface);setSelectedLayer(0);setInspectorTab("layer");setPreviewArrangement("surface");}}>{surface}</button>)}
     <button type="button" aria-pressed={previewArrangement==="split"} onClick={()=>setPreviewArrangement("split")}>SPLIT</button>
     </div></div><div className="s64-stage"><canvas width={960} height={540} ref={canvas} onPointerDown={points} aria-label="Visual preview composer"/>{!previewBlackout&&!blackout&&previewLive&&!cameraOn&&selected==='FLOOR'&&!readyMedia('FLOOR')&&<FootprintDemo state={demoFootprints} config={footprint??{style:'Tapak',palette:0,size:32,life:8,delay:0,showLive:true,showTrail:true,hold:false,gaitAnalysis:false,colors:{background:'#000000',left:'#e5e9eb',right:'#a9a4ec'}}} nowMs={demoNowMs} sceneName={sceneId}/>}{!previewBlackout&&!blackout&&previewLive&&!cameraOn&&selected!=='FLOOR'&&!readyMedia(selected)&&<LegDemo actor={selected==='BODY A'?'A':'B'}/>}{editMask&&layer?.mask==='polygon'&&<svg viewBox="0 0 960 540" preserveAspectRatio="none">{layer.points.map(([x,y],i)=><circle key={i} cx={x*960} cy={y*540} r="9" fill="#84dacb"/>)}<polygon points={layer.points.map(p=>p[0]*960+','+p[1]*540).join(' ')} fill="#84dacb" fillOpacity=".1" stroke="#84dacb" strokeDasharray="6 5"/></svg>}</div><div className="s64-bar"><span>{selected} · {cameraOn?'Camera connected':'Camera offline'} · {selected==='FLOOR'?(floorReady?'Floor verified':'Floor not ready'):performerCount+' performer(s)'}</span><button onClick={()=>{setEditMask(!editMask);setInspectorTab('object');}}>{editMask?'Selesai edit':'Edit mask'}</button><button onClick={openPreview}>Buka preview terpisah</button></div><div className='s64-test-events'><span className="msv4-event-label">EVENT TEST</span><button type="button" onClick={()=>rehearsalEvent('contact','left')}>Step L</button><button type="button" onClick={()=>rehearsalEvent('contact','right')}>Step R</button><button onClick={()=>triggerTest('contact')}>Test Contact</button><button onClick={()=>rehearsalEvent('slide')}>Test Slide</button><button onClick={()=>rehearsalEvent('pivot')}>Test Pivot</button><button type="button" onClick={()=>rehearsalEvent('release')}>Release</button><button type="button" onClick={()=>{setDemoFootprints(emptyFootprintState());setTestEvent(null);}}>Reset demo</button><small>{testEvent?'Simulasi terakhir: '+testEvent:''}</small></div><details className="soma-ia-layers" open><summary>Layers · {layers.length}</summary>{layers.map((l,i)=><div className={'s64-layer '+(i===selectedLayer?'active':'')} key={l.id}
  draggable={layers.length>1} data-dragging={dragLayer===i} data-drop-target={dropLayer===i&&dragLayer!==i}
  onDragStart={event=>{setDragLayer(i);setDropLayer(null);event.dataTransfer.effectAllowed='move';event.dataTransfer.setData('text/plain',String(i));}}
  onDragOver={event=>{if(dragLayer===null)return;event.preventDefault();event.dataTransfer.dropEffect='move';setDropLayer(i);}}
  onDrop={event=>{event.preventDefault();if(dragLayer!==null&&dragLayer!==i){
   setComposition(state=>{const order=[...state[selected]];const [moving]=order.splice(dragLayer,1);order.splice(i,0,moving);return {...state,[selected]:order};});
   setSelectedLayer(i);setSaveStatus('Urutan layer diubah');
  }setDragLayer(null);setDropLayer(null);}}
  onDragEnd={()=>{setDragLayer(null);setDropLayer(null);}}><button onClick={()=>{setSelectedLayer(i);setInspectorTab('layer');}}>{i+1}. {l.name}</button><button onClick={()=>setComposition(c=>({...c,[selected]:c[selected].map((x,j)=>j===i?{...x,visible:!x.visible}:x)}))}>{l.visible?'Visible':'Hidden'}</button><button disabled={i===0} onClick={()=>setComposition(c=>{const a=[...c[selected]];[a[i-1],a[i]]=[a[i],a[i-1]];return {...c,[selected]:a};})}>↑</button><button disabled={i===layers.length-1} onClick={()=>setComposition(c=>{const a=[...c[selected]];[a[i],a[i+1]]=[a[i+1],a[i]];return {...c,[selected]:a};})}>↓</button></div>)}<button onClick={()=>{setComposition(c=>({...c,[selected]:[...c[selected],makeLayer()]}));setSelectedLayer(layers.length);}}>+ Layer</button><button disabled={layers.length<=1} onClick={()=>{setComposition(c=>({...c,[selected]:c[selected].filter((_,i)=>i!==selectedLayer)}));setSelectedLayer(0);}}>Hapus layer</button></details></section>
   <aside className="s64-column cp02-inspector"
  onPointerDownCapture={onInspectorPointerDown} onPointerUpCapture={onInspectorPointerEnd}
  onPointerCancelCapture={onInspectorPointerEnd} onKeyDownCapture={onInspectorKeyDown}
  onKeyUpCapture={onInspectorKeyUp} onBlurCapture={event=>{if(!event.currentTarget.contains(event.relatedTarget))history.endGroup();}}>
  <h3>INSPECTOR <small>{selected}</small></h3>
  {selected==='FLOOR'&&footprint&&updateFootprint&&<MappingStudioFootprintControls value={footprint} onChange={updateFootprint}/>}
  <div className="cp04-inspector-tabs" role="group" aria-label="Jenis pengaturan">
   {(['scene','layer','object'] as const).map(tab=><button type="button" key={tab}
    aria-pressed={inspectorTab===tab} onClick={()=>setInspectorTab(tab)}>
    {tab==='scene'?'Scene':tab==='layer'?'Layer':'Objek'}</button>)}
  </div>
  {inspectorTab!=='scene'&&<div className="cp04-current-layer" role="status">
   <strong>{selected} / {layer?.name??'Tidak ada layer'}</strong>
   <span>{media.find(m=>m.id===layer?.mediaId)?.name??'Belum ada media'}</span>
  </div>}
 {inspectorTab==='scene'&&<label className="cp04-scene-select">Scene aktif
  <select value={sceneId} onChange={e=>{
   onSceneChange?.(e.target.value as 'footprints'|FloorSceneId);
   setSelected('FLOOR');setSelectedLayer(0);
  }} aria-label="Scene aktif pada FLOOR">
   {COMPOSE_SCENES.map(scene=><option value={scene.id} key={scene.id}>{scene.name}</option>)}
  </select>
 </label>}
 {inspectorTab==='scene'&&<details className="soma-ia-hydra" open><summary>Hydra · {hydraSettings?.enabled?hydraStatus??'ON':'OFF'}</summary>
  <label><input type="checkbox" checked={hydraSettings?.enabled??false}
   onChange={e=>onHydraSettingsChange?.({enabled:e.target.checked})}/> Aktif</label>
  <label>Style<select value={hydraSettings?.style??'off'}
   onChange={e=>onHydraSettingsChange?.({style:e.target.value as HydraFootprintSettings['style']})}>
   {HYDRA_FOOTPRINT_STYLES.map(style=><option value={style.id} key={style.id}>{style.label}</option>)}
  </select></label>
  <label>Feedback · {Math.round((hydraSettings?.feedback??0)*100)}%
   <input type="range" min="0" max=".65" step=".05" value={hydraSettings?.feedback??0}
    onChange={e=>onHydraSettingsChange?.({feedback:Number(e.target.value)})}/></label>
 </details>}
 {inspectorTab==='object'&&<details className="uxr3-advanced" open><summary>Advanced · transform &amp; mask</summary><label>Mask<select value={layer?.mask} onChange={e=>patch({mask:e.target.value as Mask})}><option value="none">None</option><option value="silhouette">Body silhouette</option><option value="polygon">Polygon</option></select></label><label>Opacity <input type="range" min="0" max="100" value={layer?.opacity??100} onChange={e=>patch({opacity:+e.target.value})}/>{layer?.opacity}%</label><label>Scale <input type="range" min="20" max="300" value={layer?.scale??100} onChange={e=>patch({scale:+e.target.value})}/>{layer?.scale}%</label>{(['x','y','rotation','feather'] as const).map(k=><label key={k}>{k}<input type="number" value={layer?.[k]??0} onChange={e=>patch({[k]:+e.target.value})}/></label>)}</details>} {inspectorTab==='layer'&&<><label>Blend<select value={layer?.blend} onChange={e=>patch({blend:e.target.value as GlobalCompositeOperation})}><option value="source-over">Normal</option><option value="screen">Screen</option><option value="multiply">Multiply</option><option value="lighter">Add</option></select></label><label>Effect Recipe<select value={layer?.recipe} onChange={e=>patch({recipe:e.target.value})}><option value="none">None</option><option value="contact-reveal">Contact → Reveal</option><option value="slide-hold">Slide → Hold</option><option value="pivot-decay">Legacy release → Decay</option><option value="motion-v2">Motion Recipe V2 → Media</option></select></label>
 {layer?.recipe==='motion-v2'&&<section className="visr4-recipe-editor" aria-label="Editor Motion Recipe">
  <strong>EVENT → MEDIA TREATMENT</strong>
  <label>Input event<select value={normalizeMotionRecipeRule(layer.motionRecipe).trigger}
   onChange={e=>patch({motionRecipe:{...normalizeMotionRecipeRule(layer.motionRecipe),
    trigger:e.target.value as MotionRecipeRule['trigger'],verifiedOnly:e.target.value==='contact'}})}>
   {MOTION_RECIPE_TRIGGERS.map(x=><option key={x} value={x}>{x.toUpperCase()}</option>)}
  </select></label>
  <label>Visual treatment<select value={normalizeMotionRecipeRule(layer.motionRecipe).treatment}
   onChange={e=>patch({motionRecipe:{...normalizeMotionRecipeRule(layer.motionRecipe),
    treatment:e.target.value as MotionRecipeRule['treatment']}})}>
   {MOTION_RECIPE_TREATMENTS.map(x=><option key={x} value={x}>{x.toUpperCase()}</option>)}
  </select></label>
  <label>Duration · {normalizeMotionRecipeRule(layer.motionRecipe).durationMs}ms
   <input type="range" min="100" max="12000" step="100"
    value={normalizeMotionRecipeRule(layer.motionRecipe).durationMs}
    onChange={e=>patch({motionRecipe:{...normalizeMotionRecipeRule(layer.motionRecipe),durationMs:Number(e.target.value)}})}/></label>
  <label>Strength · {Math.round(normalizeMotionRecipeRule(layer.motionRecipe).strength*100)}%
   <input type="range" min="0" max="1" step=".05"
    value={normalizeMotionRecipeRule(layer.motionRecipe).strength}
    onChange={e=>patch({motionRecipe:{...normalizeMotionRecipeRule(layer.motionRecipe),strength:Number(e.target.value)}})}/></label>
  <label className="visr4-check"><input type="checkbox" checked={normalizeMotionRecipeRule(layer.motionRecipe).verifiedOnly}
   onChange={e=>patch({motionRecipe:{...normalizeMotionRecipeRule(layer.motionRecipe),verifiedOnly:e.target.checked}})}/>
   Verified only</label>
  <small>Kontak kaki wajib terverifikasi. Slide dan Pivot belum didukung klasifikasi terverifikasi. Mode eksperimen hanya muncul di preview software.</small>
 </section>}</>}
 {inspectorTab==='scene'&&<details className="soma-ia-presets"><summary>Presets</summary><input value={presetName} onChange={e=>setPresetName(e.target.value)} placeholder="Nama preset"/><button onClick={savePreset}>Simpan preset</button><select defaultValue="" onChange={e=>{const p=presets.find(p=>p.name===e.target.value);if(p){setComposition(structuredClone(p.snapshot.composition));setSelected(p.snapshot.selected);setSelectedLayer(0);}}}><option value="">Pilih preset</option>{presets.map(p=><option key={p.name} value={p.name}>{p.name}</option>)}</select><button onClick={exportConfig}>Ekspor JSON</button><label className="s64-upload">Impor JSON<input type="file" accept=".json,application/json" onChange={importConfig}/></label>{hint&&<p role="status">{hint}</p>}</details>}
 {hint&&inspectorTab!=='scene'&&<p className="cp04-hint" role="status">{hint}</p>}</aside>
  </div>
  <div className="s64-runtime" aria-hidden="true">
   <canvas ref={bodyOutput} width={160} height={90} hidden aria-label="BODY compositor raster"/>
   <canvas ref={floorOutput} width={640} height={360} hidden aria-label="FLOOR compositor raster"/>
  </div>
 </div>;
}
