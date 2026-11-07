import type {Landmark,MotionFrame} from '../engine/types.ts';
export type BodyMask={width:number;height:number;data:Uint8Array};
export type Surface={a:{x:number;y:number};b:{x:number;y:number}};
export type BodyField={mask?:BodyMask;surfaces:Surface[];left:number;top:number;width:number;height:number;mirror:boolean};
export function unionMasks(masks:{width:number;height:number;getAsFloat32Array:()=>Float32Array}[],size=96):BodyMask|undefined{
 if(!masks.length)return;const data=new Uint8Array(size*size);
 for(const mask of masks){const source=mask.getAsFloat32Array();for(let y=0;y<size;y++)for(let x=0;x<size;x++){const i=y*size+x;const v=source[Math.min(mask.height-1,Math.floor(y*mask.height/size))*mask.width+Math.min(mask.width-1,Math.floor(x*mask.width/size))];data[i]=Math.max(data[i],Math.round(Math.max(0,Math.min(1,v))*255));}}
 return {width:size,height:size,data};
}
export function bodyField(f:MotionFrame,mirror:boolean,aspect:number,cameraAspect=4/3):BodyField{
 const width=Math.min(1,cameraAspect/aspect),height=Math.min(1,aspect/cameraAspect);const field:BodyField={mask:f.segmentation,surfaces:[],left:(1-width)/2,top:(1-height)/2,width,height,mirror};
 const project=(p:Landmark)=>({x:field.left+(mirror?1-p.x:p.x)*width,y:field.top+p.y*height});
 const segment=(points:Landmark[],a:number,b:number)=>{if(points[a]&&points[b]&&(points[a].visibility??1)>.65&&(points[b].visibility??1)>.65)field.surfaces.push({a:project(points[a]),b:project(points[b])});};
 for(const p of f.poses??[f.pose])for(const [a,b]of [[11,12],[11,13],[13,15],[12,14],[14,16]])segment(p,a,b);
 for(const hand of f.hands)for(const [a,b]of [[0,5],[5,9],[9,13],[13,17],[17,0]])segment(hand,a,b);
 if(f.source==='mouse')field.surfaces=[{a:{x:f.features.x-.12,y:1-f.features.y},b:{x:f.features.x+.12,y:1-f.features.y}}];
 return field;
}
// Find the first real surface crossed by a falling word's lower edge.
export function landing(field:BodyField|undefined,x:number,from:number,to:number):number|undefined{
 if(!field||to<from)return;
 let found:number|undefined;
 const accept=(y:number)=>{if(y>=from-.004&&y<=to+.004&&(found===undefined||y<found))found=y;};
 if(field.mask){const m=field.mask;let u=(x-field.left)/field.width;if(field.mirror)u=1-u;
 if(u>=0&&u<1){const col=Math.floor(u*m.width);let wasSolid=false;for(let y=0;y<m.height;y++){const solid=m.data[y*m.width+col]>150;if(solid&&!wasSolid)accept(field.top+y/m.height*field.height);wasSolid=solid;}}}
 else for(const {a,b}of field.surfaces){if(Math.abs(b.x-a.x)<.006)continue;const t=(x-a.x)/(b.x-a.x);if(t>=0&&t<=1)accept(a.y+t*(b.y-a.y));}
 return found;
}
