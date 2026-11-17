import type {Landmark} from '../engine/types.ts';

/**
 * Full MediaPipe Pose Landmarker topology (33 indexed pose landmarks).
 * This draws observed pose landmarks only; no missing joints are fabricated.
 * 3D bone measurements and biometric person identity are NOT inferred here.
 */
export const POSE_LANDMARK_COUNT=33;
export const POSE_CONNECTIONS=[
 [0,1],[1,2],[2,3],[3,7],[0,4],[4,5],[5,6],[6,8],[9,10],
 [11,12],[11,13],[13,15],[15,17],[15,19],[15,21],[17,19],
 [12,14],[14,16],[16,18],[16,20],[16,22],[18,20],
 [11,23],[12,24],[23,24],[23,25],[25,27],[27,29],[29,31],[27,31],
 [24,26],[26,28],[28,30],[30,32],[28,32]
] as const;
export const SKELETON_COLORS=['#d4edb3','#88d6e2'] as const;
export type SkeletonLevel='clear'|'uncertain';
export type SkeletonJoint={index:number;x:number;y:number;level:SkeletonLevel};
export type SkeletonBone={from:number;to:number;level:SkeletonLevel};
export type SkeletonGeometry={joints:SkeletonJoint[];bones:SkeletonBone[]};
export type SkeletonRect={x:number;y:number;width:number;height:number};

function jointAt(pose:readonly Landmark[],index:number,threshold:number):SkeletonJoint|null{
 const p=pose[index];
 if(!p||!Number.isFinite(p.x)||!Number.isFinite(p.y)||p.x<0||p.x>1||p.y<0||p.y>1)return null;
 const visibility=p.visibility;
 if(visibility!==undefined&&(!Number.isFinite(visibility)||visibility<threshold))return null;
 return {index,x:p.x,y:p.y,level:visibility!==undefined&&visibility<.55?'uncertain':'clear'};
}
/** Pure skeleton geometry suitable for tests and any source: camera, phone, MP4. */
export function skeletonGeometry(pose:readonly Landmark[],minVisibility=.2):SkeletonGeometry{
 if(pose.length<POSE_LANDMARK_COUNT)return {joints:[],bones:[]};
 const joints=Array.from({length:POSE_LANDMARK_COUNT},(_,i)=>jointAt(pose,i,minVisibility))
  .filter((x):x is SkeletonJoint=>x!==null);
 const index=new Map(joints.map(point=>[point.index,point]));
 const bones:SkeletonBone[]=[];
 for(const [from,to] of POSE_CONNECTIONS){
  const a=index.get(from),b=index.get(to);
  if(!a||!b)continue;
  bones.push({from,to,level:a.level==='clear'&&b.level==='clear'?'clear':'uncertain'});
 }
 return {joints,bones};
}
/** Keep diagnostic skeletons independent from a blocked gait/identity event gate.
 * Replay snapshots contain only coordinates from the last analyzed video frame.
 */
export function replaySkeletonsCurrent(snapshot:{
 atMs:number;rawPoses?:Landmark[][];
},videoTimeMs:number,maxDriftMs=260):Landmark[][]{
 if(!Number.isFinite(videoTimeMs)||!Number.isFinite(snapshot.atMs)||
  Math.abs(snapshot.atMs-videoTimeMs)>maxDriftMs)return [];
 return (snapshot.rawPoses??[]).filter(p=>p.length>=POSE_LANDMARK_COUNT).slice(0,2);
}
export function drawSkeletonBodies(
 ctx:CanvasRenderingContext2D,poses:readonly (readonly Landmark[])[],
 rect:SkeletonRect,options:{labels?:boolean;lineWidth?:number;minVisibility?:number}={}
):number{
 if(!Number.isFinite(rect.x)||!Number.isFinite(rect.y)||
  !Number.isFinite(rect.width)||!Number.isFinite(rect.height)||
  rect.width<=0||rect.height<=0)return 0;
 let drawn=0;
 const size=Math.max(1,Math.min(rect.width,rect.height));
 const width=options.lineWidth??Math.max(1.4,Math.min(3.2,size/150));
 ctx.save();
 try{
  for(const [i,pose] of poses.slice(0,2).entries()){
   const geometry=skeletonGeometry(pose,options.minVisibility);
   if(!geometry.joints.length)continue;
   drawn++;
   const color=SKELETON_COLORS[i];
   const points=new Map(geometry.joints.map(p=>[p.index,p]));
   ctx.save();
   ctx.lineCap='round';ctx.lineJoin='round';
   for(const bone of geometry.bones){
    const a=points.get(bone.from)!,b=points.get(bone.to)!;
    ctx.beginPath();ctx.strokeStyle=color;ctx.globalAlpha=bone.level==='clear'?.94:.35;
    ctx.lineWidth=width;ctx.setLineDash(bone.level==='uncertain'?[3,4]:[]);
    ctx.moveTo(rect.x+a.x*rect.width,rect.y+a.y*rect.height);
    ctx.lineTo(rect.x+b.x*rect.width,rect.y+b.y*rect.height);
    ctx.stroke();
   }
   ctx.setLineDash([]);
   for(const point of geometry.joints){
    ctx.globalAlpha=point.level==='clear'?1:.38;
    ctx.beginPath();ctx.arc(rect.x+point.x*rect.width,rect.y+point.y*rect.height,
     point.level==='clear'?width*1.45:width*1.2,0,Math.PI*2);
    ctx.fillStyle=color;ctx.fill();
   }
   if(options.labels!==false){
    const anchor=points.get(11)??points.get(12)??points.get(0)??geometry.joints[0];
    ctx.globalAlpha=1;ctx.fillStyle=color;
    ctx.font='bold 11px system-ui,sans-serif';ctx.textBaseline='bottom';
    ctx.fillText('POSE '+(i+1),rect.x+anchor.x*rect.width+7,
     Math.max(rect.y+13,rect.y+anchor.y*rect.height-5));
   }
   ctx.restore();
  }
 }finally{ctx.restore();}
 return drawn;
}
