/** ENGINE-02 — Single PixiJS v8 WebGL2 footprint shader compositor.
 * ONE Pixi Application / WebGL2 renderer owns every sole mask and steerable
 * visual style filter. Track / Map / Perform / projector safety are never modified.
 */
import {Application,CanvasSource,Filter,Matrix,Sprite,Texture} from 'pixi.js';
import {METRIC_SOLE_SCALE,paintAuthenticFootprint} from '../scenes/authenticFootGeometry.ts';
import {liquidMaterialResponse} from './liquidMaterialResponse.ts';
import {MATERIAL03_GLSL} from './liquidMaterialShader.ts';
import {collectLiquidImprints,LIQUID_LIMIT,type LiquidImprint,type LiquidTimelineOptions,type LiquidInputEvent}
 from './liquidImprintTimeline.ts';
import {DEFAULT_COMPOSE_STEERING,getComposeVisualStyle,type ComposeVisualStyleId}
 from './composeVisualStyles.ts';

const WIDTH=160,HEIGHT=320,MASK_WIDTH=112,MASK_LENGTH=250;
const clamp=(v:number,min:number,max:number)=>Math.min(max,Math.max(min,v));
const safe=(v:number,base:number)=>Number.isFinite(v)?v:base;
const PIXI_MATERIAL_FRAGMENT=`
in vec2 vTextureCoord;
out vec4 finalColor;
uniform sampler2D uTexture;
uniform float uAge;
uniform float uSeed;
uniform float uFlow;
uniform float uTurbulence;
uniform float uGlow;
uniform float uHueShift;
uniform float uPulseRate;
uniform float uStyle;
uniform float uContactFill;
uniform float uSlideStrength;
uniform float uPivotStrength;
uniform float uReleaseProgress;
uniform float uTwist;
uniform vec2 uSlide;
uniform vec3 uTint;
${MATERIAL03_GLSL}
void main(){
 float coverage=texture(uTexture,vTextureCoord).a;
 if(coverage<.015)discard;
 vec3 pigment=composeStylePigment(
  vTextureCoord,uAge,uSeed,uFlow,
  uTurbulence,uGlow,uHueShift,uPulseRate,uStyle,
  uContactFill,uSlide,uSlideStrength,uTwist,
  uPivotStrength,uReleaseProgress,uTint
 );
 finalColor=vec4(pigment*coverage,coverage);
}`;

type RecordEntry={
 sprite:Sprite;texture:Texture;source:CanvasSource;filter:Filter;
 mask:HTMLCanvasElement;ctx:CanvasRenderingContext2D;signature:string;
};
export type PixiLiquidStats={
 renderer:'PixiJS v8 WebGL2';contexts:1;activeImprints:number;
 material:string;orientationUncertain:number;
 allocatedTextures:number;maxTextures:number;
};
function createFilter():Filter{
 return Filter.from({
  gl:{
   // Explicit Pixi v8 filter-vertex contract (required by v8.23 types).
   vertex:`
in vec2 aPosition;
out vec2 vTextureCoord;
uniform vec4 uInputSize;
uniform vec4 uOutputFrame;
uniform vec4 uOutputTexture;
void main(void){
 vec2 position=aPosition*uOutputFrame.zw+uOutputFrame.xy;
 position.x=position.x*(2.0/uOutputTexture.x)-1.0;
 position.y=position.y*(2.0*uOutputTexture.z/uOutputTexture.y)-uOutputTexture.z;
 gl_Position=vec4(position,0.0,1.0);
 vTextureCoord=aPosition*(uOutputFrame.zw*uInputSize.zw);
}
`,
   fragment:PIXI_MATERIAL_FRAGMENT
  },
  resources:{
   liquidUniforms:{
    uAge:{value:0,type:'f32'},uSeed:{value:0,type:'f32'},
    uFlow:{value:.68,type:'f32'},uTurbulence:{value:.45,type:'f32'},
    uGlow:{value:.48,type:'f32'},uHueShift:{value:0,type:'f32'},
    uPulseRate:{value:.24,type:'f32'},uStyle:{value:0,type:'f32'},
    uContactFill:{value:0,type:'f32'},
    uSlideStrength:{value:0,type:'f32'},uPivotStrength:{value:0,type:'f32'},
    uReleaseProgress:{value:0,type:'f32'},uTwist:{value:0,type:'f32'},
    uSlide:{value:new Float32Array([0,0]),type:'vec2<f32>'},
    uTint:{value:new Float32Array([.84,.90,.74]),type:'vec3<f32>'}
   }
  },
  padding:0
 });
}
export class PixiLiquidImprintCompositor{
 private readonly soleMatrix=new Matrix();
 readonly canvas:HTMLCanvasElement;
 private readonly app:Application;
 private readonly masks=new Map<string,RecordEntry>();
 private destroyed=false;
 private lastStats:PixiLiquidStats={
  renderer:'PixiJS v8 WebGL2',contexts:1,activeImprints:0,
  material:'Mineral Ink',orientationUncertain:0,
  allocatedTextures:0,maxTextures:LIQUID_LIMIT
 };
 private constructor(canvas:HTMLCanvasElement,app:Application){
  this.canvas=canvas;this.app=app;
 }
 static async create(canvas:HTMLCanvasElement):Promise<PixiLiquidImprintCompositor>{
  const app=new Application();
  await app.init({
   canvas,width:canvas.width,height:canvas.height,
   preference:'webgl',autoStart:false,sharedTicker:false,
   backgroundAlpha:0,antialias:true,preserveDrawingBuffer:true,
   resolution:1,autoDensity:false
  });
  app.ticker.stop();
  if(app.renderer.type!==1){
   app.destroy(false);
   throw Error('ENGINE-02 WebGL renderer unavailable');
  }
  return new PixiLiquidImprintCompositor(canvas,app);
 }
 get stats():PixiLiquidStats{return {...this.lastStats};}
 private createMask(imprint:LiquidImprint):RecordEntry{
  const mask=document.createElement('canvas');
  mask.width=WIDTH;mask.height=HEIGHT;
  const ctx=mask.getContext('2d');
  if(!ctx)throw Error('ENGINE-02 Canvas2D masks unavailable');
  const source=new CanvasSource({resource:mask,autoGenerateMipmaps:false});
  const texture=new Texture({source});
  const sprite=new Sprite(texture);
  const filter=createFilter();
  sprite.anchor.set(.5);
  sprite.filters=[filter];
  this.app.stage.addChild(sprite);
  const entry={sprite,texture,source,filter,mask,ctx,signature:''};
  this.masks.set(imprint.id,entry);
  return entry;
 }
 private dispose(id:string){
  const entry=this.masks.get(id);
  if(!entry)return;
  this.app.stage.removeChild(entry.sprite);
  entry.sprite.filters=[];
  entry.filter.destroy();
  entry.sprite.destroy();
  entry.texture.destroy(true);
  this.masks.delete(id);
 }
 render(events:readonly LiquidInputEvent[],timeMs:number,options:LiquidTimelineOptions&{
  styleId?:ComposeVisualStyleId;
  flow?:number;turbulence?:number;glow?:number;hueShift?:number;pulseRate?:number;
  widthPx?:number;lengthPx?:number;metricFloor?:{widthM:number;depthM:number}|null;sizeFactor?:number;
  /** QA only: freeze anatomy to compare shader material at one identical mask. */
  materialOnlyQA?:boolean
 }={}):PixiLiquidStats{
  if(this.destroyed)throw Error('ENGINE-02 Pixi compositor destroyed');
  const items=collectLiquidImprints(events,timeMs,options);
  const ids=new Set(items.map(x=>x.id));
  for(const id of this.masks.keys())if(!ids.has(id))this.dispose(id);
  const style=getComposeVisualStyle(options.styleId??DEFAULT_COMPOSE_STEERING.styleId);
  const width=clamp(safe(options.widthPx??72,72),25,220);
  const height=clamp(safe(options.lengthPx??116,116),55,440);
  const flow=clamp(safe(options.flow??style.defaults.flow,style.defaults.flow),0,1);
  const turbulence=clamp(safe(options.turbulence??style.defaults.turbulence,style.defaults.turbulence),0,1);
  const glow=clamp(safe(options.glow??style.defaults.glow,style.defaults.glow),0,1);
  const hueShift=clamp(safe(options.hueShift??0,0),-.5,.5);
  const pulseRate=clamp(safe(options.pulseRate??style.defaults.pulseRate,style.defaults.pulseRate),0,1);
  for(const imprint of items){
   const entry=this.masks.get(imprint.id)??this.createMask(imprint);
   const d=options.materialOnlyQA?
    {mode:'stance' as const,amount:0}:imprint.deformation;
   const response=liquidMaterialResponse(imprint);
   const signature=[imprint.foot,d.mode,d.amount,d.travelX,d.travelY,d.pivotRad]
    .map(v=>typeof v==='number'?Math.round(v*120):String(v)).join(':');
   if(entry.signature!==signature){
    entry.signature=signature;
    entry.ctx.setTransform(1,0,0,1,0,0);
    entry.ctx.clearRect(0,0,WIDTH,HEIGHT);
    paintAuthenticFootprint(entry.ctx,{
     x:WIDTH/2,y:HEIGHT/2,widthPx:MASK_WIDTH,lengthPx:MASK_LENGTH,
     color:'#ffffff',side:imprint.foot,deformation:d
    });
    entry.source.update();
   }
   const sprite=entry.sprite;
   const x=imprint.x*this.canvas.width,y=imprint.y*this.canvas.height;
   const angle=imprint.orientationKnown?Math.PI/2-imprint.headingRad:0;
   const floor=options.metricFloor;
   if(floor&&floor.widthM>0&&floor.depthM>0&&
      (imprint.basis==='calibrated-estimate'||imprint.basis==='simulated')){
    const px=this.canvas.width/floor.widthM,py=this.canvas.height/floor.depthM;
    const factor=clamp(safe(options.sizeFactor??1,1),.25,3);
    const sx=METRIC_SOLE_SCALE.widthM*factor/MASK_WIDTH,sy=METRIC_SOLE_SCALE.lengthM*factor/MASK_LENGTH;
    const c=Math.cos(angle),s=Math.sin(angle);
    sprite.setFromMatrix(this.soleMatrix.set(px*c*sx,py*s*sx,-px*s*sy,py*c*sy,x,y));
   }else{
    sprite.position.set(x,y);sprite.skew.set(0,0);
    sprite.width=width;sprite.height=height;sprite.rotation=angle;
   }
   sprite.alpha=response.opacity*.95;
   const uniforms=entry.filter.resources.liquidUniforms.uniforms;
   uniforms.uAge=imprint.ageMs/1000;
   uniforms.uSeed=imprint.seed;
   uniforms.uFlow=flow;
   uniforms.uTurbulence=turbulence;
   uniforms.uGlow=glow;
   uniforms.uHueShift=hueShift;
   uniforms.uPulseRate=pulseRate;
   uniforms.uStyle=style.index;
   uniforms.uContactFill=response.contactFill;
   uniforms.uSlideStrength=response.slideStrength;
   uniforms.uPivotStrength=response.pivotStrength;
   uniforms.uReleaseProgress=response.releaseProgress;
   uniforms.uTwist=response.pivotTwist*response.pivotStrength;
   uniforms.uSlide=new Float32Array([response.slideX,response.slideY]);
   const b=imprint.actorId==='B'||imprint.actorId.includes('2');
   const tint=b?style.tintB:style.tintA;
   uniforms.uTint=new Float32Array([tint[0],tint[1],tint[2]]);
  }
  this.app.render();
  this.lastStats={
   renderer:'PixiJS v8 WebGL2',contexts:1,activeImprints:items.length,
   material:style.name,
   orientationUncertain:items.filter(i=>!i.orientationKnown).length,
   allocatedTextures:this.masks.size,maxTextures:LIQUID_LIMIT
  };
  return this.stats;
 }
 destroy(){
  if(this.destroyed)return;
  this.destroyed=true;
  for(const id of this.masks.keys())this.dispose(id);
  // React owns the HTML canvas. Destroy GPU resources without removing DOM.
  this.app.destroy(false);
 }
}
