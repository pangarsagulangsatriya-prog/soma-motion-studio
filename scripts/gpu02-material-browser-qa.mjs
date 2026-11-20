#!/usr/bin/env node
/** GPU-02 / MATERIAL-03: real Chromium WebGL2 pixel QA. No fake thumbnails.
 * Capture reproducible alpha-masked soles for 1/2/6 landings, slide,
 * pivot, lift, idle and A/B crossing from the isolated V5 research lab.
 */
import assert from 'node:assert/strict';
import {spawn} from 'node:child_process';
import {setTimeout as sleep} from 'node:timers/promises';
import {mkdirSync,writeFileSync} from 'node:fs';
import {chromium} from 'playwright';
const pixi=process.env.GPU02_RENDERER==='pixi';
const port=pixi?4189:4188;
const url=`http://127.0.0.1:${port}/gpu02-lab.html?qa=1${pixi?'&engine=pixi':''}`;
const directory=pixi?'artifacts/gpu02-pixi':'artifacts/gpu02';
mkdirSync(directory,{recursive:true});
const server=spawn(process.execPath,['node_modules/vite/bin/vite.js','--host','127.0.0.1',
 '--port',String(port),'--strictPort'],{stdio:['ignore','pipe','pipe']});
let stderr='',browser;
server.stderr.on('data',b=>{stderr+=String(b);if(stderr.length>4000)stderr=stderr.slice(-4000)});
const report={checks:[],screenshots:[],scenarios:{},errors:[]};
try{
 let ready=false;
 for(let i=0;i<90;i++){
  try{if((await fetch(url,{signal:AbortSignal.timeout(450)})).ok){ready=true;break}}catch{}
  await sleep(300);
 }
 assert.ok(ready,'GPU02 Vite startup failed: '+stderr);
 browser=await chromium.launch({headless:true,args:[
  '--disable-dev-shm-usage','--enable-webgl',
  '--use-gl=angle','--use-angle=swiftshader','--enable-unsafe-swiftshader'
 ]});
 const page=await browser.newPage({viewport:{width:1340,height:970},deviceScaleFactor:1});
 // Measure actual browser WebGL contexts on the shared stage canvas.
 // A reported numeric stats.contexts value alone cannot prove isolation.
 await page.addInitScript(()=>{
  const original=HTMLCanvasElement.prototype.getContext;
  const live=new Set();
  window.__gpu02ContextProbe={stageContexts:0,allContexts:0,canvases:[]};
  HTMLCanvasElement.prototype.getContext=function(kind,...args){
   const result=original.call(this,kind,...args);
   if(result&&/^(webgl|webgl2|experimental-webgl)$/.test(String(kind))){
    if(!live.has(result)){
     live.add(result);
     window.__gpu02ContextProbe.canvases.push({
      id:this.id||'(detached)',
      attached:this.isConnected,
      width:this.width,height:this.height,kind:String(kind)
     });
    }
    window.__gpu02ContextProbe.allContexts=live.size;
    if(this.id==='gpu02-stage'){
     window.__gpu02ContextProbe.stageContexts=1;
    }
   }
   return result;
  };
 });
 page.on('pageerror',e=>report.errors.push(e.message));
 await page.goto(url,{waitUntil:'networkidle'});
 const probe=await page.evaluate(()=>window.__gpu02ContextProbe);
 assert.equal(probe.stageContexts,1,
  'Expected exactly one real WebGL context on the stage canvas');
 report.contextProbe=probe;
 await page.locator('#gpu02-stage').waitFor({state:'visible'});
 const cases=[
  ['one',1,10390],['two',2,10450],['six',6,10450],
  ['slide',1,10390],['pivot',1,10390],['release',1,10390],
  ['idle',0,10450],['crossing',4,10450]
 ];
 for(const [name,count,atMs] of cases){
  const stats=await page.evaluate(([scenario,time])=>
   window.__gpu02QA?.runScenario(scenario,time),[name,atMs]);
  assert.ok(stats,'GPU02 research engine did not initialize');
  assert.equal(stats.renderer,pixi?'PixiJS v8 WebGL2':'WebGL2');
  assert.equal(stats.contexts,1,'Unexpected second GPU renderer context');
  assert.equal(stats.activeImprints,count,'Unexpected stamp count for '+name);
  assert.equal(stats.allocatedTextures,count,'Texture leak or duplicate stamp '+name);
  const pixels=await page.evaluate(()=>{
   const stage=document.querySelector('#gpu02-stage');
   const c=document.createElement('canvas');c.width=1280;c.height=720;
   const ctx=c.getContext('2d',{willReadFrequently:true});
   ctx.drawImage(stage,0,0,1280,720);
   const data=ctx.getImageData(0,0,1280,720).data;
   let lit=0,hash=2166136261,outside=0;
   for(let y=0;y<720;y+=2)for(let x=0;x<1280;x+=2){
    const i=(y*1280+x)*4,alpha=data[i+3];
    if(alpha>25)lit++;
    if(alpha>25&&(x<120||x>1190||y<95||y>635))outside++;
    hash=Math.imul(hash^(data[i]+(data[i+1]<<3)+(data[i+2]<<7)+(alpha<<1)),16777619)>>>0;
   }
   const positions=[
    [.16,.38],[.30,.59],[.44,.38],[.58,.59],[.72,.38],[.85,.59]
   ];
   const regions=positions.map(([u,v])=>{
    let count=0;
    const cx=Math.round(u*1280),cy=Math.round(v*720);
    for(let y=cy-68;y<cy+68;y+=3)for(let x=cx-44;x<cx+44;x+=3)
     if(x>=0&&y>=0&&x<1280&&y<720&&data[(y*1280+x)*4+3]>30)count++;
    return count;
   });
   return {lit,hash,outside,regions};
  });
  report.scenarios[name]={stats,pixels};
  assert.ok(pixels.outside<8,'Pigment escaped sole region: '+name);
  if(count>0)assert.ok(pixels.lit>45,'Black/empty GPU pixels: '+name);
  else assert.equal(pixels.lit,0,'Idle residue exceeded bounded history');
  if(name==='six')assert.ok(pixels.regions.every(v=>v>16),
   'One or more of six soles missing: '+JSON.stringify(pixels.regions));
  const file=directory+'/'+name+'-chromium.png';
  await page.locator('#gpu02-stage').screenshot({path:file});
  report.screenshots.push(file);
 }
 const o=report.scenarios;
 assert.ok(o.six.pixels.lit>o.one.pixels.lit*3,
  'Six impacts do not produce six distinct footprints');
 assert.notEqual(o.one.pixels.hash,o.slide.pixels.hash,
  'Slide did not produce a visible deformation');
 assert.notEqual(o.one.pixels.hash,o.pivot.pixels.hash,
  'Pivot did not produce a visible deformation');
 assert.notEqual(o.one.pixels.hash,o.release.pixels.hash,
  'Release did not produce a visible toe-off');
 report.checks.push('Browser getContext probe confirms one actual stage GPU context');
 report.checks.push('One WebGL2 context; one/two/six contacts produce exact imprints');
 report.checks.push('Liquid pigment stays within original foot alpha');
 report.checks.push('Slide/pivot/release yield distinct GPU pixel captures');
 report.checks.push('A/B crossing and bounded idle/expiry captured');
 // Temporal proof: identical stamped silhouette, moving internal pigment.
 // The two frames are independently rendered from the same verified contact.
 const temporal=await page.evaluate(()=>{
  const stage=document.querySelector('#gpu02-stage');
  if(!(stage instanceof HTMLCanvasElement)||!window.__gpu02QA)
   throw Error('GPU02 stage unavailable for motion verification');
  const c=document.createElement('canvas');c.width=stage.width;c.height=stage.height;
  const ctx=c.getContext('2d',{willReadFrequently:true});
  if(!ctx)throw Error('Canvas2D temporal QA unavailable');
  const pixels=(time)=>{
   window.__gpu02QA.runScenario('one',time);
   ctx.clearRect(0,0,c.width,c.height);
   ctx.drawImage(stage,0,0);
   return ctx.getImageData(0,0,c.width,c.height).data;
  };
  const first=pixels(10390),second=pixels(10990);
  let overlapping=0,changed=0,union=0,silhouetteAgreement=0;
  for(let i=0;i<first.length;i+=4){
   const a=first[i+3]>48,b=second[i+3]>48;
   if(a||b)union++;
   if(a&&b){
    silhouetteAgreement++;
    overlapping++;
    if(Math.abs(first[i]-second[i])+
       Math.abs(first[i+1]-second[i+1])+
       Math.abs(first[i+2]-second[i+2])>27)changed++;
   }
  }
  return {
   overlapping,changed,union,
   movingPigmentRatio:changed/Math.max(1,overlapping),
   stableSilhouetteRatio:silhouetteAgreement/Math.max(1,union)
  };
 });
 report.temporal=temporal;
 assert.ok(temporal.overlapping>1500,'Temporal mask too small or missing');
 assert.ok(temporal.movingPigmentRatio>.12,
  'Liquid pigment did not visibly move within the same contact: '+JSON.stringify(temporal));
 assert.ok(temporal.stableSilhouetteRatio>.90,
  'Foot silhouette changed while only pigment time advanced: '+JSON.stringify(temporal));
 await page.evaluate(()=>window.__gpu02QA.runScenario('one',10390));
 await page.locator('#gpu02-stage').screenshot({path:directory+'/flow-early-chromium.png'});
 await page.evaluate(()=>window.__gpu02QA.runScenario('one',10990));
 await page.locator('#gpu02-stage').screenshot({path:directory+'/flow-late-chromium.png'});
 report.screenshots.push(directory+'/flow-early-chromium.png',directory+'/flow-late-chromium.png');
 // Review motion as a *sequence* instead of asserting artistic quality
 // from only two PNGs. Each frame comes from real Chromium/WebGL pixels.
 for(let i=0;i<12;i++){
  await page.evaluate(time=>window.__gpu02QA.runScenario('one',time),10390+i*90);
  const file=directory+'/motion-'+String(i).padStart(2,'0')+'.png';
  await page.locator('#gpu02-stage').screenshot({path:file});
  report.screenshots.push(file);
 }
 report.checks.push('Moving internal pigment across 600ms with stable footprint alpha silhouette');
 report.checks.push('Twelve actual Chromium frames retained for motion/art review');
 const accelerated=await page.evaluate(()=>window.__gpu02QA.acceleratedSweep());
 report.accelerated=accelerated;
 assert.equal(accelerated.sampledMinutes,10);
 assert.ok(accelerated.frames>=100);
 assert.equal(accelerated.contexts,1);
 assert.ok(accelerated.peakTextures<=32);
 assert.equal(accelerated.finalTextures,0,'GPU textures failed to expire on long timeline');
 report.checks.push('Accelerated 10-minute simulated event timeline keeps texture budget and expires all masks');
 const dense=await page.evaluate(()=>window.__gpu02QA.denseStress());
 report.dense=dense;
 assert.equal(dense.attempted,40);
 assert.equal(dense.shown,32,'Dense scene must cap at 32 authentic sole stamps');
 assert.equal(dense.allocated,32,'Dense scene must cap mask allocations');
 assert.equal(dense.maxTextures,32);
 assert.equal(dense.contexts,1);
 assert.equal(dense.afterClear,0,'GPU textures leaked after dense scene cleanup');
 assert.ok(Number.isFinite(dense.renderMs)&&dense.renderMs>=0);
 report.checks.push('Forty synthetic contacts are capped to 32 live GPU masks, then all released');
 assert.equal(report.errors.length,0,'Chromium errors: '+report.errors.join('; '));
 console.log(pixi?'ENGINE02_PIXI_PIXEL_QA_PASS':'GPU02_PIXEL_QA_PASS',JSON.stringify(report));
}catch(e){
 report.errors.push(e.stack||String(e));
 console.error('GPU02_PIXEL_QA_FAIL',e);
 process.exitCode=1;
}finally{
 writeFileSync(directory+'/report.json',JSON.stringify(report,null,2));
 await browser?.close();
 server.kill('SIGTERM');
}
