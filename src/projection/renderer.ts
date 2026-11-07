import {homography,inverse3,projectionMatrix,type ProjectionState} from './model';
import {FrameMetrics} from './metrics';
export class ProjectionRenderer{
 readonly mode:'WebGL'|'Canvas 2D';readonly metrics=new FrameMetrics();private gl:WebGLRenderingContext|null;private program:WebGLProgram|null=null;private texture:WebGLTexture|null=null;private buffer:WebGLBuffer|null=null;private ctx:CanvasRenderingContext2D|null=null;private textureData:Uint8Array|null=null;private dead=false;private paintKey='';private mapKey='';private sampleMap=new Int32Array(0);private patternPixels=new Float32Array(0);private lost=()=>{this.dead=true;};
 constructor(readonly canvas:HTMLCanvasElement){
  this.gl=canvas.getContext('webgl',{alpha:false,antialias:false,preserveDrawingBuffer:true});this.mode=this.gl?'WebGL':'Canvas 2D';
  if(this.gl){const gl=this.gl;const shader=(type:number,source:string)=>{const s=gl.createShader(type)!;gl.shaderSource(s,source);gl.compileShader(s);if(!gl.getShaderParameter(s,gl.COMPILE_STATUS))throw Error(gl.getShaderInfoLog(s)||'Shader gagal');return s;};
   const v=shader(gl.VERTEX_SHADER,'attribute vec2 a;varying vec2 uv;void main(){uv=vec2(a.x*.5+.5,.5-a.y*.5);gl_Position=vec4(a,0.,1.);}');
   const f=shader(gl.FRAGMENT_SHADER,`precision highp float;varying vec2 uv;uniform mat3 imageInverse;uniform mat3 screenInverse;uniform sampler2D mask;uniform vec2 texel;uniform vec4 crop;uniform float threshold;uniform float softness;uniform float bright;uniform float pattern;uniform float outline;uniform float registered;uniform float processed;uniform vec2 target[4];
float sampleMask(vec2 q){if(q.x<crop.x||q.x>crop.z||q.y<crop.y||q.y>crop.w)return 0.;float a=texture2D(mask,q).r;return processed>.5?a:smoothstep(threshold-softness,threshold+softness,a);}
void main(){vec3 s=screenInverse*vec3(uv,1.);vec2 screen=s.xy/s.z;float value=0.;if(screen.x>=0.&&screen.y>=0.&&screen.x<=1.&&screen.y<=1.){if(pattern>.5){vec2 grid=abs(fract(screen*10.+.5)-.5);value=(min(grid.x,grid.y)<.018||min(min(screen.x,screen.y),min(1.-screen.x,1.-screen.y))<.004)?1.:.035;if(abs(screen.x-.5)<.0015||abs(screen.y-.5)<.0027)value=1.;}else{vec3 p=imageInverse*vec3(uv,1.);vec2 q=p.xy/p.z;value=sampleMask(q);if(outline>.5){float low=min(min(sampleMask(q+vec2(texel.x,0.)),sampleMask(q-vec2(texel.x,0.))),min(sampleMask(q+vec2(0.,texel.y)),sampleMask(q-vec2(0.,texel.y))));value=max(0.,value-low);}}}if(pattern>.5&&registered>.5){for(int i=0;i<4;i++){vec2 d=abs(uv-target[i]);if((d.x<.0015&&d.y<.025)||(d.y<.0027&&d.x<.014))value=1.;}}gl_FragColor=vec4(vec3(value*bright),1.);}`);
   const p=gl.createProgram()!;gl.attachShader(p,v);gl.attachShader(p,f);gl.linkProgram(p);gl.deleteShader(v);gl.deleteShader(f);if(!gl.getProgramParameter(p,gl.LINK_STATUS))throw Error('Program proyeksi gagal');this.program=p;gl.useProgram(p);
   this.buffer=gl.createBuffer();gl.bindBuffer(gl.ARRAY_BUFFER,this.buffer);gl.bufferData(gl.ARRAY_BUFFER,new Float32Array([-1,-1,1,-1,-1,1,1,1]),gl.STATIC_DRAW);const a=gl.getAttribLocation(p,'a');gl.enableVertexAttribArray(a);gl.vertexAttribPointer(a,2,gl.FLOAT,false,0,0);
   this.texture=gl.createTexture();gl.bindTexture(gl.TEXTURE_2D,this.texture);gl.texParameteri(gl.TEXTURE_2D,gl.TEXTURE_MIN_FILTER,gl.LINEAR);gl.texParameteri(gl.TEXTURE_2D,gl.TEXTURE_MAG_FILTER,gl.LINEAR);gl.texParameteri(gl.TEXTURE_2D,gl.TEXTURE_WRAP_S,gl.CLAMP_TO_EDGE);gl.texParameteri(gl.TEXTURE_2D,gl.TEXTURE_WRAP_T,gl.CLAMP_TO_EDGE);gl.pixelStorei(gl.UNPACK_ALIGNMENT,1);gl.texImage2D(gl.TEXTURE_2D,0,gl.LUMINANCE,1,1,0,gl.LUMINANCE,gl.UNSIGNED_BYTE,new Uint8Array([0]));canvas.addEventListener('webglcontextlost',this.lost);
  }else this.ctx=canvas.getContext('2d',{alpha:false});
 }
 get healthy(){return !this.dead;}
 render(state:ProjectionState|null,forceBlack=false){
  this.metrics.add(performance.now());const c=this.canvas,w=this.mode==='WebGL'?(state?.config.resolution==='1080p'?1920:1280):480,h=w*9/16;if(c.width!==w||c.height!==h){c.width=w;c.height=h;this.paintKey='';}
  if(this.dead){c.style.visibility='hidden';return;}
  const blank=forceBlack||!state||state.blank;
  if(blank){this.paintKey='';if(this.gl){this.gl.viewport(0,0,w,h);this.gl.clearColor(0,0,0,1);this.gl.clear(this.gl.COLOR_BUFFER_BIT);}else if(this.ctx){this.ctx.fillStyle='#000';this.ctx.fillRect(0,0,w,h);}return;}
  const s=state!,cfg=s.config,mask=s.image?.mask,inv=inverse3(projectionMatrix(cfg,s.image)),screen=inverse3(homography(cfg.quad)),crop=s.image?.processed?{left:0,top:0,right:1,bottom:1}:cfg.placement.crop,bright=cfg.brightness*(s.pattern?1:s.opacity),key=JSON.stringify([cfg,s.image?.time,s.image?.bounds,s.image?.processed,bright,s.pattern]);
  if(this.gl){const gl=this.gl,p=this.program!;gl.viewport(0,0,w,h);gl.useProgram(p);const loc=(n:string)=>gl.getUniformLocation(p,n),matrix=(n:string,m:number[])=>gl.uniformMatrix3fv(loc(n),false,new Float32Array([m[0],m[3],m[6],m[1],m[4],m[7],m[2],m[5],m[8]]));matrix('imageInverse',inv);matrix('screenInverse',screen);gl.uniform4f(loc('crop'),crop.left,crop.top,crop.right,crop.bottom);gl.uniform2f(loc('texel'),2/(mask?.width||256),2/(mask?.height||256));gl.uniform1f(loc('threshold'),cfg.threshold);gl.uniform1f(loc('softness'),cfg.softness);gl.uniform1f(loc('bright'),bright);gl.uniform1f(loc('pattern'),s.pattern?1:0);gl.uniform1f(loc('outline'),cfg.appearance==='outline'?1:0);gl.uniform1f(loc('registered'),cfg.registration.enabled?1:0);gl.uniform1f(loc('processed'),s.image?.processed?1:0);gl.uniform2fv(loc('target[0]'),new Float32Array(cfg.registration.destination.flatMap(p=>[p.x,p.y])));
   if(mask&&mask.data!==this.textureData){gl.bindTexture(gl.TEXTURE_2D,this.texture);gl.texImage2D(gl.TEXTURE_2D,0,gl.LUMINANCE,mask.width,mask.height,0,gl.LUMINANCE,gl.UNSIGNED_BYTE,mask.data);this.textureData=mask.data;}gl.drawArrays(gl.TRIANGLE_STRIP,0,4);
  }else if(this.ctx){if(this.paintKey===key)return;this.paintKey=key;const mapping=JSON.stringify([inv,screen,crop,cfg.registration,mask?.width,mask?.height,w,h]);
   if(mapping!==this.mapKey){this.mapKey=mapping;this.sampleMap=new Int32Array(w*h).fill(-1);this.patternPixels=new Float32Array(w*h);
    for(let y=0;y<h;y++)for(let x=0;x<w;x++){const i=y*w+x,u=(x+.5)/w,v=(y+.5)/h,z=screen[6]*u+screen[7]*v+screen[8],sx=(screen[0]*u+screen[1]*v+screen[2])/z,sy=(screen[3]*u+screen[4]*v+screen[5])/z;
     if(sx>=0&&sx<=1&&sy>=0&&sy<=1){const a=Math.abs((sx*10+.5)%1-.5),b=Math.abs((sy*10+.5)%1-.5);this.patternPixels[i]=Math.min(a,b)<.018||Math.min(sx,sy,1-sx,1-sy)<.004||Math.abs(sx-.5)<.0015||Math.abs(sy-.5)<.0027?1:.035;
      const dz=inv[6]*u+inv[7]*v+inv[8],qx=(inv[0]*u+inv[1]*v+inv[2])/dz,qy=(inv[3]*u+inv[4]*v+inv[5])/dz;if(mask&&qx>=crop.left&&qx<crop.right&&qy>=crop.top&&qy<crop.bottom)this.sampleMap[i]=Math.floor(qy*mask.height)*mask.width+Math.floor(qx*mask.width);
     }
     if(cfg.registration.enabled&&cfg.registration.destination.some(p=>(Math.abs(u-p.x)<.0015&&Math.abs(v-p.y)<.025)||(Math.abs(v-p.y)<.0027&&Math.abs(u-p.x)<.014)))this.patternPixels[i]=1;
    }
   }
   const out=this.ctx.createImageData(w,h),lut=new Uint8Array(256);for(let k=0;k<256;k++){const t=Math.max(0,Math.min(1,(k/255-cfg.threshold+cfg.softness)/(2*cfg.softness)));lut[k]=Math.round((s.image?.processed?k/255:t*t*(3-2*t))*bright*255);}
   const sample=(x:number,y:number)=>!mask||x<0||y<0||x>=mask.width||y>=mask.height||x/mask.width<crop.left||x/mask.width>crop.right||y/mask.height<crop.top||y/mask.height>crop.bottom?0:lut[mask.data[y*mask.width+x]];
   for(let j=0;j<w*h;j++){const index=this.sampleMap[j];let value=s.pattern?Math.round(this.patternPixels[j]*bright*255):index>=0&&mask?lut[mask.data[index]]:0;if(!s.pattern&&cfg.appearance==='outline'&&mask&&index>=0){const x=index%mask.width,y=Math.floor(index/mask.width);value=Math.max(0,value-Math.min(sample(x+2,y),sample(x-2,y),sample(x,y+2),sample(x,y-2)));}const i=j*4;out.data[i]=out.data[i+1]=out.data[i+2]=value;out.data[i+3]=255;}this.ctx.putImageData(out,0,0);
  }
 }
 dispose(){this.canvas.removeEventListener('webglcontextlost',this.lost);this.gl?.deleteTexture(this.texture);this.gl?.deleteBuffer(this.buffer);this.gl?.deleteProgram(this.program);}
}
