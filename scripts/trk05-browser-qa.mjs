#!/usr/bin/env node
/** TRK-05 browser E2E and visual evidence.
 * Run against a local production Vite preview. Screenshot diffs activate only
 * after approved golden images are checked into tests/visual-baselines/trk05.
 * Missing baselines are explicitly PENDING, never silently treated as PASS.
 */
import assert from 'node:assert/strict';
import {spawn} from 'node:child_process';
import {mkdirSync,existsSync,writeFileSync,readFileSync,appendFileSync} from 'node:fs';
import {join,resolve} from 'node:path';
import {setTimeout as sleep} from 'node:timers/promises';
import {chromium} from 'playwright';
import {PNG} from 'pngjs';
import pixelmatch from 'pixelmatch';

const port=4175;
const base='http://127.0.0.1:'+port+'/soma-motion-studio/';
const output=resolve('artifacts/trk05');
const baselineDir=resolve('tests/visual-baselines/trk05');
mkdirSync(output,{recursive:true});
const viewports=[
 {id:'desktop-1920x1080',width:1920,height:1080},
 {id:'desktop-1440x900',width:1440,height:900},
 {id:'laptop-1366x768',width:1366,height:768},
 {id:'tablet-1024x768',width:1024,height:768},
 {id:'portrait-768x1024',width:768,height:1024},
 {id:'mobile-390x844',width:390,height:844}
];
const report={commit:process.env.GITHUB_SHA??'local',generatedAt:new Date().toISOString(),
 url:base,viewports:[],checks:[],screenshots:[],baselinePending:[],diffFailures:[],issues:[]};
const issue=(label,error)=>{
 const detail=error instanceof Error?error.message:String(error);
 report.issues.push({label,detail});
 console.error('[FAIL]',label,detail);
};
const check=(label,fn)=>Promise.resolve().then(fn).then(
 ()=>{report.checks.push({label,result:'PASS'});console.log('[PASS]',label);},
 error=>{report.checks.push({label,result:'FAIL'});issue(label,error);}
);
const waitUntilReady=async()=>{
 for(let i=0;i<75;i++){
  try{const result=await fetch(base,{signal:AbortSignal.timeout(800)});
   if(result.ok)return;
  }catch{}
  await sleep(400);
 }
 throw Error('Local Vite preview did not start at '+base);
};
const server=spawn(process.execPath,['node_modules/vite/bin/vite.js','preview',
 '--mode','githubpages','--host','127.0.0.1','--port',String(port),'--strictPort'],{
 cwd:process.cwd(),stdio:['ignore','pipe','pipe']});
server.stdout.on('data',()=>{});
server.stderr.on('data',b=>process.stderr.write(b));
let browser=null;
const screenshot=async(page,viewport,slug)=>{
 await page.waitForTimeout(170);
 const file=viewport+'__'+slug+'.png';
 const bytes=await page.screenshot({
  path:join(output,file),fullPage:false,animations:'disabled',
  caret:'hide'
 });
 const record={file,comparison:'PENDING'};
 const reference=join(baselineDir,file);
 if(existsSync(reference)){
  const actual=PNG.sync.read(bytes),golden=PNG.sync.read(readFileSync(reference));
  if(actual.width!==golden.width||actual.height!==golden.height){
   record.comparison='FAIL: dimension mismatch';
   report.diffFailures.push(record);
  }else{
   const diff=new PNG({width:actual.width,height:actual.height});
   const mismatch=pixelmatch(actual.data,golden.data,diff.data,actual.width,actual.height,
    {threshold:.12,includeAA:false});
   const rate=mismatch/(actual.width*actual.height);
   record.pixelDiffRate=rate;
   record.comparison=rate<=.005?'PASS':'FAIL';
   if(record.comparison==='FAIL'){
    report.diffFailures.push(record);
    writeFileSync(join(output,viewport+'__'+slug+'__diff.png'),PNG.sync.write(diff));
   }
  }
 }else{
  report.baselinePending.push(file);
 }
 report.screenshots.push(record);
};
const stage=(page)=>page.locator('.fp-stage-workspace[data-workspace="track"]');
const choose=async(page,name)=>{
 const picker=stage(page).locator('.soma-track-source-select');
 await picker.locator('summary').click();
 await picker.getByRole('button',{name,exact:true}).click();
 await page.waitForTimeout(250);
};
const bounds=async(locator)=>{
 const rect=await locator.boundingBox();
 assert.ok(rect,'Element not visible: '+locator.toString());
 return rect;
};
const layoutCheck=async(page,v)=>{
 const root=stage(page),rail=root.locator('.soma-track-source-panel');
 const monitor=root.locator('.fp-stage-overview > .fp-stage-video');
 const media=root.locator('.fp-stage-video-content');
 await rail.waitFor({state:'visible'});
 await monitor.waitFor({state:'visible'});
 const [a,b,c]=await Promise.all([bounds(rail),bounds(monitor),bounds(media)]);
 const railSizing=await rail.evaluate(el=>{
  const css=getComputedStyle(el);
  const usable=el.clientWidth-parseFloat(css.paddingLeft)-parseFloat(css.paddingRight);
  const picker=el.querySelector('.soma-track-source-select');
  const status=el.querySelector('.soma-track-source-status');
  return {direction:css.flexDirection,usable,
   pickerWidth:picker?.getBoundingClientRect().width??0,
   statusWidth:status?.getBoundingClientRect().width??0};
 });
 assert.equal(railSizing.direction,'column','Track source controls must stack vertically');
 assert.ok(railSizing.pickerWidth>=railSizing.usable*.82,
  'Source picker compressed: '+JSON.stringify(railSizing));
 assert.ok(railSizing.statusWidth>=railSizing.usable*.82,
  'Source status compressed: '+JSON.stringify(railSizing));
 const horizontal=await page.evaluate(()=>({
  root:document.documentElement.scrollWidth,viewport:window.innerWidth
 }));
 assert.ok(horizontal.root<=horizontal.viewport+4,
  'Horizontal overflow: '+JSON.stringify(horizontal));
 assert.ok(b.x>=0&&b.x+b.width<=v.width+4,'Monitor exceeds viewport');
 assert.ok(Math.abs(c.width/c.height-16/9)<.06,'Monitor distorted from 16:9');
 assert.ok(b.width>=Math.min(205,v.width-36),'Monitor collapsed');
 assert.ok(await root.locator('.fp-stage-side-previews').evaluate(el=>
  el.hasAttribute('hidden')||getComputedStyle(el).display==='none'),
  'BODY/FLOOR tiles visible in Track');
 const sidebreak=v.width<=850;
 if(sidebreak){
  assert.ok(b.y>=a.y+a.height-3,'Portrait source/preview overlap');
 }else{
  assert.ok(a.x+a.width<=b.x-6,'Desktop source and camera overlap');
  assert.ok(a.width<=294,'Source panel too wide: '+a.width);
  const max=v.height<=700?620:v.height<=850?760:960;
  assert.ok(b.width<=max+3,'Camera too wide: '+b.width+' > '+max);
 }
 const metrics={viewport:v.id,rail:a,monitor:b,media:c,overflow:horizontal.root-horizontal.viewport};
 report.viewports.push(metrics);
};
const makeVideo=async(page)=>{
 const data=await page.evaluate(async()=>{
  const canvas=document.createElement('canvas');canvas.width=320;canvas.height=180;
  const ctx=canvas.getContext('2d');
  if(!ctx||!window.MediaRecorder)throw Error('No canvas MediaRecorder support');
  const stream=canvas.captureStream(16);
  const recorder=new MediaRecorder(stream,{mimeType:'video/webm'});
  const chunks=[];
  recorder.ondataavailable=e=>{if(e.data.size)chunks.push(e.data);};
  const ended=new Promise((resolve,reject)=>{
   recorder.onerror=e=>reject(new Error(String(e.error)));
   recorder.onstop=resolve;
  });
  recorder.start();
  for(let i=0;i<16;i++){
   ctx.fillStyle=i%2?'#5a7949':'#344c36';ctx.fillRect(0,0,320,180);
   ctx.fillStyle='#dfe4d0';ctx.fillRect(65+i*3,45,60,120);
   await new Promise(r=>setTimeout(r,55));
  }
  recorder.stop();await ended;
  stream.getTracks().forEach(track=>track.stop());
  const blob=new Blob(chunks,{type:'video/webm'});
  return await new Promise((resolve,reject)=>{
   const reader=new FileReader();
   reader.onload=()=>resolve(String(reader.result).split(',')[1]);
   reader.onerror=()=>reject(reader.error);
   reader.readAsDataURL(blob);
  });
 });
 return Buffer.from(data,'base64');
};
const run=async()=>{
 await waitUntilReady();
 browser=await chromium.launch({headless:true,args:[
  '--use-fake-device-for-media-stream','--use-fake-ui-for-media-stream',
  '--enable-unsafe-swiftshader'
 ]});
 for(const v of viewports){
  const context=await browser.newContext({
   viewport:{width:v.width,height:v.height},deviceScaleFactor:1,
   reducedMotion:'reduce',colorScheme:'dark',locale:'id-ID'
  });
  const page=await context.newPage();
  page.setDefaultTimeout(10000);
  const browserFailures=[];
  page.on('pageerror',err=>{browserFailures.push(err.message);issue(v.id+' runtime exception',err);});
  page.on('response',res=>{if(res.status()>=400&&/\\.(js|css|wasm)(\\?|$)/.test(res.url()))
   browserFailures.push('HTTP '+res.status()+' '+res.url());});
  page.on('console',msg=>{if(msg.type()==='error')browserFailures.push('Console '+msg.text());});
  await check(v.id+' Track load',async()=>{
   await page.goto(base,{waitUntil:'domcontentloaded',timeout:35000});
   try{await stage(page).waitFor({state:'visible',timeout:12000});}
   catch(error){
    const title=await page.title().catch(()=>'<title unavailable>');
    const html=await page.content().catch(()=>'<html unavailable>');
    writeFileSync(join(output,v.id+'__load-failure.html'),html);
    writeFileSync(join(output,v.id+'__load-failure.json'),
     JSON.stringify({url:page.url(),title,browserFailures},null,2));
    await page.screenshot({path:join(output,v.id+'__load-failure.png')}).catch(()=>{});
    throw Error('Track failed to render at '+page.url()+
     '; see load-failure screenshot/HTML. '+String(error));
   }
  });
  if(!(await stage(page).count())){
   await context.close();throw Error('Track did not mount; abort QA after first viewport');
  }
  if(await stage(page).count()){
   await check(v.id+' measured layout',()=>layoutCheck(page,v));
   await check(v.id+' screenshot no source',()=>screenshot(page,v.id,'track-empty'));
   await check(v.id+' source menu',async()=>{
    const picker=stage(page).locator('.soma-track-source-select');
    await picker.locator('summary').click();
    for(const option of ['Webcam laptop','Kamera HP','Video MP4','Simulasi 3D']){
     assert.ok(await picker.getByRole('button',{name:option,exact:true}).isVisible(),option);
    }
    await screenshot(page,v.id,'source-open');
    await page.keyboard.press('Escape');
    assert.equal(await picker.getAttribute('open'),null,'Escape must close source list');
    assert.ok(await picker.locator('summary').evaluate(el=>el===document.activeElement));
   });
   await check(v.id+' MP4 empty state',async()=>{
    await choose(page,'Video MP4');
    assert.equal(await stage(page).getAttribute('data-stage-source'),'video');
    assert.equal(await stage(page).locator('.soma-track-input-placeholder').isVisible(),true);
    assert.ok(await stage(page).getByText('Pilih video MP4').count());
    const backdrop=await stage(page).locator('.soma-track-input-placeholder').evaluate(
     el=>getComputedStyle(el).backgroundColor);
    assert.equal(backdrop,'rgb(2, 4, 3)','Empty MP4 must cover old pixels');
    await layoutCheck(page,v);
    await screenshot(page,v.id,'mp4-empty');
   });
   await check(v.id+' simulation input',async()=>{
    await choose(page,'Simulasi 3D');
    assert.equal(await stage(page).getAttribute('data-stage-source'),'simulator');
    const step=stage(page).getByRole('button',{name:'Langkah kiri'});
    await step.waitFor({state:'visible'});
    const status=stage(page).locator('.fp-experiment-meta');
    await step.click();
    await page.waitForTimeout(150);
    assert.match(await status.innerText(),/kontak sintetis/);
    await layoutCheck(page,v);
    await screenshot(page,v.id,'simulator');
   });
  }
  await context.close();
 }
 // Deep E2E on a full desktop, where media and workspace controls are visible.
 const context=await browser.newContext({
  viewport:{width:1440,height:900},deviceScaleFactor:1,
  reducedMotion:'reduce',locale:'id-ID',permissions:['camera']
 });
 const page=await context.newPage();page.setDefaultTimeout(12000);
 page.on('pageerror',err=>issue('desktop E2E runtime exception',err));
 await page.goto(base,{waitUntil:'domcontentloaded'});
 await stage(page).waitFor({state:'visible',timeout:30000});
 await check('Webcam fake-device activation',async()=>{
  await choose(page,'Webcam laptop');
  await page.waitForTimeout(650);
  const button=stage(page).getByRole('button',{name:'Aktifkan webcam'});
  if(await button.isVisible())await button.click();
  await page.waitForFunction(()=>{
   const root=document.querySelector('[data-workspace="track"]');
   return root?.getAttribute('data-stage-source')==='webcam'&&
    root.querySelector('.soma-track-source-status')?.getAttribute('data-phase')==='ready';
  },undefined,{timeout:15000});
  assert.equal(await stage(page).locator('canvas[aria-label*="kamera SOMA"]').count(),1);
  await screenshot(page,'desktop-e2e','webcam');
 });
 await check('Webcam → MP4 isolation and video upload/seek',async()=>{
  await choose(page,'Video MP4');
  const root=stage(page);
  assert.equal(await root.getAttribute('data-stage-source'),'video');
  assert.ok(await root.locator('.soma-track-input-placeholder').isVisible());
  await screenshot(page,'desktop-e2e','webcam-to-mp4-empty');
  const buffer=await makeVideo(page);
  assert.ok(buffer.length>1000,'WebM test clip not generated');
  await root.getByLabel('Pilih file video Footprints').setInputFiles({
   name:'trk05-motion.webm',mimeType:'video/webm',buffer
  });
  const video=root.locator('video[aria-label="Pemutar MP4 untuk Footprints"]');
  await video.waitFor({state:'attached'});
  await page.waitForFunction(()=>{
   const el=document.querySelector('video[aria-label="Pemutar MP4 untuk Footprints"]');
   return !!el&&el.readyState>=2&&el.duration>0;
  },undefined,{timeout:20000});
  const play=root.getByRole('button',{name:'Putar video'});
  await play.click();
  const time=await video.evaluate(el=>el.currentTime);
  assert.ok(time>=0);
  await screenshot(page,'desktop-e2e','video-loaded');
  const range=root.getByRole('slider',{name:'Geser waktu video'});
  await range.evaluate(el=>{
   const input=el;input.value=String(Math.max(.1,Number(input.max)*.5));
   input.dispatchEvent(new Event('input',{bubbles:true}));
   input.dispatchEvent(new Event('change',{bubbles:true}));
  });
  assert.equal(await root.locator('.fp-experiment-dock').count(),1);
  await choose(page,'Simulasi 3D');
  assert.equal(await root.getAttribute('data-stage-source'),'simulator');
  assert.equal(await root.locator('.fp-experiment-dock').count(),1);
  assert.equal(await root.locator('.soma-track-input-placeholder').count(),0);
 });
 await check('Phone QR-first pairing, accessible scan image and no duplicated waiting',async()=>{
  // Simulated signaling confirms QR visuals; it does NOT claim live HP connectivity.
  await page.route('**/api/phone-pair',async route=>{
   const req=route.request();
   const action=req.postDataJSON()?.action;
   const reply=action==='create'?{ok:true,room:'qaRoom1234567890',
    ticket:'aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa',
    desktopToken:'bbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb',
    expiresAt:Date.now()+180000}:action==='poll'?{ok:true,state:'waiting'}:{ok:true};
   await route.fulfill({status:200,contentType:'application/json',body:JSON.stringify(reply)});
  });
  await choose(page,'Kamera HP');
  const root=stage(page);
  const pairing=root.locator('#soma-track-phone-pairing');
  await pairing.waitFor({state:'visible',timeout:13000});
  assert.equal(await root.locator('.fp-stage-video').count(),1);
  assert.equal(await root.locator('canvas[aria-label*="kamera SOMA"]').count(),1);
  assert.equal(await root.locator('.soma-track-source-status').isVisible(),false);
  assert.equal(await root.locator('.fp-stage-video>.fp-stage-surface-foot').isVisible(),false);
  assert.equal(await root.getByRole('button',{name:'Tutup pairing',exact:true}).count(),0);
  const create=root.getByRole('button',{name:'Tampilkan QR kamera HP'});
  const trigger=await bounds(create);
  assert.ok(trigger.height>=44&&trigger.width>=180,'QR CTA is visually hidden or too small');
  await screenshot(page,'desktop-e2e','phone-pairing');
  await create.click();
  const qr=root.getByRole('img',{name:'QR untuk menghubungkan kamera HP ke laptop'});
  await qr.waitFor({state:'visible',timeout:13000});
  const rect=await bounds(qr);
  assert.ok(rect.width>=160&&rect.height>=160,'QR too small to scan');
  const white=await root.locator('.soma-track-qr-frame').evaluate(el=>getComputedStyle(el).backgroundColor);
  assert.equal(white,'rgb(255, 255, 255)');
  assert.ok(await root.getByRole('button',{name:'Salin tautan'}).isVisible());
  await screenshot(page,'desktop-e2e','phone-qr-visible');
  await root.getByRole('button',{name:'Tutup pairing kamera HP'}).click();
  assert.ok(await pairing.isHidden());
  await root.getByRole('button',{name:/Hubungkan HP|Lihat koneksi HP/}).click();
  assert.ok(await pairing.isVisible());
  assert.equal(await root.locator('#soma-track-phone-pairing').count(),1);
  assert.equal(await root.getByRole('img',{name:'QR untuk menghubungkan kamera HP ke laptop'}).count(),1,
   'Closing the panel must retain the active QR receiver');
 });
 await check('Compose keeps its three previews after changing source',async()=>{
  await page.getByRole('button',{name:'Compose workspace'}).click();
  const compose=page.locator('.fp-stage-workspace[data-workspace="compose"]');
  await compose.waitFor({state:'visible'});
  const screens=compose.locator('.fp-stage-side-previews');
  assert.equal(await screens.getAttribute('hidden'),null);
  const floor=compose.locator('.fp-preview-floor');
  const body=compose.locator('.fp-preview-body');
  const input=compose.locator('.fp-stage-overview > .fp-stage-video');
  const [a,b,c]=await Promise.all([bounds(floor),bounds(body),bounds(input)]);
  for(const [label,r] of [['FLOOR',a],['BODY',b],['INPUT',c]]){
   assert.ok(r.width>=180,label+' preview too narrow: '+r.width);
   assert.ok(r.x>=0&&r.x+r.width<=1444,label+' preview outside viewport');
  }
  assert.ok(a.x+a.width<=b.x+5&&b.x+b.width<=c.x+5,
   'Compose FLOOR, BODY, INPUT do not occupy three ordered columns');
  assert.ok(Math.abs(a.y-b.y)<18&&Math.abs(b.y-c.y)<18,
   'Compose previews do not align on the same row');
  await screenshot(page,'desktop-e2e','compose-three-previews');
 });
 await check('Map and Track navigation recovers',async()=>{
  await page.getByRole('button',{name:'Map workspace'}).click();
  await page.locator('.fp-stage-workspace[data-workspace="map"]').waitFor({state:'visible'});
  await screenshot(page,'desktop-e2e','map');
  await page.getByRole('button',{name:'Track workspace'}).click();
  await stage(page).waitFor({state:'visible'});
  assert.ok(await stage(page).locator('.soma-track-source-panel').isVisible());
  await screenshot(page,'desktop-e2e','returned-track');
 });
 await context.close();
};
const save=()=>{
 writeFileSync(join(output,'report.json'),JSON.stringify(report,null,2)+'\n');
 const failing=report.checks.filter(x=>x.result==='FAIL').length+report.diffFailures.length;
 const md=[
 '# SOMA TRK-05 Browser QA',
 '',
 '- Commit: '+report.commit,
 '- Browser: Chromium headless',
 '- Checks: '+report.checks.length+' ('+failing+' failures including pixel baseline diffs)',
 '- Screenshots: '+report.screenshots.length,
 '- Approved visual baselines missing: '+report.baselinePending.length,
 '- Full pixel-perfect approval: '+(report.baselinePending.length?'PENDING':failing?'FAIL':'PASS'),
 '',
 '## Checks',
 ...report.checks.map(c=>'- '+c.result+': '+c.label),
 '',
 '## Visual comparisons',
 ...report.screenshots.map(s=>'- '+s.comparison+': '+s.file),
 '',
 '## Issues',
 ...(report.issues.length?report.issues.map(x=>'- '+x.label+': '+x.detail):['- None'])
 ].join('\n')+'\n';
 writeFileSync(join(output,'report.md'),md);
 console.log(md);
 if(process.env.GITHUB_STEP_SUMMARY){
  try{appendFileSync(process.env.GITHUB_STEP_SUMMARY,md);}
  catch{}
 }
 if(failing)process.exitCode=1;
};
try{await run();}catch(error){issue('browser harness',error);}
finally{if(browser)await browser.close().catch(()=>{});server.kill('SIGTERM');save();}
