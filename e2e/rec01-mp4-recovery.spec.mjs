import {test,expect} from '@playwright/test';
import {fileURLToPath} from 'node:url';
const fixture=name=>fileURLToPath(new URL('./fixtures/'+name,import.meta.url));
test.setTimeout(120_000);
async function openVideo(page,file){
 await page.goto('/');
 await page.locator('.fp-source-switch-trigger').click();
 await page.getByRole('button',{name:'Video MP4',exact:true}).click();
 await page.getByLabel('Pilih file video Footprints').setInputFiles(fixture(file));
 await expect(page.getByRole('button',{name:'Jeda video',exact:true})).toBeEnabled({timeout:60_000});
}
const diagnostics=page=>page.getByRole('status',{name:'Status inferensi MP4'});
async function expectInference(page){
 await expect(diagnostics(page)).toContainText(/[1-9]\d* inferensi selesai/,{timeout:60_000});
 await expect(diagnostics(page)).toContainText(/(?:[1-9]\d*\.\d|0\.[1-9]) FPS AI/,{timeout:60_000});
}
async function evidence(page,info,name){
 await info.attach(name,{body:await page.screenshot({fullPage:true}),contentType:'image/png'});
 await info.attach(name+'-status',{body:await diagnostics(page).innerText(),contentType:'text/plain'});
}
test('REC-01 real hidden MP4 decodes two poses, survives workspaces, seek and CPU retry',async({page},info)=>{
 const errors=[];page.on('pageerror',e=>errors.push(e.message));
 await openVideo(page,'rec01-dual.mp4');
 await expectInference(page);
 await expect(diagnostics(page)).toContainText('2/2 pose hasil terakhir',{timeout:60_000});
 await evidence(page,info,'dual-real-worker');
 const source=await page.getByLabel('Pemutar MP4 untuk Footprints').getAttribute('src');
 for(let round=0;round<3;round++){
  for(const name of ['Map','Perform','Compose']){
   await page.getByRole('navigation',{name:'Sistem SOMA'}).getByRole('button',{name,exact:true}).click();
   await expect(page.getByLabel('Pemutar MP4 untuk Footprints')).toHaveAttribute('src',source);
  }
 }
 await page.getByRole('button',{name:'Jeda video',exact:true}).click();
 await page.getByRole('slider',{name:'Geser waktu video'}).focus();
 await page.getByRole('slider',{name:'Geser waktu video'}).press('Home');
 await expect(page.getByRole('button',{name:'Putar video',exact:true})).toBeVisible();
 await page.getByRole('button',{name:'Gunakan CPU',exact:true}).click();
 await expect(diagnostics(page)).toContainText('CPU dipilih operator.',{timeout:60_000});
 await page.getByRole('button',{name:'Putar video',exact:true}).click();
 await expectInference(page);
 await evidence(page,info,'cpu-recovery');
 expect(errors).toEqual([]);
});
test('REC-01 a real stationary two-pose MP4 produces no contact over ten seconds',async({page},info)=>{
 await openVideo(page,'rec01-idle.mp4');
 await expectInference(page);
 await expect(diagnostics(page)).toContainText('2/2 pose hasil terakhir',{timeout:60_000});
 // Observe ten seconds of real inference, not an injected pose/event stream.
 await page.waitForTimeout(10_000);
 await expect(page.locator('.fp-preview-floor')).toContainText('0 kontak segmen video');
 await evidence(page,info,'idle-ten-seconds');
});
test('REC-01 worker boot failure visibly recovers through real CPU model',async({page},info)=>{
 await page.route('**/workers/replay-inference-classic.js',route=>route.abort());
 await openVideo(page,'rec01-dual.mp4');
 await expectInference(page);
 await expect(diagnostics(page)).toContainText('CPU fallback');
 await expect(diagnostics(page)).toContainText('Worker classic gagal');
 await evidence(page,info,'worker-failure-cpu');
});
test('REC-01 late completed inference is measured but cannot emit contacts',async({page})=>{
 await page.goto('/');
 const result=await page.evaluate(async()=>{
  const {VideoPoseGaitEngine}=await import('/src/stage/VideoPoseGaitEngine.ts');
  const engine=new VideoPoseGaitEngine(()=>{});
  const video={readyState:2,seeking:false,currentTime:1,videoWidth:640,videoHeight:320};
  // Fault injection: completed worker responses deliberately miss the 320ms gate.
  engine.worker={detect:async()=>{await new Promise(r=>setTimeout(r,25));video.currentTime+=.5;return {landmarks:[],worldLandmarks:[],poseMs:25};},dispose(){}};
  engine.meter.setBackend('worker');
  for(let i=0;i<3;i++){
   engine.process(video,video.currentTime,18);
   await new Promise(r=>setTimeout(r,40));
  }
  const snapshot=engine.snapshot;engine.dispose();return snapshot;
 });
 expect(result.performance.processedFrames).toBe(3);
 expect(result.performance.poseFps).toBeGreaterThan(0);
 expect(result.performance.staleResults).toBe(3);
 expect(result.sampledFrames).toBe(0);
 expect(result.events).toEqual([]);
 expect(result.inference.state).toBe('stale');
});
