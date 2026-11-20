/**
 * Compose Visual Style Library & Live Creative-Coding Performance Steering.
 * Pure, deterministic configuration consumed by the single PixiJS v8 WebGL2
 * footprint shader. Every style stays strictly clipped inside the verified
 * anatomical 5-toe foot mask — artistic steering never invents live contacts
 * or grants physical projector authorization.
 */

export type ComposeVisualStyleId=
 |'mineral'
 |'neon-flux'
 |'thermal'
 |'aurora'
 |'topo-wire'
 |'prism-ripple';

export type ComposeVisualStyleMeta={
 id:ComposeVisualStyleId;
 index:0|1|2|3|4|5;
 name:string;
 tag:string;
 description:string;
 /** Performer A & B default RGB (0..1) tints for the GPU shader. */
 tintA:readonly [number,number,number];
 tintB:readonly [number,number,number];
 /** Preview swatch gradient CSS for crisp studio selection cards. */
 swatch:string;
 /** Recommended starting steering values when selecting this style. */
 defaults:{flow:number;turbulence:number;glow:number;pulseRate:number};
};

export const COMPOSE_VISUAL_STYLES:readonly ComposeVisualStyleMeta[]=[
 {
  id:'mineral',index:0,name:'Mineral Ink',tag:'Organik Cair',
  description:'Aliran tinta mineral & urat halus di dalam telapak.',
  tintA:[.84,.90,.74],tintB:[.48,.82,.90],
  swatch:'linear-gradient(135deg,#2e4a38 0%,#cde3a5 55%,#77c4d6 100%)',
  defaults:{flow:.68,turbulence:.45,glow:.42,pulseRate:.22}
 },
 {
  id:'neon-flux',index:1,name:'Neon Flux',tag:'Elektrik',
  description:'Filamen plasma & tepi bercahaya responsif gerak.',
  tintA:[.28,.94,.86],tintB:[.94,.36,.78],
  swatch:'linear-gradient(135deg,#0f2936 0%,#45f0dc 50%,#f05bc7 100%)',
  defaults:{flow:.80,turbulence:.58,glow:.82,pulseRate:.55}
 },
 {
  id:'thermal',index:2,name:'Ember Thermal',tag:'Bara Termal',
  description:'Inti panas menyala saat pijakan lalu mendingin menjadi abu.',
  tintA:[.98,.52,.18],tintB:[.96,.24,.42],
  swatch:'linear-gradient(135deg,#33140c 0%,#fa852e 55%,#ffd86b 100%)',
  defaults:{flow:.62,turbulence:.65,glow:.78,pulseRate:.40}
 },
 {
  id:'aurora',index:3,name:'Aurora Mist',tag:'Spektral',
  description:'Gelombang kabut spektral berirama mengikuti arah langkah.',
  tintA:[.44,.92,.72],tintB:[.58,.52,.98],
  swatch:'linear-gradient(135deg,#182838 0%,#6eeab8 48%,#9484fa 100%)',
  defaults:{flow:.54,turbulence:.40,glow:.64,pulseRate:.32}
 },
 {
  id:'topo-wire',index:4,name:'Topo Vector',tag:'Generatif',
  description:'Garis kontur topografi & kisi pindai ala creative coding.',
  tintA:[.86,.98,.64],tintB:[.52,.88,.98],
  swatch:'linear-gradient(135deg,#112419 0%,#dafaa3 52%,#54d8f2 100%)',
  defaults:{flow:.50,turbulence:.52,glow:.68,pulseRate:.36}
 },
 {
  id:'prism-ripple',index:5,name:'Chromatic Ripple',tag:'Interferensi',
  description:'Riak konsentris RGB menyebar dari tumpuan tumit ke jari.',
  tintA:[.96,.68,.88],tintB:[.46,.90,.96],
  swatch:'linear-gradient(135deg,#241834 0%,#f5ade0 45%,#75e6f5 100%)',
  defaults:{flow:.74,turbulence:.48,glow:.72,pulseRate:.62}
 }
];

export type ComposeSteeringState={
 styleId:ComposeVisualStyleId;
 /** Animation flow / tempo (0..1) — XY pad X-axis. */
 flow:number;
 /** Procedural distortion / generative complexity (0..1) — XY pad Y-axis. */
 turbulence:number;
 /** Rim & highlight intensity (0..1). */
 glow:number;
 /** Live color rotation (-0.5..0.5). */
 hueShift:number;
 /** Rhythmic breathing pulse speed (0..1). */
 pulseRate:number;
};

export const DEFAULT_COMPOSE_STEERING:ComposeSteeringState={
 styleId:'mineral',
 flow:.68,
 turbulence:.45,
 glow:.48,
 hueShift:0,
 pulseRate:.24
};

export type SteerMacroPreset={
 id:string;
 label:string;
 patch:Partial<ComposeSteeringState>;
};

export const COMPOSE_STEER_MACROS:readonly SteerMacroPreset[]=[
 {id:'calm',label:'Halus',patch:{flow:.34,turbulence:.25,glow:.36,pulseRate:.15}},
 {id:'stage',label:'Panggung',patch:{flow:.72,turbulence:.52,glow:.72,pulseRate:.42}},
 {id:'kinetic',label:'Kinetik',patch:{flow:.96,turbulence:.86,glow:.92,pulseRate:.78}},
 {id:'reset',label:'Netral',patch:{flow:.68,turbulence:.45,glow:.48,hueShift:0,pulseRate:.24}}
];

const clamp=(v:number,min:number,max:number)=>
 Number.isFinite(v)?Math.min(max,Math.max(min,v)):min;

export function getComposeVisualStyle(id:ComposeVisualStyleId):ComposeVisualStyleMeta{
 return COMPOSE_VISUAL_STYLES.find(s=>s.id===id)??COMPOSE_VISUAL_STYLES[0];
}

export function sanitizeSteeringState(raw:Partial<ComposeSteeringState>):ComposeSteeringState{
 const style=COMPOSE_VISUAL_STYLES.find(s=>s.id===raw.styleId)?.id??DEFAULT_COMPOSE_STEERING.styleId;
 return {
  styleId:style,
  flow:clamp(raw.flow??DEFAULT_COMPOSE_STEERING.flow,0,1),
  turbulence:clamp(raw.turbulence??DEFAULT_COMPOSE_STEERING.turbulence,0,1),
  glow:clamp(raw.glow??DEFAULT_COMPOSE_STEERING.glow,0,1),
  hueShift:clamp(raw.hueShift??DEFAULT_COMPOSE_STEERING.hueShift,-.5,.5),
  pulseRate:clamp(raw.pulseRate??DEFAULT_COMPOSE_STEERING.pulseRate,0,1)
 };
}

/**
 * Convert Compose footprint size (12..90 px slider) into PixiJS sole sprite
 * dimensions while preserving the nominal anatomical width/length ratio
 * (0.095 m / 0.26 m ≈ 0.365). This is an artistic display size, never a claim
 * of measured performer foot length without physical stage calibration.
 */
export function footprintSpriteDimensions(sizePx:number):{widthPx:number;lengthPx:number}{
 const s=clamp(sizePx,12,90);
 const lengthPx=Math.round(Math.min(360,Math.max(76,s*5.2)));
 const widthPx=Math.round(lengthPx*(0.095/0.26)*1.42);
 return {widthPx,lengthPx};
}

export type ComposeProvenanceState={
 kind:'demo'|'live-detected'|'video-estimate'|'simulation'|'waiting';
 label:string;
 detail:string;
};

/** Honest source provenance badge for Compose Stage Monitor. */
export function deriveComposeProvenance(params:{
 liquidMode:'track'|'demo';
 experimentSource:'video'|'simulator'|null;
 cameraOn:boolean;
 floorReady:boolean;
}):ComposeProvenanceState{
 if(params.liquidMode==='demo')
  return {kind:'demo',label:'DEMO SINTETIK',detail:'Pratinjau uji gaya — bukan data pelacakan'};
 if(params.experimentSource==='video')
  return {kind:'video-estimate',label:'VIDEO ESTIMATE',detail:'Estimasi 2D dari berkas video Track'};
 if(params.experimentSource==='simulator')
  return {kind:'simulation',label:'SIMULASI 3D',detail:'Kontak virtual dari simulator panggung'};
 if(params.cameraOn&&params.floorReady)
  return {kind:'live-detected',label:'LIVE DETECTED',detail:'Pelacakan kamera terkalibrasi lantai'};
 if(params.cameraOn)
  return {kind:'waiting',label:'KAMERA · BELUM KALIBRASI',detail:'Kamera aktif; konfirmasi lantai di Track'};
 return {kind:'waiting',label:'MENUNGGU TRACK',detail:'Pilih sumber gerak di Track atau aktifkan Demo'};
}
