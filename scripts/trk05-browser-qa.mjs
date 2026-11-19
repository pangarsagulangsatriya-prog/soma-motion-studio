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
   statusVisible:!!status&&!status.hidden&&getComputedStyle(status).display!=='none',
   statusWidth:status?.getBoundingClientRect().width??0};
 });
 assert.equal(railSizing.direction,'column','Track source controls must stack vertically');
 assert.ok(railSizing.pickerWidth>=railSizing.usable*.82,
  'Source picker compressed: '+JSON.stringify(railSizing));
 // Hidden status is intentional for media docks and active pairing.
 // A zero-width element must never be mistaken for a compressed visible rail.
 if(railSizing.statusVisible)
  assert.ok(railSizing.statusWidth>=railSizing.usable*.82,
   'Visible source status compressed: '+JSON.stringify(railSizing));
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
    const disabledPlay=stage(page).getByRole('button',{name:'Putar video',exact:true});
    assert.equal(await disabledPlay.isDisabled(),true,'Cannot play missing MP4');
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
   if(v.id==='desktop-1440x900'||v.id==='mobile-390x844'){
    await check(v.id+' live webcam, button geometry, disabled state and stop recovery',async()=>{
     await choose(page,'Webcam laptop');
     const root=stage(page);
     await page.waitForFunction(()=>{
      const r=document.querySelector('[data-workspace="track"]');
      return r?.getAttribute('data-stage-source')==='webcam'&&
       r.querySelector('.soma-track-source-status')?.getAttribute('data-phase')==='ready';
     },undefined,{timeout:22000});
     const bar=root.locator('.fp-unified-transport');
     await bar.waitFor({state:'visible',timeout:16000});
     const stop=bar.getByRole('button',{name:'Stop kamera'});
     const record=bar.getByRole('button',{name:'Rekam',exact:true});
     const monitor=root.locator('.fp-stage-overview > .fp-stage-video');
     for(const [label,control] of [['Stop kamera',stop],['Rekam',record]]){
      const box=await bounds(control);
      assert.ok(box.height>=34,label+' touch target too small: '+box.height);
      assert.ok(box.x>=0&&box.x+box.width<=v.width+4,
       label+' button outside viewport');
     }
     assert.equal(await record.isDisabled(),false,'Recording must be available for live Body');
     const state=await root.getAttribute('data-tracking-state');
     assert.ok(['idle','waiting','framing','uncertain','ready'].includes(state),
      'Invalid tracking state '+state);
     const skeleton=root.getByRole('button',{name:/kerangka tubuh/});
     if(await skeleton.isVisible()){
      const initial=await skeleton.getAttribute('aria-pressed');
      await skeleton.click();
      assert.notEqual(await skeleton.getAttribute('aria-pressed'),initial);
      assert.equal(await root.getAttribute('data-skeleton-visible'),
       initial==='true'?'false':'true');
      await skeleton.click();
     }
     const barBounds=await bounds(bar);
     assert.ok(barBounds.x>=0&&barBounds.x+barBounds.width<=v.width+4,
      'Camera toolbar overflows viewport');
     const m=await bounds(monitor);
     assert.ok(m.width>=220,'Camera monitor collapsed while active');
     await screenshot(page,v.id,'webcam-active-controls');
     if(v.id==='mobile-390x844'){
      const setup=root.locator('.fp-quick-setup');
      await setup.locator('summary').first().click();
      const panel=setup.locator('.fp-quick-setup-panel');
      await panel.waitFor({state:'visible'});
      const sourceBox=await bounds(root.locator('.soma-track-source-panel'));
      const setupBox=await bounds(panel);
      assert.ok(setupBox.x>=sourceBox.x-3 &&
       setupBox.x+setupBox.width<=sourceBox.x+sourceBox.width+3,
       'Quick Start breaks out of the narrow source rail');
      const transportBox=await bounds(bar);
      assert.ok(transportBox.y>=setupBox.y+setupBox.height-4,
       'Recording toolbar overlaps expanded Quick Start');
      await screenshot(page,v.id,'setup-in-rail');
      const settings=root.getByRole('button',{name:'Pengaturan',exact:true});
      await settings.click();
      const inspector=root.locator('.fp-stage-inspector');
      await inspector.waitFor({state:'visible'});
      await page.waitForTimeout(100);
      assert.equal(await setup.getAttribute('open'),null,
       'Opening inspector should collapse Quick Start');
      const drawer=await bounds(inspector);
      const input=await bounds(monitor);
      assert.ok(drawer.y>=input.y+input.height-6,
       'Mobile inspector overlays the INPUT monitor');
      assert.ok(drawer.x>=0&&drawer.x+drawer.width<=v.width+5,
       'Mobile inspector exceeds viewport width');
      await screenshot(page,v.id,'inspector-below-camera');
      await inspector.getByRole('button',{name:'Tutup pengaturan'}).click();
      await settings.focus();
      assert.equal(await settings.getAttribute('aria-expanded'),'false');
      // A real MediaRecorder cycle on the narrowest tested viewport.
      const downloaded=page.waitForEvent('download',{timeout:14000});
      await record.click();
      const recStop=bar.getByRole('button',{name:'Stop REC'});
      await recStop.waitFor({state:'visible',timeout:11000});
      assert.equal(await recStop.getAttribute('aria-pressed'),'true');
      await screenshot(page,v.id,'mobile-recording');
      await page.waitForTimeout(750);
      await recStop.click();
      const file=await downloaded;
      assert.match(file.suggestedFilename(),/^SOMA_FOOTPRINTS_TAKE\.(webm|mp4)$/);
      await record.waitFor({state:'visible',timeout:10000});
      assert.equal(await record.getAttribute('aria-pressed'),'false');
     }
     await stop.click();
     await root.getByRole('button',{name:'Aktifkan webcam'}).waitFor({state:'visible',timeout:15000});
     assert.equal(await root.locator('.fp-inline-assistant').count(),0);
     assert.notEqual(await root.getAttribute('data-tracking-state'),'ready',
      'Stopped camera must invalidate ready feedback');
     assert.equal(await bar.isVisible(),false,'Local camera toolbar remains on after stop');
     await screenshot(page,v.id,'webcam-stopped');
    });
   }
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
  // One status owner in Track: no second recovery card over the monitor.
  assert.equal(await stage(page).locator('.fp-inline-assistant').count(),0);
  assert.equal(await stage(page).locator('.fp-source-correction').count(),0);
  const button=stage(page).getByRole('button',{name:'Aktifkan webcam'});
  if(await button.isVisible()){
   assert.equal(await stage(page).locator('.soma-track-source-status').isVisible(),false);
   assert.equal(await button.count(),1);
   await button.click();
  }
  await page.waitForFunction(()=>{
   const root=document.querySelector('[data-workspace="track"]');
   return root?.getAttribute('data-stage-source')==='webcam'&&
    root.querySelector('.soma-track-source-status')?.getAttribute('data-phase')==='ready';
  },undefined,{timeout:15000});
  assert.equal(await stage(page).locator('canvas[aria-label*="kamera SOMA"]').count(),1);
  assert.equal(await stage(page).locator('.fp-inline-assistant').count(),0);
  assert.equal(await stage(page).locator('.fp-source-correction').count(),0);
  await screenshot(page,'desktop-e2e','webcam');
 });
 await check('TRK-07 Quick Start stays inside source rail with stable toolbar',async()=>{
  const root=stage(page),rail=root.locator('.soma-track-source-panel');
  const setup=root.locator('.fp-quick-setup');
  await setup.locator('summary').first().click();
  const panel=setup.locator('.fp-quick-setup-panel');
  await panel.waitFor({state:'visible'});
  const source=await bounds(rail),detail=await bounds(panel);
  assert.ok(detail.x>=source.x-3 && detail.x+detail.width<=source.x+source.width+3,
   'Quick Start extends outside source rail: '+JSON.stringify({source,detail}));
  assert.equal(await panel.getByText('Periksa lantai').count()>0,true);
  assert.equal(await panel.getByText('Periksa kamera').count(),0,
   'A live webcam should not show the no-op camera check');
  const toolbar=root.locator('.fp-unified-transport');
  const bar=await bounds(toolbar),monitor=await bounds(root.locator('.fp-stage-video'));
  assert.ok(bar.y>=detail.y+detail.height-5,
   'Toolbar covers expanded setup controls');
  assert.ok(bar.x>=monitor.x-5&&bar.x+bar.width<=monitor.x+monitor.width+6,
   'Toolbar should align with the camera, not the entire workspace');
  assert.notEqual(await toolbar.evaluate(el=>getComputedStyle(el).position),'sticky');
  await screenshot(page,'desktop-e2e','setup-contained');
  const profile=panel.locator('.fp-quick-profile-details');
  await profile.locator('summary').click();
  const expanded=await bounds(profile);
  assert.ok(expanded.x+expanded.width<=source.x+source.width+3);
  await screenshot(page,'desktop-e2e','setup-profile-open');
  await setup.locator('summary').first().click();
 });
 await check('TRK-07 inspector docks beside camera, never overlays video',async()=>{
  const root=stage(page),settings=root.getByRole('button',{name:'Pengaturan',exact:true});
  await settings.click();
  const inspector=root.locator('.fp-stage-inspector');
  await inspector.waitFor({state:'visible'});
  const screen=await bounds(root.locator('.fp-stage-video'));
  const drawer=await bounds(inspector);
  assert.ok(drawer.x>=screen.x+screen.width+5,
   'Inspector overlaps live camera: '+JSON.stringify({screen,drawer}));
  assert.ok(drawer.x+drawer.width<=1445,
   'Inspector extends beyond browser viewport');
  assert.equal(await settings.getAttribute('aria-expanded'),'true');
  await screenshot(page,'desktop-e2e','inspector-docked');
  await inspector.getByRole('button',{name:'Tutup pengaturan'}).click();
  assert.equal(await settings.getAttribute('aria-expanded'),'false');
  assert.ok(await settings.evaluate(el=>el===document.activeElement),
   'Closing the inspector should restore focus to Settings');
 });
 await check('TRK-07 Track toolbar has one output for each action',async()=>{
  const root=stage(page),toolbar=root.locator('.fp-unified-transport');
  assert.equal(await toolbar.locator('.fp-transport-preview').count(),0,
   'BODY/FLOOR Live and Hold should not appear on INPUT toolbar');
  assert.equal(await toolbar.getByText('PREVIEW LOKAL').count(),0);
  const results=toolbar.getByRole('button',{name:'Buka hasil rekaman dan pola'});
  await results.click();
  const hub=page.getByRole('dialog').filter({hasText:'Capture & Sesi'});
  await hub.waitFor({state:'visible'});
  assert.equal(await hub.getByRole('tab',{name:'Pola'}).getAttribute('aria-selected'),'true');
  await screenshot(page,'desktop-e2e','results-hub');
  await hub.getByRole('button',{name:'Tutup'}).click();
 });
 await check('TRK-06D recording starts, stops and creates a video file',async()=>{
  const root=stage(page);
  const bar=root.locator('.fp-unified-transport');
  const record=bar.getByRole('button',{name:'Rekam',exact:true});
  await record.waitFor({state:'visible',timeout:12000});
  assert.equal(await record.isDisabled(),false,'Rekam disabled while live Body is ready');
  const download=page.waitForEvent('download',{timeout:12000});
  await record.click();
  const stop=bar.getByRole('button',{name:'Stop REC'});
  await stop.waitFor({state:'visible',timeout:10000});
  assert.equal(await stop.getAttribute('aria-pressed'),'true');
  await screenshot(page,'desktop-e2e','recording-active');
  await page.waitForTimeout(900);
  await stop.click();
  const file=await download;
  assert.match(file.suggestedFilename(),/^SOMA_FOOTPRINTS_TAKE\.(webm|mp4)$/);
  await record.waitFor({state:'visible',timeout:10000});
  assert.equal(await record.getAttribute('aria-pressed'),'false');
  await screenshot(page,'desktop-e2e','recording-stopped');
 });
 await check('TRK-06D disconnected live video revokes tracking and offers retry',async()=>{
  const root=stage(page);
  const observed=await page.evaluate(()=>{
   const videos=Array.from(document.querySelectorAll('video'));
   const el=videos.find(video=>video.srcObject instanceof MediaStream&&
    video.srcObject.getVideoTracks().length>0);
   if(!el)throw Error('No active camera stream available for disconnect test');
   const track=el.srcObject.getVideoTracks()[0];
   track.dispatchEvent(new Event('ended'));
   return track.label||'fake-device';
  });
  assert.ok(observed);
  const retry=root.getByRole('button',{name:'Coba lagi',exact:true});
  await retry.waitFor({state:'visible',timeout:12000});
  assert.equal(await root.locator('.soma-track-source-status').isVisible(),true);
  assert.equal(await root.locator('.fp-inline-assistant').count(),0);
  await page.waitForFunction(()=>{
   const r=document.querySelector('[data-workspace="track"]');
   return r?.getAttribute('data-tracking-state')!=='ready';
  },undefined,{timeout:2500});
  assert.equal(await root.locator('.fp-unified-transport').isVisible(),false);
  await screenshot(page,'desktop-e2e','camera-disconnected-retry');
  await retry.click();
  await page.waitForFunction(()=>{
   const r=document.querySelector('[data-workspace="track"]');
   return r?.querySelector('.soma-track-source-status')?.getAttribute('data-phase')==='ready';
  },undefined,{timeout:22000});
  assert.equal(await root.locator('.soma-track-source-status').isVisible(),false);
  await screenshot(page,'desktop-e2e','camera-recovered');
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
  const controls=root.locator('.soma-track-qr-actions');
  const direction=await controls.evaluate(el=>getComputedStyle(el).flexDirection);
  assert.equal(direction,'row','QR toolbar must stay in one horizontal row');
  const copyBox=await bounds(root.getByRole('button',{name:'Salin tautan'}));
  const regenerateBox=await bounds(root.getByRole('button',{name:'Buat ulang kode QR'}));
  assert.ok(Math.abs(copyBox.y-regenerateBox.y)<=6,
   'QR controls unexpectedly stacked or misaligned');
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
