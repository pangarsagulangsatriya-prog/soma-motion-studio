import type {DuetV2Frame} from './duetV2Worker.ts';

type Pending={resolve:(value:unknown)=>void;reject:(reason:Error)=>void;
 timer:ReturnType<typeof setTimeout>};
const error=(e:unknown)=>e instanceof Error?e:Error(String(e));
/** D4: a single transferable bitmap in flight, never a queue of old frames. */
export class DuetV2WorkerClient{
 private worker:Worker;
 private tasks=new Map<number,Pending>();
 private serial=0;
 private disposed=false;
 private busy=false;
 readonly supported=typeof Worker!=='undefined'&&typeof createImageBitmap==='function';
 constructor(){
  if(!this.supported)throw Error('Worker atau createImageBitmap belum tersedia.');
  this.worker=new Worker(new URL('./duetV2Worker.ts',import.meta.url),{type:'module'});
  this.worker.onmessage=event=>{
   const message=event.data as {type:string;id:number;frame?:DuetV2Frame;message?:string};
   const job=this.tasks.get(message.id);if(!job)return;
   this.tasks.delete(message.id);clearTimeout(job.timer);
   if(message.type==='error')job.reject(Error(message.message??'Worker gagal'));
   else job.resolve(message.type==='result'?message.frame:message);
  };
  this.worker.onerror=event=>this.failAll(Error(event.message||'Worker gagal dimuat'));
 }
 get inFlight(){return this.busy;}
 private failAll(reason:Error){
  for(const [id,p] of this.tasks){
   clearTimeout(p.timer);p.reject(reason);this.tasks.delete(id);
  }
  this.busy=false;
 }
 private request(message:Record<string,unknown>,timeoutMs=60000,bitmap?:ImageBitmap){
  if(this.disposed)return Promise.reject(Error('Worker sudah ditutup'));
  return new Promise<unknown>((resolve,reject)=>{
   const id=++this.serial;
   const timer=setTimeout(()=>{
    this.tasks.delete(id);reject(Error('Duet V2 melampaui waktu proses.'));
   },timeoutMs);
   this.tasks.set(id,{resolve,reject,timer});
   try{this.worker.postMessage({...message,id},bitmap?[bitmap]:[]);}
   catch(e){this.tasks.delete(id);clearTimeout(timer);bitmap?.close();reject(error(e));}
  });
 }
 async init(resolution:384|512,detailed=false):Promise<void>{
  await this.request({type:'init',base:import.meta.env.BASE_URL,resolution,detailed},90000);
 }
 async reset():Promise<void>{await this.request({type:'reset'},15000);}
 async frame(video:HTMLVideoElement,timeMs:number,
  options:{detector:boolean;detailed:boolean}):Promise<DuetV2Frame|null>{
  if(this.disposed||this.busy)return null;
  this.busy=true;
  let bitmap:ImageBitmap|null=null;
  try{
   bitmap=await createImageBitmap(video);
   return await this.request({type:'frame',bitmap,timeMs,detector:options.detector,
    detailed:options.detailed},60000,bitmap) as DuetV2Frame;
  }finally{this.busy=false;}
 }
 dispose(){
  if(this.disposed)return;
  this.disposed=true;this.failAll(Error('Worker dihentikan.'));
  this.worker.terminate();
 }
}
