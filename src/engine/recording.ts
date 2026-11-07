import {uid,type MotionFrame} from './types.ts';
export type Take={id:string;name:string;url:string;blob:Blob;duration:number;created:string;mime:string};
export const download=(blob:Blob,name:string)=>{const u=URL.createObjectURL(blob),a=document.createElement('a');a.href=u;a.download=name;a.click();setTimeout(()=>URL.revokeObjectURL(u),2000);};
export class Recorder {
 private recorder:MediaRecorder|null=null;private chunks:Blob[]=[];private started=0;private timer:ReturnType<typeof setTimeout>|null=null;active=false;
 start(stream:MediaStream,onDone:(take:Take)=>void,onError:(message:string)=>void){
  if(typeof MediaRecorder==='undefined')throw new Error('Browser ini belum mendukung perekaman audio. Coba Chrome atau Edge.');
  const mime=['audio/webm;codecs=opus','audio/webm','audio/mp4','audio/ogg;codecs=opus'].find(t=>MediaRecorder.isTypeSupported(t));
  this.recorder=new MediaRecorder(stream,mime?{mimeType:mime}:undefined);this.chunks=[];this.started=Date.now();this.active=true;
  this.recorder.ondataavailable=e=>{if(e.data.size)this.chunks.push(e.data);};
  this.recorder.onstop=()=>{this.active=false;if(this.timer)clearTimeout(this.timer);const actual=this.recorder?.mimeType||mime||'audio/webm';const blob=new Blob(this.chunks,{type:actual});onDone({id:uid(),name:`SOMA · ${new Date().toLocaleTimeString('id-ID',{hour:'2-digit',minute:'2-digit'})}`,url:URL.createObjectURL(blob),blob,duration:(Date.now()-this.started)/1000,created:new Date().toISOString(),mime:actual});this.chunks=[];};
  this.recorder.onerror=()=>{onError('Perekaman terhenti. Coba rekam lagi.');this.stop();};this.recorder.start(1000);this.timer=setTimeout(()=>{this.stop();onError('Rekaman mencapai 30 menit dan sudah disimpan untuk diunduh.');},30*60*1000);
 }
 stop(){if(this.recorder?.state==='recording')this.recorder.stop();}
}
export class MotionLog {
 enabled=false;rows:{t:number;gesture:string;tracked:boolean;source:string;features:MotionFrame['features']}[]=[];private started=0;private last=0;full=false;
 start(){this.enabled=true;this.started=performance.now();this.last=0;this.full=false;this.rows=[];}
 add(f:MotionFrame){if(!this.enabled||f.time-this.last<90)return;if(this.rows.length>=18000){this.enabled=false;this.full=true;return;}this.last=f.time;this.rows.push({t:Math.round(f.time-this.started),gesture:f.gesture,tracked:f.tracked,source:f.source,features:{...f.features}});}
 export(format:'json'|'csv'){
  if(format==='json')download(new Blob([JSON.stringify({version:1,timeUnit:'milliseconds',frames:this.rows},null,2)],{type:'application/json'}),'soma-motion.json');
  else{const keys=Object.keys(this.rows[0]?.features??{});const csv=['time_ms,gesture,tracked,source,'+keys.join(','),...this.rows.map(r=>[r.t,JSON.stringify(r.gesture),r.tracked,r.source,...Object.values(r.features)].join(','))].join('\n');download(new Blob([csv],{type:'text/csv'}),'soma-motion.csv');}
 }
}
