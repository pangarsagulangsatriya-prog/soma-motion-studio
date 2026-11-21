/** MAP-R2: Pure, deterministic Stage Map calibration model.
 * Owns:
 * 1. Dominant 4-state Map readiness derivation (uncalibrated | ready-to-test | needs-physical-qa | ready-perform)
 * 2. Customizable stage room presets (2x1, 3x1, 3x2, 3x4, 5x5 default + custom 1..20 m) & aspect-aware perspective projection
 * 3. Optional virtual 2-performer (A/B) stage simulation for source-less preview (explicitly SIMULASI, never live/hardware)
 * 4. Quad editing Undo/Redo history & optional grid snapping
 */
import type {Point,Quad} from '../../projection/geometry.ts';
import type {StageSurface,SurfaceAssessment} from '../../footprints/stage-optics/DualSurfaceCalibration.ts';

export type MapDominantStatusId='uncalibrated'|'ready-to-test'|'needs-physical-qa'|'ready-perform';

export type MapDominantStatus={
 id:MapDominantStatusId;
 label:string;
 blocker:string;
 sourceLabel:string;
 physicalReady:boolean;
};

/** Fractions for physically spaced calibration lines; never percentages of the preview. */
export const mapGridFractions=(meters:number,stepM:number):number[]=>{
 if(!Number.isFinite(meters)||!Number.isFinite(stepM)||meters<=0||stepM<=0)return [];
 return Array.from({length:Math.min(80,Math.max(0,Math.ceil(meters/stepM)-1))},
  (_,i)=>(i+1)*stepM/meters).filter(t=>t>0&&t<1-1e-6);
};

export type MapStageDimensions={
 widthM:number;
 depthM:number;
};

export type MapStageDimensionPreset={
 id:string;
 label:string;
 widthM:number;
 depthM:number;
};

export const DEFAULT_STAGE_DIMENSIONS:MapStageDimensions={widthM:5,depthM:5};

export const STAGE_DIMENSION_PRESETS:readonly MapStageDimensionPreset[]=[
 {id:'2x1',label:'2×1 m',widthM:2,depthM:1},
 {id:'3x1',label:'3×1 m',widthM:3,depthM:1},
 {id:'3x2',label:'3×2 m',widthM:3,depthM:2},
 {id:'3x4',label:'3×4 m',widthM:3,depthM:4},
 {id:'5x5',label:'5×5 m',widthM:5,depthM:5}
];

export function clampStageDimensions(raw:Partial<MapStageDimensions>):MapStageDimensions{
 const clean=(v:unknown,fb:number)=>
  typeof v==='number'&&Number.isFinite(v)?Math.min(20,Math.max(1,Math.round(v*2)/2)):fb;
 return {
  widthM:clean(raw.widthM,DEFAULT_STAGE_DIMENSIONS.widthM),
  depthM:clean(raw.depthM,DEFAULT_STAGE_DIMENSIONS.depthM)
 };
}

export function deriveMapStageStatus(params:{
 source:'camera'|'video'|'simulator'|'demo-sim'|'none';
 cameraOn:boolean;
 floorCalibrated:boolean;
 hardwareEnabled:boolean;
 experimentLocked:boolean;
 operatorConfirm:boolean;
 outputConnected:boolean;
 outputMode:string;
 qa:SurfaceAssessment;
 selected:StageSurface;
}):MapDominantStatus{
 const sourceLabel=
  params.source==='camera'?'Kamera':
  params.source==='video'?'Video MP4':
  params.source==='simulator'?'Simulasi 3D':
  params.source==='demo-sim'?'Simulasi Map':
  'Belum ada sumber';

 if(params.source==='none'){
  return {
   id:'uncalibrated',
   label:'Belum dikalibrasi',
   blocker:'Sesuaikan 4 sudut ruang atau pilih sumber di Track sebelum uji proyektor fisik.',
   sourceLabel,
   physicalReady:false
  };
 }

 if(params.source==='camera'&&(!params.cameraOn||!params.floorCalibrated)){
  return {
   id:'uncalibrated',
   label:'Belum dikalibrasi',
   blocker:params.cameraOn
    ?'Konfirmasi 4 sudut kamera ke lantai sebelum menyelaraskan proyektor.'
    :'Nyalakan kamera di Track atau sesuaikan grid kalibrasi lokal.',
   sourceLabel,
   physicalReady:false
  };
 }

 if(params.source==='demo-sim'){
  return {
   id:'ready-to-test',
   label:'Siap diuji',
   blocker:'Mode kalibrasi & uji software aktif — output proyektor fisik terkunci hingga kamera terkalibrasi.',
   sourceLabel,
   physicalReady:false
  };
 }

 if(!params.hardwareEnabled){
  return {
   id:'ready-to-test',
   label:'Siap diuji',
   blocker:'Kalibrasi software siap; output proyektor fisik terkunci di build Production.',
   sourceLabel,
   physicalReady:false
  };
 }

 if(!params.outputConnected){
  return {
   id:'ready-to-test',
   label:'Siap diuji',
   blocker:'Buka jendela proyektor '+(params.selected==='body'?'Tubuh':'Lantai')+' dan jalankan pola uji.',
   sourceLabel,
   physicalReady:false
  };
 }

 if(!params.operatorConfirm||params.qa.status!=='within-provisional-target'){
  return {
   id:'needs-physical-qa',
   label:'Perlu QA fisik',
   blocker:'Lengkapi QA fisik 5 titik ('+params.qa.count+'/5) dan verifikasi Blackout sebelum LIVE.',
   sourceLabel,
   physicalReady:false
  };
 }

 return {
  id:'ready-perform',
  label:'Siap Perform',
  blocker:'QA fisik tercatat; pantau cahaya proyektor langsung saat masuk Perform.',
  sourceLabel,
  physicalReady:true
 };
}

/** Compute perspective trapezoid bounds adapted cleanly to the room's width/depth ratio
 * so 3x1, 2x1, 3x2, 3x4, 5x5, and custom venues look true to their real geometry. */
export function stageTrapezoidMetrics(
 w:number,
 h:number,
 dims:MapStageDimensions=DEFAULT_STAGE_DIMENSIONS
){
 const safeW=Math.max(1,dims.widthM||5);
 const safeD=Math.max(1,dims.depthM||5);
 const ratio=Math.min(3.2,Math.max(0.45,safeW/safeD));
 // Shallow wide rooms (e.g. 3x1, 2x1) occupy less vertical depth and full comfortable width;
 // deeper rooms (3x4, 5x5) use full centered perspective depth.
 const depthFrac=ratio>=2.4?0.42:ratio>=1.6?0.52:ratio>=1.25?0.58:0.64;
 const centerY=h*0.56;
 const topY=Math.max(h*0.18,centerY-h*depthFrac*0.5);
 const botY=Math.min(h*0.88,centerY+h*depthFrac*0.5);
 const widthScale=ratio<0.85?Math.max(0.74,ratio/0.85):1;
 const botHalfW=w*0.41*widthScale;
 const taper=ratio>=2.4?0.78:ratio>=1.6?0.73:0.68;
 const topHalfW=botHalfW*taper;
 return {topY,botY,topHalfW,botHalfW};
}

/** Perspective projection of normalized stage floor UV (0..1, 0=upstage, 1=downstage)
 * onto monitor canvas coordinates (0..w, 0..h), adapted to stageDimensions. */
export function stageFloorToScreen(
 u:number,
 v:number,
 w:number,
 h:number,
 dims:MapStageDimensions=DEFAULT_STAGE_DIMENSIONS
):{x:number;y:number;scale:number}{
 const cu=Math.min(1.15,Math.max(-0.15,Number.isFinite(u)?u:0.5));
 const cv=Math.min(1.15,Math.max(-0.15,Number.isFinite(v)?v:0.5));
 const {topY,botY,topHalfW,botHalfW}=stageTrapezoidMetrics(w,h,dims);
 const depth=Math.pow(Math.min(1,Math.max(0,cv)),1.1);
 const y=topY+(botY-topY)*depth;
 const halfW=topHalfW+(botHalfW-topHalfW)*depth;
 const x=w*0.5+(cu-0.5)*2*halfW;
 const scale=0.68+0.42*depth;
 return {x,y,scale};
}

/** Inverse perspective mapping: screen pixel (px, py) -> normalized stage UV (0..1). */
export function screenToStageFloor(
 px:number,
 py:number,
 w:number,
 h:number,
 dims:MapStageDimensions=DEFAULT_STAGE_DIMENSIONS
):Point|null{
 if(!Number.isFinite(px)||!Number.isFinite(py)||w<=0||h<=0)return null;
 const {topY,botY,topHalfW,botHalfW}=stageTrapezoidMetrics(w,h,dims);
 const depth=Math.min(1,Math.max(0,(py-topY)/(botY-topY)));
 const v=Math.pow(depth,1/1.1);
 const halfW=topHalfW+(botHalfW-topHalfW)*depth;
 const u=Math.min(1,Math.max(0,0.5+(px-w*0.5)/(2*halfW)));
 return {x:u,y:v};
}

export type MapSimFootprint={
 id:string;
 actorId:'A'|'B';
 foot:'left'|'right';
 x:number;
 y:number;
 headingRad:number;
 atMs:number;
};

export type MapSimPerformer={
 id:'A'|'B';
 x:number;
 y:number;
 headingRad:number;
 phaseRad:number;
 stride:number;
};

export type MapSimState={
 active:boolean;
 playing:boolean;
 elapsedMs:number;
 performers:[MapSimPerformer,MapSimPerformer];
 footprints:MapSimFootprint[];
};

export function createDefaultMapSim():MapSimState{
 return {
  active:false,
  playing:true,
  elapsedMs:0,
  performers:[
   {id:'A',x:0.34,y:0.58,headingRad:0.15,phaseRad:0,stride:0},
   {id:'B',x:0.66,y:0.46,headingRad:Math.PI-0.2,phaseRad:Math.PI*0.7,stride:0}
  ],
  footprints:[
   {id:'sim-init-a-l',actorId:'A',foot:'left',x:0.31,y:0.61,headingRad:0.15,atMs:0},
   {id:'sim-init-a-r',actorId:'A',foot:'right',x:0.37,y:0.55,headingRad:0.15,atMs:200},
   {id:'sim-init-b-l',actorId:'B',foot:'left',x:0.68,y:0.49,headingRad:Math.PI-0.2,atMs:100},
   {id:'sim-init-b-r',actorId:'B',foot:'right',x:0.63,y:0.44,headingRad:Math.PI-0.2,atMs:300}
  ]
 };
}

/** Advance optional virtual 2-performer simulation deterministically (pure function). */
export function stepMapSimState(prev:MapSimState,dtMs:number):MapSimState{
 if(!prev.active||!prev.playing||!Number.isFinite(dtMs)||dtMs<=0)return prev;
 const clampedDt=Math.min(120,dtMs);
 const nextMs=prev.elapsedMs+clampedDt;
 const t=nextMs/1000;

 const ax=0.35+0.19*Math.sin(t*0.52);
 const ay=0.60+0.13*Math.sin(t*1.04);
 const avx=0.19*0.52*Math.cos(t*0.52);
 const avy=0.13*1.04*Math.cos(t*1.04);
 const aHead=Math.atan2(avy,avx);

 const bx=0.65-0.18*Math.sin(t*0.46+0.9);
 const by=0.44+0.12*Math.cos(t*0.92+0.9);
 const bvx=-0.18*0.46*Math.cos(t*0.46+0.9);
 const bvy=-0.12*0.92*Math.sin(t*0.92+0.9);
 const bHead=Math.atan2(bvy,bvx);

 const prevStepA=Math.floor(prev.elapsedMs/680);
 const nextStepA=Math.floor(nextMs/680);
 const prevStepB=Math.floor((prev.elapsedMs+340)/740);
 const nextStepB=Math.floor((nextMs+340)/740);

 let footprints=prev.footprints;
 const pushFoot=(actorId:'A'|'B',stepIdx:number,cx:number,cy:number,headingRad:number)=>{
  const foot:('left'|'right')=stepIdx%2===0?'left':'right';
  const lateral=(foot==='left'?-1:1)*0.022;
  const fx=Math.min(0.95,Math.max(0.05,cx-Math.sin(headingRad)*lateral));
  const fy=Math.min(0.95,Math.max(0.05,cy+Math.cos(headingRad)*lateral));
  const id=`map-sim-${actorId}-${stepIdx}`;
  if(footprints.some(f=>f.id===id))return;
  footprints=[...footprints.slice(-17),{id,actorId,foot,x:fx,y:fy,headingRad,atMs:nextMs}];
 };

 if(nextStepA>prevStepA)pushFoot('A',nextStepA,ax,ay,aHead);
 if(nextStepB>prevStepB)pushFoot('B',nextStepB,bx,by,bHead);

 return {
  ...prev,
  elapsedMs:nextMs,
  performers:[
   {id:'A',x:ax,y:ay,headingRad:aHead,phaseRad:t*4.6,stride:Math.hypot(avx,avy)},
   {id:'B',x:bx,y:by,headingRad:bHead,phaseRad:t*4.2+1.2,stride:Math.hypot(bvx,bvy)}
  ],
  footprints
 };
}

export function moveMapSimPerformer(prev:MapSimState,actorId:'A'|'B',pos:Point):MapSimState{
 const x=Math.min(0.94,Math.max(0.06,pos.x));
 const y=Math.min(0.94,Math.max(0.08,pos.y));
 const idx=actorId==='A'?0:1;
 const old=prev.performers[idx];
 const dx=x-old.x,dy=y-old.y;
 const moved=Math.hypot(dx,dy);
 const headingRad=moved>0.008?Math.atan2(dy,dx):old.headingRad;
 const nextPerformers:[MapSimPerformer,MapSimPerformer]=[...prev.performers] as [MapSimPerformer,MapSimPerformer];
 nextPerformers[idx]={...old,x,y,headingRad,phaseRad:old.phaseRad+moved*18};
 let footprints=prev.footprints;
 if(moved>0.055){
  const foot:('left'|'right')=footprints.filter(f=>f.actorId===actorId).length%2===0?'left':'right';
  footprints=[...footprints.slice(-17),{
   id:`map-drag-${actorId}-${Math.round(prev.elapsedMs)}-${footprints.length}`,
   actorId,foot,x,y,headingRad,atMs:prev.elapsedMs
  }];
 }
 return {...prev,active:true,performers:nextPerformers,footprints};
}

/** Optional grid snap (step = 0.05 -> 5% grid) for clean projector corner alignment. */
export function snapQuadPoint(point:Point,enabled:boolean,step=0.05):Point{
 const clamp=(n:number)=>Math.min(1,Math.max(0,Number.isFinite(n)?n:0));
 const x=clamp(point.x),y=clamp(point.y);
 if(!enabled||step<=0)return {x,y};
 const sx=Math.round(x/step)*step;
 const sy=Math.round(y/step)*step;
 const threshold=step*0.32;
 return {
  x:Math.abs(x-sx)<=threshold?clamp(Number(sx.toFixed(4))):x,
  y:Math.abs(y-sy)<=threshold?clamp(Number(sy.toFixed(4))):y
 };
}

export type MapQuadHistory={
 past:Quad[];
 future:Quad[];
};

export const emptyQuadHistory=():MapQuadHistory=>({past:[],future:[]});

const cloneQuad=(q:Quad):Quad=>q.map(p=>({x:p.x,y:p.y})) as Quad;

export function pushQuadHistory(history:MapQuadHistory,previous:Quad,limit=25):MapQuadHistory{
 return {
  past:[...history.past.slice(-(limit-1)),cloneQuad(previous)],
  future:[]
 };
}

export function undoQuadHistory(history:MapQuadHistory,current:Quad):{history:MapQuadHistory;quad:Quad}|null{
 if(!history.past.length)return null;
 const prev=history.past[history.past.length-1];
 return {
  quad:cloneQuad(prev),
  history:{
   past:history.past.slice(0,-1),
   future:[cloneQuad(current),...history.future].slice(0,25)
  }
 };
}

export function redoQuadHistory(history:MapQuadHistory,current:Quad):{history:MapQuadHistory;quad:Quad}|null{
 if(!history.future.length)return null;
 const next=history.future[0];
 return {
  quad:cloneQuad(next),
  history:{
   past:[...history.past,cloneQuad(current)].slice(-25),
   future:history.future.slice(1)
  }
 };
}
