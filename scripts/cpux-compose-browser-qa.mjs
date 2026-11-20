#!/usr/bin/env node
/** CP-UX: verify the actual Composer UX in Chromium (desktop + mobile).
 * No projector or camera actions. Uses the existing software preview gate. */
import assert from 'node:assert/strict';
import {spawn} from 'node:child_process';
import {setTimeout as sleep} from 'node:timers/promises';
import {mkdirSync,writeFileSync} from 'node:fs';
import {chromium} from 'playwright';

const dir='artifacts/cpux-compose';
mkdirSync(dir,{recursive:true});
const port=4194,origin='http://127.0.0.1:'+port+'/';
const server=spawn(process.execPath,['node_modules/vite/bin/vite.js',
 '--host','127.0.0.1','--port',String(port),'--strictPort'],{
 stdio:['ignore','pipe','pipe']
});
let err='',browser;
server.stderr.on('data',b=>{err=(err+String(b)).slice(-2000)});
const report={checks:[],phases:{},screenshots:[],errors:[]};
try{
 let online=false;
 for(let i=0;i<90;i++){
  try{if((await fetch(origin,{signal:AbortSignal.timeout(450)})).ok){online=true;break}}catch{}
  await sleep(250);
 }
 assert.ok(online,'Vite not ready: '+err);
 browser=await chromium.launch({headless:true,args:[
  '--enable-webgl','--use-gl=angle','--use-angle=swiftshader',
  '--enable-unsafe-swiftshader','--disable-dev-shm-usage'
 ]});
 const page=await browser.newPage({viewport:{width:1500,height:940},deviceScaleFactor:1});
 page.on('pageerror',e=>report.errors.push(e.message));
 await page.goto(origin,{waitUntil:'networkidle'});
 await page.getByRole('button',{name:'Stage 1'}).click();
 await page.getByRole('button',{name:'Compose workspace'}).click();
 const root=page.getByRole('region',{name:'Compose Workspace — media dan layer'});
 await root.waitFor({timeout:20000});
 const resume=page.getByRole('button',{name:'Resume preview'});
 if(await resume.count())await resume.first().click();
 const stage=root.locator('canvas[aria-label^="Visual preview composer"]');
 await stage.waitFor({timeout:15000});
 await page.waitForFunction(()=>{
  const c=document.querySelector('canvas[aria-label^="Visual preview composer"]');
  return c?.dataset.mat03Active==='drawn';
 },null,{timeout:25000});
 const mat=root.getByRole('region',{name:'Material MAT-03 Liquid Imprint'});
 await mat.waitFor({timeout:10000});
 for(const selector of ['details.soma-ia-media','details.soma-ia-layers','details.cpux-timeline-drawer','details.cp04-command-menu']){
  const d=root.locator(selector);
  assert.equal(await d.count(),1,'Missing collapsible control '+selector);
  assert.equal(await d.evaluate(el=>el.open),false,'Default must be collapsed: '+selector);
 }
 report.checks.push('Media, Layers, Timeline and secondary commands collapse by default');
 const layout=await root.locator('.s64-layout').evaluate(el=>{
  const r=getComputedStyle(el);
  const stage=el.querySelector('.cp02-editor').getBoundingClientRect();
  const inspector=el.querySelector('.cp02-inspector').getBoundingClientRect();
  const media=el.querySelector('.cp02-library').getBoundingClientRect();
  return {columns:r.gridTemplateColumns,stageWidth:stage.width,
   inspectorX:inspector.x,stageRight:stage.right,
   mediaX:media.x,mediaY:media.y};
 });
 report.desktop=layout;
 assert.ok(layout.stageWidth>480,'Stage canvas lacks primary space '+JSON.stringify(layout));
 assert.ok(layout.inspectorX>layout.stageRight-15,'Inspector should be to the right of preview');
 assert.ok(layout.mediaY>=0,'Media drawer missing');
 const duplicate=await page.locator('.fp-stage-overview:not([hidden])').first().evaluate(el=>getComputedStyle(el).display).catch(()=>null);
 assert.equal(duplicate,'none','Duplicate three-monitor overview remains exposed in Composer');
 report.checks.push('Stage Monitor dominant two-column layout and no duplicate monitors');
 assert.equal(await root.getByText('VISUAL RESET · V5').count(),0);
 assert.equal(await root.getByText('Katalog visual lama').count(),0);
 const pixels=()=>stage.evaluate(canvas=>{
  const data=canvas.getContext('2d',{willReadFrequently:true}).getImageData(0,0,960,540).data;
  let lit=0,hash=2166136261;
  for(let y=180;y<375;y+=2)for(let x=405;x<555;x+=2){
   const i=4*(y*960+x),r=data[i],g=data[i+1],b=data[i+2];
   if(Math.max(r,g,b)>35)lit++;
   hash=Math.imul(hash^(r+(g<<8)+(b<<16)),16777619)>>>0;
  }
  return {lit,hash};
 });
 for(const phase of ['Contact','Slide','Pivot','Release']){
  await mat.getByRole('button',{name:phase,exact:true}).click();
  await page.waitForTimeout(260);
  const shot=await pixels();report.phases[phase]=shot;
  assert.ok(shot.lit>50,'No liquid pigment visible for '+phase+': '+JSON.stringify(shot));
  const p=dir+'/'+phase.toLowerCase()+'.png';await stage.screenshot({path:p});
  report.screenshots.push(p);
 }
 assert.ok(new Set(Object.values(report.phases).map(x=>x.hash)).size>=3,
  'Changing material phase does not change Composer pixels');
 report.checks.push('Contact/Slide/Pivot/Release change real Stage Monitor pixels');
 const timeline=root.locator('details.cpux-timeline-drawer');
 await timeline.locator('summary').click();
 assert.equal(await timeline.evaluate(x=>x.open),true);
 await timeline.getByRole('group',{name:'Kontrol playback event'}).waitFor();
 await timeline.locator('summary').click();
 const layers=root.locator('details.soma-ia-layers');
 await layers.locator('summary').click();
 await layers.getByRole('button',{name:'+ Layer'}).waitFor();
 await layers.locator('summary').click();
 const media=root.locator('details.soma-ia-media');
 await media.locator('summary').click();
 await media.getByText('+ Import image / video').waitFor();
 await media.locator('summary').click();
 const options=root.locator('details.cp04-command-menu');
 await options.locator('summary').click();
 await options.getByRole('button',{name:'Reset komposisi'}).waitFor();
 await options.locator('summary').click();
 report.checks.push('Timeline, Layers, Media import and Undo/Reset remain accessible');
 await mat.getByRole('button',{name:'Track',exact:true}).click();
 await page.waitForTimeout(210);
 assert.ok((await pixels()).lit<report.phases.Contact.lit*.5,
  'Empty Track creates a false footprint');
 await mat.getByRole('checkbox',{name:'Tampilkan di Stage Monitor'}).uncheck();
 await page.waitForTimeout(210);
 assert.ok((await pixels()).lit<report.phases.Contact.lit*.5,
  'Liquid toggle OFF leaves visible pigment');
 report.checks.push('Empty Track and material OFF remain safe');
 await mat.getByRole('checkbox',{name:'Tampilkan di Stage Monitor'}).check();
 await mat.getByRole('button',{name:'Demo',exact:true}).click();
 await mat.getByRole('button',{name:'Contact'}).click();
 await page.waitForTimeout(200);
 const desktop=dir+'/desktop.png';await page.screenshot({path:desktop});report.screenshots.push(desktop);
 await page.setViewportSize({width:390,height:844});
 await page.waitForTimeout(320);
 const mobile=await root.locator('.s64-layout').evaluate(el=>{
  const editor=el.querySelector('.cp02-editor').getBoundingClientRect();
  const inspector=el.querySelector('.cp02-inspector').getBoundingClientRect();
  const media=el.querySelector('.cp02-library').getBoundingClientRect();
  return {editorWidth:editor.width,inspectorTop:inspector.top,editorBottom:editor.bottom,
   mediaTop:media.top,inspectorBottom:inspector.bottom,viewport:innerWidth};
 });
 report.mobile=mobile;
 assert.ok(mobile.editorWidth<=mobile.viewport,
  'Mobile Composer stage overflows viewport: '+JSON.stringify(mobile));
 assert.ok(mobile.inspectorTop>=mobile.editorBottom-10,
  'Mobile Inspector should stack after Stage Monitor');
 assert.ok(mobile.mediaTop>=mobile.inspectorBottom-10,
  'Mobile Media should stack after Inspector');
 const mobileShot=dir+'/mobile.png';await page.screenshot({path:mobileShot});report.screenshots.push(mobileShot);
 report.checks.push('390px mobile stack keeps Stage → Inspector → Media order');
 assert.deepEqual(report.errors,[],'JavaScript exceptions');
 console.log('CPUX_COMPOSER_QA_PASS',JSON.stringify(report));
}catch(e){
 report.errors.push(String(e?.stack??e));
 console.error('CPUX_COMPOSER_QA_FAIL',e);
 process.exitCode=1;
}finally{
 writeFileSync(dir+'/report.json',JSON.stringify(report,null,2));
 await browser?.close();
 server.kill('SIGTERM');
}
