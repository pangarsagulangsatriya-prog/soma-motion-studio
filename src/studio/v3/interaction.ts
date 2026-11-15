/** Small, testable UI decisions. The camera and projection engines remain the source of truth. */
export type CameraState='mouse'|'loading'|'error'|'off'|'tracking'|'lost'|'searching';
export type CameraView={state:CameraState;label:string;hint:string};
export function cameraView(input:{source:'mouse'|'camera';busy:boolean;error:string;cameraOn:boolean;tracked:boolean;hadTracking?:boolean;input:string}):CameraView{
 if(input.source==='mouse')return {state:'mouse',label:'Mouse siap',hint:'Seret pointer pada kanvas untuk simulasi gerak.'};
 if(input.busy)return {state:'loading',label:'Menghubungkan kamera…',hint:'Memuat pelacak gerak. Jangan tutup tab.'};
 if(input.error)return {state:'error',label:'Kamera gagal',hint:input.error};
 if(!input.cameraOn)return {state:'off',label:'Kamera mati',hint:'Aktifkan kamera untuk mulai mendeteksi gerak.'};
 if(input.tracked)return {state:'tracking',label:'Gerak terbaca',hint:'Pelacakan aktif. Silakan bergerak.'};
 if(input.hadTracking)return {state:'lost',label:'Tracking terputus',hint:'Kembali ke dalam bingkai kamera dan pastikan tubuh terlihat.'};
 return {state:'searching',label:input.input==='body'?'Mencari tubuh…':input.input==='face'?'Mencari wajah…':'Mencari tangan…',hint:'Masuk ke jangkauan kamera dan pastikan pencahayaan cukup.'};
}
export const bodyConnectionRequired=(scene:string,input:string,cameraOn:boolean)=>scene==='footprints'&&(input!=='body'||!cameraOn);
export const patternExportReady=(selected:boolean,count:number)=>selected&&Number.isInteger(count)&&count>0;
export function formatElapsed(seconds:number){
 const s=Math.max(0,Math.floor(Number.isFinite(seconds)?seconds:0));
 return String(Math.floor(s/60)).padStart(2,'0')+':'+String(s%60).padStart(2,'0');
}
export function stoppingVideoRequiresConfirmation(videoRecording:boolean,fromScene:string,toScene:string){
 return videoRecording&&fromScene==='footprints'&&toScene!=='footprints';
}

/** Arrow-key navigation in a compact tablist, without changing global shortcuts. */
export function nextTab<T extends string>(tabs:readonly T[],current:T,direction:-1|1):T{
 if(!tabs.length)return current;
 const index=tabs.indexOf(current),at=index<0?0:index;
 return tabs[(at+direction+tabs.length)%tabs.length];
}
