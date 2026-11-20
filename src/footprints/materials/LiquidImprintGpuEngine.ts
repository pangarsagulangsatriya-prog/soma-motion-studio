/** GPU-02 / MATERIAL-03: single-context WebGL2 Liquid Imprint research spike.
 * Uses GEO-01B Canvas2D anatomical masks, uploads to ONE GPU compositor and
 * runs a custom pigment/advection shader *inside* each original sole alpha.
 * QA laboratory only. No Stage import, legacy preset, new tracker or hardware
 * output authorization. WebGL2 prototype; Pixi v8 integration awaits gate.
 */
import {paintAuthenticFootprint} from '../scenes/authenticFootGeometry.ts';
import type {FloorInteractionEvent} from '../scenes/FloorInteractionEngine.ts';
import {collectLiquidImprints,LIQUID_LIMIT,type LiquidImprint,type LiquidTimelineOptions}
 from './liquidImprintTimeline.ts';

const MASK_W=160,MASK_H=320;
export const GPU02_VERTEX_SHADER=`#version 300 es
layout(location=0) in vec2 aCorner;
uniform vec2 uCenter;
uniform vec2 uExtentPx;
uniform vec2 uViewport;
uniform float uHeading;
out vec2 vUV;
void main(){
 vec2 px=aCorner*uExtentPx*.5;
 float s=sin(uHeading),c=cos(uHeading);
 vec2 rotated=vec2(c*px.x-s*px.y,s*px.x+c*px.y);
 vec2 point=uCenter+rotated/uViewport;
 gl_Position=vec4(point.x*2.-1.,1.-point.y*2.,0.,1.);
 vUV=(aCorner+1.)*.5;
}`;
export const GPU02_FRAGMENT_SHADER=`#version 300 es
precision highp float;
in vec2 vUV;
uniform sampler2D uMask;
uniform vec3 uTint;
uniform float uTime;
uniform float uSeed;
uniform float uFlow;
uniform float uAge;
uniform float uOpacity;
out vec4 outColor;
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
 // Geometry alpha stays intact. All wave/flow displacement is confined to
 // the pigment field: neither rings nor noise may extend outside the toes.
 float coverage=texture(uMask,vUV).a;
 if(coverage<.015)discard;
 vec2 local=vUV;
 float evolution=uTime*.38+uSeed*7.1;
 vec2 drift=vec2(
  fbm(local*6.8+vec2(evolution*.21,-evolution*.12)),
  fbm(local*7.4+vec2(-evolution*.11,evolution*.26))
 )-.5;
 // Refract pigment coordinates, not the silhouette's alpha channel.
 vec2 advected=local+drift*(.085*uFlow);
 float pool=fbm(advected*10.0+vec2(evolution*.14,uSeed*12.));
 float folds=fbm(advected*24.0+vec2(uSeed*6.,-evolution*.25));
 float flowPhase=advected.y*27.+pool*13.-evolution*1.9;
 float blade=1.-smoothstep(.05,.24,abs(sin(flowPhase)));
 float branch=1.-smoothstep(.035,.21,abs(sin(
  advected.x*19.-advected.y*9.+folds*12.+evolution)));
 float caustic=clamp(blade*.78+branch*.42,0.,1.);
 float pooled=clamp(pool*.94+folds*.16-.12,0.,1.);
 // Deep ink channels and fine wet reflective ridges remain foot-shaped.
 vec3 pigment=mix(uTint*.18,uTint*.91,pooled);
 pigment+=uTint*(.58*caustic);
 pigment+=vec3(.14,.16,.17)*pow(caustic,3.);
 pigment=mix(pigment,uTint*.72,.12*(1.-coverage));
 pigment*=.95+.05*sin(uAge*.8+uSeed*5.);
 outColor=vec4(clamp(pigment,0.,1.),coverage*uOpacity);
}`;

type MaskRecord={
 canvas:HTMLCanvasElement;ctx:CanvasRenderingContext2D;
 texture:WebGLTexture;signature:string;
};
type UniformNames='uCenter'|'uExtentPx'|'uViewport'|'uHeading'|'uMask'|'uTint'|
 'uTime'|'uSeed'|'uFlow'|'uAge'|'uOpacity';
export type LiquidGpuStats={
 renderer:'WebGL2';contexts:number;activeImprints:number;
 material:'Liquid Imprint (research)';orientationUncertain:number;
 allocatedTextures:number;maxTextures:number;
};
function compile(gl:WebGL2RenderingContext,kind:number,source:string):WebGLShader{
 const shader=gl.createShader(kind);
 if(!shader)throw Error('GPU-02 shader allocation failed');
 gl.shaderSource(shader,source);gl.compileShader(shader);
 if(!gl.getShaderParameter(shader,gl.COMPILE_STATUS)){
  const log=gl.getShaderInfoLog(shader)||'shader compile failed';
  gl.deleteShader(shader);throw Error('GPU-02 GLSL: '+log);
 }
 return shader;
}
function createProgram(gl:WebGL2RenderingContext):WebGLProgram{
 const vert=compile(gl,gl.VERTEX_SHADER,GPU02_VERTEX_SHADER);
 const frag=compile(gl,gl.FRAGMENT_SHADER,GPU02_FRAGMENT_SHADER);
 const program=gl.createProgram();
 if(!program){gl.deleteShader(vert);gl.deleteShader(frag);throw Error('GPU-02 program allocation failed');}
 gl.attachShader(program,vert);gl.attachShader(program,frag);gl.linkProgram(program);
 gl.deleteShader(vert);gl.deleteShader(frag);
 if(!gl.getProgramParameter(program,gl.LINK_STATUS)){
  const log=gl.getProgramInfoLog(program)||'program link failed';
  gl.deleteProgram(program);throw Error('GPU-02 GLSL link: '+log);
 }
 return program;
}
const f=(v:number,defaultValue:number)=>Number.isFinite(v)?v:defaultValue;
const clamp=(n:number,min:number,max:number)=>Math.max(min,Math.min(max,n));

/** Constructor creates exactly one WebGL2 context on the supplied canvas.
 * Other code owns the render clock and calls render(); no internal RAF.
 */
export class LiquidImprintGpuEngine{
 readonly canvas:HTMLCanvasElement;
 private readonly gl:WebGL2RenderingContext;
 private readonly program:WebGLProgram;
 private readonly vertexBuffer:WebGLBuffer;
 private readonly uniforms:Record<UniformNames,WebGLUniformLocation>;
 private readonly masks=new Map<string,MaskRecord>();
 private destroyed=false;
 private lastStats:LiquidGpuStats={
  renderer:'WebGL2',contexts:1,activeImprints:0,
  material:'Liquid Imprint (research)',orientationUncertain:0,
  allocatedTextures:0,maxTextures:LIQUID_LIMIT
 };
 constructor(canvas:HTMLCanvasElement){
  this.canvas=canvas;
  const gl=canvas.getContext('webgl2',{
   alpha:true,antialias:true,premultipliedAlpha:false,preserveDrawingBuffer:true
  });
  if(!gl)throw Error('GPU-02 membutuhkan WebGL2. Stage tetap menggunakan preview aman.');
  this.gl=gl;
  this.program=createProgram(gl);
  const buffer=gl.createBuffer();
  if(!buffer){gl.deleteProgram(this.program);throw Error('GPU-02 buffer allocation failed');}
  this.vertexBuffer=buffer;
  gl.bindBuffer(gl.ARRAY_BUFFER,buffer);
  gl.bufferData(gl.ARRAY_BUFFER,new Float32Array([
   -1,-1, 1,-1, -1,1, 1,1
  ]),gl.STATIC_DRAW);
  this.uniforms={} as Record<UniformNames,WebGLUniformLocation>;
  const names:UniformNames[]=[
   'uCenter','uExtentPx','uViewport','uHeading','uMask','uTint',
   'uTime','uSeed','uFlow','uAge','uOpacity'
  ];
  for(const name of names){
   const location=gl.getUniformLocation(this.program,name);
   if(location===null)throw Error('GPU-02 missing shader uniform '+name);
   this.uniforms[name]=location;
  }
 }
 get stats():LiquidGpuStats{return {...this.lastStats};}
 private maskFor(imprint:LiquidImprint):MaskRecord{
  let entry=this.masks.get(imprint.id);
  if(!entry){
   const canvas=document.createElement('canvas');
   canvas.width=MASK_W;canvas.height=MASK_H;
   const ctx=canvas.getContext('2d');
   const texture=this.gl.createTexture();
   if(!ctx||!texture)throw Error('GPU-02 footprint mask allocation failed');
   entry={canvas,ctx,texture,signature:''};
   this.masks.set(imprint.id,entry);
   const gl=this.gl;
   gl.bindTexture(gl.TEXTURE_2D,texture);
   gl.texParameteri(gl.TEXTURE_2D,gl.TEXTURE_MIN_FILTER,gl.LINEAR);
   gl.texParameteri(gl.TEXTURE_2D,gl.TEXTURE_MAG_FILTER,gl.LINEAR);
   gl.texParameteri(gl.TEXTURE_2D,gl.TEXTURE_WRAP_S,gl.CLAMP_TO_EDGE);
   gl.texParameteri(gl.TEXTURE_2D,gl.TEXTURE_WRAP_T,gl.CLAMP_TO_EDGE);
  }
  const d=imprint.deformation;
  const signature=[imprint.foot,d.mode,d.amount,d.travelX,d.travelY,d.pivotRad]
   .map(v=>typeof v==='number'?Math.round(v*120):String(v)).join(':');
  if(signature!==entry.signature){
   entry.signature=signature;
   entry.ctx.setTransform(1,0,0,1,0,0);
   entry.ctx.clearRect(0,0,MASK_W,MASK_H);
   paintAuthenticFootprint(entry.ctx,{
    x:MASK_W/2,y:MASK_H/2,side:imprint.foot,
    widthPx:112,lengthPx:250,color:'#ffffff',
    deformation:d
   });
   this.gl.bindTexture(this.gl.TEXTURE_2D,entry.texture);
   // vUV.y=0 points to source canvas top on this explicit unflipped upload.
   this.gl.pixelStorei(this.gl.UNPACK_FLIP_Y_WEBGL,false);
   this.gl.texImage2D(this.gl.TEXTURE_2D,0,this.gl.RGBA,this.gl.RGBA,
    this.gl.UNSIGNED_BYTE,entry.canvas);
  }
  return entry;
 }
 render(events:readonly FloorInteractionEvent[],timeMs:number,options:LiquidTimelineOptions&{
  flow?:number;widthPx?:number;lengthPx?:number
 }={}):LiquidGpuStats{
  if(this.destroyed)throw Error('GPU-02 renderer already destroyed');
  const gl=this.gl;
  if(gl.isContextLost())throw Error('GPU-02 WebGL context lost');
  const items=collectLiquidImprints(events,timeMs,options);
  const active=new Set(items.map(i=>i.id));
  for(const [id,record] of this.masks){
   if(!active.has(id)){gl.deleteTexture(record.texture);this.masks.delete(id);}
  }
  gl.viewport(0,0,this.canvas.width,this.canvas.height);
  gl.clearColor(0,0,0,0);gl.clear(gl.COLOR_BUFFER_BIT);
  gl.useProgram(this.program);
  gl.bindBuffer(gl.ARRAY_BUFFER,this.vertexBuffer);
  gl.enableVertexAttribArray(0);gl.vertexAttribPointer(0,2,gl.FLOAT,false,0,0);
  gl.enable(gl.BLEND);
  gl.blendEquation(gl.FUNC_ADD);gl.blendFunc(gl.SRC_ALPHA,gl.ONE_MINUS_SRC_ALPHA);
  gl.activeTexture(gl.TEXTURE0);
  gl.uniform1i(this.uniforms.uMask,0);
  gl.uniform2f(this.uniforms.uViewport,this.canvas.width,this.canvas.height);
  gl.uniform2f(this.uniforms.uExtentPx,
   clamp(f(options.widthPx??72,72),25,220),
   clamp(f(options.lengthPx??116,116),55,440));
  gl.uniform1f(this.uniforms.uFlow,clamp(f(options.flow??.7,.7),0,1));
  gl.uniform1f(this.uniforms.uTime,timeMs/1000);
  for(const imprint of items){
   const mask=this.maskFor(imprint);
   gl.bindTexture(gl.TEXTURE_2D,mask.texture);
   gl.uniform2f(this.uniforms.uCenter,imprint.x,imprint.y);
   gl.uniform1f(this.uniforms.uHeading,
    imprint.orientationKnown?Math.PI/2-imprint.headingRad:0);
   gl.uniform1f(this.uniforms.uSeed,imprint.seed);
   gl.uniform1f(this.uniforms.uAge,imprint.ageMs/1000);
   gl.uniform1f(this.uniforms.uOpacity,imprint.opacity*.94);
   const actorB=imprint.actorId==='B'||imprint.actorId.includes('2');
   gl.uniform3f(this.uniforms.uTint,
    actorB?.49:.86,actorB?.80:.88,actorB?.90:.74);
   gl.drawArrays(gl.TRIANGLE_STRIP,0,4);
  }
  this.lastStats={renderer:'WebGL2',contexts:1,activeImprints:items.length,
   material:'Liquid Imprint (research)',
   orientationUncertain:items.filter(i=>!i.orientationKnown).length,
   allocatedTextures:this.masks.size,maxTextures:LIQUID_LIMIT};
  return this.stats;
 }
 destroy():void{
  if(this.destroyed)return;
  this.destroyed=true;
  for(const mask of this.masks.values())this.gl.deleteTexture(mask.texture);
  this.masks.clear();
  this.gl.deleteBuffer(this.vertexBuffer);
  this.gl.deleteProgram(this.program);
 }
}
