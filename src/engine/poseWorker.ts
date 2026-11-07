import type {Landmark} from './types';
import type {BodyMask} from '../studio/bodyField';
export type WorkerPose={landmarks:Landmark[][];worldLandmarks:Landmark[][];segmentation?:BodyMask;projectionMask?:BodyMask;inferenceMs:number};
export class PoseWorkerClient{
 private worker:Worker;private pending:{resolve:(value:WorkerPose)=>void;reject:(error:Error)=>void;timer:ReturnType<typeof setTimeout>}|null=null;private stopped=false;
 constructor(){this.worker=new Worker('/workers/soma-pose.js');}
 init():Promise<void>{return new Promise((resolve,reject)=>{const timer=setTimeout(()=>reject(Error('Worker pose tidak merespons.')),15000);this.worker.onerror=()=>{clearTimeout(timer);reject(Error('Worker pose belum didukung.'));};this.worker.onmessage=e=>{clearTimeout(timer);if(e.data.type==='ready'){this.worker.onmessage=message=>this.receive(message.data);this.worker.onerror=()=>this.fail(Error('Worker pose terputus.'));resolve();}else reject(Error(e.data.message||'Worker belum siap.'));};this.worker.postMessage({type:'init'});});}
 async detect(video:HTMLVideoElement,time:number,projection:boolean):Promise<WorkerPose>{
  if(this.pending||this.stopped)throw Error('Worker pose belum tersedia.');const bitmap=await createImageBitmap(video);if(this.stopped){bitmap.close();throw Error('Worker dihentikan.');}
  return new Promise((resolve,reject)=>{const timer=setTimeout(()=>this.fail(Error('Worker pose melewati batas waktu. Sambungkan ulang Body.')),3000);this.pending={resolve,reject,timer};try{this.worker.postMessage({type:'frame',bitmap,time,projection},[bitmap]);}catch(e){bitmap.close();this.fail(e as Error);}});
 }
 private receive(data:WorkerPose&{type:string;message?:string}){const p=this.pending;if(!p)return;this.pending=null;clearTimeout(p.timer);if(data.type==='result')p.resolve(data);else p.reject(Error(data.message||'Deteksi worker gagal.'));}
 private fail(error:Error){if(this.pending){clearTimeout(this.pending.timer);this.pending.reject(error);this.pending=null;}}
 dispose(){this.stopped=true;this.fail(Error('Worker dihentikan.'));this.worker.terminate();}
}
