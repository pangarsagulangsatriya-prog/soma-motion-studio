import {SNOW_GRID,type SnowfallOptions,type SnowfallScene} from './SnowfallScene.ts';

export const SNOWFALL_RASTER={width:1280,height:720} as const;
const VERTEX=`#version 300 es
precision highp float;
void main(){
 vec2 v=vec2(float((gl_VertexID<<1)&2),float(gl_VertexID&2));
 gl_Position=vec4(v*2.0-1.0,0.,1.);
}`;
const FRAGMENT=`#version 300 es
precision highp float;
precision highp sampler2D;
uniform sampler2D uSnow;
uniform vec2 uResolution;
uniform float uTime;
uniform float uFlurry;
out vec4 color;
float hash(vec2 p){return fract(sin(dot(p,vec2(127.1,311.7)))*43758.5453123);}
float noise(vec2 p){
 vec2 i=floor(p),f=fract(p);
 f=f*f*(3.-2.*f);
 return mix(mix(hash(i),hash(i+vec2(1.,0.)),f.x),
  mix(hash(i+vec2(0.,1.)),hash(i+vec2(1.,1.)),f.x),f.y);
}
void main(){
 vec2 uv=vec2(gl_FragCoord.x/uResolution.x,1.-gl_FragCoord.y/uResolution.y);
 float snow=texture(uSnow,uv).r;
 // GPU-procedural granular powder in 2 bands; the footprint impression
 // and its persistence are owned by the deterministic floor-height texture.
 float fine=noise(uv*vec2(790.,450.));
 float soft=noise(uv*vec2(83.,48.));
 // Smooth-scrolling procedural flakes preserve continuity between frames.
 // Hard hash thresholds on time-quantized cells would visibly flicker.
 float fieldA=noise(uv*vec2(210.,135.)+vec2(uTime*.25,-uTime*4.2));
 float fieldB=noise(uv*vec2(330.,220.)+vec2(-uTime*.13,-uTime*8.));
 float flakes=(smoothstep(.78,.96,fieldA)*.14+
  smoothstep(.81,.98,fieldB)*.095)*uFlurry;
 float ridge=smoothstep(.21,.7,snow);
 vec3 powder=vec3(.11,.135,.15)+ridge*vec3(.63,.65,.65);
 powder+=(fine-.5)*.055*ridge+(soft-.5)*.038*ridge;
 powder+=flakes*.24*ridge;
 // Printed floor-safe RGB: no UI text, grid, status, or tracking skeletons.
 color=vec4(clamp(powder,0.,.91),1.);
}`;
function shader(gl:WebGL2RenderingContext,type:number,source:string){
 const s=gl.createShader(type);if(!s)throw Error('GPU shader tidak tersedia.');
 gl.shaderSource(s,source);gl.compileShader(s);
 if(!gl.getShaderParameter(s,gl.COMPILE_STATUS)){
  const message=gl.getShaderInfoLog(s)??'GPU shader gagal.';
  gl.deleteShader(s);throw Error(message);
 }
 return s;
}
export class SnowfallRenderer{
 readonly mode:'webgl2'|'2d'|'unavailable';
 private gl:WebGL2RenderingContext|null=null;
 private context:CanvasRenderingContext2D|null=null;
 private program:WebGLProgram|null=null;
 private texture:WebGLTexture|null=null;
 private vao:WebGLVertexArrayObject|null=null;
 private timeUniform:WebGLUniformLocation|null=null;
 private flurryUniform:WebGLUniformLocation|null=null;
 private buffer:HTMLCanvasElement|null=null;
 private fallback:CanvasRenderingContext2D|null=null;
 constructor(private readonly canvas:HTMLCanvasElement){
  if(canvas.width!==SNOWFALL_RASTER.width)canvas.width=SNOWFALL_RASTER.width;
  if(canvas.height!==SNOWFALL_RASTER.height)canvas.height=SNOWFALL_RASTER.height;
  let gl:WebGL2RenderingContext|null=null;
  try{gl=canvas.getContext('webgl2',{
   alpha:false,antialias:false,depth:false,stencil:false,
   preserveDrawingBuffer:true,powerPreference:'high-performance'
  });}catch{/* Browser may block WebGL. */}
  if(gl){
   try{
    this.gl=gl;
    const vs=shader(gl,gl.VERTEX_SHADER,VERTEX);
    const fs=shader(gl,gl.FRAGMENT_SHADER,FRAGMENT);
    const program=gl.createProgram();
    if(!program)throw Error('GPU program tidak tersedia.');
    gl.attachShader(program,vs);gl.attachShader(program,fs);gl.linkProgram(program);
    gl.deleteShader(vs);gl.deleteShader(fs);
    if(!gl.getProgramParameter(program,gl.LINK_STATUS))
     throw Error(gl.getProgramInfoLog(program)??'GPU link gagal.');
    this.program=program;
    const tex=gl.createTexture(),vao=gl.createVertexArray();
    if(!tex||!vao)throw Error('Tekstur GPU tidak tersedia.');
    this.texture=tex;this.vao=vao;
    gl.bindTexture(gl.TEXTURE_2D,tex);
    gl.texParameteri(gl.TEXTURE_2D,gl.TEXTURE_MIN_FILTER,gl.LINEAR);
    gl.texParameteri(gl.TEXTURE_2D,gl.TEXTURE_MAG_FILTER,gl.LINEAR);
    gl.texParameteri(gl.TEXTURE_2D,gl.TEXTURE_WRAP_S,gl.CLAMP_TO_EDGE);
    gl.texParameteri(gl.TEXTURE_2D,gl.TEXTURE_WRAP_T,gl.CLAMP_TO_EDGE);
    gl.pixelStorei(gl.UNPACK_ALIGNMENT,1);
    gl.texImage2D(gl.TEXTURE_2D,0,gl.R8,SNOW_GRID.width,SNOW_GRID.height,
     0,gl.RED,gl.UNSIGNED_BYTE,null);
    gl.useProgram(program);
    gl.uniform1i(gl.getUniformLocation(program,'uSnow'),0);
    gl.uniform2f(gl.getUniformLocation(program,'uResolution'),
     SNOWFALL_RASTER.width,SNOWFALL_RASTER.height);
    this.timeUniform=gl.getUniformLocation(program,'uTime');
    this.flurryUniform=gl.getUniformLocation(program,'uFlurry');
    this.mode='webgl2';return;
   }catch{
    // Once a WebGL context is bound, browser canvas context switching is
    // forbidden; report unavailable rather than inventing a 2D result.
    this.mode='unavailable';this.dispose();return;
   }
  }
  this.context=canvas.getContext('2d',{alpha:false});
  this.buffer=document.createElement('canvas');
  this.buffer.width=SNOW_GRID.width;this.buffer.height=SNOW_GRID.height;
  this.fallback=this.buffer.getContext('2d',{alpha:false});
  this.mode=this.context&&this.fallback?'2d':'unavailable';
 }
 render(scene:SnowfallScene,nowMs:number,options:Partial<SnowfallOptions>={}){
  if(this.mode==='webgl2'){
   const gl=this.gl!,tex=this.texture!;
   gl.viewport(0,0,this.canvas.width,this.canvas.height);
   gl.disable(gl.BLEND);gl.activeTexture(gl.TEXTURE0);
   gl.bindTexture(gl.TEXTURE_2D,tex);
   gl.pixelStorei(gl.UNPACK_ALIGNMENT,1);
   gl.texSubImage2D(gl.TEXTURE_2D,0,0,0,SNOW_GRID.width,SNOW_GRID.height,
    gl.RED,gl.UNSIGNED_BYTE,scene.pixels);
   gl.useProgram(this.program);
   gl.uniform1f(this.timeUniform,nowMs/1000);
   gl.uniform1f(this.flurryUniform,Math.max(0,Math.min(1,options.snowfall??.55)));
   gl.bindVertexArray(this.vao);gl.drawArrays(gl.TRIANGLES,0,3);
   return;
  }
  if(this.mode!=='2d'||!this.context||!this.fallback||!this.buffer)return;
  const ctx=this.fallback;
  const img=ctx.createImageData(SNOW_GRID.width,SNOW_GRID.height);
  for(let y=0;y<SNOW_GRID.height;y++){
   for(let x=0;x<SNOW_GRID.width;x++){
    const i=y*SNOW_GRID.width+x,p=i*4;
    const s=scene.density[i];
    const grain=((x*197+y*139+x*y*13)%17-8)*.002;
    const powder=Math.min(1,Math.max(0,(s-.2)/.5));
    img.data[p]=Math.round(28+158*powder+grain*50);
    img.data[p+1]=Math.round(33+161*powder+grain*50);
    img.data[p+2]=Math.round(37+162*powder+grain*50);
    img.data[p+3]=255;
   }
  }
  ctx.putImageData(img,0,0);
  this.context.imageSmoothingEnabled=true;
  this.context.drawImage(this.buffer,0,0,this.canvas.width,this.canvas.height);
 }
 dispose(){
  if(this.gl){
   if(this.texture)this.gl.deleteTexture(this.texture);
   if(this.vao)this.gl.deleteVertexArray(this.vao);
   if(this.program)this.gl.deleteProgram(this.program);
  }
  this.gl=null;this.texture=null;this.program=null;this.vao=null;
 }
}
