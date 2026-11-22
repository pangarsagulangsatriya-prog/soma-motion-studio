import type {Landmark,MotionFrame} from '../../engine/types.ts';
import type {MultiPoseStatus} from '../../footprints/live/MultiPoseGaitRouter.ts';
import type {ReplayAnalysisSnapshot} from '../../stage/VideoPoseGaitEngine.ts';
import type {FootprintsInputChoice,FootprintsInputPhase} from './sourceSwitchModel.ts';

export type TrackActorFeedback={
 id:'A'|'B';state:'missing'|'unstable'|'partial'|'visible';
 feet:0|1|2;
};
export type TrackFeedback={
 state:'idle'|'waiting'|'framing'|'uncertain'|'ready'|'synthetic';
 label:string;hint:string|null;actors:TrackActorFeedback[];
 visibleFeet:number;expectedFeet:number;
};

/** Visibility of actual MediaPipe foot landmarks, not ground contact.
 * A foot is display-visible only when the ankle, heel and toe are confident
 * and remain inside the image bounds. No interpolated/ghost points count.
 */
export function visiblePoseFeet(pose:readonly Landmark[]|null|undefined):0|1|2{
 if(!pose||pose.length<33)return 0;
 const valid=(index:number)=>{
  const p=pose[index];
  return !!p&&Number.isFinite(p.x)&&Number.isFinite(p.y)&&
   p.x>=.02&&p.x<=.98&&p.y>=.02&&p.y<=.98&&
   (p.visibility===undefined||(Number.isFinite(p.visibility)&&p.visibility>=.45));
 };
 const left=valid(27)&&valid(29)&&valid(31);
 const right=valid(28)&&valid(30)&&valid(32);
 return (Number(left)+Number(right)) as 0|1|2;
}

const missing=(id:'A'|'B'):TrackActorFeedback=>({id,state:'missing',feet:0});
const forPose=(id:'A'|'B',pose:readonly Landmark[]|null|undefined):TrackActorFeedback=>{
 if(!pose||pose.length<33)return missing(id);
 const feet=visiblePoseFeet(pose);
 return {id,feet,state:feet===2?'visible':'partial'};
};
const waiting=(label:string):TrackFeedback=>({
 state:'waiting',label,hint:null,actors:[],visibleFeet:0,expectedFeet:0
});
const resultFor=(actors:TrackActorFeedback[],ambiguous=false):TrackFeedback=>{
 const expectedFeet=actors.length*2;
 const visibleFeet=actors.reduce((n,actor)=>n+actor.feet,0);
 if(ambiguous){
  return {state:'uncertain',label:'Identitas belum stabil',
   hint:'Pisahkan posisi kedua aktor',actors,visibleFeet:0,expectedFeet};
 }
 if(actors.every(a=>a.state==='missing')){
  return {state:'waiting',label:'Mencari tubuh',hint:'Masuk ke bingkai kamera',
   actors,visibleFeet:0,expectedFeet};
 }
 const detected=actors.filter(a=>a.state!=='missing').length;
 if(detected<actors.length){
  return {state:'framing',label:`Aktor ${detected}/${actors.length}`,
   hint:'Pastikan semua aktor masuk bingkai',actors,visibleFeet,expectedFeet};
 }
 if(visibleFeet<expectedFeet){
  return {state:'framing',label:`Kaki terlihat ${visibleFeet}/${expectedFeet}`,
   hint:'Pastikan kedua telapak masuk bingkai',actors,visibleFeet,expectedFeet};
 }
 return {state:'ready',label:`Kaki terlihat ${visibleFeet}/${expectedFeet}`,
  hint:null,actors,visibleFeet,expectedFeet};
};

/** UI-only framing feedback. This never approves gait contacts or projection. */
export function deriveTrackFeedback(input:{
 selection:FootprintsInputChoice|null;phase:FootprintsInputPhase;
 cameraOn:boolean;frameFresh:boolean;performerCount:1|2;
 liveFrame:MotionFrame|null;liveIdentity:MultiPoseStatus|null;
 videoSnapshot:ReplayAnalysisSnapshot|null;videoReady:boolean;
}):TrackFeedback{
 const {selection,phase,cameraOn,frameFresh,performerCount,
  liveFrame,liveIdentity,videoSnapshot,videoReady}=input;
 if(!selection)return {state:'idle',label:'Pilih sumber',hint:null,actors:[],
  visibleFeet:0,expectedFeet:0};
 if(phase==='error')return waiting('Periksa sumber');
 if(phase==='connecting')return waiting('Menghubungkan…');
 if(selection==='simulator')return {
  state:'synthetic',label:'Gerak simulasi',hint:null,actors:[],
  visibleFeet:0,expectedFeet:0
 };
 if(selection==='video'){
  if(!videoReady)return waiting('Pilih atau muat video');
  if(!videoSnapshot)return waiting('Menganalisis video');
  const ambiguous=videoSnapshot.ambiguous;
  const actorIds:( 'A'|'B')[]=performerCount===1?['A']:['A','B'];
  const actors=actorIds.map(id=>{
   if(ambiguous)return {id,state:'unstable',feet:0} as TrackActorFeedback;
   const person=videoSnapshot.people.find(p=>p.id===id);
   return forPose(id,person?.landmarks);
  });
  return resultFor(actors,ambiguous);
 }
 if(phase!=='ready'||!cameraOn)return waiting('Menunggu kamera');
 if(!frameFresh||!liveFrame||liveFrame.source!=='camera'||!liveFrame.tracked)
  return waiting('Mencari tubuh');
 const actorIds:('A'|'B')[]=performerCount===1?['A']:['A','B'];
 if(performerCount===1){
  const pose=liveFrame.pose?.length===33?liveFrame.pose:liveFrame.poses?.[0];
  return resultFor([forPose('A',pose)]);
 }
 const identity=liveIdentity;
 // No A/B claim until the router associates IDs with this exact frame.
 if(identity?.ambiguous)return resultFor(
  actorIds.map((id):TrackActorFeedback=>({id,state:'unstable',feet:0})),true
 );
 if(identity&&identity.visible.length>0&&identity.visible.length<performerCount){
  // Keep the verified partial actor visible instead of erasing their feet
  // while the other performer is cropped or awaiting rescue.
  const sameFrame=identity.observedFrameTime===liveFrame.time;
  const actors=actorIds.map(id=>{
   const index=sameFrame?identity.poseIndices[id]:null;
   return index===null?missing(id):forPose(id,liveFrame.poses?.[index]);
  });
  const visibleFeet=actors.reduce((sum,actor)=>sum+actor.feet,0);
  const missingId=actorIds.find(id=>!identity.visible.includes(id))??'B';
  return {state:'framing',label:`Aktor ${identity.visible.length}/${performerCount}`,
   hint:`Aktor ${missingId} belum terbaca · pastikan kedua aktor terpisah dan terlihat dari kepala sampai kaki`,
   actors,visibleFeet,expectedFeet:performerCount*2};
 }
 if(!identity||identity.observedFrameTime!==liveFrame.time){
  const rawCount=Math.min(liveFrame.poses?.length??0,performerCount);
  return {state:'uncertain',
   label:rawCount?`${rawCount} tubuh · ID diperiksa`:'Mencari dua tubuh',
   hint:rawCount===1?'Pastikan kedua tubuh terlihat penuh dan terpisah':
    'Identitas A/B belum stabil · pisahkan kedua performer',
   actors:actorIds.map((id):TrackActorFeedback=>({id,state:'unstable',feet:0})),
   visibleFeet:0,expectedFeet:performerCount*2};
 }
 const actors=actorIds.map(id=>{
  const index=identity.poseIndices[id];
  return index===null?missing(id):forPose(id,liveFrame.poses?.[index]);
 });
 return resultFor(actors);
}

/** Raw skeletons remain visible for troubleshooting, but their A/B colors
 * are assigned only when a current-frame identity mapping is verified.
 */
export function liveSkeletonPresentation(
 frame:MotionFrame,identity:MultiPoseStatus,performerCount:1|2,
 allowIdentityColors=true
):{poses:Landmark[][];colors:string[]}{
 const poses=frame.poses?.length?frame.poses:(frame.pose?.length?[frame.pose]:[]);
 if(performerCount===1)return {
  poses:poses.slice(0,1),colors:['#d4edb3']
 };
 const a=identity.poseIndices.A,b=identity.poseIndices.B;
 if(allowIdentityColors&&!identity.ambiguous&&identity.observedFrameTime===frame.time&&
  a!==null&&b!==null&&a!==b&&poses[a]&&poses[b]){
  return {poses:[poses[a],poses[b]],colors:['#d4edb3','#88d6e2']};
 }
 return {poses:poses.slice(0,2),colors:['#aab8ad','#aab8ad']};
}

