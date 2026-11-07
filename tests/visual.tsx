import React,{useEffect,useRef,useState} from 'react';
import {createRoot} from 'react-dom/client';
import {VisualStage} from '../src/VisualStage';
import {defaults,emptyFrame,type VisualStyle} from '../src/engine/types';
import {VisualMappingEngine,MappingEngine} from '../src/engine/mapping';
import {AudioEngine} from '../src/engine/audio';
import {Recorder} from '../src/engine/recording';
const styles:VisualStyle[]=['trail','fiber','particles','planes'];
const frame={current:emptyFrame('mouse')};
const states=styles.map(style=>({current:{...defaults(),input:'mouse' as const,layers:{...defaults().layers,tracking:'off' as const},visual:{...defaults().visual,style,life:3}}}));
const params=styles.map(()=>({current:{size:.5,spread:.5,rotation:0,energy:.5,tension:0,density:.5}}));
const metrics=styles.map(()=>({current:{fps:0,particles:0}}));
const tracking={current:false},video={current:null};
function Verification(){
 const [lines,setLines]=useState<string[]>([]),[running,setRunning]=useState(false);const audio=useRef(new AudioEngine()).current;
 useEffect(()=>{const visualMappers=styles.map(()=>new VisualMappingEngine()),sound=new MappingEngine();const tick=()=>{const time=performance.now();const f=emptyFrame('mouse');f.time=time;f.tracked=true;f.features.open=1;f.features.x=.5+Math.sin(time/900)*.3;f.features.y=.5+Math.sin(time/600)*.3;f.features.speed=.5+Math.sin(time/1000)*.3;f.features.spread=.7;frame.current=f;states.forEach((s,i)=>params[i].current=visualMappers[i].process(f,s.current));audio.update(sound.process(f,states[0].current),states[0].current,true,true);};const interval=setInterval(tick,33);return()=>{clearInterval(interval);void audio.dispose();};},[audio]);
 const frames=(count:number)=>new Promise<void>(resolve=>{const tick=()=>{if(--count<=0)resolve();else requestAnimationFrame(tick);};requestAnimationFrame(tick);});
 const run=async()=>{setRunning(true);setLines([]);const out:string[]=[];const check=(name:string,ok:boolean,info:string)=>{out.push(`${ok?'PASS':'FAIL'} · ${name} · ${info}`);setLines([...out]);};
  try{states.forEach(s=>s.current.output='both');await audio.init();const recorder=new Recorder();const take=new Promise<any>((resolve,reject)=>recorder.start(audio.recordDestination!.stream,resolve,reject));
   await frames(24);
   const coverage=()=>Array.from(document.querySelectorAll<HTMLCanvasElement>('.test-stage canvas')).map(c=>{const pixels=c.getContext('2d')!.getImageData(0,0,c.width,c.height).data;let count=0;for(let i=3;i<pixels.length;i+=4)if(pixels[i]>12)count++;return count;});
   const pixels=coverage();styles.forEach((name,i)=>check(`${name} renders during audio + recording`,pixels[i]>40,`${pixels[i]} non-transparent pixels; ${metrics[i].current.fps} draw FPS`));
   audio.mute();await frames(5);check('Visuals continue while audio is muted',coverage().every(n=>n>40),'All four canvases retain motion-driven geometry');
   states.forEach(s=>s.current.output='sound');await frames(5);check('Sound-only output hides generated visuals',coverage().every(n=>n===0),`${coverage().join(', ')} pixels`);
   states.forEach(s=>s.current.output='visual');await frames(12);check('Visual-only output restores geometry',coverage().every(n=>n>40),`${coverage().join(', ')} pixels`);
   recorder.stop();const saved=await take;const decoded=await audio.context!.decodeAudioData(await saved.blob.arrayBuffer());check('Recording survives concurrent visual work',decoded.duration>.4&&saved.blob.size>1000,`${decoded.duration.toFixed(2)} seconds; ${saved.blob.size} bytes`);URL.revokeObjectURL(saved.url);
  }catch(e){check('Unexpected error',false,String(e));}finally{audio.mute();setRunning(false);}
 };
 return <><h1>SOMA · Generative visual verification</h1><p>Development-only: continuous simulated mouse coordinates, actual Canvas 2D renderer and actual audio recording.</p><button onClick={()=>void run()} disabled={running}>{running?'Running…':'Run visual + audio checks'}</button><section>{styles.map((style,i)=><article key={style}><h2>{style} <small>SIMULATED MOUSE INPUT</small></h2><div className="test-stage"><VisualStage frameRef={frame} settingsRef={states[i]} paramsRef={params[i]} videoRef={video} trackingRef={tracking} metricsRef={metrics[i]}/></div></article>)}</section><ol>{lines.map(line=><li key={line}>{line}</li>)}</ol></>;
}
createRoot(document.getElementById('root')!).render(<Verification/>);
