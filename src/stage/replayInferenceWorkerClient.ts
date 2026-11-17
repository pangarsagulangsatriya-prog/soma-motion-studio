import type {Landmark} from '../engine/types.ts';
export type ReplayWorkerResult={
 landmarks:Landmark[][];worldLandmarks:Landmark[][];poseMs:number;
};
type Pending={
 id:number;resolve:(data:ReplayWorkerResult)=>void;reject:(e:Error)=>void;
 timeout:ReturnType<typeof setTimeout>;
};
export class ReplayInferenceWorkerClient{
 private worker:Worker;
 private pending:Pending|null=null;
 private stopped=false;
 private serial=0;
 constructor(){
  this.worker=new Worker(new URL('./replayInferenceWorker.ts',import.meta.url),{type:'module'});
 }
 init():Promise<void>{
  return new Promise((resolve,reject)=>{
   const timeout=setTimeout(()=>{
    this.worker.removeEventListener('message',receive);reject(Error('Worker inference tidak siap.'));
   },18000);
   const receive=(event:MessageEvent)=>{
    const data=event.data;
    if(data.type!=='ready'&&data.type!=='error')return;
    clearTimeout(timeout);this.worker.removeEventListener('message',receive);
    if(data.type==='error'){reject(Error(data.message??'Worker gagal'));return;}
    this.worker.onmessage=message=>this.receive(message.data);
    this.worker.onerror=()=>this.fail(Error('Worker inference terputus.'));
    resolve();
   };
   this.worker.addEventListener('message',receive);
   this.worker.onerror=()=>{clearTimeout(timeout);reject(Error('Worker tidak tersedia.'));};
   this.worker.postMessage({type:'init',base:import.meta.env.BASE_URL});
  });
 }
 async detect(video:HTMLVideoElement,clock:number):Promise<ReplayWorkerResult>{
  if(this.stopped||this.pending)throw Error('Worker inference masih sibuk.');
  const bitmap=await createImageBitmap(video);
  if(this.stopped){bitmap.close();throw Error('Worker telah dihentikan.');}
  return new Promise((resolve,reject)=>{
   const id=++this.serial;
   const timeout=setTimeout(()=>this.fail(Error('Worker inference melebihi 2 detik.')),2000);
   this.pending={id,resolve,reject,timeout};
   try{this.worker.postMessage({type:'frame',id,bitmap,clock},[bitmap]);}
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
  this.stopped=true;this.fail(Error('Worker dihentikan.'));
  this.worker.terminate();
 }
}
