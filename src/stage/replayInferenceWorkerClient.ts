import type {Landmark} from '../engine/types.ts';
import type {D3Guide,D3Report} from './duetPose33.ts';
export type ReplayWorkerBoot={runtime:'classic';poseReady:boolean;d3Ready:boolean;
 initMs:number;d3Reason?:string};
export type ReplayWorkerResult={
 landmarks:Landmark[][];worldLandmarks:Landmark[][];poseMs:number;rescuedCount?:number;
 appearance?:(number[]|null)[];d3?:D3Report;
};
type Pending={
 id:number;resolve:(data:ReplayWorkerResult)=>void;reject:(e:Error)=>void;
 timeout:ReturnType<typeof setTimeout>;
};
export class ReplayInferenceWorkerClient{
 private worker:Worker;
 boot:ReplayWorkerBoot|null=null;
 private pending:Pending|null=null;
 private stopped=false;
 private capturing=false;
 private cancelBoot:((reason:Error)=>void)|null=null;
 private serial=0;
 constructor(){
  // Prebuilt IIFE is a classic worker in dev and production: MediaPipe WASM
  // invokes importScripts(), which throws inside a module Worker.
  this.worker=new Worker(import.meta.env.BASE_URL+'workers/replay-inference-classic.js',
   {type:'classic',name:'soma-mp-pose-classic'});
 }
 init():Promise<void>{
  if(this.stopped)return Promise.reject(Error('Worker telah dihentikan.'));
  return new Promise((resolve,reject)=>{
   const timeout=setTimeout(()=>{
    this.cancelBoot?.(Error('Worker inference tidak siap setelah 30 detik.'));
   },30000);
   const clean=()=>{clearTimeout(timeout);this.worker.removeEventListener('message',receive);this.cancelBoot=null;};
   this.cancelBoot=reason=>{clean();reject(reason);};
   const receive=(event:MessageEvent)=>{
    const data=event.data;
    if(data.type!=='ready'&&data.type!=='error')return;
    clean();
    if(data.type==='error'){reject(Error(data.message??'Worker gagal'));return;}
    this.boot={runtime:data.runtime==='classic'?'classic':'classic',
     poseReady:data.poseReady===true,d3Ready:data.d3Ready===true,
     initMs:Number(data.initMs)||0,d3Reason:data.d3Reason};
    if(!this.boot.poseReady){reject(Error('Worker siap tanpa model pose.'));return;}
    this.worker.onmessage=message=>this.receive(message.data);
    this.worker.onerror=()=>this.fail(Error('Worker inference terputus.'));
    resolve();
   };
   this.worker.addEventListener('message',receive);
   this.worker.onerror=event=>{
    this.cancelBoot?.(Error('Worker classic gagal: '+(event.message||'runtime tidak tersedia.')));
   };
   try{this.worker.postMessage({type:'init',base:import.meta.env.BASE_URL});}
   catch(error){this.cancelBoot?.(error instanceof Error?error:Error(String(error)));}
  });
 }
 async detect(video:HTMLVideoElement,clock:number,targetCount:1|2=1,guides:D3Guide[]=[]):Promise<ReplayWorkerResult>{
  if(this.stopped||this.pending||this.capturing)throw Error('Worker inference masih sibuk.');
  this.capturing=true;
  let bitmap:ImageBitmap;
  try{bitmap=await createImageBitmap(video);}
  finally{this.capturing=false;}
  if(this.stopped){bitmap.close();throw Error('Worker telah dihentikan.');}
  return new Promise((resolve,reject)=>{
   const id=++this.serial;
   const timeout=setTimeout(()=>this.fail(Error('Worker inference melebihi 2 detik.')),2000);
   this.pending={id,resolve,reject,timeout};
   try{this.worker.postMessage({type:'frame',id,bitmap,clock,targetCount,guides},[bitmap]);}
   catch(e){bitmap.close();this.fail(e instanceof Error?e:Error(String(e)));}
  });
 }
 private receive(data:ReplayWorkerResult&{type:string;id:number;message?:string}){
  if(!this.pending||this.pending.id!==data.id)return;
  const p=this.pending;this.pending=null;clearTimeout(p.timeout);
  if(data.type==='result')p.resolve(data);
  else p.reject(Error(data.message??'Deteksi worker gagal.'));
 }
 private fail(reason:Error){
  if(!this.pending)return;
  const p=this.pending;this.pending=null;clearTimeout(p.timeout);p.reject(reason);
 }
 dispose(){
  if(this.stopped)return;
  this.stopped=true;this.cancelBoot?.(Error('Worker dihentikan saat memuat model.'));this.fail(Error('Worker dihentikan.'));
  this.worker.terminate();
 }
}
