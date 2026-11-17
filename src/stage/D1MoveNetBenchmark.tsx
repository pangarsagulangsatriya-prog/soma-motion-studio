import {useEffect,useRef,useState,type ChangeEvent} from 'react';
import './d1-movenet-benchmark.css';

type Point={x:number;y:number;score?:number;name?:string};
type Pose={score?:number;box?:{xMin:number;yMin:number;width:number;height:number};keypoints:Point[]};
type Detector={estimatePoses:(image:ImageData,opts?:{maxPoses:number})=>Promise<Pose[]>;dispose:()=>void};
type Tf={setBackend:(name:string)=>Promise<boolean>;ready:()=>Promise<void>;getBackend:()=>string;version_core?:string};
type Poses={SupportedModels:{MoveNet:string};movenet:{modelType:{MULTIPOSE_LIGHTNING:string}};createDetector:(m:string,c:Record<string,unknown>)=>Promise<Detector>};
type Measurement={count:number;ms:number;poses:Pose[]};
type Row={frame:number;time:number;phase:string;v384?:Measurement;v512?:Measurement;error?:string};
type Mark='unknown'|'two'|'one'|'occluded'|'none';
const intervals=[{label:'Mendekat 1',start:0,end:47},{label:'Crossing 1',start:48,end:71},{label:'Menjauh / kembali',start:72,end:119},{label:'Crossing 2',start:120,end:151},{label:'Menjauh 2',start:152,end:191}];
const phase=(n:number)=>intervals.find(p=>n>=p.start&&n<=p.end)?.label??'Lainnya';
const percentile=(values:number[],q:number)=>{if(!values.length)return null;const a=[...values].sort((x,y)=>x-y),at=(a.length-1)*q;return a[Math.floor(at)]+(a[Math.ceil(at)]-a[Math.floor(at)])*(at-Math.floor(at));};
const fmt=(n:number|null)=>n===null?'—':n.toFixed(1)+'ms';
const csv=(v:unknown)=>{const s=v==null?'':String(v);return /[,"\n]/.test(s)?'"'+s.replaceAll('"','""')+'"':s;};
function download(name:string,type:string,data:string){const url=URL.createObjectURL(new Blob([data],{type}));const a=document.createElement('a');a.href=url;a.download=name;a.click();setTimeout(()=>URL.revokeObjectURL(url),1500);}
let loading:Promise<{tf:Tf;lib:Poses}>|null=null;
async function loadModels(){
 if(loading)return loading;
 loading=(async()=>{
  for(const url of [
   'https://cdn.jsdelivr.net/npm/@tensorflow/tfjs@4.22.0/dist/tf.min.js',
   'https://cdn.jsdelivr.net/npm/@tensorflow-models/pose-detection@2.1.3/dist/pose-detection.min.js'
  ]){
   await new Promise<void>((resolve,reject)=>{
    const previous=document.querySelector<HTMLScriptElement>('script[src="'+url+'"]');
    if(previous?.dataset.ready==='1'){resolve();return;}
    const script=previous??document.createElement('script');
    if(!previous){script.src=url;script.async=false;document.head.appendChild(script);}
    script.addEventListener('load',()=>{script.dataset.ready='1';resolve();},{once:true});
    script.addEventListener('error',()=>reject(Error('Gagal memuat TensorFlow dari CDN.')),{once:true});
   });
  }
  const g=window as unknown as {tf?:Tf;poseDetection?:Poses};
  if(!g.tf||!g.poseDetection)throw Error('MoveNet belum tersedia. Periksa jaringan internet.');
  await g.tf.setBackend('webgl');await g.tf.ready();
  return {tf:g.tf,lib:g.poseDetection};
 })().catch(e=>{loading=null;throw e});
 return loading;
}
async function seek(v:HTMLVideoElement,t:number){
 if(v.readyState<2)await new Promise<void>((resolve,reject)=>{
  const timer=setTimeout(()=>{finish();reject(Error('Video gagal dimuat.'))},12000);
  const ok=()=>{finish();resolve()},bad=()=>{finish();reject(Error('Video tidak bisa dibaca.'))};
  const finish=()=>{clearTimeout(timer);v.removeEventListener('loadeddata',ok);v.removeEventListener('error',bad);};
  v.addEventListener('loadeddata',ok);v.addEventListener('error',bad);
 });
 if(t>=v.duration)throw Error('Video terlalu pendek untuk 192 frame / 24 FPS.');
 if(Math.abs(v.currentTime-t)>.0001)await new Promise<void>((resolve,reject)=>{
  const timer=setTimeout(()=>{finish();reject(Error('Seek timeout. Gunakan paket PNG 192 frame.'))},4000);
  const ok=()=>{finish();resolve()},bad=()=>{finish();reject(Error('Seek MP4 gagal.'))};
  const finish=()=>{clearTimeout(timer);v.removeEventListener('seeked',ok);v.removeEventListener('error',bad);};
  v.addEventListener('seeked',ok);v.addEventListener('error',bad);v.currentTime=t;
 });
}
function draw(canvas:HTMLCanvasElement|null,src:HTMLCanvasElement,result?:Measurement,score=.3){
 if(!canvas)return;canvas.width=src.width;canvas.height=src.height;
 const g=canvas.getContext('2d');if(!g)return;g.drawImage(src,0,0);
 result?.poses.forEach((p,i)=>{
  if((p.score??0)<score)return;
  g.strokeStyle=i%2?'#ffca75':'#6be9d0';g.fillStyle=g.strokeStyle;g.lineWidth=2;
  if(p.box)g.strokeRect(p.box.xMin,p.box.yMin,p.box.width,p.box.height);
  p.keypoints.forEach(k=>{if((k.score??0)<.35)return;g.beginPath();g.arc(k.x,k.y,2.5,0,Math.PI*2);g.fill();});
 });
}
export function D1MoveNetBenchmark({sourceUrl,sourceName}:{sourceUrl:string|null;sourceName:string|null}){
 const video=useRef<HTMLVideoElement>(null),buffer=useRef<HTMLCanvasElement|null>(null);
 const view384=useRef<HTMLCanvasElement>(null),view512=useRef<HTMLCanvasElement>(null);
 const files=useRef<File[]>([]),latest=useRef<Row[]>([]),stop=useRef(false),busy=useRef(false);
 const [count,setCount]=useState(0),[running,setRunning]=useState(false),[completed,setCompleted]=useState(0);
 const [rows,setRows]=useState<Row[]>([]),[selected,setSelected]=useState(0);
 const [marks,setMarks]=useState<Record<number,Mark>>({}),[threshold,setThreshold]=useState(.3);
 const [status,setStatus]=useState('Pilih MP4 langsung di Footprints utama untuk memulai D1.'),[environment,setEnvironment]=useState<Record<string,string>>({});
 useEffect(()=>()=>{stop.current=true;},[]);
 useEffect(()=>{stop.current=true;files.current=[];setCount(0);latest.current=[];setRows([]);setCompleted(0);setSelected(0);setMarks({});},[sourceUrl]);
 const enabled=count===192||Boolean(sourceUrl);
 const capture=async(i:number)=>{
  const c=buffer.current??document.createElement('canvas');buffer.current=c;
  if(files.current.length===192){
   const bitmap=await createImageBitmap(files.current[i]);
   c.width=bitmap.width;c.height=bitmap.height;c.getContext('2d')?.drawImage(bitmap,0,0);
   bitmap.close();
  }else{
   const v=video.current;if(!v)throw Error('MP4 belum dibuka.');
   await seek(v,(i+.5)/24);c.width=v.videoWidth;c.height=v.videoHeight;c.getContext('2d')?.drawImage(v,0,0);
  }
  return c;
 };
 const reviewFrame=async(i:number)=>{
  if(busy.current)return;
  try{
   const frame=await capture(i),r=latest.current[i];
   draw(view384.current,frame,r?.v384,threshold);draw(view512.current,frame,r?.v512,threshold);
  }catch(e){setStatus('Preview: '+(e instanceof Error?e.message:String(e)));}
 };
 const changeImages=(e:ChangeEvent<HTMLInputElement>)=>{
  const list=Array.from(e.target.files??[]).sort((a,b)=>a.name.localeCompare(b.name,undefined,{numeric:true}));
  if(list.length&&list.length!==192){setStatus('Pilih tepat 192 gambar. Saat ini '+list.length+'.');return;}
  files.current=list;setCount(list.length);latest.current=[];setRows([]);setCompleted(0);setMarks({});
  setStatus(list.length?'192 frame siap.':'Menggunakan MP4 pada sumber Footprints utama.');
 };
 const start=async()=>{
  if(busy.current||!enabled)return;
  stop.current=false;busy.current=true;setRunning(true);setRows([]);setCompleted(0);
  const all:Row[]=Array.from({length:192},(_,i)=>({frame:i,time:(i+.5)/24,phase:phase(i)}));
  const detectors:Detector[]=[];
  try{
   setStatus('Memuat TensorFlow.js dan MoveNet 384/512...');
   const {tf,lib}=await loadModels();
   const config=(size:number)=>({modelType:lib.movenet.modelType.MULTIPOSE_LIGHTNING,multiPoseMaxDimension:size,minPoseScore:.15,enableTracking:false,enableSmoothing:false});
   detectors.push(await lib.createDetector(lib.SupportedModels.MoveNet,config(384)));
   detectors.push(await lib.createDetector(lib.SupportedModels.MoveNet,config(512)));
   setEnvironment({backend:tf.getBackend(),version:tf.version_core??'?',source:count===192?'192 frame PNG/JPEG':sourceName??'MP4'});
   const frame=await capture(0),ctx=frame.getContext('2d');if(!ctx)throw Error('Canvas tidak tersedia.');
   const image=ctx.getImageData(0,0,frame.width,frame.height);
   for(let i=0;i<3;i++)for(const detector of detectors)await detector.estimatePoses(image,{maxPoses:6});
   for(let i=0;i<192;i++){
    if(stop.current)break;
    try{
     const frame=await capture(i),ctx=frame.getContext('2d');if(!ctx)throw Error('Canvas tidak tersedia.');
     const input=ctx.getImageData(0,0,frame.width,frame.height);
     for(const index of (i%2?[1,0]:[0,1])){
      const begin=performance.now(),detected=await detectors[index].estimatePoses(input,{maxPoses:6});
      const value:Measurement={count:detected.filter(p=>(p.score??0)>=threshold).length,ms:performance.now()-begin,
       poses:detected.map(p=>({score:p.score,box:p.box?{...p.box}:undefined,keypoints:p.keypoints.map(k=>({...k}))}))};
      if(index===0)all[i].v384=value;else all[i].v512=value;
     }
     if(i%6===0||i===191){draw(view384.current,frame,all[i].v384,threshold);draw(view512.current,frame,all[i].v512,threshold);setSelected(i);}
    }catch(e){all[i].error=e instanceof Error?e.message:String(e);}
    latest.current=all;setCompleted(i+1);
    if(i%6===0||i===191){setRows([...all]);setStatus('Memproses frame '+(i+1)+'/192 · '+phase(i));await new Promise<void>(r=>setTimeout(r,0));}
   }
   latest.current=all;setRows([...all]);setStatus(stop.current?'Dihentikan. Hasil masih parsial.':
    all.some(r=>r.error)?'Selesai dengan error frame. Periksa ekspor.':'192 frame selesai. Beri label visual untuk pemeriksaan recall.');
  }catch(e){setStatus('D1 gagal: '+(e instanceof Error?e.message:String(e)));}
  finally{detectors.forEach(d=>{try{d.dispose();}catch{}});busy.current=false;setRunning(false);}
 };
 const valid=rows.filter(r=>r.v384&&r.v512);
 const detected=(dim:384|512)=>valid.filter(r=>((dim===384?r.v384:r.v512)?.count??0)>=2).length;
 const timing=(dim:384|512,q:number)=>fmt(percentile(valid.map(r=>(dim===384?r.v384!:r.v512!).ms),q));
 const labelled=valid.filter(r=>marks[r.frame]==='two');
 const recall=(dim:384|512)=>labelled.length?(100*labelled.filter(r=>((dim===384?r.v384:r.v512)?.count??0)>=2).length/labelled.length).toFixed(1)+'%':'—';
 const exportData=(type:'json'|'csv')=>{
  const payload={schema:'soma.d1.movenet.v1',status:completed===192&&!rows.some(r=>r.error)?'COMPLETE_UNREVIEWED':'PARTIAL',
   environment,scoreThreshold:threshold,framesRequested:192,fps:24,manualLabels:marks,results:rows};
  if(type==='json')download('soma-d1-192.json','application/json',JSON.stringify(payload,null,2));
  else download('soma-d1-192.csv','text/csv',[
   ['frame','time_s','phase','label','count384','ms384','poses384','count512','ms512','poses512','error'].join(','),
   ...rows.map(r=>[r.frame,r.time,r.phase,marks[r.frame]??'unknown',r.v384?.count,r.v384?.ms,JSON.stringify(r.v384?.poses??[]),
    r.v512?.count,r.v512?.ms,JSON.stringify(r.v512?.poses??[]),r.error??''].map(csv).join(','))
  ].join('\n'));
 };
 return <section className="soma-d1" aria-label="D1 MoveNet MultiPose benchmark">
  <video key={sourceUrl??'none'} ref={video} src={sourceUrl??undefined} preload="auto" muted playsInline hidden/>
  <p className="soma-d1-explain">D1 · Dua aktor · 192 frame pada 24 FPS. Sumber MP4 mengikuti Footprints utama. Gunakan 192 PNG/JPEG untuk hasil pengukuran frame yang lebih presisi; seek MP4 dapat meleset.</p>
  <div className="soma-d1-controls">
   <label>Paket 192 frame (opsional)<input type="file" accept="image/png,image/jpeg" multiple disabled={running} onChange={changeImages}/></label>
   <label>Ambang skor<select value={threshold} disabled={running} onChange={e=>setThreshold(Number(e.target.value))}>
    <option value={.3}>0,30</option><option value={.4}>0,40</option><option value={.5}>0,50</option></select></label>
   <button type="button" disabled={!enabled||running} onClick={()=>void start()}>Jalankan D1 — 384 vs 512</button>
   <button type="button" disabled={!running} onClick={()=>{stop.current=true;}}>Hentikan</button>
   <button type="button" disabled={!completed||running} onClick={()=>exportData('json')}>JSON</button>
   <button type="button" disabled={!completed||running} onClick={()=>exportData('csv')}>CSV</button>
  </div>
  <div className="soma-d1-metrics"><div>Frame<strong>{completed}/192</strong></div>
   <div>384 · p50 / p95<strong>{timing(384,.5)} / {timing(384,.95)}</strong></div>
   <div>512 · p50 / p95<strong>{timing(512,.5)} / {timing(512,.95)}</strong></div>
   <div>2+ kandidat · 384 / 512<strong>{detected(384)} / {detected(512)}</strong></div></div>
  <div className="soma-d1-views"><div><b>384</b><canvas ref={view384} width={640} height={360}/></div>
   <div><b>512</b><canvas ref={view512} width={640} height={360}/></div></div>
  <div className="soma-d1-review"><label>Frame {selected+1} · {phase(selected)}
   <input type="range" min={0} max={191} value={selected} disabled={running||!enabled}
    onChange={e=>{const n=Number(e.target.value);setSelected(n);void reviewFrame(n);}}/></label>
   <label>Label visual<select value={marks[selected]??'unknown'} disabled={running}
    onChange={e=>setMarks(prev=>({...prev,[selected]:e.target.value as Mark}))}>
    <option value="unknown">Belum diperiksa</option><option value="two">2 aktor jelas</option>
    <option value="one">1 aktor jelas</option><option value="occluded">Crossing / tertutup</option><option value="none">Tidak ada</option>
   </select></label></div>
  <p className="soma-d1-status" role="status">{status}</p>
  <p className="soma-d1-explain">Recall dua kandidat, {labelled.length} frame berlabel jelas: 384 {recall(384)} · 512 {recall(512)}. Ini masih hitungan kandidat, perlu pemeriksaan bounding box manual.</p>
  <div className="soma-d1-phase"><table><thead><tr><th>Fase</th><th>Frame</th><th>384 ≥2</th><th>512 ≥2</th></tr></thead>
   <tbody>{intervals.map(p=>{const subset=valid.filter(r=>r.frame>=p.start&&r.frame<=p.end);
    return <tr key={p.label}><td>{p.label}</td><td>{p.start+1}–{p.end+1}</td>
     <td>{subset.filter(r=>(r.v384?.count??0)>=2).length}/{subset.length}</td>
     <td>{subset.filter(r=>(r.v512?.count??0)>=2).length}/{subset.length}</td></tr>;})}</tbody>
  </table></div>
  <small>Benchmark lokal terisolasi; tidak menyentuh proyektor, floor mapping, atau identity gate. Model perlu internet pada pemuatan pertama. D1 belum PASS sebelum inspeksi manual.</small>
 </section>;
}