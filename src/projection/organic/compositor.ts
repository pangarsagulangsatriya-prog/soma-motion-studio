import type {BodyMask} from '../../studio/bodyField.ts';
import {sourcePoint,type OrganicLayer} from './shape.ts';
export interface BodyCompositor {readonly mode:string;readonly size:number;render(layers:OrganicLayer[],clip?:BodyMask,additive?:boolean):BodyMask;dispose():void;}
const smooth=(value:number,t:number,s:number)=>{if(t<0)return value;const x=Math.max(0,Math.min(1,(value-t+s)/(2*s)));return x*x*(3-2*x);};
export function rasterizeLayers(layers:OrganicLayer[],size=128,clip?:BodyMask,additive=false):BodyMask{
 const values=new Float32Array(size*size);
 for(const l of layers){if(l.opacity<=0)continue;for(let y=0;y<size;y++)for(let x=0;x<size;x++){
  const p=sourcePoint(l,(x+.5)/size,(y+.5)/size);if(p.x<Math.max(0,l.crop[0])||p.x>=Math.min(1,l.crop[2])||p.y<Math.max(0,l.crop[1])||p.y>=Math.min(1,l.crop[3]))continue;
  const index=Math.floor(p.y*l.mask.height)*l.mask.width+Math.floor(p.x*l.mask.width),v=smooth(l.mask.data[index]/255,l.threshold,l.softness)*l.opacity,i=y*size+x;
  values[i]=additive?Math.min(1,values[i]+v):v+values[i]*(1-v);
 }}
 const data=new Uint8Array(size*size);for(let y=0;y<size;y++)for(let x=0;x<size;x++){const i=y*size+x,c=clip?clip.data[Math.floor((y+.5)*clip.height/size)*clip.width+Math.floor((x+.5)*clip.width/size)]/255:1;data[i]=Math.round(values[i]*c*255);}return {width:size,height:size,data};
}
export class CPUCompositor implements BodyCompositor{readonly mode='CPU · 128²';readonly size=128;render(l:OrganicLayer[],clip?:BodyMask,additive=false){return rasterizeLayers(l,this.size,clip,additive);}dispose(){}}
/** One small reusable GPU target. Only the finished mask crosses the output window boundary. */
export class OrganicCompositor implements BodyCompositor{
 readonly size:number;readonly mode:string;private gl:WebGLRenderingContext|null=null;private canvas:HTMLCanvasElement;private program:WebGLProgram|null=null;private texture:WebGLTexture|null=null;private clipTexture:WebGLTexture|null=null;private buffer:WebGLBuffer|null=null;private target:WebGLFramebuffer|null=null;private targetTexture:WebGLTexture|null=null;private pixels:Uint8Array;private lost=false;private lostHandler=(e:Event)=>{e.preventDefault();this.lost=true;};
 constructor(){this.canvas=document.createElement('canvas');this.canvas.width=this.canvas.height=256;const gl=this.canvas.getContext('webgl',{alpha:true,antialias:false,preserveDrawingBuffer:false});this.gl=gl;this.size=gl?256:128;this.mode=gl?'WebGL · 256²':'CPU · 128²';this.pixels=new Uint8Array(this.size*this.size*4);
  if(!gl)return;this.canvas.addEventListener('webglcontextlost',this.lostHandler);
  try{const shader=(type:number,source:string)=>{const s=gl.createShader(type)!;gl.shaderSource(s,source);gl.compileShader(s);if(!gl.getShaderParameter(s,gl.COMPILE_STATUS)){const message=gl.getShaderInfoLog(s);gl.deleteShader(s);throw Error(message||'Shader Organic gagal');}return s;};
  const vs=shader(gl.VERTEX_SHADER,'attribute vec2 pos;varying vec2 uv;void main(){uv=pos*.5+.5;gl_Position=vec4(pos,0.,1.);}');
  const fs=shader(gl.FRAGMENT_SHADER,`precision highp float;varying vec2 uv;uniform sampler2D body;uniform sampler2D clipping;uniform vec4 placement;uniform vec4 crop;uniform vec2 anchor;uniform vec2 axis;uniform vec2 pull;uniform vec2 offset;uniform float factor;uniform float local;uniform float radius;uniform float shrink;uniform float opacity;uniform float threshold;uniform float softness;uniform float useClip;
void main(){vec2 q=uv-offset-anchor;float f=local>.5?exp(-2.*dot(q,q)/(radius*radius)):1.;q-=pull*f;float s=1.+(factor-1.)*f;if(shrink>.5)q/=s;else q-=axis*dot(q,axis)*(1.-1./s);q=(q+anchor-placement.zw)/placement.xy;float a=0.;if(q.x>=max(0.,crop.x)&&q.x<min(1.,crop.z)&&q.y>=max(0.,crop.y)&&q.y<min(1.,crop.w)){a=texture2D(body,q).r;if(threshold>=0.)a=smoothstep(threshold-softness,threshold+softness,a);}a*=opacity;if(useClip>.5)a*=texture2D(clipping,uv).r;gl_FragColor=vec4(vec3(a),a);}`);
  this.program=gl.createProgram()!;gl.attachShader(this.program,vs);gl.attachShader(this.program,fs);gl.linkProgram(this.program);gl.deleteShader(vs);gl.deleteShader(fs);if(!gl.getProgramParameter(this.program,gl.LINK_STATUS))throw Error('Program Organic gagal');gl.useProgram(this.program);
  this.buffer=gl.createBuffer();gl.bindBuffer(gl.ARRAY_BUFFER,this.buffer);gl.bufferData(gl.ARRAY_BUFFER,new Float32Array([-1,-1,1,-1,-1,1,1,1]),gl.STATIC_DRAW);const position=gl.getAttribLocation(this.program,'pos');gl.enableVertexAttribArray(position);gl.vertexAttribPointer(position,2,gl.FLOAT,false,0,0);
  const texture=()=>{const t=gl.createTexture()!;gl.bindTexture(gl.TEXTURE_2D,t);gl.texParameteri(gl.TEXTURE_2D,gl.TEXTURE_MIN_FILTER,gl.LINEAR);gl.texParameteri(gl.TEXTURE_2D,gl.TEXTURE_MAG_FILTER,gl.LINEAR);gl.texParameteri(gl.TEXTURE_2D,gl.TEXTURE_WRAP_S,gl.CLAMP_TO_EDGE);gl.texParameteri(gl.TEXTURE_2D,gl.TEXTURE_WRAP_T,gl.CLAMP_TO_EDGE);return t;};
  this.texture=texture();this.clipTexture=texture();this.targetTexture=texture();gl.texImage2D(gl.TEXTURE_2D,0,gl.RGBA,this.size,this.size,0,gl.RGBA,gl.UNSIGNED_BYTE,null);this.target=gl.createFramebuffer();gl.bindFramebuffer(gl.FRAMEBUFFER,this.target);gl.framebufferTexture2D(gl.FRAMEBUFFER,gl.COLOR_ATTACHMENT0,gl.TEXTURE_2D,this.targetTexture,0);if(gl.checkFramebufferStatus(gl.FRAMEBUFFER)!==gl.FRAMEBUFFER_COMPLETE)throw Error('Render target Organic belum tersedia');gl.pixelStorei(gl.UNPACK_ALIGNMENT,1);
  }catch(e){this.dispose();throw e;}
 }
 render(layers:OrganicLayer[],clip?:BodyMask,additive=false):BodyMask{
  const gl=this.gl;if(!gl)return rasterizeLayers(layers,this.size,clip,additive);if(this.lost)throw Error('GPU Organic terputus. Reset Organic untuk memulai ulang.');
  gl.bindFramebuffer(gl.FRAMEBUFFER,this.target);gl.viewport(0,0,this.size,this.size);gl.clearColor(0,0,0,0);gl.clear(gl.COLOR_BUFFER_BIT);gl.useProgram(this.program);gl.enable(gl.BLEND);gl.blendEquation(gl.FUNC_ADD);gl.blendFunc(gl.ONE,additive?gl.ONE:gl.ONE_MINUS_SRC_ALPHA);
  const loc=(n:string)=>gl.getUniformLocation(this.program!,n);gl.uniform1i(loc('body'),0);gl.uniform1i(loc('clipping'),1);gl.uniform1f(loc('useClip'),clip?1:0);gl.activeTexture(gl.TEXTURE1);gl.bindTexture(gl.TEXTURE_2D,this.clipTexture);gl.texImage2D(gl.TEXTURE_2D,0,gl.LUMINANCE,clip?.width||1,clip?.height||1,0,gl.LUMINANCE,gl.UNSIGNED_BYTE,clip?.data??new Uint8Array([255]));
  for(const l of layers){if(l.opacity<=0)continue;gl.activeTexture(gl.TEXTURE0);gl.bindTexture(gl.TEXTURE_2D,this.texture);gl.texImage2D(gl.TEXTURE_2D,0,gl.LUMINANCE,l.mask.width,l.mask.height,0,gl.LUMINANCE,gl.UNSIGNED_BYTE,l.mask.data);gl.uniform4fv(loc('placement'),l.placement);gl.uniform4fv(loc('crop'),l.crop);for(const n of ['anchor','axis','pull','offset'] as const)gl.uniform2f(loc(n),l[n].x,l[n].y);for(const n of ['factor','radius','opacity','threshold','softness'] as const)gl.uniform1f(loc(n),l[n]);gl.uniform1f(loc('local'),l.local?1:0);gl.uniform1f(loc('shrink'),l.shrink?1:0);gl.drawArrays(gl.TRIANGLE_STRIP,0,4);}
  gl.readPixels(0,0,this.size,this.size,gl.RGBA,gl.UNSIGNED_BYTE,this.pixels);const data=new Uint8Array(this.size*this.size);for(let i=0;i<data.length;i++)data[i]=this.pixels[i*4];return {width:this.size,height:this.size,data};
 }
 dispose(){const g=this.gl;if(g){g.deleteTexture(this.texture);g.deleteTexture(this.clipTexture);g.deleteTexture(this.targetTexture);g.deleteFramebuffer(this.target);g.deleteBuffer(this.buffer);g.deleteProgram(this.program);}this.gl=null;this.canvas.removeEventListener('webglcontextlost',this.lostHandler);}
}
