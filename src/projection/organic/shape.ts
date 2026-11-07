import type {BodyMask} from '../../studio/bodyField.ts';
import type {ProjectionConfig} from '../model.ts';
import type {OrganicConfig} from './config.ts';
import type {OrganicFrame} from './history.ts';
export type Vec={x:number;y:number};
export type OrganicLayer={mask:BodyMask;placement:[number,number,number,number];anchor:Vec;axis:Vec;factor:number;local:boolean;radius:number;shrink:boolean;pull:Vec;offset:Vec;crop:[number,number,number,number];opacity:number;threshold:number;softness:number};
export const flatLayer=(mask:BodyMask,opacity=1):OrganicLayer=>({mask,placement:[1,1,0,0],anchor:{x:.5,y:.5},axis:{x:0,y:1},factor:1,local:false,radius:.25,shrink:false,pull:{x:0,y:0},offset:{x:0,y:0},crop:[0,0,1,1],opacity,threshold:-1,softness:.08});
export function landmarkAnchor(frame:OrganicFrame,name:OrganicConfig['anchor']):Vec{
 const b=frame.rawBounds??{cx:.5,cy:.5,width:.4,height:.8},p=frame.pose;
 const good=(i:number)=>p[i]&&Number.isFinite(p[i].x)&&Number.isFinite(p[i].y)&&(p[i].visibility??1)>.35;
 const point=(i:number)=>({x:p[i].x,y:p[i].y});
 const pair=(a:number,z:number)=>good(a)&&good(z)?{x:(p[a].x+p[z].x)/2,y:(p[a].y+p[z].y)/2}:good(a)?point(a):good(z)?point(z):{x:b.cx,y:b.cy};
 if(name==='head'&&good(0))return point(0);
 if(name==='shoulder')return pair(11,12);
 if(name==='hip')return pair(23,24);
 if(name==='hand'){if(good(15)&&good(16))return point(p[15].y<p[16].y?15:16);if(good(15))return point(15);if(good(16))return point(16);}
 return {x:b.cx,y:b.cy};
}
export function shapeLayer(frame:OrganicFrame,c:OrganicConfig,projection:ProjectionConfig,factor:number,opacity=1):OrganicLayer{
 const layer=flatLayer(frame.mask,opacity),raw=frame.rawBounds,b=frame.bounds;
 if(raw&&b){const sx=b.width/raw.width,sy=b.height/raw.height;layer.placement=[sx,sy,(projection.motion==='fixed'?.5:b.cx)-raw.cx*sx,(projection.motion==='fixed'?.5:b.cy)-raw.cy*sy];}
 const [sx,sy,tx,ty]=layer.placement,a=landmarkAnchor(frame,c.anchor);layer.anchor={x:a.x*sx+tx,y:a.y*sy+ty};
 const speed=Math.hypot(frame.velocity.x,frame.velocity.y);layer.axis=c.axis==='horizontal'?{x:1,y:0}:c.axis==='motion'&&speed>.005?{x:frame.velocity.x/speed,y:frame.velocity.y/speed}:{x:0,y:-1};
 layer.factor=factor;layer.local=c.falloff==='local';layer.radius=Math.max(.075,Math.min(.4,Math.max(raw?.width??.4,raw?.height??.7)*(c.anchor==='hand'?.22:.45)));layer.shrink=c.mode==='shrink';
 if(c.mode==='stretch'&&c.anchor==='hand'&&c.falloff==='local'){
  const shoulder=landmarkAnchor(frame,'shoulder'),dx=(a.x-shoulder.x)*sx,dy=(a.y-shoulder.y)*sy;
  layer.pull={x:dx*(factor-1)*.35,y:dy*(factor-1)*.35};
 }
 const crop=projection.placement.crop;layer.crop=[crop.left,crop.top,crop.right,crop.bottom];layer.threshold=projection.threshold;layer.softness=projection.softness;return layer;
}
/** Inverse sampling in camera space. The GPU uses the same equations. */
export function sourcePoint(layer:OrganicLayer,x:number,y:number):Vec{
 let qx=x-layer.offset.x-layer.anchor.x,qy=y-layer.offset.y-layer.anchor.y;
 const falloff=layer.local?Math.exp(-2*(qx*qx+qy*qy)/(layer.radius*layer.radius)):1;
 qx-=layer.pull.x*falloff;qy-=layer.pull.y*falloff;
 const factor=1+(layer.factor-1)*falloff;
 if(layer.shrink){qx/=factor;qy/=factor;}else{const dot=qx*layer.axis.x+qy*layer.axis.y;qx-=layer.axis.x*dot*(1-1/factor);qy-=layer.axis.y*dot*(1-1/factor);}
 const [sx,sy,tx,ty]=layer.placement;return {x:(qx+layer.anchor.x-tx)/sx,y:(qy+layer.anchor.y-ty)/sy};
}
export function sliceRect(frame:OrganicFrame,mode:OrganicConfig['splitMode'],index:number,count:number):[number,number,number,number]{
 const b=frame.rawBounds??{cx:.5,cy:.5,width:1,height:1},left=b.cx-b.width/2,top=b.cy-b.height/2,right=left+b.width,bottom=top+b.height;
 if(mode==='anatomical'){
  const shoulder=landmarkAnchor(frame,'shoulder').y,hip=landmarkAnchor(frame,'hip').y;
  const cuts=[top,Math.max(top+b.height*.08,Math.min(top+b.height*.4,shoulder)),Math.max(top+b.height*.45,Math.min(bottom-b.height*.1,hip)),bottom];return [left,cuts[index],right,cuts[index+1]];
 }
 return mode==='vertical'?[left+b.width*index/count,top,left+b.width*(index+1)/count,bottom]:[left,top+b.height*index/count,right,top+b.height*(index+1)/count];
}
export function intersectCrop(a:OrganicLayer['crop'],b:OrganicLayer['crop']):OrganicLayer['crop']{return [Math.max(a[0],b[0]),Math.max(a[1],b[1]),Math.min(a[2],b[2]),Math.min(a[3],b[3])];}
