import type {Landmark} from '../engine/types.ts';
import type {VideoActorAssignment,VideoActorId,VideoActorState,VideoActorPresence}
 from './videoAutoActorTracker.ts';

/**
 * S6.8.8.3: a local, bounded, replay-only motion trace.
 * Positions use normalized MediaPipe image coordinates; velocity and acceleration
 * are normalized-image units/second and units/second², NOT meters or physical forces.
 * Depth z is only MediaPipe's relative estimated depth.
 */
export type TemporalJoint={
 index:number;visibility:number;
 x:number;y:number;z:number; // raw observation, image-normalized
 smoothX:number;smoothY:number;smoothZ:number; // time-aware EMA
 vx:number|null;vy:number|null;vz:number|null; // units/s
 ax:number|null;ay:number|null;az:number|null; // units/s²
 speed:number|null;acceleration:number|null; // image-plane magnitudes
};
export type TemporalAngle={
 joint:number;name:string;degrees:number;
};
export type TemporalActorSample={
 id:VideoActorId;presence:VideoActorPresence;
 joints:TemporalJoint[];angles:TemporalAngle[];
};
export type TemporalFrame={atMs:number;actors:TemporalActorSample[]};
export type TemporalTracePoint={
 atMs:number;x:number|null;y:number|null;z:number|null;
 smoothX:number|null;smoothY:number|null;smoothZ:number|null;
 vx:number|null;vy:number|null;vz:number|null;
 ax:number|null;ay:number|null;az:number|null;
 speed:number|null;acceleration:number|null;angleDeg:number|null;
 visibility:number|null;
};
export const TEMPORAL_WINDOW_FRAMES=360;
export const TEMPORAL_SMOOTH_TAU_MS=130;
export const TEMPORAL_MAX_GAP_MS=450;
export const TEMPORAL_MIN_VISIBILITY=.5;
const ACTORS=['A','B'] as const;
type Coordinates={x:number;y:number;z:number};
type Previous=Coordinates&{
 atMs:number;vx:number|null;vy:number|null;vz:number|null;
};
export const TEMPORAL_JOINT_NAMES=[
 'Hidung','Mata kiri dalam','Mata kiri','Mata kiri luar',
 'Mata kanan dalam','Mata kanan','Mata kanan luar',
 'Telinga kiri','Telinga kanan','Mulut kiri','Mulut kanan',
 'Bahu kiri','Bahu kanan','Siku kiri','Siku kanan',
 'Pergelangan tangan kiri','Pergelangan tangan kanan',
 'Kelingking kiri','Kelingking kanan','Telunjuk kiri','Telunjuk kanan',
 'Ibu jari kiri','Ibu jari kanan','Pinggul kiri','Pinggul kanan',
 'Lutut kiri','Lutut kanan','Pergelangan kaki kiri','Pergelangan kaki kanan',
 'Tumit kiri','Tumit kanan','Ujung kaki kiri','Ujung kaki kanan'
] as const;
export const TEMPORAL_ANGLE_TRIPLES=[
 {name:'Bahu kiri',points:[13,11,23]}, {name:'Bahu kanan',points:[14,12,24]},
 {name:'Siku kiri',points:[11,13,15]}, {name:'Siku kanan',points:[12,14,16]},
 {name:'Pergelangan tangan kiri',points:[13,15,19]},
 {name:'Pergelangan tangan kanan',points:[14,16,20]},
 {name:'Pinggul kiri',points:[11,23,25]}, {name:'Pinggul kanan',points:[12,24,26]},
 {name:'Lutut kiri',points:[23,25,27]}, {name:'Lutut kanan',points:[24,26,28]},
 {name:'Pergelangan kaki kiri',points:[25,27,31]},
 {name:'Pergelangan kaki kanan',points:[26,28,32]}
] as const;
const finite=(n:number)=>Number.isFinite(n);
const valid=(p:Landmark|undefined)=>!!p&&finite(p.x)&&finite(p.y)&&finite(p.z)&&
 p.x>=0&&p.x<=1&&p.y>=0&&p.y<=1&&
 (p.visibility===undefined||(finite(p.visibility)&&p.visibility>=TEMPORAL_MIN_VISIBILITY));
const norm=(x:number,y:number)=>Math.hypot(x,y);

/** Angle at vertex b from three projected image points. Undefined when hidden. */
export function angle2D(a:Coordinates,b:Coordinates,c:Coordinates):number|null{
 const ux=a.x-b.x,uy=a.y-b.y,vx=c.x-b.x,vy=c.y-b.y;
 const lu=norm(ux,uy),lv=norm(vx,vy);
 if(lu<1e-6||lv<1e-6)return null;
 return Math.acos(Math.max(-1,Math.min(1,(ux*vx+uy*vy)/(lu*lv))))*180/Math.PI;
}
function copyFrame(f:TemporalFrame):TemporalFrame{
 return {atMs:f.atMs,actors:f.actors.map(a=>({
  id:a.id,presence:a.presence,
  joints:a.joints.map(j=>({...j})),angles:a.angles.map(angle=>({...angle}))
 }))};
}
export class TemporalJointAnalyzer{
 private previous=new Map<VideoActorId,Map<number,Previous>>();
 private frames:TemporalFrame[]=[];
 private lastTime=-1;
 reset(){this.previous.clear();this.frames=[];this.lastTime=-1;}
 get frameCount(){return this.frames.length;}
 get latest():TemporalFrame|null{
  const f=this.frames[this.frames.length-1];return f?copyFrame(f):null;
 }
 /** Bounded to the last 360 *sampled* video frames; never stored in browser storage. */
 get window():TemporalFrame[]{return this.frames.map(copyFrame);}
 observe(assignments:readonly VideoActorAssignment[],
  actorStates:readonly VideoActorState[],atMs:number):TemporalFrame{
  if(!finite(atMs)||atMs<0||this.lastTime>=0&&atMs<=this.lastTime)
   throw Error('Timestamp joint harus bergerak maju.');
  // A discontinuity cannot carry velocities between unrelated video frames.
  if(this.lastTime>=0&&atMs-this.lastTime>TEMPORAL_MAX_GAP_MS)
   this.previous.clear();
  const actorSamples=ACTORS.map((id:VideoActorId):TemporalActorSample=>{
   const a=assignments.find(item=>item.id===id);
   const state=actorStates.find(item=>item.id===id);
   const presence=a?'visible':state?.presence??'not-detected';
   if(!a){
    this.previous.delete(id);
    return {id,presence,joints:[],angles:[]};
   }
   const before=this.previous.get(id)??new Map<number,Previous>();
   const next=new Map<number,Previous>();
   const joints:TemporalJoint[]=[];
   const coord=new Map<number,Coordinates>();
   for(let index=0;index<33;index++){
    const pose=a.pose[index];
    if(!valid(pose))continue;
    const p={x:pose.x,y:pose.y,z:pose.z};
    const old=before.get(index);
    const dt=old?(atMs-old.atMs)/1000:0;
    const continuous=!!old&&dt>=.005&&dt<=TEMPORAL_MAX_GAP_MS/1000;
    const alpha=continuous?1-Math.exp(-(dt*1000)/TEMPORAL_SMOOTH_TAU_MS):1;
    const sx=continuous?old!.x+alpha*(p.x-old!.x):p.x;
    const sy=continuous?old!.y+alpha*(p.y-old!.y):p.y;
    const sz=continuous?old!.z+alpha*(p.z-old!.z):p.z;
    const vx=continuous?(sx-old!.x)/dt:null;
    const vy=continuous?(sy-old!.y)/dt:null;
    const vz=continuous?(sz-old!.z)/dt:null;
    const ax=continuous&&old!.vx!==null&&vx!==null?(vx-old!.vx)/dt:null;
    const ay=continuous&&old!.vy!==null&&vy!==null?(vy-old!.vy)/dt:null;
    const az=continuous&&old!.vz!==null&&vz!==null?(vz-old!.vz)/dt:null;
    const speed=vx!==null&&vy!==null?norm(vx,vy):null;
    const acceleration=ax!==null&&ay!==null?norm(ax,ay):null;
    joints.push({index,visibility:pose.visibility??1,
     x:p.x,y:p.y,z:p.z,smoothX:sx,smoothY:sy,smoothZ:sz,
     vx,vy,vz,ax,ay,az,speed,acceleration});
    next.set(index,{x:sx,y:sy,z:sz,atMs,vx,vy,vz});
    coord.set(index,{x:sx,y:sy,z:sz});
   }
   this.previous.set(id,next);
   const angles:TemporalAngle[]=[];
   for(const item of TEMPORAL_ANGLE_TRIPLES){
    const [i,j,k]=item.points;
    const a1=coord.get(i),b1=coord.get(j),c1=coord.get(k);
    if(!a1||!b1||!c1)continue;
    const degrees=angle2D(a1,b1,c1);
    if(degrees!==null)angles.push({joint:j,name:item.name,degrees});
   }
   return {id,presence,joints,angles};
  });
  const frame={atMs,actors:actorSamples};
  this.frames.push(frame);
  if(this.frames.length>TEMPORAL_WINDOW_FRAMES)this.frames.shift();
  this.lastTime=atMs;
  return copyFrame(frame);
 }
 getTrace(actor:VideoActorId,joint:number):TemporalTracePoint[]{
  if(!Number.isInteger(joint)||joint<0||joint>=33)return [];
  return this.frames.map(frame=>{
   const a=frame.actors.find(item=>item.id===actor);
   const v=a?.joints.find(item=>item.index===joint);
   const angle=a?.angles.find(item=>item.joint===joint);
   return {atMs:frame.atMs,
    x:v?.x??null,y:v?.y??null,z:v?.z??null,
    smoothX:v?.smoothX??null,smoothY:v?.smoothY??null,
    smoothZ:v?.smoothZ??null,vx:v?.vx??null,vy:v?.vy??null,vz:v?.vz??null,
    ax:v?.ax??null,ay:v?.ay??null,az:v?.az??null,
    speed:v?.speed??null,acceleration:v?.acceleration??null,
    angleDeg:angle?.degrees??null,visibility:v?.visibility??null};
  });
 }
}

/** Portable local export; bounded and explicitly scoped to current replay segment. */
export function temporalTraceCsv(trace:TemporalTracePoint[]):string{
 const columns=['video_ms','x','y','z_relative','smooth_x','smooth_y','smooth_z',
  'velocity_x_per_s','velocity_y_per_s','velocity_z_relative_per_s',
  'accel_x_per_s2','accel_y_per_s2','accel_z_relative_per_s2',
  'speed_2d_per_s','accel_2d_per_s2','angle_deg','visibility'];
 const keys=['atMs','x','y','z','smoothX','smoothY','smoothZ','vx','vy','vz',
  'ax','ay','az','speed','acceleration','angleDeg','visibility'] as const;
 const rows=trace.map(p=>keys.map(key=>p[key]===null?'':String(p[key])).join(','));
 return [columns.join(','),...rows].join('\r\n')+'\r\n';
}
