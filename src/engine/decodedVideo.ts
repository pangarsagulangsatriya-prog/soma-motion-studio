/** A connected MediaStream is not evidence of decoded video. Bound startup and
 * reject ended streams; never depend on a pose being present to show camera pixels. */
export function decodedVideoReady(v:Pick<HTMLVideoElement,'readyState'|'videoWidth'|'videoHeight'|'currentTime'>,initialTime:number){return v.readyState>=2&&v.videoWidth>0&&v.videoHeight>0&&Number.isFinite(v.currentTime)&&v.currentTime>initialTime;}
export async function waitForDecodedVideo(video:HTMLVideoElement,active:()=>boolean,timeoutMs=12000):Promise<void>{
 const initial=video.currentTime;
 await new Promise<void>((resolve,reject)=>{
  const start=performance.now();let timer:ReturnType<typeof setInterval>|undefined,done=false;
  const finish=(error?:Error)=>{if(done)return;done=true;if(timer!==undefined)clearInterval(timer);error?reject(error):resolve();};
  const check=()=>{if(!active()){finish(Error('Sumber kamera sudah berubah atau terputus.'));return;}if(decodedVideoReady(video,initial)){finish();return;}if(performance.now()-start>=timeoutMs)finish(Error('Koneksi tersedia, tetapi frame video belum diterima. Sambungkan ulang HP.'));};
  timer=setInterval(check,50);
  try{Promise.resolve(video.play()).catch(e=>finish(e instanceof Error?e:Error(String(e))));}catch(e){finish(e instanceof Error?e:Error(String(e)));}
  check();
 });
}
