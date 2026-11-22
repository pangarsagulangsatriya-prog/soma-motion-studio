import type {MotionFrame} from '../../../engine/types.ts';
import type {MultiPoseStatus} from '../../live/MultiPoseGaitRouter.ts';
import type {ExperimentalFrame} from '../../../studio/v3/experimentSourceModel.ts';
import {demoFootSamples} from '../FootLineSampleAdapter.ts';
import {floorToUV} from '../../spatial/coordinates.ts';
import {resolvePoseFeet,fromLegacySample,type FootV3Sample} from './FootPositionResolver.ts';

export type V3Input={
 sourceKey:string;frameMs:number;presentationMs:number;
 samples:FootV3Sample[];ready:boolean;paused:boolean;seeking:boolean;
 status:string;source:'camera'|'phone'|'video'|'simulator'|'demo';
};
export type V3InputOptions={
 nowMs:number;demo:boolean;demoStart:number;
 experimentSource:'video'|'simulator'|null;
 experiment:ExperimentalFrame|null;live:MotionFrame|null;cameraOn:boolean;
 bodySelected:boolean;performers:1|2;status:MultiPoseStatus;
 sourceKind:'camera'|'phone';motionSession:string;
};
const raw=(ms:number)=>Number.isFinite(ms)&&ms>=0?ms:-1;
const clipTokens=new WeakMap<File,number>();
let clipSerial=0;
function clipIdentity(file:File|null|undefined,fallback:string):string{
 if(!file)return fallback;
 let token=clipTokens.get(file);
 if(token===undefined){token=++clipSerial;clipTokens.set(file,token);}
 return file.name+':'+file.size+':'+file.lastModified+':'+token;
}
const meta=(id:string,source:'camera'|'phone'|'video'|'simulator',atMs:number,actorId:string)=>
 ({sessionId:id,generation:0,source,atMs,actorId,
  coordinateBasis:source==='simulator'?'simulated' as const:'image-2d' as const});
const empty=(source:V3Input['source'],sourceKey:string,frameMs:number,presentationMs:number,
 status:string,extra:Partial<Pick<V3Input,'paused'|'seeking'|'ready'>>={}):V3Input=>
 ({source,sourceKey,frameMs,presentationMs,status,samples:[],ready:false,paused:false,seeking:false,...extra});

/** Normalize every data source to one 1P/2P × left/right observation batch.
 * The app NEVER requests a second camera or a second pose detector.
 */
export function normalizeTrajectoryInput(o:V3InputOptions):V3Input{
 const {nowMs,experimentSource,experiment,status,sourceKind,performers}=o;
 if(o.demo){
  const sourceKey='demo:v3';
  return {source:'demo',sourceKey,frameMs:nowMs,presentationMs:nowMs,
   samples:demoFootSamples(nowMs,o.demoStart).map(fromLegacySample),
   ready:true,paused:false,seeking:false,status:'DEMO · 2 kaki simulasi'};
 }
 if(experimentSource==='video'){
  const f=experiment?.kind==='video'?experiment:null;
  const clip=f?.clip;
  const identity=clipIdentity(clip,f?.name??'none');
  const snap=f?.snapshot;
  const segment=snap?.segment??0;
  const sourceKey='video:'+identity+':'+segment+':'+performers;
  const mediaMs=f?raw(f.video?.currentTime===undefined?f.timeMs:f.video.currentTime*1000):0;
  const frameMs=snap?.atMs??-1;
  if(!f||!f.ready||!f.video||f.video.readyState<2)
   return empty('video',sourceKey,frameMs,mediaMs,'MP4 · memuat video/pose');
  if(f.video.seeking)
   return empty('video',sourceKey,frameMs,mediaMs,'MP4 · seek', {seeking:true});
  if(!snap)return empty('video',sourceKey,-1,mediaMs,'MP4 · menunggu hasil deteksi');
  const lag=Math.abs(mediaMs-snap.atMs);
  // Never paint a pose from an unrelated point of the timeline.
  if(lag>320)return empty('video',sourceKey,frameMs,mediaMs,'MP4 · analisis tertunda');
  const samples=snap.ambiguous?[]:snap.people.flatMap(p=>
   resolvePoseFeet(p.landmarks,meta(identity,'video',snap.atMs,p.id)));
  return {source:'video',sourceKey,frameMs,presentationMs:mediaMs,samples,
   ready:true,paused:f.video.paused,seeking:false,
   status:snap.ambiguous?'MP4 · identitas belum stabil':
    samples.length?'MP4 · '+samples.length+' kaki terbaca':'MP4 · kaki belum terdeteksi'};
 }
 if(experimentSource==='simulator'){
  const f=experiment?.kind==='simulator'?experiment:null;
  const sourceKey='simulator:'+ (f?.name??'none')+':'+performers;
  if(!f)return empty('simulator',sourceKey,-1,nowMs,'Simulasi belum siap');
  const samples:FootV3Sample[]=f.performers.flatMap(p=>
   (['left','right'] as const).map(foot=>{
    const uv=floorToUV(f.session.floor,p[foot].positionM);
    return {...meta(f.name,'simulator',f.timeMs,p.id),foot,x:uv.x,y:uv.y,
     confidence:1,anchor:'simulated' as const};
   }));
  return {source:'simulator',sourceKey,frameMs:f.timeMs,presentationMs:f.timeMs,
   samples,ready:true,paused:false,seeking:false,status:'Simulasi · '+samples.length+' kaki'};
 }
 const f=o.live;
 const sourceKey='track:'+sourceKind+':'+o.motionSession+':'+performers;
 if(!o.cameraOn||!o.bodySelected||!f||f.source!=='camera'||f.time<=0)
  return empty(sourceKind,sourceKey,-1,nowMs,'Track · menunggu kamera');
 if(nowMs-f.time>550||nowMs<f.time)
  return empty(sourceKind,sourceKey,f.time,nowMs,'Track · frame tertunda');
 if(performers===1){
  const samples=f.tracked?resolvePoseFeet(f.pose,meta(o.motionSession,sourceKind,f.time,'performer-1')):[];
  return {source:sourceKind,sourceKey,frameMs:f.time,presentationMs:nowMs,
   samples,ready:true,paused:false,seeking:false,
   status:samples.length?'Track · '+samples.length+' kaki terbaca':'Track · belum mendeteksi kaki'};
 }
 if(status.ambiguous||status.observedFrameTime!==f.time){
  return {source:sourceKind,sourceKey,frameMs:f.time,presentationMs:nowMs,
   samples:[],ready:true,paused:false,seeking:false,status:'Track · identitas A/B belum stabil'};
 }
 const samples:FootV3Sample[]=[];
 for(const actor of ['A','B'] as const){
  const i=status.poseIndices[actor];
  if(i!==null&&f.poses?.[i])
   samples.push(...resolvePoseFeet(f.poses[i],meta(o.motionSession,sourceKind,f.time,actor)));
 }
 return {source:sourceKind,sourceKey,frameMs:f.time,presentationMs:nowMs,
  samples,ready:true,paused:false,seeking:false,
  status:samples.length?'Track 2P · '+samples.length+' kaki':'Track · kaki tidak terlihat'};
}
