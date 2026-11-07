// Development-only integration fixture. It mounts the real App, replacing device boundaries only.
import React from 'react';import {createRoot} from 'react-dom/client';
import App from '../src/App';
import {CameraTracker} from '../src/engine/tracking';
import {MotionProcessor} from '../src/engine/motion';
import type {Landmark} from '../src/engine/types';
import {readPhotos,removePhoto} from '../src/photos/store';
import type {Recognition} from '../src/photos/voice';
import '../src/style.css';
import '../src/v2.css';
import '../src/archive/archive.css';

let recognition:FakeRecognition|null=null,speechIndex=0,cameraStarts=0,cameraRaf=0,stream:MediaStream|null=null,frameCounter=0,stopCounter=0;
let input={gap:.4,y:.6,fist:false,lost:false};
class FakeRecognition implements Recognition{
 lang='';continuous=false;interimResults=false;maxAlternatives=1;
 onstart:Recognition['onstart']=null;onend:Recognition['onend']=null;onerror:Recognition['onerror']=null;onresult:Recognition['onresult']=null;
 constructor(){recognition=this;}start(){this.onstart?.();}abort(){}
 say(transcript:string){const index=speechIndex++;this.onresult?.({resultIndex:index,results:{length:index+1,[index]:{length:1,isFinal:true,0:{transcript}}}});}
}
Object.defineProperty(window,'SpeechRecognition',{value:FakeRecognition,configurable:true});
function hand(cx:number,y:number,fist:boolean):Landmark[]{const h=Array.from({length:21},()=>({x:cx,y,z:0}));h[0]={x:cx,y,z:0};h[4]={x:cx-.08,y:y-.15,z:0};for(let k=0;k<4;k++)for(let j=0;j<4;j++)h[5+k*4+j]={x:cx+(k-1.5)*.025,y:y-.1-(fist?[0,.035,.01,-.015][j]:j*.06),z:0};return h;}
const originalStart=CameraTracker.prototype.start,originalStop=CameraTracker.prototype.stop;
CameraTracker.prototype.stop=function(video){stopCounter++;this.running=false;clearTimeout(cameraRaf);stream?.getTracks().forEach(t=>t.stop());stream=null;if(video)video.srcObject=null;};
CameraTracker.prototype.start=async function(video,settings,onFrame,onStatus){
 this.stop(video);this.running=true;cameraStarts++;
 const c=document.createElement('canvas');c.width=640;c.height=480;const ctx=c.getContext('2d')!,processor=new MotionProcessor();
 const draw=(now:number)=>{if(!this.running)return;cameraRaf=window.setTimeout(()=>draw(performance.now()),33);frameCounter++;
  const gradient=ctx.createLinearGradient(0,0,640,480);gradient.addColorStop(0,'#a76d4a');gradient.addColorStop(.5,'#325c56');gradient.addColorStop(1,'#596c94');ctx.fillStyle=gradient;ctx.fillRect(0,0,640,480);
  ctx.strokeStyle='#d4dfb650';ctx.lineWidth=1;for(let i=0;i<640;i+=40){ctx.beginPath();ctx.moveTo(i,0);ctx.lineTo(i,480);ctx.stroke();}for(let i=0;i<480;i+=40){ctx.beginPath();ctx.moveTo(0,i);ctx.lineTo(640,i);ctx.stroke();}
  ctx.fillStyle='#e8e9cd';ctx.font='28px monospace';ctx.fillText('KAMERA UJI',225,255);ctx.fillStyle='#ee9a62';ctx.beginPath();ctx.arc(160,175,55,0,Math.PI*2);ctx.fill();
  const hands=input.lost?[]:input.fist?[hand(.4,input.y,true)]:[hand(.5-input.gap/2,input.y,false),hand(.5+input.gap/2,input.y,false)];
  onFrame(processor.process({landmarks:hands,handedness:hands.map((_,i)=>[{categoryName:i?'Left':'Right',score:.99}])},null,now,settings(),30));
 };stream=c.captureStream(30);video.srcObject=stream;draw(performance.now());await video.play();onStatus('Pelacak tangan siap');
};
// This origin is disposable local QA. Production never includes this entrypoint.
for(const p of await readPhotos())await removePhoto(p.slot);
const root=createRoot(document.getElementById('root')!);root.render(<App/>);
const controls=document.createElement('div');controls.style.cssText='position:fixed;bottom:8px;left:8px;z-index:5000;background:#101610ee;border:1px solid #657451;padding:8px;color:#dce8bf;font:11px monospace;max-width:570px';
controls.innerHTML='<button id="run-cue-e2e">Run camera performance E2E</button> <button id="show-cue-preview">Preview test frame</button><span id="camera-diag"></span><details><summary>Hasil uji sintetis</summary><pre id="cue-results" style="white-space:pre-wrap;max-height:260px;overflow:auto"></pre></details>';document.body.append(controls);
const diagnostic=setInterval(()=>{document.getElementById('camera-diag')!.textContent=` starts ${cameraStarts} / stops ${stopCounter} / frames ${frameCounter} / hidden ${document.hidden}`;},500);
const wait=(ms:number)=>new Promise(r=>setTimeout(r,ms));
async function until(fn:()=>boolean,label:string,ms=5000){const start=performance.now();while(!fn()){if(performance.now()-start>ms)throw Error('Timeout: '+label);await wait(25);}}
const byName=(name:string)=>Array.from(document.querySelectorAll('button')).find(b=>b.getAttribute('aria-label')===name||b.textContent?.trim()===name)!;
const press=(name:string)=>{const b=byName(name);if(!b)throw Error('Missing button '+name);b.click();};
const box=()=>document.querySelector('.camera-viewfinder') as HTMLElement|null;
const photoCount=()=>document.querySelectorAll('.photo-wall .photo-cell.filled').length;
const result=document.getElementById('cue-results')!;
document.getElementById('run-cue-e2e')!.onclick=async()=>{
 const checks:string[]=[];const check=(label:string,pass:boolean)=>{if(!pass)throw Error(label);checks.push('PASS '+label);result.textContent=checks.join('\n');};
 try{
  await until(()=>!!byName('Mulai kamera'),'App mounted');press('Mulai kamera');await until(()=>frameCounter>15,'camera frames');
  press('Arsip foto 0/4');await wait(100);press('Aktifkan suara “kamera”');await wait(60);check('voice turns on only after operator action',!!recognition&&!!byName('Matikan mikrofon'));
  recognition!.say('kamera');await until(()=>!!box(),'spoken camera opens frame');check('voice opens frame and closes settings on the real stage',!!document.querySelector('.stage .camera-viewfinder')&&!document.querySelector('dialog[open]'));
  await wait(150);const initial=box()!.getBoundingClientRect().width;input.gap=.75;await wait(350);const large=box()!.getBoundingClientRect().width;input.gap=.15;await wait(350);const small=box()!.getBoundingClientRect().width;check('open palms resize both ways without taking a photo',large>initial+20&&small<initial-20&&photoCount()===0);
  press('Rekam audio');await until(()=>!!byName('Stop rekam'),'recording started');const counter=frameCounter;
  input.fist=true;input.y=.6;await until(()=>!!document.querySelector('.camera-viewfinder.ready'),'fist ready');input.y=.64;await wait(60);input.y=.75;await until(()=>photoCount()===1,'punch stores photo');
  check('one punch captures once and closes the central frame',!box()&&photoCount()===1);await wait(200);check('held fist does not make a second capture',photoCount()===1);
  const photo=(await readPhotos())[0];check('JPEG stores the selected square crop',photo.width===photo.height&&!!photo.crop&&photo.width===photo.crop.width&&photo.width<480);
  const img=await createImageBitmap(photo.blob);const inspect=document.createElement('canvas');inspect.width=img.width;inspect.height=img.height;const x=inspect.getContext('2d')!;x.drawImage(img,0,0);const pixel=x.getImageData(5,5,1,1).data;check('cropped JPEG contains camera pixels',pixel[0]+pixel[1]+pixel[2]>50);img.close();
  check('main tracking, visual canvas and recording continue through capture',frameCounter>counter+10&&!!byName('Stop rekam')&&!!document.querySelector('canvas[aria-label="Kanvas gerak dan visual generatif"]'));
  press('Buka tampilan Clean');await wait(100);check('Clean keeps the photo and live recording',document.querySelector('.app')!.classList.contains('clean-view')&&photoCount()===1&&!!byName('Stop rekam'));
  input.fist=false;input.gap=.4;await wait(1500);recognition!.say('kamera');await until(()=>!!box(),'second voice command');input.lost=true;await wait(350);input.lost=false;input.fist=true;input.y=.85;await wait(100);check('lost tracking and reacquisition cannot shoot',photoCount()===1&&!!box());recognition!.say('batal kamera');await until(()=>!box(),'voice cancel');check('spoken cancel closes only frame',photoCount()===1&&!!byName('Stop rekam'));
  input.fist=false;input.y=.6;press('Bingkai kamera');await until(()=>!!box(),'manual fallback');check('manual fallback opens the same frame',!!box());press('Tutup bingkai kamera');
  // Fill remaining slots via the existing manual capture controls, then verify voice full guard.
  for(let count=1;count<4;count++){press('Arsip foto '+count+'/4 · MIC ●');await wait(80);press('Jepret sekarang');await until(()=>photoCount()===count+1,'manual slot '+count);press('Tutup');await wait(60);}
  await wait(1500);recognition!.say('kamera');await wait(120);check('full wall blocks a fifth voice capture',!box()&&photoCount()===4);
  press('Arsip foto 4/4 · MIC ●');await wait(80);press('Ganti 2');await until(()=>!byName('Buka bingkai')?.disabled,'replacement selection committed');press('Buka bingkai');await until(()=>!!box(),'replacement frame');const before=(await readPhotos()).map(p=>p.createdAt);const oldImage=document.querySelector('.photo-wall .photo-cell:nth-child(2) img')!.getAttribute('src');
  input.fist=true;input.y=.6;await until(()=>!!document.querySelector('.camera-viewfinder.ready'),'replacement fist');input.y=.64;await wait(60);input.y=.75;await until(()=>!box(),'replacement strike');await until(()=>document.querySelector('.photo-wall .photo-cell:nth-child(2) img')!.getAttribute('src')!==oldImage,'replacement stored and committed');const after=(await readPhotos()).map(p=>p.createdAt);check('punch replacement changes only selected slot',after[1]!==before[1]&&[0,2,3].every(i=>after[i]===before[i]));
  check('one main camera stream supplies the complete performance',cameraStarts===1);
  press('Stop rekam');await wait(100);press('Kembali ke Studio');await wait(100);press('Arsip foto 4/4 · MIC ●');await wait(80);recognition!.onerror?.({error:'not-allowed'});await wait(80);check('permission failure stops listening and exposes manual fallback',!!byName('Aktifkan suara “kamera”')&&document.body.textContent!.includes('Izin mikrofon ditolak'));
  press('Tutup');checks.push('DONE · synthetic voice/landmarks/camera; physical mic and tracker not exercised.');result.textContent=checks.join('\n');
 }catch(e){result.textContent=checks.join('\n')+'\nFAIL '+(e as Error).message;}
};
document.getElementById('show-cue-preview')!.onclick=async()=>{input={gap:.45,y:.6,fist:false,lost:false};if(document.querySelector('dialog[open]'))press('Tutup');const count=photoCount();press('Arsip foto '+count+'/4');await wait(80);if(count===4)press('Ganti 2');await until(()=>!byName('Buka bingkai')?.disabled,'replacement selection committed');press('Buka bingkai');await wait(80);if(byName('Buka tampilan Clean'))press('Buka tampilan Clean');};
if(import.meta.hot)import.meta.hot.dispose(()=>{root.unmount();controls.remove();clearInterval(diagnostic);clearTimeout(cameraRaf);stream?.getTracks().forEach(t=>t.stop());CameraTracker.prototype.start=originalStart;CameraTracker.prototype.stop=originalStop;});
