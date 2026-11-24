import type {Landmark,MotionFrame} from '../../engine/types.ts';
import type {LiveFloorStatus} from '../../footprints/live/LiveFloorTrackingEngine.ts';
import type {MultiPoseStatus} from '../../footprints/live/MultiPoseGaitRouter.ts';

type FootDiagnostic={side:'L'|'R';confidence:number|null;state:'valid'|'partial'|'missing'};
type ActorDiagnostic={id:'A'|'B';state:string;feet:FootDiagnostic[]};
const valid=(p:Landmark|undefined)=>!!p&&Number.isFinite(p.x)&&Number.isFinite(p.y)&&
 p.x>=0&&p.x<=1&&p.y>=0&&p.y<=1&&Number.isFinite(p.visibility)&&(p.visibility??0)>=.55;
const foot=(pose:readonly Landmark[]|undefined,side:0|1):FootDiagnostic=>{
 const points=[27+side,29+side,31+side].map(i=>pose?.[i]);
 const count=points.filter(valid).length;
 return {side:side===0?'L':'R',confidence:count===3?Math.min(...points.map(p=>p!.visibility!)):null,
  state:count===3?'valid':count>0?'partial':'missing'};
};
export function runtimeDiagnostics(input:{
 frame:MotionFrame;identity:MultiPoseStatus;floor:LiveFloorStatus;cameraMatched:boolean;
 now:number;cameraReady:boolean;performers:1|2;paintFps:number|null;
}){
 const {frame,identity,floor,cameraMatched,now,cameraReady,performers,paintFps}=input;
 const age=now-frame.time;
 const fresh=cameraReady&&frame.source==='camera'&&frame.time>0&&Number.isFinite(age)&&age>=0&&age<=450;
 const telemetry=fresh?frame.telemetry:undefined;
 const poses=fresh?(frame.poses?.length?frame.poses:frame.pose.length>=33?[frame.pose]:[]):[];
 const matched=fresh&&!identity.ambiguous&&identity.observedFrameTime===frame.time;
 const actors:ActorDiagnostic[]=(performers===1?['A'] as const:['A','B'] as const).map(id=>{
  const index=identity.poseIndices[id];
  const pose=performers===1?(fresh&&frame.tracked?frame.pose:undefined):matched&&index!==null?frame.poses?.[index]:undefined;
  return {id,state:!fresh?'waiting':pose?(identity.actorStates?.[id]??'observed'):identity.ambiguous?'uncertain':identity.actorStates?.[id]==='lost'?'lost':'missing',
   feet:[foot(pose,0),foot(pose,1)]};
 });
 const assigned=actors.filter(a=>a.state==='observed'||a.state==='confirmed'||a.state==='partial').length;
 const validFeet=actors.flatMap(a=>a.feet).filter(f=>f.state==='valid').length;
 const gaitFeet=actors.flatMap(a=>a.feet.map(f=>({actor:a.id,foot:f}))).filter(({actor,foot:f})=>{
  const i=identity.poseIndices[actor];const p=performers===1?frame.pose:i===null?undefined:frame.poses?.[i];
  return f.state==='valid'&&valid(p?.[23])&&valid(p?.[24]);
 }).length;
 const blocker=!cameraReady?'Aktifkan kamera Body.':!fresh?'Menunggu frame kamera baru.':
  !poses.length?'Detector belum menemukan tubuh.':performers===2&&!matched?'Identitas A/B belum stabil.':
  !validFeet?'Landmark kaki belum lengkap.':!gaitFeet?'Pinggul belum terlihat untuk estimasi gait.':
  !floor.calibrated?'Kalibrasikan lantai pada Map.':!floor.confirmed?'Konfirmasi kalibrasi Map.':
  !cameraMatched?'Sumber kamera berbeda dari kalibrasi.':floor.reason;
 const metric=(n:number|undefined)=>typeof n==='number'&&Number.isFinite(n)&&n>=0?n:null;
 return {fresh,detected:poses.filter(p=>p.length>=33).length,assigned,validFeet,gaitFeet,expectedFeet:performers*2,actors,
  backend:telemetry?.backend??null,poseFps:telemetry?metric(frame.fps):null,
  paintFps:cameraReady&&paintFps!==null?metric(paintFps):null,
  inferenceMs:metric(telemetry?.inferenceMs),pipelineMs:metric(telemetry?.pipelineMs),
  frameAgeMs:fresh?age:null,skippedFrames:metric(telemetry?.skippedFrames),contacts:floor.contacts,blocker};
}
export type RuntimeDiagnostics=ReturnType<typeof runtimeDiagnostics>;
