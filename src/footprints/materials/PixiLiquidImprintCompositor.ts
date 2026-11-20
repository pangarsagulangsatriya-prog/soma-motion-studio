/** ENGINE-02 — PixiJS v8 integration spike (lab only).
 * ONE Pixi Application / WebGL2 renderer owns every sole and filter.
 * The native GPU-02 shader engine is NOT constructed alongside this engine.
 * Track / Map / Perform / projector safety are not imported or modified.
 */
import {Application,CanvasSource,Filter,Sprite,Texture} from 'pixi.js';
import {paintAuthenticFootprint} from '../scenes/authenticFootGeometry.ts';
import {liquidMaterialResponse} from './liquidMaterialResponse.ts';
import {MATERIAL03_GLSL} from './liquidMaterialShader.ts';
import {collectLiquidImprints,LIQUID_LIMIT,type LiquidImprint,type LiquidTimelineOptions,type LiquidInputEvent}
 from './liquidImprintTimeline.ts';

const WIDTH=160,HEIGHT=320;
const clamp=(v:number,min:number,max:number)=>Math.min(max,Math.max(min,v));
const safe=(v:number,base:number)=>Number.isFinite(v)?v:base;
const PIXI_MATERIAL_FRAGMENT=`
in vec2 vTextureCoord;
out vec4 finalColor;
uniform sampler2D uTexture;
uniform float uAge;
uniform float uSeed;
uniform float uFlow;
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
 vec3 pigment=mat03Pigment(
  vTextureCoord,uAge,uSeed,uFlow,
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
 material:'Liquid Imprint (research)';orientationUncertain:number;
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
    uFlow:{value:.7,type:'f32'},uContactFill:{value:0,type:'f32'},
    uSlideStrength:{value:0,type:'f32'},uPivotStrength:{value:0,type:'f32'},
    uReleaseProgress:{value:0,type:'f32'},uTwist:{value:0,type:'f32'},
    uSlide:{value:new Float32Array([0,0]),type:'vec2<f32>'},
    uTint:{value:new Float32Array([.86,.88,.74]),type:'vec3<f32>'}
   }
  },
  padding:0
 });
}
export class PixiLiquidImprintCompositor{
 readonly canvas:HTMLCanvasElement;
 private readonly app:Application;
 private readonly masks=new Map<string,RecordEntry>();
 private destroyed=false;
 private lastStats:PixiLiquidStats={
  renderer:'PixiJS v8 WebGL2',contexts:1,activeImprints:0,
  material:'Liquid Imprint (research)',orientationUncertain:0,
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
  if(app.renderer.type!==1) {
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
  flow?:number;widthPx?:number;lengthPx?:number;
  /** QA only: freeze anatomy to compare shader material at one identical mask. */
  materialOnlyQA?:boolean
 }={}):PixiLiquidStats{
  if(this.destroyed)throw Error('ENGINE-02 Pixi compositor destroyed');
  const items=collectLiquidImprints(events,timeMs,options);
  const ids=new Set(items.map(x=>x.id));
  for(const id of this.masks.keys())if(!ids.has(id))this.dispose(id);
  const width=clamp(safe(options.widthPx??72,72),25,220);
  const height=clamp(safe(options.lengthPx??116,116),55,440);
  const flow=clamp(safe(options.flow??.7,.7),0,1);
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
     x:WIDTH/2,y:HEIGHT/2,widthPx:112,lengthPx:250,
     color:'#ffffff',side:imprint.foot,deformation:d
    });
    entry.source.update();
   }
   const sprite=entry.sprite;
   sprite.position.set(imprint.x*this.canvas.width,imprint.y*this.canvas.height);
   sprite.width=width;sprite.height=height;
   sprite.rotation=imprint.orientationKnown?Math.PI/2-imprint.headingRad:0;
   sprite.alpha=response.opacity*.94;
   const uniforms=entry.filter.resources.liquidUniforms.uniforms;
   uniforms.uAge=imprint.ageMs/1000;
   uniforms.uSeed=imprint.seed;
   uniforms.uFlow=flow;
   uniforms.uContactFill=response.contactFill;
   uniforms.uSlideStrength=response.slideStrength;
   uniforms.uPivotStrength=response.pivotStrength;
   uniforms.uReleaseProgress=response.releaseProgress;
   uniforms.uTwist=response.pivotTwist*response.pivotStrength;
   uniforms.uSlide=new Float32Array([response.slideX,response.slideY]);
   const b=imprint.actorId==='B'||imprint.actorId.includes('2');
   uniforms.uTint=new Float32Array(b?[.49,.80,.90]:[.86,.88,.74]);
  }
  this.app.render();
  this.lastStats={
   renderer:'PixiJS v8 WebGL2',contexts:1,activeImprints:items.length,
   material:'Liquid Imprint (research)',
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
