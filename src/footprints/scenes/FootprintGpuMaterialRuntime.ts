/** FV-02 — a bounded WebGL2 material and feedback pass.
 * One offscreen GPU context supplies an s0 texture to the existing Hydra instance.
 * It never creates a camera, RAF, or physical projector output.
 */
import type {FootMotionEventV2} from './FootMotionEventV2.ts';
import type {HydraFootprintSettings} from './hydraFootprintModel.ts';

export type MaterialMode='trace'|'echo';
export type MaterialImpulse={id:string;x:number;y:number;dx:number;dy:number;kind:0|1|2;atMs:number;actor:0|1};
export const MAX_MATERIAL_IMPULSES=20;
export const MATERIAL_LIFE_MS=2800;
export const MATERIAL_VERT=`#version 300 es
precision highp float;
const vec2 vertices[3]=vec2[](vec2(-1.,-1.),vec2(3.,-1.),vec2(-1.,3.));
out vec2 uv;
void main(){
 vec2 p=vertices[gl_VertexID];
 uv=p*.5+.5;
 gl_Position=vec4(p,0.,1.);
}`;
export const MATERIAL_FRAG=`#version 300 es
precision highp float;
in vec2 uv;
out vec4 outColor;
uniform sampler2D uSource;
uniform sampler2D uPrevious;
uniform vec2 uResolution;
uniform float uTime;
uniform float uDelta;
uniform float uMix;
uniform float uFeedback;
uniform float uDistortion;
uniform float uEnergy;
uniform float uMode;
uniform int uCount;
uniform vec4 uImpulses[20]; // x,y,age,kind
uniform vec4 uVectors[20]; // dx,dy,actor,strength
float hash(vec2 p){return fract(sin(dot(p,vec2(127.1,311.7)))*43758.5453123);}
float noise(vec2 p){vec2 i=floor(p),f=fract(p);f=f*f*(3.-2.*f);
 return mix(mix(hash(i),hash(i+vec2(1.,0.)),f.x),
 mix(hash(i+vec2(0.,1.)),hash(i+vec2(1.,1.)),f.x),f.y);}
float footprintSdf(vec2 p){
 // Angled, narrow footprint capsule with a broader forefoot.
 float heel=length((p+vec2(0.,.15))/vec2(.56,.9))-.65;
 float front=length((p-vec2(0.,.26))/vec2(.8,1.1))-.65;
 return min(heel,front);
}
void main(){
 vec2 st=uv;float aspect=uResolution.x/max(1.,uResolution.y);
 vec3 original=texture(uSource,st).rgb;
 float material=0.,erosion=0.,wake=0.;
 vec2 direction=vec2(0.);
 for(int i=0;i<20;i++){
  if(i>=uCount)break;
  vec4 e=uImpulses[i],v=uVectors[i];
  vec2 diff=vec2((st.x-e.x)*aspect,st.y-e.y);
  float speed=clamp(length(v.xy)*18.,0.,1.);
  float angle=atan(v.y,v.x)-1.5707963;
  float ca=cos(angle),sa=sin(angle);
  vec2 local=vec2(ca*diff.x+sa*diff.y,-sa*diff.x+ca*diff.y)/(.045+.011*speed);
  float d=footprintSdf(local);
  float age=e.z;
  float decay=exp(-age*(uMode<.5?1.2:2.2));
  float fracture=noise(local*3.3+vec2(uTime*.13,float(i)*1.97));
  float rim=exp(-abs(d)*7.5);
  float region=1.-smoothstep(-.24,.18,d);
  material=max(material,region*decay);
  erosion+=rim*(.3+.7*fracture)*decay*(e.w>0.5?1.4:1.);
  float distanceWeight=exp(-dot(diff,diff)*350.);
  direction+=v.xy*distanceWeight*decay;
  wake+=distanceWeight*decay;
 }
 float grain=noise(st*uResolution*.6+uTime*.05);
 // TRACE: contact fills an irregular SDF, slide scrapes edges and pivot fractures.
 float cracked=smoothstep(.40,.78,noise(st*vec2(165.,83.)+
  direction*58.+uTime*.11));
 vec3 trace=vec3(max(0.,material*(.22+.45*grain)+erosion*(.55+.4*cracked)));
 trace+=vec3(original.r*.48,original.g*.55,original.b*.57);
 trace+=vec3(erosion*cracked*.13);
 // ECHO: directional UV advection through a bounded previous-frame framebuffer.
 vec2 drift=direction*(.22+uDistortion)*2.4;
 vec2 advected=clamp(st-drift,vec2(.001),vec2(.999));
 vec3 previous=texture(uPrevious,advected).rgb;
 float preserve=clamp(uFeedback*(.4+.55*uEnergy),0.,.82);
 preserve*=exp(-max(0.,uDelta)*(.38+.34*max(0.,1.-uEnergy)));
 vec3 echo=max(original*1.2,previous*preserve);
 echo+=vec3(wake*.12, wake*.19, wake*.18);
 vec3 result=uMode<.5?mix(original,trace,clamp(uMix,0.,1.)):mix(original,echo,clamp(uMix,0.,1.));
 // Final energy stays bounded to avoid runaway feedback over long rehearsals.
 outColor=vec4(clamp(result,vec3(0.),vec3(1.)),1.);
}`;

const qualitySize=(quality:HydraFootprintSettings['quality']):[number,number]=>
 quality==='low'?[320,180]:quality==='high'?[960,540]:[640,360];
export function materialMode(settings:Pick<HydraFootprintSettings,'artwork'|'style'|'catalogVisual'>):MaterialMode|null{
 if(settings.catalogVisual)return null;
 if(settings.style==='grain'&&settings.artwork==='trace')return 'trace';
 if(settings.style==='echo'&&settings.artwork==='wave-record')return 'echo';
 return null;
}
export function collectMaterialImpulses(
 old:readonly MaterialImpulse[],events:readonly FootMotionEventV2[],nowMs:number
):MaterialImpulse[]{
 const next=old.filter(p=>nowMs-p.atMs<MATERIAL_LIFE_MS&&nowMs>=p.atMs);
 const seen=new Set(next.map(i=>i.id));
 for(const e of events){
  if(seen.has(e.eventId)||!Number.isFinite(e.x)||!Number.isFinite(e.y)||
   e.x<0||e.x>1||e.y<0||e.y>1||e.actorId.startsWith('unassigned-'))continue;
  if(e.kind==='contact'&&!e.verified)continue;
  if(e.kind!=='contact'&&e.kind!=='slide'&&e.kind!=='pivot')continue;
  const actor:0|1=e.actorId==='B'||e.actorId==='performer-2'?1:0;
  const prior=next.findLast(i=>i.actor===actor);
  const dx=prior?Math.max(-.2,Math.min(.2,e.x-prior.x)):0;
  const dy=prior?Math.max(-.2,Math.min(.2,e.y-prior.y)):-.03;
  const kind=e.kind==='contact'?0:e.kind==='slide'?1:2;
  next.push({id:e.eventId,x:e.x,y:e.y,dx,dy,kind,atMs:nowMs,actor});
  seen.add(e.eventId);
 }
 return next.slice(-MAX_MATERIAL_IMPULSES);
}
function shader(gl:WebGL2RenderingContext,type:number,code:string){
 const s=gl.createShader(type);if(!s)throw Error('WebGL shader allocation failed');
 gl.shaderSource(s,code);gl.compileShader(s);
 if(!gl.getShaderParameter(s,gl.COMPILE_STATUS)){const error=gl.getShaderInfoLog(s);gl.deleteShader(s);throw Error(error??'WebGL shader compile failed');}
 return s;
}
function program(gl:WebGL2RenderingContext){
 const vs=shader(gl,gl.VERTEX_SHADER,MATERIAL_VERT),fs=shader(gl,gl.FRAGMENT_SHADER,MATERIAL_FRAG);
 const p=gl.createProgram();if(!p)throw Error('WebGL program allocation failed');
 gl.attachShader(p,vs);gl.attachShader(p,fs);gl.linkProgram(p);
 gl.deleteShader(vs);gl.deleteShader(fs);
 if(!gl.getProgramParameter(p,gl.LINK_STATUS)){const err=gl.getProgramInfoLog(p);gl.deleteProgram(p);throw Error(err??'WebGL program link failed');}
 return p;
}
export class FootprintGpuMaterialRuntime{
 private gl:WebGL2RenderingContext;
 readonly canvas:HTMLCanvasElement;
 private shader:WebGLProgram;
 private input:WebGLTexture;
 private textures:WebGLTexture[]=[];
 private buffers:WebGLFramebuffer[]=[];
 private vao:WebGLVertexArrayObject;
 private index=0;
 private lastMs=0;
 private impulses:MaterialImpulse[]=[];
 private mode:MaterialMode|null=null;
 private size:[number,number]=[0,0];
 private generation=-1;
 constructor(canvas:HTMLCanvasElement){
  this.canvas=canvas;
  const gl=canvas.getContext('webgl2',{alpha:false,antialias:false,depth:false,
   stencil:false,preserveDrawingBuffer:true});
  if(!gl)throw Error('WebGL2 unavailable; fallback to existing artistic texture');
  this.gl=gl;this.shader=program(gl);
  const vao=gl.createVertexArray(),input=gl.createTexture();
  if(!vao||!input)throw Error('WebGL material allocation failed');
  this.vao=vao;this.input=input;
  gl.bindVertexArray(vao);gl.bindTexture(gl.TEXTURE_2D,input);
  gl.texParameteri(gl.TEXTURE_2D,gl.TEXTURE_MIN_FILTER,gl.LINEAR);
  gl.texParameteri(gl.TEXTURE_2D,gl.TEXTURE_MAG_FILTER,gl.LINEAR);
  gl.texParameteri(gl.TEXTURE_2D,gl.TEXTURE_WRAP_S,gl.CLAMP_TO_EDGE);
  gl.texParameteri(gl.TEXTURE_2D,gl.TEXTURE_WRAP_T,gl.CLAMP_TO_EDGE);
 }
 private resize(w:number,h:number){
  const gl=this.gl;if(this.size[0]===w&&this.size[1]===h)return;
  this.size=[w,h];this.canvas.width=w;this.canvas.height=h;
  for(const t of this.textures)gl.deleteTexture(t);
  for(const b of this.buffers)gl.deleteFramebuffer(b);
  this.textures=[];this.buffers=[];
  for(let i=0;i<2;i++){
   const texture=gl.createTexture(),framebuffer=gl.createFramebuffer();
   if(!texture||!framebuffer)throw Error('GPU feedback allocation failed');
   gl.bindTexture(gl.TEXTURE_2D,texture);
   gl.texParameteri(gl.TEXTURE_2D,gl.TEXTURE_MIN_FILTER,gl.LINEAR);
   gl.texParameteri(gl.TEXTURE_2D,gl.TEXTURE_MAG_FILTER,gl.LINEAR);
   gl.texParameteri(gl.TEXTURE_2D,gl.TEXTURE_WRAP_S,gl.CLAMP_TO_EDGE);
   gl.texParameteri(gl.TEXTURE_2D,gl.TEXTURE_WRAP_T,gl.CLAMP_TO_EDGE);
   gl.texImage2D(gl.TEXTURE_2D,0,gl.RGBA8,w,h,0,gl.RGBA,gl.UNSIGNED_BYTE,null);
   gl.bindFramebuffer(gl.FRAMEBUFFER,framebuffer);
   gl.framebufferTexture2D(gl.FRAMEBUFFER,gl.COLOR_ATTACHMENT0,gl.TEXTURE_2D,texture,0);
   if(gl.checkFramebufferStatus(gl.FRAMEBUFFER)!==gl.FRAMEBUFFER_COMPLETE)throw Error('GPU feedback framebuffer incomplete');
   this.textures.push(texture);this.buffers.push(framebuffer);
  }
  gl.bindFramebuffer(gl.FRAMEBUFFER,null);this.reset();
 }
 reset(){
  const gl=this.gl;this.index=0;this.lastMs=0;this.impulses=[];
  for(const fb of this.buffers){gl.bindFramebuffer(gl.FRAMEBUFFER,fb);
   gl.viewport(0,0,this.canvas.width,this.canvas.height);gl.clearColor(0,0,0,1);gl.clear(gl.COLOR_BUFFER_BIT);}
  gl.bindFramebuffer(gl.FRAMEBUFFER,null);
 }
 paint(source:HTMLCanvasElement,events:readonly FootMotionEventV2[],generation:number,nowMs:number,settings:HydraFootprintSettings):HTMLCanvasElement{
  const gl=this.gl,mode=materialMode(settings);
  if(!mode)throw Error('Material recipe not active');
  const [w,h]=qualitySize(settings.quality);
  this.resize(w,h);
  if(this.generation!==generation||this.mode!==mode){
   this.generation=generation;this.mode=mode;this.reset();
  }
  if(!Number.isFinite(nowMs))return this.canvas;
  this.impulses=collectMaterialImpulses(this.impulses,events,nowMs);
  const delta=this.lastMs?Math.max(0,Math.min(.1,(nowMs-this.lastMs)/1000)):.016;
  this.lastMs=nowMs;
  gl.useProgram(this.shader);gl.bindVertexArray(this.vao);
  gl.pixelStorei(gl.UNPACK_FLIP_Y_WEBGL,true);
  gl.activeTexture(gl.TEXTURE0);gl.bindTexture(gl.TEXTURE_2D,this.input);
  gl.texImage2D(gl.TEXTURE_2D,0,gl.RGBA,gl.RGBA,gl.UNSIGNED_BYTE,source);
  gl.activeTexture(gl.TEXTURE1);gl.bindTexture(gl.TEXTURE_2D,this.textures[this.index]);
  const uni=(name:string)=>gl.getUniformLocation(this.shader,name);
  gl.uniform1i(uni('uSource'),0);gl.uniform1i(uni('uPrevious'),1);
  gl.uniform2f(uni('uResolution'),w,h);
  gl.uniform1f(uni('uTime'),nowMs/1000);gl.uniform1f(uni('uDelta'),delta);
  gl.uniform1f(uni('uMix'),settings.mix);
  gl.uniform1f(uni('uFeedback'),settings.feedback);
  gl.uniform1f(uni('uDistortion'),settings.distortion);
  gl.uniform1f(uni('uEnergy'),Math.min(1,this.impulses.reduce((n,i)=>n+Math.exp(-(nowMs-i.atMs)/850)*.24,0)));
  gl.uniform1f(uni('uMode'),mode==='trace'?0:1);
  gl.uniform1i(uni('uCount'),this.impulses.length);
  const points=new Float32Array(MAX_MATERIAL_IMPULSES*4);
  const vectors=new Float32Array(MAX_MATERIAL_IMPULSES*4);
  for(let i=0;i<this.impulses.length;i++){
   const e=this.impulses[i],offset=i*4;
   points[offset]=e.x;points[offset+1]=1-e.y;
   points[offset+2]=Math.max(0,(nowMs-e.atMs)/MATERIAL_LIFE_MS);
   points[offset+3]=e.kind;
   vectors[offset]=e.dx;vectors[offset+1]=-e.dy;
   vectors[offset+2]=e.actor;vectors[offset+3]=1;
  }
  gl.uniform4fv(uni('uImpulses[0]'),points);
  gl.uniform4fv(uni('uVectors[0]'),vectors);
  const target=1-this.index;
  gl.bindFramebuffer(gl.FRAMEBUFFER,this.buffers[target]);
  gl.viewport(0,0,w,h);gl.drawArrays(gl.TRIANGLES,0,3);
  gl.bindFramebuffer(gl.READ_FRAMEBUFFER,this.buffers[target]);
  gl.bindFramebuffer(gl.DRAW_FRAMEBUFFER,null);
  gl.blitFramebuffer(0,0,w,h,0,0,w,h,gl.COLOR_BUFFER_BIT,gl.NEAREST);
  gl.bindFramebuffer(gl.FRAMEBUFFER,null);
  this.index=target;
  return this.canvas;
 }
 dispose(){
  const gl=this.gl;
  for(const b of this.buffers)gl.deleteFramebuffer(b);
  for(const t of this.textures)gl.deleteTexture(t);
  gl.deleteTexture(this.input);gl.deleteVertexArray(this.vao);gl.deleteProgram(this.shader);
  this.buffers=[];this.textures=[];this.impulses=[];
 }
 get activeImpulses(){return this.impulses.length;}
}
