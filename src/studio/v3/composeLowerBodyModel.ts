/** Quick Lower-Body Visual Composer data model, presets, and deterministic simulation poses.
 *  Pure module (no DOM/React dependencies) so logic is unit-testable and reusable across Compose & Perform. */

export type ComposeMonitorView='FLOOR'|'LEG A'|'LEG B'|'SPLIT'|'FOOT'|'SKELETON';
/** Show the right inspector for every mode except SKELETON's Input overlay. */
export function composeInspectorVisible(view:ComposeMonitorView,backdrop:'black'|'input'):boolean{
 return view!=='SKELETON'||backdrop!=='input';
}

/** Exact benchmark-aligned order: FLOOR is always first, followed by lower-body, foot, and skeleton views. */
export const COMPOSE_VIEW_TABS:readonly {id:ComposeMonitorView;label:string;title:string}[]=[
 {id:'FLOOR',label:'FLOOR',title:'Komposisi visual lantai (Liquid Imprint & Jejak)'},
 {id:'LEG A',label:'LEG A',title:'Masking & visual kaki Performer A (paha atas ke bawah)'},
 {id:'LEG B',label:'LEG B',title:'Masking & visual kaki Performer B (paha atas ke bawah)'},
 {id:'SPLIT',label:'SPLIT',title:'Tampilan ganda LEG A & LEG B secara bersamaan'},
 {id:'SKELETON',label:'SKELETON',title:'Deteksi skeleton 33 titik dari Track · hitam atau input'}
];

export type LowerBodyMaskPreset='auto'|'tight'|'wide'|'custom';
export type LowerBodyLookMode='solid'|'wash'|'texture'|'image';
export type LowerBodyTextureKind='linen'|'grain'|'noise'|'organic';
export type LowerBodySimAction='idle'|'step-l'|'step-r'|'slide'|'pivot'|'crossing';

export interface PerformerLowerBodyStyle{
 color:string;
 secondaryColor:string;
 opacity:number;       // 0..1
 brightness:number;    // 0.3..1.6
 blendStrength:number; // 0..1
 texture:LowerBodyTextureKind;
 textureScale:number;  // 0.4..2.5
 offsetX:number;       // -0.25..0.25
 offsetY:number;       // -0.25..0.25
 mediaId:string;
}

export interface LowerBodyComposerState{
 maskPreset:LowerBodyMaskPreset;
 customCutoff:number;   // 0.15..0.65 (fraction down thigh from hip; lower = higher up thigh)
 customSpread:number;   // 0.7..1.4 (width multiplier)
 feather:number;        // 0..24 px
 look:LowerBodyLookMode;
 activeTarget:'A'|'B'|'BOTH';
 skeletonScope:'lower'|'full';
 showCutoffLine:boolean;
 showConfidence:boolean;
 styleA:PerformerLowerBodyStyle;
 styleB:PerformerLowerBodyStyle;
 activePresetId:string;
}

export interface LowerBodyQuickPreset{
 id:string;
 name:string;
 short:string;
 swatch:string;
 patch:Partial<Pick<LowerBodyComposerState,'maskPreset'|'look'|'feather'>>&{
  styleA:Partial<PerformerLowerBodyStyle>;
  styleB:Partial<PerformerLowerBodyStyle>;
 };
}

export const LOWER_BODY_COLOR_CHIPS:readonly {id:string;label:string;hex:string}[]=[
 {id:'red',label:'Merah',hex:'#e84855'},
 {id:'blue',label:'Biru',hex:'#3b8cff'},
 {id:'green',label:'Hijau',hex:'#4cd97b'},
 {id:'white',label:'Putih',hex:'#f2f6f2'},
 {id:'yellow',label:'Kuning',hex:'#f2cf57'},
 {id:'cyan',label:'Cyan',hex:'#38d9e8'},
 {id:'magenta',label:'Magenta',hex:'#e359c8'}
];

export const LOWER_BODY_MASK_PRESETS:readonly {id:LowerBodyMaskPreset;label:string;cutoff:number;spread:number;desc:string}[]=[
 {id:'auto',label:'Auto Lower Body',cutoff:0.32,spread:1.0,desc:'Dari paha atas ke bawah'},
 {id:'tight',label:'Tight Legs',cutoff:0.52,spread:0.86,desc:'Fokus lutut, betis & telapak'},
 {id:'wide',label:'Wide Lower Body',cutoff:0.24,spread:1.18,desc:'Paha atas longgar & aman'},
 {id:'custom',label:'Custom',cutoff:0.32,spread:1.0,desc:'Atur batas paha manual'}
];

export const LOWER_BODY_LOOK_MODES:readonly {id:LowerBodyLookMode;label:string}[]=[
 {id:'solid',label:'Solid'},
 {id:'wash',label:'Lighting Wash'},
 {id:'texture',label:'Texture'},
 {id:'image',label:'Image'}
];

export const LOWER_BODY_TEXTURES:readonly {id:LowerBodyTextureKind;label:string}[]=[
 {id:'linen',label:'Linen'},
 {id:'grain',label:'Grain'},
 {id:'noise',label:'Noise'},
 {id:'organic',label:'Organic'}
];

export const LOWER_BODY_SIM_ACTIONS:readonly {id:LowerBodySimAction|'reset';label:string}[]=[
 {id:'step-l',label:'STEP L'},
 {id:'step-r',label:'STEP R'},
 {id:'slide',label:'SLIDE'},
 {id:'pivot',label:'PIVOT'},
 {id:'crossing',label:'CROSSING'},
 {id:'reset',label:'RESET'}
];

export const LOWER_BODY_CUSTOM_PRESETS_KEY='soma-compose-lower-body-presets-v1';

const baseStyle=(color:string,secondaryColor:string):PerformerLowerBodyStyle=>({
 color,
 secondaryColor,
 opacity:0.9,
 brightness:1.0,
 blendStrength:0.82,
 texture:'linen',
 textureScale:1.0,
 offsetX:0,
 offsetY:0,
 mediaId:''
});

export function defaultLowerBodyState():LowerBodyComposerState{
 return {
  maskPreset:'auto',
  customCutoff:0.32,
  customSpread:1.0,
  feather:6,
  look:'wash',
  activeTarget:'BOTH',
  skeletonScope:'lower',
  showCutoffLine:true,
  showConfidence:true,
  styleA:baseStyle('#e84855','#ff9e7d'),
  styleB:baseStyle('#3b8cff','#8ad8ff'),
  activePresetId:'a-red-b-blue'
 };
}

/** 8 required built-in quick presets from SOMA Compose Lower-Body Simplification spec. */
export const LOWER_BODY_QUICK_PRESETS:readonly LowerBodyQuickPreset[]=[
 {
  id:'a-red-b-blue',
  name:'A Red / B Blue',
  short:'A Merah · B Biru',
  swatch:'linear-gradient(90deg,#e84855 0 48%,#3b8cff 52% 100%)',
  patch:{
   look:'solid',
   feather:5,
   styleA:{color:'#e84855',secondaryColor:'#ff8b94',opacity:0.92,brightness:1.05},
   styleB:{color:'#3b8cff',secondaryColor:'#8bc8ff',opacity:0.92,brightness:1.05}
  }
 },
 {
  id:'a-green-b-magenta',
  name:'A Green / B Magenta',
  short:'A Hijau · B Magenta',
  swatch:'linear-gradient(90deg,#4cd97b 0 48%,#e359c8 52% 100%)',
  patch:{
   look:'solid',
   feather:5,
   styleA:{color:'#4cd97b',secondaryColor:'#b6f5c9',opacity:0.9,brightness:1.02},
   styleB:{color:'#e359c8',secondaryColor:'#ffaae9',opacity:0.9,brightness:1.02}
  }
 },
 {
  id:'both-white',
  name:'Both White',
  short:'Dua kaki putih bersih',
  swatch:'linear-gradient(90deg,#eef3ee 0 100%)',
  patch:{
   look:'solid',
   feather:4,
   styleA:{color:'#f2f6f2',secondaryColor:'#ffffff',opacity:0.95,brightness:1.1},
   styleB:{color:'#f2f6f2',secondaryColor:'#ffffff',opacity:0.95,brightness:1.1}
  }
 },
 {
  id:'both-red-wash',
  name:'Both Red Wash',
  short:'Cahaya panggung merah',
  swatch:'linear-gradient(90deg,#6e1620,#e84855,#ff9c78)',
  patch:{
   look:'wash',
   feather:12,
   styleA:{color:'#e84855',secondaryColor:'#ff9e7d',opacity:0.86,brightness:1.12,blendStrength:0.85},
   styleB:{color:'#d93b49',secondaryColor:'#ff8a70',opacity:0.86,brightness:1.12,blendStrength:0.85}
  }
 },
 {
  id:'both-blue-wash',
  name:'Both Blue Wash',
  short:'Cahaya panggung biru',
  swatch:'linear-gradient(90deg,#122e66,#3b8cff,#7ee8fa)',
  patch:{
   look:'wash',
   feather:12,
   styleA:{color:'#3b8cff',secondaryColor:'#7ee8fa',opacity:0.86,brightness:1.12,blendStrength:0.85},
   styleB:{color:'#2f78e8',secondaryColor:'#84d9ff',opacity:0.86,brightness:1.12,blendStrength:0.85}
  }
 },
 {
  id:'texture-linen',
  name:'Texture Linen',
  short:'Serat tenun linen',
  swatch:'repeating-linear-gradient(45deg,#c9c2ad 0 3px,#8b8472 3px 6px)',
  patch:{
   look:'texture',
   feather:6,
   styleA:{color:'#e8dec6',secondaryColor:'#a89c80',texture:'linen',textureScale:1.1,opacity:0.92,brightness:1.0},
   styleB:{color:'#d2dbe3',secondaryColor:'#8c9aa8',texture:'linen',textureScale:1.1,opacity:0.92,brightness:1.0}
  }
 },
 {
  id:'texture-grain',
  name:'Texture Grain',
  short:'Butir film organik',
  swatch:'linear-gradient(90deg,#525e57,#b9c8be,#3d4741)',
  patch:{
   look:'texture',
   feather:8,
   styleA:{color:'#d9e8dc',secondaryColor:'#6f8575',texture:'grain',textureScale:1.0,opacity:0.9,brightness:1.05},
   styleB:{color:'#c7d4e6',secondaryColor:'#647691',texture:'grain',textureScale:1.0,opacity:0.9,brightness:1.05}
  }
 },
 {
  id:'archive-bw',
  name:'Archive B/W Fill',
  short:'Arsip monokrom B/W',
  swatch:'linear-gradient(90deg,#1c1f1d,#e4e8e5,#525954)',
  patch:{
   look:'image',
   feather:6,
   styleA:{color:'#e8ece9',secondaryColor:'#6d7570',texture:'organic',textureScale:1.0,opacity:0.94,brightness:1.02},
   styleB:{color:'#d6dcd8',secondaryColor:'#565f59',texture:'organic',textureScale:1.0,opacity:0.94,brightness:0.98}
  }
 }
];

const clamp=(v:number,min:number,max:number)=>Math.min(max,Math.max(min,Number.isFinite(v)?v:min));

export function resolveMaskGeometry(state:Pick<LowerBodyComposerState,'maskPreset'|'customCutoff'|'customSpread'>):{cutoff:number;spread:number}{
 if(state.maskPreset==='custom'){
  return {cutoff:clamp(state.customCutoff,0.15,0.65),spread:clamp(state.customSpread,0.7,1.4)};
 }
 const found=LOWER_BODY_MASK_PRESETS.find(p=>p.id===state.maskPreset)??LOWER_BODY_MASK_PRESETS[0];
 return {cutoff:found.cutoff,spread:found.spread};
}

export function applyLowerBodyQuickPreset(
 current:LowerBodyComposerState,
 presetId:string
):LowerBodyComposerState{
 const found=LOWER_BODY_QUICK_PRESETS.find(p=>p.id===presetId);
 if(!found)return current;
 return {
  ...current,
  maskPreset:found.patch.maskPreset??current.maskPreset,
  look:found.patch.look??current.look,
  feather:found.patch.feather??current.feather,
  styleA:{...current.styleA,...found.patch.styleA},
  styleB:{...current.styleB,...found.patch.styleB},
  activePresetId:found.id
 };
}

export function updateLowerBodyStyle(
 current:LowerBodyComposerState,
 target:'A'|'B'|'BOTH',
 patch:Partial<PerformerLowerBodyStyle>
):LowerBodyComposerState{
 const clean:Partial<PerformerLowerBodyStyle>={...patch};
 if(clean.opacity!==undefined)clean.opacity=clamp(clean.opacity,0.1,1);
 if(clean.brightness!==undefined)clean.brightness=clamp(clean.brightness,0.35,1.6);
 if(clean.blendStrength!==undefined)clean.blendStrength=clamp(clean.blendStrength,0,1);
 if(clean.textureScale!==undefined)clean.textureScale=clamp(clean.textureScale,0.4,2.5);
 if(clean.offsetX!==undefined)clean.offsetX=clamp(clean.offsetX,-0.25,0.25);
 if(clean.offsetY!==undefined)clean.offsetY=clamp(clean.offsetY,-0.25,0.25);
 return {
  ...current,
  activePresetId:'custom',
  styleA:target==='A'||target==='BOTH'?{...current.styleA,...clean}:current.styleA,
  styleB:target==='B'||target==='BOTH'?{...current.styleB,...clean}:current.styleB
 };
}

export interface SavedLowerBodyPreset{
 id:string;
 name:string;
 state:LowerBodyComposerState;
}

export function loadSavedLowerBodyPresets(storage?:Pick<Storage,'getItem'>):SavedLowerBodyPreset[]{
 try{
  const raw=storage?.getItem(LOWER_BODY_CUSTOM_PRESETS_KEY);
  if(!raw)return [];
  const parsed=JSON.parse(raw);
  if(!Array.isArray(parsed))return [];
  return parsed.filter(item=>item&&typeof item.id==='string'&&typeof item.name==='string'&&item.state&&typeof item.state==='object').slice(0,12);
 }catch{return [];}
}

export function saveCustomLowerBodyPreset(
 existing:readonly SavedLowerBodyPreset[],
 name:string,
 state:LowerBodyComposerState,
 storage?:Pick<Storage,'setItem'>
):SavedLowerBodyPreset[]{
 const trimmed=name.trim().slice(0,36)||'Preset '+String(existing.length+1);
 const next:SavedLowerBodyPreset[]=[
  {id:'user-'+Date.now(),name:trimmed,state:{...state,styleA:{...state.styleA},styleB:{...state.styleB}}},
  ...existing.filter(item=>item.name.toLowerCase()!==trimmed.toLowerCase())
 ].slice(0,12);
 try{storage?.setItem(LOWER_BODY_CUSTOM_PRESETS_KEY,JSON.stringify(next));}catch{}
 return next;
}

/** Normalized leg joint coordinates (0..1 stage space) for deterministic simulation & live pose normalization. */
export interface LegChain{
 hip:{x:number;y:number};
 thighMid:{x:number;y:number};
 knee:{x:number;y:number};
 ankle:{x:number;y:number};
 heel:{x:number;y:number};
 toe:{x:number;y:number};
 planted:boolean;
 headingRad:number;
}

export interface PerformerLowerBodyPose{
 id:'A'|'B';
 confidence:number;
 left:LegChain;
 right:LegChain;
 torso?:{shoulderL:{x:number;y:number};shoulderR:{x:number;y:number};head:{x:number;y:number}};
}

export interface LowerBodyFrameSnapshot{
 performers:PerformerLowerBodyPose[];
 crossing:boolean;
 ambiguous:boolean;
 source:'live'|'simulation';
 actionLabel:string;
}

function makeChain(
 hipX:number,hipY:number,
 kneeDx:number,ankleDx:number,
 lift:number,toeDx:number,
 planted:boolean,headingRad=0
):LegChain{
 const kneeY=hipY+0.25-lift*0.5;
 const ankleY=hipY+0.52-lift;
 return {
  hip:{x:hipX,y:hipY},
  thighMid:{x:hipX+kneeDx*0.45,y:hipY+0.125-lift*0.2},
  knee:{x:hipX+kneeDx,y:kneeY},
  ankle:{x:hipX+ankleDx,y:ankleY},
  heel:{x:hipX+ankleDx-0.014,y:ankleY+0.055},
  toe:{x:hipX+ankleDx+toeDx,y:ankleY+0.06},
  planted,
  headingRad
 };
}

/** Deterministic, smooth lower-body simulation matching the orthographic reference silhouette. */
export function buildSimulatedLowerBodyFrame(
 timeMs:number,
 action:LowerBodySimAction,
 performerCount:1|2
):LowerBodyFrameSnapshot{
 const phase=(timeMs/1000)*2.2;
 const wave=Math.sin(phase);
 const sway=Math.cos(phase*0.65)*0.008;

 let aCenter=performerCount===2?0.39:0.5;
 let bCenter=0.61;
 let aLiftL=0,aLiftR=0,aSlideL=0,aPivotR=0;
 let bLiftL=0,bLiftR=0,bSlideR=0;
 let crossing=false;
 let actionLabel='LIVE SIMULATION';

 if(action==='step-l'){
  aLiftL=Math.max(0,Math.sin(phase))*0.07;
  bLiftL=Math.max(0,Math.sin(phase+1.1))*0.05;
  actionLabel='STEP L · SIMULATION';
 }else if(action==='step-r'){
  aLiftR=Math.max(0,Math.sin(phase))*0.07;
  bLiftR=Math.max(0,Math.sin(phase+0.9))*0.05;
  actionLabel='STEP R · SIMULATION';
 }else if(action==='slide'){
  aSlideL=Math.sin(phase)*0.055;
  bSlideR=-Math.sin(phase)*0.045;
  actionLabel='SLIDE · SIMULATION';
 }else if(action==='pivot'){
  aPivotR=Math.sin(phase)*0.55;
  actionLabel='PIVOT · SIMULATION';
 }else if(action==='crossing'&&performerCount===2){
  const crossMix=Math.sin(phase*0.75);
  aCenter=0.5-0.11*crossMix;
  bCenter=0.5+0.11*crossMix;
  crossing=Math.abs(aCenter-bCenter)<0.095;
  aLiftL=Math.max(0,Math.cos(phase*1.5))*0.045;
  bLiftR=Math.max(0,-Math.cos(phase*1.5))*0.045;
  actionLabel=crossing?'CROSSING · IDENTITY GUARD':'CROSSING · SIMULATION';
 }else{
  aLiftL=Math.max(0,wave)*0.018;
  bLiftR=Math.max(0,-wave)*0.018;
 }

 const hipY=0.25;
 const perfA:PerformerLowerBodyPose={
  id:'A',
  confidence:crossing?0.84:0.98,
  left:makeChain(aCenter-0.055+sway,hipY,-0.012+aSlideL*0.4,-0.022+aSlideL,aLiftL,-0.045,aLiftL<0.012,aSlideL*2),
  right:makeChain(aCenter+0.055+sway,hipY,0.008,0.012,aLiftR,0.045+Math.sin(aPivotR)*0.018,aLiftR<0.012,aPivotR),
  torso:{
   shoulderL:{x:aCenter-0.075+sway,y:0.06},
   shoulderR:{x:aCenter+0.075+sway,y:0.06},
   head:{x:aCenter+sway,y:0.01}
  }
 };

 const performers:PerformerLowerBodyPose[]=[perfA];
 if(performerCount===2){
  performers.push({
   id:'B',
   confidence:crossing?0.79:0.91,
   left:makeChain(bCenter-0.055-sway,hipY,-0.006,-0.01,bLiftL,-0.042,bLiftL<0.012,0),
   right:makeChain(bCenter+0.055-sway,hipY,0.012+bSlideR*0.4,0.018+bSlideR,bLiftR,0.048,bLiftR<0.012,bSlideR*2),
   torso:{
    shoulderL:{x:bCenter-0.075-sway,y:0.06},
    shoulderR:{x:bCenter+0.075-sway,y:0.06},
    head:{x:bCenter-sway,y:0.01}
   }
  });
 }

 return {
  performers,
  crossing,
  ambiguous:crossing,
  source:'simulation',
  actionLabel
 };
}

/** Converts live MediaPipe 33-point pose landmarks into normalized PerformerLowerBodyPose when present. */
export function extractLiveLowerBodyPose(
 pose:{x:number;y:number;visibility?:number}[]|undefined,
 id:'A'|'B'='A'
):PerformerLowerBodyPose|null{
 if(!pose||pose.length<33)return null;
 const lh=pose[23],rh=pose[24],lk=pose[25],rk=pose[26],la=pose[27],ra=pose[28],lHeel=pose[29],rHeel=pose[30],lToe=pose[31],rToe=pose[32];
 const vis=[lh,rh,lk,rk,la,ra].map(p=>p?.visibility??0.9);
 const avgConf=vis.reduce((a,b)=>a+b,0)/vis.length;
 if(!lh||!rh||!lk||!rk||!la||!ra||avgConf<0.4)return null;

 const build=(hip:typeof lh,knee:typeof lk,ankle:typeof la,heel:typeof lHeel,toe:typeof lToe):LegChain=>({
  hip:{x:hip.x,y:hip.y},
  thighMid:{x:(hip.x+knee.x)*0.5,y:(hip.y+knee.y)*0.5},
  knee:{x:knee.x,y:knee.y},
  ankle:{x:ankle.x,y:ankle.y},
  heel:{x:heel?.x??ankle.x-0.012,y:heel?.y??ankle.y+0.045},
  toe:{x:toe?.x??ankle.x+0.032,y:toe?.y??ankle.y+0.05},
  planted:ankle.y>0.7,
  headingRad:Math.atan2((toe?.y??ankle.y)-ankle.y,(toe?.x??ankle.x+0.03)-ankle.x)
 });

 return {
  id,
  confidence:Math.min(0.99,Math.max(0.45,avgConf)),
  left:build(lh,lk,la,lHeel,lToe),
  right:build(rh,rk,ra,rHeel,rToe),
  torso:{
   shoulderL:{x:pose[11]?.x??lh.x-0.02,y:pose[11]?.y??Math.max(0.05,lh.y-0.25)},
   shoulderR:{x:pose[12]?.x??rh.x+0.02,y:pose[12]?.y??Math.max(0.05,rh.y-0.25)},
   head:{x:pose[0]?.x??(lh.x+rh.x)*0.5,y:pose[0]?.y??Math.max(0.02,lh.y-0.38)}
  }
 };
}
