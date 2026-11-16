import {insideFloor,type FloorPoint,type FloorSpace} from '../spatial/coordinates.ts';
import type {FootSide} from '../spatial/events.ts';

/** Physical 3D world: floor X stage-right, Y upstage, Z above floor. */
export type Vector3={x:number;y:number;z:number};
export type ScreenPoint={x:number;y:number;depth:number};
export type OrbitCamera={yawRad:number;elevationRad:number;distanceM:number;fovRad:number};
export type PuppetFoot={positionM:FloorPoint;heightM:number;headingRad:number};
export type PuppetPerformer={id:string;left:PuppetFoot;right:PuppetFoot};
export type Limb={hip:Vector3;knee:Vector3;ankle:Vector3;heel:Vector3;toe:Vector3};
export const initialCamera=():OrbitCamera=>({
 yawRad:0,elevationRad:Math.PI/3,distanceM:12,fovRad:Math.PI/3
});
const v=(x:number,y:number,z:number):Vector3=>({x,y,z});
const plus=(a:Vector3,b:Vector3)=>v(a.x+b.x,a.y+b.y,a.z+b.z);
const sub=(a:Vector3,b:Vector3)=>v(a.x-b.x,a.y-b.y,a.z-b.z);
const scale=(a:Vector3,n:number)=>v(a.x*n,a.y*n,a.z*n);
const dot=(a:Vector3,b:Vector3)=>a.x*b.x+a.y*b.y+a.z*b.z;
const cross=(a:Vector3,b:Vector3)=>v(a.y*b.z-a.z*b.y,a.z*b.x-a.x*b.z,a.x*b.y-a.y*b.x);
const norm=(a:Vector3)=>{const d=Math.hypot(a.x,a.y,a.z);return d>1e-9?scale(a,1/d):v(0,0,0);};
export const clamp=(n:number,min:number,max:number)=>Math.max(min,Math.min(max,n));
export const initialPerformers=(floor:FloorSpace):PuppetPerformer[]=>{
 const centerX=floor.widthM/2,centerY=floor.depthM/2;
 const performer=(id:string,x:number,y:number):PuppetPerformer=>({
  id,
  left:{positionM:{xM:clamp(x-.2,0,floor.widthM),yM:y},heightM:0,headingRad:Math.PI/2},
  right:{positionM:{xM:clamp(x+.2,0,floor.widthM),yM:y},heightM:0,headingRad:Math.PI/2}
 });
 return [performer('A',centerX-.85,centerY-.7),
  performer('B',centerX+.95,centerY+.85)];
};
export function cameraBasis(camera:OrbitCamera,floor:FloorSpace){
 const e=camera.elevationRad,y=camera.yawRad,d=camera.distanceM;
 if(!Number.isFinite(e)||!Number.isFinite(y)||!Number.isFinite(d)||d<=0||
    !Number.isFinite(camera.fovRad)||camera.fovRad<=0||camera.fovRad>=Math.PI)
  throw Error('Parameter kamera simulasi 3D tidak valid.');
 const target=v(floor.widthM/2,floor.depthM/2,.5);
 const eye=plus(target,v(Math.sin(y)*Math.cos(e)*d,-Math.cos(y)*Math.cos(e)*d,Math.sin(e)*d));
 const forward=norm(sub(target,eye));
 const right=norm(cross(forward,v(0,0,1)));
 const up=norm(cross(right,forward));
 return {eye,target,forward,right,up};
}
export function project3D(point:Vector3,camera:OrbitCamera,floor:FloorSpace,width:number,height:number):ScreenPoint|null{
 if(width<=0||height<=0||!Number.isFinite(width)||!Number.isFinite(height))return null;
 const b=cameraBasis(camera,floor),offset=sub(point,b.eye),depth=dot(offset,b.forward);
 if(depth<=.02)return null;
 const focal=height/(2*Math.tan(camera.fovRad/2));
 return {x:width/2+dot(offset,b.right)*focal/depth,
  y:height/2-dot(offset,b.up)*focal/depth,depth};
}
/** Raycast cursor to flat physical floor. No projector calibration is involved. */
export function unprojectFloor(screen:{x:number;y:number},camera:OrbitCamera,floor:FloorSpace,
 width:number,height:number):FloorPoint|null{
 if(width<=0||height<=0||!Number.isFinite(screen.x)||!Number.isFinite(screen.y))return null;
 const b=cameraBasis(camera,floor),focal=height/(2*Math.tan(camera.fovRad/2));
 const direction=norm(plus(b.forward,plus(scale(b.right,(screen.x-width/2)/focal),scale(b.up,(height/2-screen.y)/focal))));
 if(direction.z>=-1e-7)return null;
 const t=-b.eye.z/direction.z;
 if(t<=0)return null;
 const at=plus(b.eye,scale(direction,t)),point={xM:at.x,yM:at.y};
 return insideFloor(floor,point)?point:null;
}
export function clampOnFloor(point:FloorPoint,floor:FloorSpace,marginM=.12):FloorPoint{
 return {xM:clamp(point.xM,marginM,floor.widthM-marginM),
  yM:clamp(point.yM,marginM,floor.depthM-marginM)};
}
/** Stage-proportion lower-body puppet with visible 3D ankle, knee and hip joints. */
export function buildLimb(performer:PuppetPerformer,side:FootSide):Limb{
 const f=performer[side],middle={
  x:(performer.left.positionM.xM+performer.right.positionM.xM)/2,
  y:(performer.left.positionM.yM+performer.right.positionM.yM)/2
 };
 const hip=v(middle.x+(side==='left'?-.18:.18),middle.y,1.05);
 const ankle=v(f.positionM.xM,f.positionM.yM,f.heightM+.09);
 const knee=v(hip.x*.54+ankle.x*.46,hip.y*.54+ankle.y*.46+.17,
  Math.max(.25,hip.z*.57+ankle.z*.43));
 const ahead=v(Math.cos(f.headingRad),Math.sin(f.headingRad),0);
 return {hip,knee,ankle,
  heel:plus(ankle,scale(ahead,-.095)),
  toe:plus(ankle,scale(ahead,.22))};
}
export function hitFoot(screen:{x:number;y:number},performers:PuppetPerformer[],count:number,
 camera:OrbitCamera,floor:FloorSpace,width:number,height:number,
 radiusPx=37):{performerId:string;foot:FootSide}|null{
 let best=radiusPx;
 let selected:null|{performerId:string;foot:FootSide}=null;
 for(const performer of performers.slice(0,count)){
  for(const foot of ['left','right'] as const){
   const p=project3D(buildLimb(performer,foot).ankle,camera,floor,width,height);
   if(!p)continue;
   const d=Math.hypot(screen.x-p.x,screen.y-p.y);
   if(d<best){best=d;selected={performerId:performer.id,foot};}
  }
 }
 return selected;
}
