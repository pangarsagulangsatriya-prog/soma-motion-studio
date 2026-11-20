/** ENGINE-02 — PixiJS v8 integration spike (lab only).
 * ONE Pixi Application / WebGL2 renderer owns every sole and filter.
 * The native GPU-02 shader engine is NOT constructed alongside this engine.
 * Track / Map / Perform / projector safety are not imported or modified.
 */
import {Application,CanvasSource,Filter,Sprite,Texture} from 'pixi.js';
import {paintAuthenticFootprint} from '../scenes/authenticFootGeometry.ts';
import type {FloorInteractionEvent} from '../scenes/FloorInteractionEngine.ts';
import {collectLiquidImprints,LIQUID_LIMIT,type LiquidImprint,type LiquidTimelineOptions}
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
uniform float uImpulse;
uniform float uTwist;
uniform float uRelease;
uniform vec2 uSlide;
uniform vec3 uTint;
float hash(vec2 p){return fract(sin(dot(p,vec2(127.1,311.7)))*43758.5453);}
float noise(vec2 p){
 vec2 i=floor(p),f=fract(p);
 f=f*f*(3.-2.*f);
 return mix(mix(hash(i),hash(i+vec2(1.,0.)),f.x),
 mix(hash(i+vec2(0.,1.)),hash(i+vec2(1.,1.)),f.x),f.y);
}
float fbm(vec2 p){
 float a=.5,v=0.;
 for(int i=0;i<4;i++){v+=a*noise(p);p=p*2.03+3.71;a*=.5;}
 return v;
}
void main(){
 vec4 footprint=texture(uTexture,vTextureCoord);
 float coverage=footprint.a;
 if(coverage<.015)discard;
 float seconds=max(0.,uAge);
 vec2 sole=vTextureCoord-.5;
 float theta=uTwist*(.15+.85*(1.-vTextureCoord.y));
 vec2 turned=vec2(cos(theta)*sole.x-sin(theta)*sole.y,
                   sin(theta)*sole.x+cos(theta)*sole.y)+.5;
 vec2 sheared=turned-uSlide*(.28*uImpulse);
 float velocity=.16+.29*uFlow;
 float ageFlow=seconds*(velocity+.065*sin(sheared.x*8.+uSeed*9.));
 vec2 advected=sheared+vec2(
  .033*sin((sheared.y+uSeed)*15.-seconds*1.8),-ageFlow
 );
 vec2 drift=vec2(
  fbm(advected*7.8+vec2(uSeed*5.,-seconds*.24)),
  fbm(advected*8.9+vec2(seconds*.21,uSeed*7.))
 )-.5;
 vec2 liquid=advected+drift*(.095*uFlow);
 float channels=fbm(liquid*9.7+vec2(uSeed*4.1,seconds*.09));
 float veinWarp=fbm(liquid*14.+uSeed*8.3);
 float phase=liquid.y*33.+liquid.x*5.5+veinWarp*8.5;
 float seam=1.-smoothstep(.07,.23,abs(sin(phase)));
 float vein=1.-smoothstep(.10,.29,abs(sin(
   liquid.x*25.-liquid.y*11.+channels*10.+seconds*.5
 )));
 float band=clamp(seam*.87+vein*.35,0.,1.);
 float basin=clamp((channels-.22)*1.85,0.,1.);
 float surge=.18+uImpulse*.82;
 vec3 pigment=mix(uTint*.075,uTint*(.40+.50*basin),.58+.36*basin);
 pigment+=uTint*(.46*band*surge);
 pigment+=vec3(.20,.24,.25)*pow(band,2.)*surge;
 float meniscusY=.91-seconds*(.31+.12*uFlow)
   +.038*sin(liquid.x*13.+uSeed*7.+seconds*2.1);
 float meniscus=exp(-pow((vTextureCoord.y-meniscusY)*17.,2.));
 float wake=exp(-pow((vTextureCoord.y-(meniscusY+.16))*11.,2.));
 pigment+=uTint*(.61*meniscus+.13*wake)*(.68+.32*surge);
 pigment+=vec3(.17,.20,.21)*meniscus;
 pigment*=1.-.53*uRelease;
 float alpha=coverage;
 finalColor=vec4(clamp(pigment,0.,1.)*alpha,alpha);
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
    uFlow:{value:.7,type:'f32'},uImpulse:{value:0,type:'f32'},
    uTwist:{value:0,type:'f32'},uRelease:{value:0,type:'f32'},
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
   app.destroy(true);
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
 render(events:readonly FloorInteractionEvent[],timeMs:number,options:LiquidTimelineOptions&{
  flow?:number;widthPx?:number;lengthPx?:number
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
   const d=imprint.deformation;
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
   sprite.alpha=imprint.opacity*.94;
   const uniforms=entry.filter.resources.liquidUniforms.uniforms;
   const strength=clamp(safe(d.amount,0),0,1);
   uniforms.uAge=imprint.ageMs/1000;
   uniforms.uSeed=imprint.seed;
   uniforms.uFlow=flow;
   uniforms.uImpulse=d.mode==='stance'?0:strength;
   uniforms.uRelease=d.mode==='toe-off'?strength:0;
   uniforms.uTwist=d.mode==='pivot'?clamp(safe(d.pivotRad??0,0),-.9,.9)*strength:0;
   uniforms.uSlide=new Float32Array([
    d.mode==='slide'?clamp(safe(d.travelX??0,0),-1,1):0,
    d.mode==='slide'?clamp(safe(d.travelY??0,0),-1,1):0
   ]);
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
  this.app.destroy(true);
 }
}
