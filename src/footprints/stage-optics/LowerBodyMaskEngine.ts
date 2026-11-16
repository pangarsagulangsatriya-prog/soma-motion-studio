import type {Landmark,MotionFrame} from '../../engine/types.ts';
import type {BodyMask} from '../../studio/bodyField.ts';

/**
 * S5.7.1 — planning/preview mask, on the UNMIRRORED camera coordinate plane.
 * No projector homography, floor warp, video footage or device output here.
 * A multi-person segmentation mask is a UNION: it must never be used as a person ID.
 */
export type MaskPolygon={points:{x:number;y:number}[];part:'pelvis'|'thigh'|'shin'|'foot';poseIndex:number};
export type LowerBodyMaskConfig={
 width:number;height:number;performers:1|2;
 torsoExtension:number;featherPx:number;minimumVisibility:number;
 requireSegmentation:boolean;
};
export const LOWER_BODY_MASK_DEFAULTS:LowerBodyMaskConfig={
 width:160,height:90,performers:2,torsoExtension:.19,featherPx:2,
 minimumVisibility:.58,requireSegmentation:false
};
export type LowerBodyMaskStatus='ready'|'missing'|'ambiguous'|'stale'|'invalid';
export type LowerBodyMaskResult={
 status:LowerBodyMaskStatus;reason:string;mask:BodyMask;perPoseMasks:BodyMask[];
 polygons:MaskPolygon[];poseCount:number;segmentationUsed:boolean;
 source:'camera'|'simulation';
};
type Vec={x:number;y:number};
const valid=(v:number)=>Number.isFinite(v);
const clamp=(v:number)=>Math.max(0,Math.min(1,v));
const point=(p:Landmark|undefined,min:number):Vec|null=>
 p&&valid(p.x)&&valid(p.y)&&p.x>=0&&p.x<=1&&p.y>=0&&p.y<=1&&
 (p.visibility??0)>=min?{x:p.x,y:p.y}:null;
const center=(a:Vec,b:Vec):Vec=>({x:(a.x+b.x)/2,y:(a.y+b.y)/2});
const width=(a:Vec,b:Vec)=>Math.hypot(b.x-a.x,b.y-a.y);
const empty=(width:number,height:number):BodyMask=>({width,height,data:new Uint8Array(width*height)});
const area=(points:Vec[])=>points.reduce((v,p,i)=>v+(p.x*points[(i+1)%points.length].y-
 points[(i+1)%points.length].x*p.y),0)/2;
const segment=(a:Vec,b:Vec,radius:number):Vec[]=>{
 const length=Math.hypot(a.x-b.x,a.y-b.y);
 if(length<1e-6)return [];
 const ux=(b.x-a.x)/length,uy=(b.y-a.y)/length;
 const vertices:Vec[]=[];
 // 12-sided capsule with 6 vertices on each half-round, safe for rotation.
 for(let i=0;i<=6;i++){
  const angle=Math.PI/2+i*Math.PI/6;
  vertices.push({x:a.x+radius*(Math.cos(angle)*ux-Math.sin(angle)*uy),
   y:a.y+radius*(Math.sin(angle)*ux+Math.cos(angle)*uy)});
 }
 for(let i=0;i<=6;i++){
  const angle=-Math.PI/2+i*Math.PI/6;
  vertices.push({x:b.x+radius*(Math.cos(angle)*ux-Math.sin(angle)*uy),
   y:b.y+radius*(Math.sin(angle)*ux+Math.cos(angle)*uy)});
 }
 return vertices;
};
type PoseMask={polygons:MaskPolygon[];bounds:{minX:number;maxX:number;minY:number;maxY:number}};
export function lowerBodyPosePolygons(pose:Landmark[],poseIndex:number,
 config:LowerBodyMaskConfig):PoseMask|null{
 const pick=(idx:number)=>point(pose[idx],config.minimumVisibility);
 const shoulderL=pick(11),shoulderR=pick(12),hipL=pick(23),hipR=pick(24);
 const kneeL=pick(25),kneeR=pick(26),ankleL=pick(27),ankleR=pick(28);
 const heelL=pick(29),heelR=pick(30),toeL=pick(31),toeR=pick(32);
 if(!shoulderL||!shoulderR||!hipL||!hipR||!kneeL||!kneeR||
  !ankleL||!ankleR||!heelL||!heelR||!toeL||!toeR)return null;
 const shoulders=center(shoulderL,shoulderR),hips=center(hipL,hipR);
 const hipWidth=width(hipL,hipR);
 if(hipWidth<.025||hipWidth>.5)return null;
 // Preserve subject-relative top cutoff during bending; never use a horizontal stage-wide band.
 const extension=config.torsoExtension;
 const upperL={x:hipL.x+(shoulderL.x-hipL.x)*extension,
  y:hipL.y+(shoulderL.y-hipL.y)*extension};
 const upperR={x:hipR.x+(shoulderR.x-hipR.x)*extension,
  y:hipR.y+(shoulderR.y-hipR.y)*extension};
 // Guard pathological inversion (e.g. accidental upside-down pose).
 if(shoulders.y>hips.y+.05)return null;
 const pelvicRadius=hipWidth*.13;
 const pelvis=[
  {x:upperL.x-pelvicRadius,y:upperL.y},
  {x:upperR.x+pelvicRadius,y:upperR.y},
  {x:hipR.x+pelvicRadius,y:hipR.y+.045},
  {x:hipL.x-pelvicRadius,y:hipL.y+.045}
 ];
 const shapes:{part:MaskPolygon['part'];points:Vec[]}[]=[
  {part:'pelvis',points:pelvis},
  {part:'thigh',points:segment(hipL,kneeL,hipWidth*.23)},
  {part:'thigh',points:segment(hipR,kneeR,hipWidth*.23)},
  {part:'shin',points:segment(kneeL,ankleL,hipWidth*.16)},
  {part:'shin',points:segment(kneeR,ankleR,hipWidth*.16)},
  {part:'foot',points:segment(heelL,toeL,hipWidth*.11)},
  {part:'foot',points:segment(heelR,toeR,hipWidth*.11)},
  {part:'foot',points:segment(ankleL,heelL,hipWidth*.13)},
  {part:'foot',points:segment(ankleR,heelR,hipWidth*.13)}
 ];
 if(shapes.some(x=>x.points.length<3||Math.abs(area(x.points))<1e-7))return null;
 const polygons=shapes.map(x=>({part:x.part,poseIndex,points:x.points.map(p=>({
  x:clamp(p.x),y:clamp(p.y)}))}));
 const all=polygons.flatMap(x=>x.points);
 return {polygons,bounds:{
  minX:Math.min(...all.map(p=>p.x)),maxX:Math.max(...all.map(p=>p.x)),
  minY:Math.min(...all.map(p=>p.y)),maxY:Math.max(...all.map(p=>p.y))
 }};
}
export function validateLowerBodyMaskConfig(input:LowerBodyMaskConfig):LowerBodyMaskConfig{
 if(!input||!Number.isInteger(input.width)||!Number.isInteger(input.height)||
  input.width<32||input.width>512||input.height<32||input.height>512||
  ![1,2].includes(input.performers)||!valid(input.torsoExtension)||
  input.torsoExtension<0||input.torsoExtension>.4||
  !Number.isInteger(input.featherPx)||input.featherPx<0||input.featherPx>8||
  !valid(input.minimumVisibility)||input.minimumVisibility<.4||input.minimumVisibility>.95||
  typeof input.requireSegmentation!=='boolean')
  throw Error('Parameter lower-body mask di luar rentang aman.');
 return {...input};
}
function inside(p:Vec,poly:Vec[]):boolean{
 let result=false;
 for(let i=0,j=poly.length-1;i<poly.length;j=i++){
  const a=poly[i],b=poly[j];
  if((a.y>p.y)!==(b.y>p.y)&&p.x<(b.x-a.x)*(p.y-a.y)/(b.y-a.y)+a.x)result=!result;
 }
 return result;
}
function raster(polys:MaskPolygon[],w:number,h:number){
 const data=new Uint8Array(w*h);
 for(const {points} of polys){
  const x0=Math.max(0,Math.floor(Math.min(...points.map(p=>p.x))*w));
  const x1=Math.min(w-1,Math.ceil(Math.max(...points.map(p=>p.x))*w));
  const y0=Math.max(0,Math.floor(Math.min(...points.map(p=>p.y))*h));
  const y1=Math.min(h-1,Math.ceil(Math.max(...points.map(p=>p.y))*h));
  for(let y=y0;y<=y1;y++)for(let x=x0;x<=x1;x++)
   if(inside({x:(x+.5)/w,y:(y+.5)/h},points))data[y*w+x]=255;
 }
 return data;
}
function softenedInside(source:Uint8Array,w:number,h:number,r:number):Uint8Array{
 if(r===0)return source;
 // Inward feather: never lights outside polygons or above the waist cutoff.
 const out=new Uint8Array(source.length);
 for(let y=0;y<h;y++)for(let x=0;x<w;x++){
  const k=y*w+x;if(!source[k])continue;
  let sum=0,count=0;
  for(let dy=-r;dy<=r;dy++)for(let dx=-r;dx<=r;dx++){
   const xx=x+dx,yy=y+dy;
   if(xx<0||yy<0||xx>=w||yy>=h)continue;
   sum+=source[yy*w+xx];count++;
  }
  out[k]=Math.round(sum/count);
 }
 return out;
}
export function buildLowerBodyMask(frame:MotionFrame|null,
 options:LowerBodyMaskConfig=LOWER_BODY_MASK_DEFAULTS,
 nowMs:number=frame?.time??0,source:'camera'|'simulation'='camera'):LowerBodyMaskResult{
 const config=validateLowerBodyMaskConfig(options);
 const mask=empty(config.width,config.height);
 const no=(status:LowerBodyMaskStatus,reason:string,poseCount=0):LowerBodyMaskResult=>({
  status,reason,mask,perPoseMasks:[],polygons:[],poseCount,segmentationUsed:false,source});
 if(!frame||!frame.tracked||frame.source!=='camera')
  return no('missing','Kamera/pose belum aktif: mask hitam.');
 if(!valid(nowMs)||!valid(frame.time)||nowMs-frame.time>450||frame.time-nowMs>80)
  return no('stale','Frame kamera kedaluwarsa: mask hitam.');
 const poses=frame.poses?.length?frame.poses:(frame.pose?.length?[frame.pose]:[]);
 if(poses.length!==config.performers)
  return no('missing','Jumlah tubuh yang terbaca belum sesuai mode: mask hitam.',poses.length);
 const results=poses.map((p,i)=>lowerBodyPosePolygons(p,i,config));
 if(results.some(r=>!r))return no('missing','Landmark pinggul/kaki tidak lengkap: mask hitam.',poses.length);
 const validPoses=results as PoseMask[];
 if(validPoses.length===2){
  const a=validPoses[0].bounds,b=validPoses[1].bounds;
  const overlapX=Math.min(a.maxX,b.maxX)-Math.max(a.minX,b.minX);
  const overlapY=Math.min(a.maxY,b.maxY)-Math.max(a.minY,b.minY);
  const hips=poses.map(p=>({x:(p[23].x+p[24].x)/2,y:(p[23].y+p[24].y)/2}));
  if((overlapX>.02&&overlapY>.02)||Math.hypot(hips[0].x-hips[1].x,hips[0].y-hips[1].y)<.12)
   return no('ambiguous','Tubuh beririsan: proyeksi mask dihentikan sampai terpisah.',poses.length);
 }
 const polygons=validPoses.flatMap(r=>r.polygons);
 const segmented=frame.segmentation;
 const usable=!!segmented&&Number.isInteger(segmented.width)&&Number.isInteger(segmented.height)&&
  segmented.width>0&&segmented.height>0&&
  segmented.data.length===segmented.width*segmented.height;
 if(config.requireSegmentation&&!usable)
  return no('missing','Segmentasi belum tersedia: mask hitam.',poses.length);
 // Build one independent alpha mask per pose for future A/B archive assignment.
 // Segmentation is a UNION, so it can clip boundaries but never assign identity.
 const perPoseMasks=validPoses.map(entry=>{
  const raw=raster(entry.polygons,config.width,config.height);
  if(usable&&segmented){
   for(let y=0;y<config.height;y++)for(let x=0;x<config.width;x++){
    const sx=Math.min(segmented.width-1,Math.floor(x*segmented.width/config.width));
    const sy=Math.min(segmented.height-1,Math.floor(y*segmented.height/config.height));
    raw[y*config.width+x]=Math.min(raw[y*config.width+x],
     segmented.data[sy*segmented.width+sx]);
   }
  }
  return {width:config.width,height:config.height,
   data:softenedInside(raw,config.width,config.height,config.featherPx)};
 });
 const combined=new Uint8Array(config.width*config.height);
 for(const part of perPoseMasks)
  for(let i=0;i<combined.length;i++)combined[i]=Math.max(combined[i],part.data[i]);
 // A valid landmark geometry that is completely absent from the segmentation
 // cannot be treated as an illuminated target.
 if(!combined.some(alpha=>alpha>0))
  return no('missing','Segmentasi tidak memuat tubuh bagian bawah: mask hitam.',poses.length);
 return {status:'ready',reason:usable?'Mask tiap pose dipotong oleh segmentasi gabungan.':
  'Mask geometris landmark per pose, belum terpotong segmentasi.',
  mask:{width:config.width,height:config.height,data:combined},perPoseMasks,
  polygons,poseCount:poses.length,segmentationUsed:usable,source};
}

/** Preview fixture only; never feed these points into FloorSession contact/Projection. */
export function sampleLowerBodyFrame(nowMs:number,performers:1|2=2,
 phase=0,overlap=false):MotionFrame{
 const person=(x:number,offset:number):Landmark[]=>{
  const arr:Landmark[]=Array.from({length:33},()=>({x:.5,y:.5,z:0,visibility:0}));
  const put=(i:number,px:number,py:number)=>{arr[i]={x:px,y:py,z:0,visibility:.98};};
  const stride=Math.sin(phase+offset)*.06;
  const swing=Math.max(0,Math.cos(phase+offset))*.035;
  put(11,x-.055,.24);put(12,x+.055,.24);
  put(23,x-.044,.43);put(24,x+.044,.43);
  put(25,x-.052+stride*.4,.64);put(26,x+.052-stride*.4,.64);
  put(27,x-.065+stride,.82-swing);put(28,x+.065-stride,.82+swing*.5);
  put(29,x-.067+stride,.84-swing);put(30,x+.064-stride,.84+swing*.5);
  put(31,x-.04+stride,.85-swing);put(32,x+.094-stride,.85+swing*.5);
  return arr;
 };
 const xs=performers===1?[.5]:overlap?[.48,.52]:[.29,.72];
 const poses=xs.map((x,i)=>person(x,i*1.15));
 return {time:nowMs,tracked:true,source:'camera',pose:poses[0],poses,
  features:{} as MotionFrame['features'],hands:[],face:[],handCount:0,quality:1,
  gesture:'SIMULATION ONLY',posture:'',events:[],framing:true,fps:24};
}
