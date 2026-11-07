import {FilesetResolver,HandLandmarker,PoseLandmarker} from '@mediapipe/tasks-vision';
import {AudioEngine} from '../src/engine/audio';
import {MappingEngine} from '../src/engine/mapping';
import {MotionProcessor} from '../src/engine/motion';
import {defaults,emptyFrame,characterPatch,type Character} from '../src/engine/types';
import {Recorder} from '../src/engine/recording';
const results=document.getElementById('results')!,status=document.getElementById('status')!,run=document.getElementById('run') as HTMLButtonElement;
let failures=0;
const result=(name:string,ok:boolean,info:string)=>{const li=document.createElement('li');li.textContent=`${ok?'PASS':'FAIL'} · ${name} · ${info}`;li.style.color=ok?'#cedf89':'#f5a291';results.append(li);if(!ok)failures++;};
const wait=(ms:number)=>new Promise(r=>setTimeout(r,ms));
run.onclick=async()=>{
 run.disabled=true;results.replaceChildren();failures=0;status.textContent='Running…';const audio=new AudioEngine();let hand:HandLandmarker|null=null,pose:PoseLandmarker|null=null,interval:ReturnType<typeof setInterval>|null=null;
 try{
  await audio.init();audio.analyser!.smoothingTimeConstant=0;const settings=defaults();settings.master=.35;settings.reverb=0;settings.macros.space=0;settings.mappings=settings.mappings.filter(m=>m.output!=='reverb');
  const probe=document.createElement('canvas');const gl=probe.getContext('webgl2')||probe.getContext('webgl');const hasGL=!!gl;gl?.getExtension('WEBGL_lose_context')?.loseContext();
  let files:any=null;const processor=new MotionProcessor(),mapper=new MappingEngine();let frame=emptyFrame('mouse');frame.tracked=true;frame.features.open=1;frame.features.y=.7;frame.features.x=.5;frame.time=performance.now();
  if(hasGL){files=await FilesetResolver.forVisionTasks('/wasm');
  hand=await HandLandmarker.createFromOptions(files,{baseOptions:{modelAssetPath:'/models/hand_landmarker.task',delegate:'CPU'},runningMode:'VIDEO',numHands:2});
  const image=document.getElementById('hands') as HTMLImageElement;await image.decode();const canvas=document.createElement('canvas');canvas.width=image.naturalWidth;canvas.height=image.naturalHeight;const ctx=canvas.getContext('2d')!;ctx.drawImage(image,0,0);
  let detections;const base=performance.now();
  for(let i=0;i<5;i++){detections=hand.detectForVideo(canvas,base+i*40);frame=processor.process(detections,null,base+i*40,settings,25);}
  result('Real hand inference',frame.handCount>0,`${frame.handCount} hands; ${detections?.landmarks[0]?.length||0} landmarks per hand`);
  result('Open-palm gesture gate',frame.features.open===1,`${frame.gesture}; normalized pinch ${frame.features.pinch.toFixed(2)}`);
  }else {const li=document.createElement('li');li.textContent='UNVERIFIED · Visual hand/pose inference: this browser has no WebGL. Audio tests below use explicitly simulated motion.';results.append(li);}
  let params=mapper.process(frame,settings);const detectedHz=params.frequency;
  const update=()=>{frame.time=performance.now();audio.update(params,settings,frame.features.open>.5,frame.tracked);};update();interval=setInterval(update,25);await wait(350);
  const measure=()=>{const d=new Float32Array(audio.analyser!.fftSize);audio.analyser!.getFloatTimeDomainData(d);return Math.sqrt(d.reduce((a,v)=>a+v*v,0)/d.length);};
  result(hasGL?'Hand landmarks → mapped sound':'Simulated motion → mapped sound',measure()>.002,`frequency ${detectedHz.toFixed(1)} Hz; RMS ${measure().toFixed(5)}`);
  const takePromise=new Promise<any>((resolve,reject)=>{const recorder=new Recorder();recorder.start(audio.recordDestination!.stream,resolve,reject);setTimeout(()=>recorder.stop(),1100);});
  params={...params,frequency:440,amplitude:.5,filter:6000};await wait(450);const spectrum=new Uint8Array(audio.analyser!.frequencyBinCount);audio.analyser!.getByteFrequencyData(spectrum);const peak=spectrum.indexOf(Math.max(...spectrum))*audio.context!.sampleRate/audio.analyser!.fftSize;
  result('Audible pitch follows mapping',Math.abs(peak-440)<30,`spectral peak ${peak.toFixed(1)} Hz`);
  const take=await takePromise;const decoded=await audio.context!.decodeAudioData(await take.blob.arrayBuffer());const samples=decoded.getChannelData(0);const peakAudio=Math.max(...samples.slice(0,48000).map(Math.abs));
  result('Generated audio recording decodes',decoded.duration>.7&&take.blob.size>1000&&peakAudio>.005,`${take.blob.size} bytes; ${decoded.duration.toFixed(2)} s; peak ${peakAudio.toFixed(4)}`);URL.revokeObjectURL(take.url);
  const profiles:Record<string,{rms:number;peak:number;centroid:number}>={};
  for(const character of ['clean','raw','metal','metallic','dark'] as Character[]){
   Object.assign(settings,characterPatch(character));settings.macros.space=0;settings.reverb=0;
   params={...params,reverb:0,roughness:settings.macros.roughness,weight:settings.macros.weight,brightness:settings.macros.brightness,attack:settings.attack,release:settings.release};
   await wait(700);const bins=new Uint8Array(audio.analyser!.frequencyBinCount);audio.analyser!.getByteFrequencyData(bins);
   const peak=bins.indexOf(Math.max(...bins))*audio.context!.sampleRate/audio.analyser!.fftSize;
   let weight=0,total=0;bins.forEach((v,i)=>{const power=v*v;weight+=power*i;total+=power;});
   const centroid=weight/Math.max(1,total)*audio.context!.sampleRate/audio.analyser!.fftSize;
   profiles[character]={rms:measure(),peak,centroid};
   result(`Character ${character}: audible bounded output`,profiles[character].rms>.001&&profiles[character].rms<.5,`RMS ${profiles[character].rms.toFixed(4)}; peak ${peak.toFixed(1)} Hz; centroid ${centroid.toFixed(1)} Hz`);
  }
  result('Raw changes spectral texture',profiles.raw.centroid>profiles.clean.centroid*1.25,`clean ${profiles.clean.centroid.toFixed(1)} → raw ${profiles.raw.centroid.toFixed(1)} Hz centroid`);
  result('Metal and Dark shift the fundamental lower',profiles.metal.peak<profiles.clean.peak*.8&&profiles.dark.peak<profiles.clean.peak*.8,`clean ${profiles.clean.peak.toFixed(1)}; metal ${profiles.metal.peak.toFixed(1)}; dark ${profiles.dark.peak.toFixed(1)} Hz`);
  settings.output='visual';await wait(1000);result('Visual-only output silences audio with live motion',measure()<.001,`RMS ${measure().toFixed(6)}; tracked=${frame.tracked}`);
  settings.output='both';Object.assign(settings,characterPatch('clean'));params={...params,reverb:0,attack:.07,release:.32,roughness:.05,weight:.3,brightness:.72};await wait(400);
  frame={...frame,features:{...frame.features,open:0}};await wait(1100);result('Fist releases sustained audio',measure()<.001,`RMS ${measure().toFixed(6)}`);
  frame={...frame,features:{...frame.features,open:1}};await wait(400);clearInterval(interval);interval=null;await wait(1200);result('Stalled tracking watchdog',measure()<.001,`RMS ${measure().toFixed(6)} after updates stop`);
  update();interval=setInterval(update,25);await wait(150);audio.mute();await wait(150);result('Mute-all cuts output',measure()<.001,`RMS ${measure().toFixed(6)}`);clearInterval(interval);interval=null;
  if(hasGL){pose=await PoseLandmarker.createFromOptions(files,{baseOptions:{modelAssetPath:'/models/pose_landmarker_lite.task',delegate:'CPU'},runningMode:'VIDEO',numPoses:1});const body=document.getElementById('body') as HTMLImageElement;await body.decode();const p=pose.detectForVideo(body,performance.now());const s={...settings,mode:'drone' as const,input:'body' as const};const bodyFrame=new MotionProcessor().process(null,p,performance.now(),s,25);
  result('Real body inference',bodyFrame.tracked&&bodyFrame.pose.length===33,`${bodyFrame.pose.length} landmarks; ${bodyFrame.posture}; quality ${bodyFrame.quality.toFixed(2)}`);
  }
  const lost=processor.process(null,null,performance.now(),settings,25);result('Tracking loss clears gate',!lost.tracked&&lost.features.open===0,`tracked=${lost.tracked}, gate=${lost.features.open}`);
 }catch(e){result('Unexpected error',false,String(e));}
 finally{if(interval)clearInterval(interval);await audio.dispose();hand?.close();pose?.close();status.textContent=failures?`COMPLETE: ${failures} failed checks`:'COMPLETE: available checks passed; review UNVERIFIED lines above';run.disabled=false;}
};
