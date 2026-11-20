#!/usr/bin/env node
/** A pixel-level browser gate for TRACE/ECHO/RIFT and visible Compose cards.
 * Prevents "READY + BLACK" false positives that passed prior string tests.
 */
import assert from 'node:assert/strict';
import {spawn} from 'node:child_process';
import {setTimeout as sleep} from 'node:timers/promises';
import {existsSync,mkdirSync,writeFileSync} from 'node:fs';
import {chromium} from 'playwright';
const url='http://127.0.0.1:4186/';
const out='artifacts/fv-material';
mkdirSync(out,{recursive:true});
const server=spawn(process.execPath,['node_modules/vite/bin/vite.js','--host','127.0.0.1','--port','4186','--strictPort'],{stdio:['ignore','pipe','pipe']});
let stdErr='';
server.stderr.on('data',b=>{stdErr+=String(b);if(stdErr.length>4000)stdErr=stdErr.slice(-4000);});
let browser;
const report={runtime:[],cards:null,errors:[]};
try{
 let started=false;
 for(let i=0;i<80;i++){
  try{const r=await fetch(url,{signal:AbortSignal.timeout(500)});if(r.ok){started=true;break;}}catch{}
  await sleep(350);
 }
 if(!started)throw Error('Vite server unavailable: '+stdErr);
 browser=await chromium.launch({headless:true,args:['--use-angle=swiftshader','--enable-unsafe-swiftshader','--enable-webgl']});
 const page=await browser.newPage({viewport:{width:1440,height:900}});
 page.on('pageerror',error=>report.errors.push(error.message));
 await page.goto(url,{waitUntil:'domcontentloaded'});
 await page.waitForTimeout(500);
 const result=await page.evaluate(async()=>{
  const {PersistentHydraFootprintRuntime}=await import('/src/footprints/scenes/PersistentHydraFootprintRuntime.ts');
  const {flagshipHydraPatch}=await import('/src/studio/v3/flagshipVisualModel.ts');
  const {normalizeHydraFootprintSettings}=await import('/src/footprints/scenes/hydraFootprintModel.ts');
  const scan=(canvas)=>{
   if(!canvas)return {bright:0,reason:'no canvas'};
   const ctx=canvas.getContext('2d',{willReadFrequently:true});
   if(!ctx)return {bright:0,reason:'not readable 2d'};
   const data=ctx.getImageData(0,0,canvas.width,canvas.height).data;
   let bright=0,total=0;
   for(let i=0;i<data.length;i+=4){
    if(Math.max(data[i],data[i+1],data[i+2])>28)bright++;
    total++;
   }
   return {bright,total};
  };
  const tests=[];
  for(const mode of ['trace','echo','rift']){
   const settings=normalizeHydraFootprintSettings(flagshipHydraPatch(mode));
   const output=document.createElement('canvas');output.width=640;output.height=360;
   const runtime=new PersistentHydraFootprintRuntime();
   await runtime.initialize(output,settings);
   if(runtime.status!=='ready'){
    tests.push({mode,status:runtime.status,error:runtime.reason,bright:0});runtime.dispose();continue;
   }
   const source=document.createElement('canvas');source.width=640;source.height=360;
   const ctx=source.getContext('2d');ctx.fillStyle='#bec9c2';ctx.fillRect(0,0,640,360);
   const now=performance.now();
   const events=Array.from({length:6},(_,i)=>({
    schema:'soma.foot-motion-event',version:2,eventId:mode+'-step-'+i,
    originEventId:mode+'-step-'+i,sessionId:'pixel-gate',generation:1,
    actorId:i%2?'B':'A',foot:i%2?'right':'left',kind:'contact',
    source:'simulator',x:.18+i*.11,y:.37+(i%2)*.21,atMs:now+i*.001,
    speed:.4,confidence:1,verified:true,verification:'simulated',
    coordinateBasis:'simulated'
   }));
   runtime.tick(source,events,1,now,mode==='rift');
   runtime.tick(source,events,1,now+55,mode==='rift');
   const preview=runtime.compositingSource;
   tests.push({mode,status:runtime.status,error:runtime.reason,
     kind:preview===output?'webgl-output':'persistent-material',...scan(preview)});
   runtime.dispose();
  }
  return tests;
 });
 report.runtime=result;
 for(const r of result) {
  console.log('MATERIAL_PIXEL',JSON.stringify(r));
  assert.equal(r.status,'ready','GPU/Hydra startup failed: '+r.mode+' '+r.error);
  assert.equal(r.kind,'persistent-material','Flagship source must be 2D: '+r.mode);
  assert.ok(r.bright>25,'Black material output: '+r.mode+' bright='+r.bright);
 }
 // UI smoke: no source/video is required for animated demo previews.
 await page.getByRole('button',{name:'Compose workspace'}).click();
 const cards=page.locator('.fv04-live-canvas');
 await cards.first().waitFor({state:'visible',timeout:15000});
 const status=[];
 for(let tries=0;tries<8;tries++){
  await page.waitForTimeout(350);
  const samples=await cards.evaluateAll(nodes=>nodes.map(canvas=>{
   const ctx=canvas.getContext('2d',{willReadFrequently:true});
   if(!ctx)return {bright:0,source:'unreadable'};
   const data=ctx.getImageData(0,0,canvas.width,canvas.height).data;
   let bright=0;
   for(let i=0;i<data.length;i+=4)
    if(Math.max(data[i],data[i+1],data[i+2])>30)bright++;
   return {bright,source:canvas.dataset.previewSource??'uninitialized'};
  }));
  status.splice(0,status.length,...samples);
  if(samples.length===3&&samples.every(s=>s.bright>20))break;
 }
 report.cards=status;
 await page.screenshot({path:out+'/compose-cards.png',fullPage:true});
 console.log('CARD_PIXELS',JSON.stringify(status));
 assert.equal(status.length,3,'Expected exactly 3 flagship card canvases');
 assert.ok(status.every(s=>s.bright>20),'A flagship card is black: '+JSON.stringify(status));
 if(report.errors.length)console.log('PAGE_ERRORS',JSON.stringify(report.errors.slice(0,5)));
 console.log('FV_MATERIAL_PIXEL_QA_PASS');
}catch(error){
 report.errors.push(error.stack||String(error));
 console.error('FV_MATERIAL_PIXEL_QA_FAIL',error);
 process.exitCode=1;
}finally{
 writeFileSync(out+'/report.json',JSON.stringify(report,null,2));
 await browser?.close();
 server.kill('SIGTERM');
}
