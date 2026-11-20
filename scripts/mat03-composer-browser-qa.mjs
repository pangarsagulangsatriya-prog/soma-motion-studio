#!/usr/bin/env node
/** MAT-03 integrated Composer real-browser QA.
 * No camera or projector: only the visual Stage Monitor is inspected.
 */
import assert from 'node:assert/strict';
import {spawn} from 'node:child_process';
import {setTimeout as sleep} from 'node:timers/promises';
import {mkdirSync,writeFileSync} from 'node:fs';
import {chromium} from 'playwright';
const port=4193;
const origin='http://127.0.0.1:'+port+'/';
const artifact='artifacts/mat03-compose';
mkdirSync(artifact,{recursive:true});
const server=spawn(process.execPath,['node_modules/vite/bin/vite.js','--host','127.0.0.1',
 '--port',String(port),'--strictPort'],{stdio:['ignore','pipe','pipe']});
let stderr='',browser;
server.stderr.on('data',b=>{stderr=(stderr+String(b)).slice(-3000)});
const result={screenshots:[],phases:{},errors:[]};
try{
 let ready=false;
 for(let i=0;i<90;i++){
  try{if((await fetch(origin,{signal:AbortSignal.timeout(400)})).ok){ready=true;break}}catch{}
  await sleep(250);
 }
 assert.ok(ready,'SOMA development preview unavailable: '+stderr);
 browser=await chromium.launch({headless:true,args:[
  '--enable-webgl','--use-gl=angle','--use-angle=swiftshader',
  '--enable-unsafe-swiftshader','--disable-dev-shm-usage'
 ]});
 const page=await browser.newPage({viewport:{width:1440,height:1000},deviceScaleFactor:1});
 page.on('pageerror',e=>result.errors.push(e.message));
 await page.goto(origin,{waitUntil:'networkidle'});
 await page.getByRole('button',{name:'Stage 1'}).click();
 await page.getByRole('button',{name:'Compose workspace'}).click();
 const composer=page.getByRole('region',{name:'Compose Workspace — media dan layer'});
 await composer.waitFor({timeout:20000});
 const controls=composer.getByRole('region',{name:'Material MAT-03 Liquid Imprint'});
 await controls.waitFor({timeout:15000});
 try{
  await controls.getByText('Liquid Imprint · PixiJS v8 siap').waitFor({timeout:9500});
 }catch(err){
  const diagnostic=await page.evaluate(()=>({
   inspector:document.querySelector('.mat03-compose-controls')?.textContent,
   runtime:document.querySelector('.s64-runtime-status')?.textContent,
   canvasExists:!!document.querySelector('canvas[aria-label="MAT-03 Liquid Imprint PixiJS preview only"]')
  }));
  result.diagnostic=diagnostic;
  await page.screenshot({path:artifact+'/failure-init.png',fullPage:true});
  console.error('MAT03_INIT_DIAGNOSTIC',JSON.stringify(diagnostic));
  throw err;
 }
 const stage=composer.locator('canvas[aria-label^="Visual preview composer"]');
 await stage.waitFor({timeout:10000});
 const pixels=()=>stage.evaluate(canvas=>{
  const d=canvas.getContext('2d',{willReadFrequently:true}).getImageData(0,0,960,540).data;
  let colored=0,hash=2166136261;
  for(let y=180;y<375;y+=2)for(let x=405;x<555;x+=2){
   const i=(y*960+x)*4,r=d[i],g=d[i+1],b=d[i+2];
   if(r>35||g>35||b>35)colored++;
   hash=Math.imul(hash^(r+(g<<8)+(b<<16)),16777619)>>>0;
  }
  return {colored,hash};
 });
 for(const phase of ['Contact','Slide','Pivot','Release']){
  await controls.getByRole('button',{name:phase,exact:true}).click();
  await page.waitForTimeout(230);
  const v=await pixels();
  result.phases[phase]=v;
  if(v.colored<=25){
   const diagnostic=await page.evaluate(()=>{
    const a=document.querySelector('canvas[aria-label^="Visual preview composer"]');
    const b=document.querySelector('canvas[aria-label="MAT-03 Liquid Imprint PixiJS preview only"]');
    const check=(source)=>{
     if(!source)return null;
     const scratch=document.createElement('canvas');
     scratch.width=source.width;scratch.height=source.height;
     const c=scratch.getContext('2d',{willReadFrequently:true});
     c.drawImage(source,0,0);
     const pixels=c.getImageData(0,0,scratch.width,scratch.height).data;
     let colored=0,brightest=0;
     for(let i=0;i<pixels.length;i+=4){
      const m=Math.max(pixels[i],pixels[i+1],pixels[i+2]);
      if(m>35)colored++;
      brightest=Math.max(brightest,m);
     }
     return {colored,brightest,width:source.width,height:source.height};
    };
    return {preview:check(a),pixi:check(b),
     inspector:document.querySelector('.mat03-compose-controls')?.textContent,
     selected:document.querySelector('.uxr3-compose-preview-bar')?.textContent};
   });
   result.diagnostic=diagnostic;
   await page.screenshot({path:artifact+'/failure-page.png',fullPage:true});
   await stage.screenshot({path:artifact+'/failure-stage.png'});
   console.error('MAT03_DIAGNOSTIC',JSON.stringify(diagnostic));
  }
  assert.ok(v.colored>25,'No colored footprint pixels in Compose '+phase+': '+JSON.stringify(v));
  const file=artifact+'/'+phase.toLowerCase()+'.png';
  await stage.screenshot({path:file});result.screenshots.push(file);
 }
 assert.ok(new Set(Object.values(result.phases).map(x=>x.hash)).size>=3,
  'Composer material controls did not change actual Stage Monitor pixels');
 await controls.getByRole('button',{name:'Track / Timeline'}).click();
 await page.waitForTimeout(250);
 const noTrack=await pixels();
 result.emptyTrack=noTrack;
 assert.ok(noTrack.colored<result.phases.Contact.colored*.5,
  'Track mode must not invent contact when no verified Track input');
 const checkbox=controls.getByRole('checkbox',{name:'Tampilkan di Stage Monitor'});
 await checkbox.uncheck();
 await page.waitForTimeout(220);
 result.off=await pixels();
 assert.ok(result.off.colored<result.phases.Contact.colored*.5,
  'Disabled liquid material still visible on Composer monitor');
 assert.deepEqual(result.errors,[],'Browser runtime exceptions');
 console.log('MAT03_COMPOSER_QA_PASS',JSON.stringify(result));
}catch(err){
 result.errors.push(err?.stack||String(err));
 console.error('MAT03_COMPOSER_QA_FAIL',err);
 process.exitCode=1;
}finally{
 writeFileSync(artifact+'/report.json',JSON.stringify(result,null,2));
 await browser?.close();
 server.kill('SIGTERM');
}
