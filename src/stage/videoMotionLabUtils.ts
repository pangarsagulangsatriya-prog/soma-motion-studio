/** S6.5.2 — playback utilities. Video time is in seconds; no physical floor calibration. */
export const VIDEO_LAB_MAX_BYTES=500*1024*1024;
export const VIDEO_LAB_FPS=[24,25,30,50,60] as const;
export const VIDEO_LAB_SPEEDS=[0.25,0.5,0.75,1,1.25,1.5,2] as const;
export type LoopRange={start:number;end:number};
export type VideoLabFile={name:string;size:number;type:string};
export function validVideoLabFile(file:VideoLabFile):string|null{
 if(!Number.isFinite(file.size)||file.size<=0)return 'Berkas kosong atau tidak valid.';
 if(file.size>VIDEO_LAB_MAX_BYTES)return 'Video maksimal 500 MB. Kompres atau potong berkas terlebih dahulu.';
 if(!/\.(mp4|m4v|webm|ogv|ogg)$/i.test(file.name))return 'Gunakan MP4, WebM, atau Ogg.';
 if(file.type&&file.type!=='application/octet-stream'&&!file.type.startsWith('video/'))return 'Berkas bukan video.';
 return null;
}
export function finiteDuration(n:number):number{return Number.isFinite(n)&&n>0?n:0;}
export function clampVideoTime(time:number,duration:number):number{
 const max=finiteDuration(duration);
 return max?Math.max(0,Math.min(max,Number.isFinite(time)?time:0)):0;
}
export function stepVideoTime(time:number,duration:number,fps:number,direction:-1|1):number{
 const validFPS=Number.isFinite(fps)&&fps>=1&&fps<=120?fps:30;
 return clampVideoTime(time+direction/validFPS,duration);
}
export function validLoopRange(start:number,end:number,duration:number):LoopRange|null{
 const d=finiteDuration(duration);
 if(!d||!Number.isFinite(start)||!Number.isFinite(end))return null;
 const a=clampVideoTime(start,d),b=clampVideoTime(end,d);
 return b-a>=0.05?{start:a,end:b}:null;
}
export function formatVideoTime(sec:number):string{
 const total=Math.max(0,Math.floor(Number.isFinite(sec)?sec*1000:0));
 const ms=total%1000,s=Math.floor(total/1000)%60,m=Math.floor(total/60000)%60,h=Math.floor(total/3600000);
 return [h,m,s].map(n=>String(n).padStart(2,'0')).join(':')+'.'+String(ms).padStart(3,'0');
}
export function simpleVideoFilename(name:string):string{
 return name.replace(/\.[^.]+$/,'').replace(/[^a-zA-Z0-9_-]+/g,'-').replace(/^-+|-+$/g,'').slice(0,60)||'video';
}
