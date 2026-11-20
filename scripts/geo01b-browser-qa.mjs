#!/usr/bin/env node
/** GEO-01B actual Chromium pixel gate for sole anatomy and deformation.
 * Inspects real Canvas2D pixels, not a mocked drawing context.
 * No camera or projector authorization is opened.
 */
import assert from 'node:assert/strict';
import {spawn} from 'node:child_process';
import {setTimeout as sleep} from 'node:timers/promises';
import {mkdirSync,writeFileSync} from 'node:fs';
import {chromium} from 'playwright';
const url='http://127.0.0.1:4187/';
const directory='artifacts/geo01b';
mkdirSync(directory,{recursive:true});
const server=spawn(process.execPath,['node_modules/vite/bin/vite.js','--host','127.0.0.1',
 '--port','4187','--strictPort'],{stdio:['ignore','pipe','pipe']});
let stderr='',browser;
server.stderr.on('data',b=>{stderr+=String(b);if(stderr.length>3000)stderr=stderr.slice(-3000)});
const report={checks:[],errors:[]};
try{
 let ready=false;
 for(let i=0;i<80;i++){
  try{if((await fetch(url,{signal:AbortSignal.timeout(500)})).ok){ready=true;break}}catch{}
  await sleep(300);
 }
 assert.ok(ready,'Vite did not start '+stderr);
 browser=await chromium.launch({headless:true,args:['--disable-dev-shm-usage']});
 const page=await browser.newPage({viewport:{width:1100,height:860},deviceScaleFactor:1});
 page.on('pageerror',e=>report.errors.push(e.message));
 await page.goto(url,{waitUntil:'domcontentloaded'});
 const result=await page.evaluate(async()=>{
  const {paintAuthenticFootprint}=await import('/src/footprints/scenes/authenticFootGeometry.ts');
  const scene=document.createElement('canvas');
  scene.id='geo01b-gallery';scene.width=1040;scene.height=720;
  scene.style.cssText='display:block;margin:8px;background:#000';
  document.body.replaceChildren(scene);
  const ctx=scene.getContext('2d',{willReadFrequently:true});
  if(!ctx)throw Error('Canvas unavailable');
  ctx.fillStyle='#000';ctx.fillRect(0,0,scene.width,scene.height);
  const variants=[
   {name:'L stance',side:'left',deformation:{mode:'stance',amount:0}},
   {name:'R stance',side:'right',deformation:{mode:'stance',amount:0}},
   {name:'L heel',side:'left',deformation:{mode:'heel-strike',amount:1}},
   {name:'R toe-off',side:'right',deformation:{mode:'toe-off',amount:1}},
   {name:'L slide',side:'left',deformation:{mode:'slide',amount:1,travelX:.8,travelY:.4}},
   {name:'R pivot',side:'right',deformation:{mode:'pivot',amount:1,pivotRad:.75}},
   {name:'L pivot',side:'left',deformation:{mode:'pivot',amount:1,pivotRad:-.75}},
   {name:'R heel',side:'right',deformation:{mode:'heel-strike',amount:1}}
  ];
  const measures=[];
  for(let i=0;i<variants.length;i++){
   const v=variants[i],col=i%4,row=Math.floor(i/4);
   const sx=col*260+24,sy=row*360+20;
   ctx.fillStyle='#ccc';ctx.font='18px sans-serif';ctx.fillText(v.name,sx+10,sy+300);
   paintAuthenticFootprint(ctx,{x:sx+110,y:sy+135,side:v.side,
    widthPx:67,lengthPx:208,alpha:1,color:'#f0f0e8',deformation:v.deformation});
   const pixels=ctx.getImageData(sx+15,sy+18,190,245).data;
   let lit=0,hash=2166136261;
   for(let k=0;k<pixels.length;k+=4){
    const value=pixels[k]+pixels[k+1]+pixels[k+2];
    if(value>90)lit++;
    hash=Math.imul(hash^Math.min(255,value),16777619)>>>0;
   }
   measures.push({name:v.name,lit,hash});
  }
  return measures;
 });
 report.measures=result;
 for(const item of result)assert.ok(item.lit>500&&item.lit<190*245*.8,
  'Blank or solid footprint '+JSON.stringify(item));
 assert.equal(new Set(result.map(x=>x.hash)).size,result.length,
  'Two supposedly different silhouettes have identical pixels');
 report.checks.push('Canvas2D: left/right, heel, toe-off, slide, pivot produce eight distinct nonblank captures');
 await page.locator('#geo01b-gallery').screenshot({path:directory+'/anatomy-deformation-chromium.png'});
 assert.equal(report.errors.length,0,'Browser page errors: '+report.errors.join('; '));
 console.log('GEO01B_PIXEL_QA_PASS',JSON.stringify(report));
}catch(error){
 report.errors.push(error.stack||String(error));
 console.error('GEO01B_PIXEL_QA_FAIL',error);
 process.exitCode=1;
}finally{
 writeFileSync(directory+'/report.json',JSON.stringify(report,null,2));
 await browser?.close();server.kill('SIGTERM');
}
