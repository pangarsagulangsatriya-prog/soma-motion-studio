import {useEffect,useRef,useState,type RefObject} from 'react';
import type {DuetV2Frame} from './duetV2Worker.ts';
import type {DuetV2Benchmark} from './duetV2Benchmark.ts';
import {chooseDuetResolution,duetBenchmarkCsv,
 summarizeDuetBenchmark} from './duetV2Benchmark.ts';
import {DuetV2WorkerClient} from './duetV2Client.ts';
import {subscribeReplayFrames} from './replayFrameClock.ts';
import './duet-v2-benchmark.css';

const FPS=24;
const MAX_FRAMES=192;
const percent=(n:number,d:number)=>d?Math.round(n/d*100)+'%':'—';
const metric=(n:number)=>n.toFixed(1)+' ms';
const save=(name:string,content:string,mime:string)=>{
 const url=URL.createObjectURL(new Blob([content],{type:mime}));
 const a=document.createElement('a');a.href=url;a.download=name;a.click();
 window.setTimeout(()=>URL.revokeObjectURL(url),1200);
};
function waitForReady(video:HTMLVideoElement){
 if(video.readyState>=2&&video.videoWidth)return Promise.resolve();
 return new Promise<void>((resolve,reject)=>{
  const timeout=window.setTimeout(()=>{cleanup();reject(Error('Video tidak dapat dimuat untuk benchmark.'));},15000);
  const ok=()=>{cleanup();resolve();};
  const fail=()=>{cleanup();reject(Error('Video lokal gagal dibaca.'));};
  const cleanup=()=>{
   clearTimeout(timeout);video.removeEventListener('loadeddata',ok);
   video.removeEventListener('error',fail);
  };
  video.addEventListener('loadeddata',ok);video.addEventListener('error',fail);
  video.load();
 });
}
function seekFrame(video:HTMLVideoElement,time:number){
 const target=Math.max(0,Math.min(time,video.duration-.003));
 if(Math.abs(video.currentTime-target)<.0005&&video.readyState>=2)
  return Promise.resolve();
 return new Promise<void>((resolve,reject)=>{
  const timer=window.setTimeout(()=>{cleanup();reject(Error('Seek frame gagal di '+target.toFixed(3)+' detik.'));},9000);
  const ok=()=>{cleanup();resolve();};
  const fail=()=>{cleanup();reject(Error('Video gagal seek.'));};
  const cleanup=()=>{
   window.clearTimeout(timer);video.removeEventListener('seeked',ok);
   video.removeEventListener('error',fail);
  };
  video.addEventListener('seeked',ok);video.addEventListener('error',fail);
  video.currentTime=target;
 });
}
const chains:number[][]=[
 [11,13,15],[12,14,16],[11,12],[11,23,24,12],
 [23,25,27,29,31],[24,26,28,30,32]
];
function drawFrame(canvas:HTMLCanvasElement|null,video:HTMLVideoElement|null,
 result:DuetV2Frame|null){
 if(!canvas)return;
 const ctx=canvas.getContext('2d');if(!ctx)return;
 const w=canvas.width,h=canvas.height;
 ctx.fillStyle='#070a08';ctx.fillRect(0,0,w,h);
 if(video?.readyState&&video.readyState>=2)ctx.drawImage(video,0,0,w,h);
 if(!result)return;
 for(const actor of result.identity.actors){
  if(!actor.box)continue;
  const color=actor.id==='A'?'#69c4fa':'#e9b273';
  const {x,y,width,height}=actor.box;
  ctx.strokeStyle=color;ctx.lineWidth=2;
  if(actor.status!=='visible')ctx.setLineDash([6,5]);
  ctx.strokeRect(x*w,y*h,width*w,height*h);
  ctx.setLineDash([]);
  ctx.fillStyle=color;ctx.font='bold 16px system-ui';
  ctx.fillText(actor.id+' '+actor.status,x*w,Math.max(18,y*h-6));
 }
 for(const pose of result.details){
  const color=pose.actor==='A'?'#69c4fa':'#e9b273';
  ctx.lineWidth=2;ctx.strokeStyle=color;ctx.fillStyle=color;
  for(const path of chains){
   ctx.beginPath();let started=false;
   for(const idx of path){
    const p=pose.landmarks[idx];
    if(!p||(p.visibility??0)<.4){started=false;continue;}
    if(started)ctx.lineTo(p.x*w,p.y*h);
    else{ctx.moveTo(p.x*w,p.y*h);started=true;}
   }
   ctx.stroke();
  }
  for(const p of pose.landmarks){
   if((p.visibility??0)<.5)continue;
   ctx.beginPath();ctx.arc(p.x*w,p.y*h,2.1,0,Math.PI*2);ctx.fill();
  }
 }
}
export function DuetV2BenchmarkPanel({clipUrl,clipName,sourceVideo,analysisActive}:{
 clipUrl:string|null;clipName:string|null;sourceVideo:RefObject<HTMLVideoElement|null>;
 analysisActive:boolean;
}){
 const videoRef=useRef<HTMLVideoElement|null>(null);
 const canvasRef=useRef<HTMLCanvasElement|null>(null);
 const workerRef=useRef<DuetV2WorkerClient|null>(null);
 const cancelRef=useRef(false);
 const lastRef=useRef<DuetV2Frame|null>(null);
 const [include33,setInclude33]=useState(true);
 const [running,setRunning]=useState(false);
 const [live,setLive]=useState(false);
 const [phase,setPhase]=useState('Belum dijalankan');
 const [error,setError]=useState('');
 const [progress,setProgress]=useState(0);
 const [results,setResults]=useState<DuetV2Benchmark[]>([]);
 const frameArchive=useRef(new Map<384|512,DuetV2Frame[]>());
 const [reviewSize,setReviewSize]=useState<384|512>(512);
 const [reviewIndex,setReviewIndex]=useState(0);
 const [current,setCurrent]=useState<DuetV2Frame|null>(null);
 const [skipped,setSkipped]=useState(0);
 const busyRef=useRef(false);
 const tickRef=useRef(-Infinity);
 useEffect(()=>()=>{
  cancelRef.current=true;workerRef.current?.dispose();workerRef.current=null;
 },[]);
 useEffect(()=>{
  cancelRef.current=true;workerRef.current?.dispose();workerRef.current=null;
  lastRef.current=null;frameArchive.current.clear();
  setResults([]);setCurrent(null);setProgress(0);setLive(false);setReviewIndex(0);
 },[clipUrl]);
 const ensureWorker=()=>{
  workerRef.current?.dispose();
  const worker=new DuetV2WorkerClient();workerRef.current=worker;
  return worker;
 };
 const run=async()=>{
  const video=videoRef.current;
  if(!clipUrl||!video||running||live||analysisActive)return;
  cancelRef.current=false;setRunning(true);setError('');setProgress(0);setResults([]);
  const completed:DuetV2Benchmark[]=[];
  try{
   video.pause();await waitForReady(video);
   const frames=Math.min(MAX_FRAMES,Math.floor(video.duration*FPS));
   if(frames<2)throw Error('Video terlalu pendek untuk benchmark.');
   const worker=ensureWorker();
   for(const size of [384,512] as const){
    setPhase('Memuat MoveNet '+size+'…');
    await worker.init(size,include33&&size===512);
    const readings:DuetV2Frame[]=[];
    for(let i=0;i<frames;i++){
     if(cancelRef.current)throw Error('Benchmark dibatalkan.');
     const time=i/FPS;
     await seekFrame(video,time);
     const frame=await worker.frame(video,time*1000+1,{
      detector:true,detailed:include33&&size===512
     });
     if(frame)readings.push(frame);
     if(i%8===0||i===frames-1){
      setProgress(Math.round(((size===384?0:frames)+i+1)/(frames*2)*100));
      setPhase('D'+(size===384?'1':'1–3')+' · '+size+' · frame '+(i+1)+'/'+frames);
     }
    }
    const summary=summarizeDuetBenchmark(size,readings);
    frameArchive.current.set(size,readings);
    completed.push(summary);setResults([...completed]);
    const last=readings.at(-1)??null;lastRef.current=last;setCurrent(last);
    if(size===512){setReviewSize(512);setReviewIndex(Math.max(0,readings.length-1));}
    drawFrame(canvasRef.current,video,last);
   }
   setPhase('Benchmark selesai. Data 384 dan 512 siap dibandingkan.');
  }catch(e){
   setError(e instanceof Error?e.message:String(e));
   setPhase('Pengujian berhenti. Engine produksi tetap tidak berubah.');
  }finally{setRunning(false);}
 };
 const startLive=async()=>{
  const video=sourceVideo.current;
  if(!video||!clipUrl||running||analysisActive)return;
  cancelRef.current=false;setError('');setPhase('Menyiapkan preview D4…');
  try{
   const worker=ensureWorker();
   await worker.init(512,true);
   tickRef.current=-Infinity;setSkipped(0);setLive(true);
   setPhase('D4 aktif · 512 + dua crop 33 · frame lama dilewati');
  }catch(e){
   setError(e instanceof Error?e.message:String(e));
   setLive(false);
  }
 };
 const stop=()=>{
  cancelRef.current=true;
  workerRef.current?.dispose();workerRef.current=null;
  setLive(false);setRunning(false);setPhase('Dihentikan.');
 };
 useEffect(()=>{
  if(!live)return;
  const source=sourceVideo.current;
  if(!source)return;
  let cancelled=false,processed=0;
  const unsubscribe=subscribeReplayFrames(source,(seconds)=>{
   const at=seconds*1000;
   // Stage video never waits for this Worker. No pending bitmap queue.
   if(busyRef.current||at-tickRef.current<88){
    if(busyRef.current)setSkipped(v=>v+1);
    return;
   }
   tickRef.current=at;busyRef.current=true;
   void workerRef.current?.frame(source,at+1,{
    detector:processed%2===0,detailed:true
   }).then(frame=>{
    if(!frame||cancelled)return;
    processed++;
    lastRef.current=frame;drawFrame(canvasRef.current,source,frame);
    if(processed%3===0)setCurrent(frame);
   }).catch(e=>{
    if(cancelled)return;
    setError(e instanceof Error?e.message:String(e));stop();
   }).finally(()=>{busyRef.current=false;});
  });
  return ()=>{cancelled=true;unsubscribe();};
 },[live,sourceVideo]);
 useEffect(()=>{
  if(running||live||!results.length)return;
  const archive=frameArchive.current.get(reviewSize);
  const video=videoRef.current;
  if(!archive?.length||!video)return;
  const index=Math.min(archive.length-1,Math.max(0,reviewIndex));
  let cancelled=false;
  void seekFrame(video,index/FPS).then(()=>{
   if(cancelled)return;
   const item=archive[index]??null;
   lastRef.current=item;setCurrent(item);drawFrame(canvasRef.current,video,item);
  }).catch(()=>{/* Frame may disappear while switching local videos. */});
  return()=>{cancelled=true;};
 },[running,live,results.length,reviewSize,reviewIndex,clipUrl]);
 const decision=chooseDuetResolution(results);
 return <details className="duet-v2-lab" data-experimental="true">
  <summary>Duet V2 · D1–D4 <span>Eksperimen terpisah dari tracking produksi</span></summary>
  <div className="duet-v2-body">
   <p>Gunakan video MP4 yang sudah dimuat. D1 membandingkan 384 dan 512 pada seluruh
    frame hingga 192; D2 memeriksa A/B, D3 membaca 33 titik tiap aktor, dan D4
    menguji preview tanpa antrean inferensi.</p>
   <video ref={videoRef} src={clipUrl??undefined} muted preload="auto"
    playsInline className="duet-v2-hidden-video" aria-hidden="true"/>
   <div className="duet-v2-actions">
    <label><input type="checkbox" checked={include33} disabled={running||live}
     onChange={e=>setInclude33(e.target.checked)}/> Jalankan D3 untuk 512</label>
    <button type="button" disabled={!clipUrl||running||live||analysisActive}
     onClick={()=>void run()}>D1 · Uji 192 frame (384 vs 512)</button>
    <button type="button" disabled={!clipUrl||running||analysisActive}
     onClick={()=>live?stop():void startLive()}>
     {live?'Hentikan preview D4':'D4 · Preview live A/B'}</button>
    {(running||live)&&<button type="button" onClick={stop}>Hentikan semua</button>}
   </div>
   {analysisActive&&<p className="duet-v2-error">
    Hentikan analisis Pose / Gait lama sebelum menguji Duet V2 agar
    dua worker tidak berebut CPU dan hasil latency tetap dapat dibandingkan.
   </p>}
   <p role="status">{phase} · {progress}%</p>
   {error&&<p role="alert" className="duet-v2-error">{error}</p>}
   {!!results.length&&<>
    <div className="duet-v2-results">
     {results.map(r=><div key={r.resolution}>
      <strong>{r.resolution} px</strong>
      <span>Dua orang: {r.twoDetected}/{r.frames} ({percent(r.twoDetected,r.frames)})</span>
      <span>A/B terlacak: {percent(r.twoTracked,r.frames)}</span>
      <span>Dua pose 33: {r.resolution===384||!include33?'Belum diuji':percent(r.twoPose33,r.frames)}</span>
      <span>Detektor P95: {metric(r.detectorP95Ms)}</span>
      <span>Pipeline P95: {metric(r.totalP95Ms)}</span>
      <span>Ambigu: {r.uncertainFrames} frame</span>
     </div>)}
    </div>
    <div className="duet-v2-review">
     <label>Periksa frame
      <select aria-label="Resolusi frame untuk ditinjau" value={reviewSize}
       disabled={running||live} onChange={e=>{
        setReviewSize(Number(e.target.value) as 384|512);setReviewIndex(0);
       }}>
       {results.map(r=><option key={r.resolution} value={r.resolution}>{r.resolution} px</option>)}
      </select>
     </label>
     <input aria-label="Frame Duet V2" type="range" min="0"
      max={Math.max(0,(results.find(r=>r.resolution===reviewSize)?.frames??1)-1)}
      step="1" value={reviewIndex} disabled={running||live}
      onChange={e=>setReviewIndex(Number(e.target.value))}/>
     <span>{reviewIndex} / {(results.find(r=>r.resolution===reviewSize)?.frames??1)-1}</span>
     {[.5,5.5,7.5].map(second=><button key={second} type="button"
      disabled={running||live} onClick={()=>setReviewIndex(Math.min(
       Math.round(second*FPS),(results.find(r=>r.resolution===reviewSize)?.frames??1)-1
      ))}>Crossing {second}s</button>)}
    </div>
    <p><b>Keputusan sementara:</b> {decision.resolution??'—'}.
     {' '}{decision.reason}</p>
    <div className="duet-v2-actions">
     <button type="button" onClick={()=>save('soma-duet-v2-'+(clipName??'video')+'.json',
      JSON.stringify({clipName,expectedSubjects:2,groundTruth:'belum dianotasi',
       decision,results},null,2),'application/json')}>Ekspor JSON</button>
     <button type="button" onClick={()=>save('soma-duet-v2.csv',
      duetBenchmarkCsv(results),'text/csv')}>Ekspor CSV</button>
    </div>
   </>}
   <canvas ref={canvasRef} width={640} height={360}
    aria-label="Preview dua aktor: MoveNet boxes dan skeleton 33 titik"/>
   {current&&<p>A/B saat ini: {current.identity.actors.map(a=>
    a.id+' '+a.status).join(' · ')} · Pose 33: {current.details.length}/2
    {live?' · frame dilewati: '+skipped:''}</p>}
   <small>Persentase di sini menghitung frame dengan dua hasil deteksi.
    Ground truth jumlah manusia di setiap frame belum dianotasi.
    Keputusan mengganti tracking produksi menunggu inspeksi visual dan
    pengukuran identitas yang sebenarnya. Data video tetap lokal.</small>
  </div>
 </details>;
}
