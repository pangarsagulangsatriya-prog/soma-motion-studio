import {test,expect} from '@playwright/test';
import {mkdir} from 'node:fs/promises';

const rail=page=>page.locator('.soma-primary-sidebar');
const nav= (page,label)=>rail(page).locator('button[aria-label="'+label+'"]');
const tab=(page,label)=>page.locator('.fp-flow-local-tabs button').filter({hasText:label});
async function ready(page){
 await page.goto('/');
 await expect(page.locator('.fp-stage-workspace')).toBeVisible({timeout:25_000});
 await expect(page.locator('.fp-compact-transport .fp-transport-blackout')).toBeVisible();
}
async function screenshot(page,testInfo,suffix){
 await mkdir('e2e/artifacts',{recursive:true});
 await page.screenshot({path:'e2e/artifacts/'+testInfo.project.name+'-'+suffix+'.png',
  fullPage:true,animations:'disabled'});
}
async function noOverflow(page){
 const state=await page.evaluate(()=>({
  viewport:document.documentElement.clientWidth,
  content:document.documentElement.scrollWidth,
  body:document.body.scrollWidth
 }));
 expect(state.content,'page overflows horizontally: '+JSON.stringify(state))
  .toBeLessThanOrEqual(state.viewport+2);
}
test('responsive initial source screen, safety access, no horizontal overflow',async({page},testInfo)=>{
 await ready(page);
 const stage=page.locator('.fp-stage-workspace');
 await expect(stage).toHaveAttribute('data-screen','source');
 await expect(page.locator('.fp-inline-assistant')).toHaveAttribute('data-condition','source');
 await expect(page.locator('.soma-guided-setup')).toHaveCount(0);
 await expect(page.locator('.fp-source-launchpad')).toHaveCount(0);
 await page.locator('.fp-inline-assistant-action').click();
 const menu=page.getByRole('dialog',{name:'Ganti sumber Footprints'});
 for(const label of ['Webcam laptop','Kamera HP','Video MP4','Simulasi 3D'])
  await expect(menu.getByRole('button',{name:new RegExp(label,'i')})).toBeVisible();
 await page.keyboard.press('Escape');
 await expect(page.locator('.fp-stage-side-previews')).toBeVisible();
 await expect(page.locator('.fp-stage-preview-toolbar')).toBeVisible();
 await expect(page.locator('.fp-stage-video')).toBeVisible();
 await expect(page.locator('#fp-context-panel')).toBeVisible();
 await expect(page.locator('.fp-compact-transport .fp-transport-blackout')).toBeEnabled();
 await noOverflow(page);
 await screenshot(page,testInfo,'source');
});

test('local workflow inspector opens, keyboard enters, Escape restores focus',async({page},testInfo)=>{
 await ready(page);
 const tracking=tab(page,'Tracking');
 await tracking.click();
 await expect(page.locator('#fp-context-panel')).toBeVisible();
 await expect(page.locator('.fp-flow-inspector-head h2')).toContainText('Baca gerak kaki');
 await screenshot(page,testInfo,'tracking');
 await tracking.focus();
 await page.keyboard.press('ArrowDown');
 await expect(page.locator('.fp-flow-inspector-head button')).toBeFocused();
 await page.keyboard.press('Escape');
 await expect(page.locator('#fp-context-panel')).toHaveCount(0);
 await expect(tracking).toBeFocused();
 await tracking.click();
 await expect(page.locator('#fp-context-panel')).toBeVisible();
 await tracking.click();
 await expect(page.locator('#fp-context-panel')).toBeVisible();
 await page.getByRole('button',{name:'Tutup pengaturan'}).click();
 await expect(page.locator('#fp-context-panel')).toHaveCount(0);
 await expect(tracking).toBeFocused();
 await noOverflow(page);
});

test('Footprints Visual → Projector → Footprints keeps software blackout accessible',async({page},testInfo)=>{
 await ready(page);
 let popups=0;
 page.on('popup',popup=>{popups++;void popup.close();});
 const visual=tab(page,'Visual & Archive');
 await visual.click();
 await expect(page.locator('.fp-flow-inspector-head')).toContainText('Atur bentuk');
 await expect(page.locator('.fp-compact-transport .fp-transport-blackout')).toBeVisible();
 // A Blackout command must remain directly clickable while editing.
 await page.locator('.fp-compact-transport .fp-transport-blackout').click();
 expect(popups).toBe(0);
 if(testInfo.project.name==='mobile-390'){
  await page.getByRole('button',{name:'Buka navigasi SOMA'}).click();
  await expect(rail(page)).toHaveAttribute('data-expanded','true');
 }
 await nav(page,'Projector').click();
 await expect(nav(page,'Projector')).toHaveAttribute('aria-current','page');
 await expect(page.locator('.soma-primary-header .v3-brand')).toContainText('PROJECTOR');
 expect(popups,'navigating to Projector must not open a physical output window').toBe(0);
 if(testInfo.project.name==='mobile-390')
  await page.getByRole('button',{name:'Buka navigasi SOMA'}).click();
 await nav(page,'Footprints').click();
 await expect(page.locator('.fp-stage-workspace')).toBeVisible();
 await expect(page.locator('.fp-compact-transport .fp-transport-blackout')).toBeVisible();
 await noOverflow(page);
});

test('Labs remains searchable and Escape restores focus without activating outputs',async({page},testInfo)=>{
 await ready(page);
 if(testInfo.project.name==='mobile-390')
  await page.getByRole('button',{name:'Buka navigasi SOMA'}).click();
 const labs=nav(page,'SOMA Labs');
 await labs.click();
 const dialog=page.locator('#soma-labs-panel');
 await expect(dialog).toBeVisible();
 const search=dialog.getByRole('searchbox',{name:'Cari modul SOMA Labs'});
 await expect(search).toBeFocused();
 await search.fill('siluet');
 await expect(dialog.getByRole('button',{name:/Siluet/})).toBeVisible();
 await expect(dialog.getByRole('button',{name:/Motion & Sound/})).toHaveCount(0);
 await screenshot(page,testInfo,'labs');
 await page.keyboard.press('Escape');
 await expect(dialog).toHaveCount(0);
 await expect(labs).toBeFocused();
 await noOverflow(page);
});

test('mobile rail can be dismissed with Escape; desktop rail remains non-modal',async({page},testInfo)=>{
 await ready(page);
 const toggle=page.locator('.soma-primary-header .soma-nav-toggle');
 if(testInfo.project.name==='mobile-390'){
  await toggle.click();
  await expect(rail(page)).toHaveAttribute('data-expanded','true');
  await expect(nav(page,'Footprints')).toBeFocused();
  await page.keyboard.press('Escape');
  await expect(rail(page)).toHaveAttribute('data-expanded','false');
  await expect(toggle).toBeFocused();
 }else{
  await toggle.click();
  await expect(rail(page)).toHaveAttribute('data-expanded','true');
  await expect(nav(page,'Footprints')).toBeVisible();
  await toggle.click();
  await expect(rail(page)).toHaveAttribute('data-expanded','false');
 }
 await noOverflow(page);
});

test('denied camera permission displays recoverable source error without projector output',async({page})=>{
 await page.addInitScript(()=>{
  Object.defineProperty(navigator.mediaDevices,'getUserMedia',{
   configurable:true,
   value:async()=>{throw new DOMException('Akses kamera ditolak untuk pengujian','NotAllowedError');}
  });
 });
 await ready(page);
 await page.locator('.fp-inline-assistant-action').click();
 await page.getByRole('dialog',{name:'Ganti sumber Footprints'})
  .getByRole('button',{name:/webcam laptop/i}).click();
 await expect(page.locator('.fp-stage-workspace')).toHaveAttribute('data-source-mode','recover',{timeout:25_000});
 await expect(page.locator('.fp-inline-assistant')).toHaveAttribute('data-condition','error');
 await expect(page.locator('.fp-compact-transport .fp-transport-blackout')).toBeEnabled();
 await expect(page.locator('.fp-stage-side-previews')).toBeVisible();
 await expect(page.locator('.fp-stage-preview-toolbar')).toBeVisible();
 await expect(page.locator('.fp-stage-video')).toBeVisible();
 await expect(page.locator('#fp-context-panel')).toBeVisible();
});

test('S6.8.1 source switcher keeps phone pairing session mounted while its panel closes',async({page},testInfo)=>{
 await ready(page);
 const switcher=page.locator('.fp-source-switch-trigger');
 await expect(switcher).toBeVisible();
 await switcher.click();
 const menu=page.getByRole('dialog',{name:'Ganti sumber Footprints'});
 await expect(menu).toBeVisible();
 await menu.getByRole('button',{name:/Kamera HP/i}).click();
 await expect(switcher).toContainText('Kamera HP');
 const manager=page.locator('.fp-phone-source-panel');
 await expect(manager).toBeVisible();
 await expect(manager.locator('.soma-setup-phone-choices')).toHaveCount(1);
 await manager.getByRole('button',{name:'Tutup panel kamera HP'}).click();
 await expect(manager).toBeHidden();
 await expect(page.locator('.fp-flow-inspector-head')).toContainText('Atur bentuk');
 // Closing the controls must not unmount the WebRTC receiver.
 await expect(manager.locator('.soma-setup-phone-choices')).toHaveCount(1);
 await switcher.click();
 await page.getByRole('dialog',{name:'Ganti sumber Footprints'}).getByRole('button',{name:/Kamera HP/i}).click();
 await expect(manager).toBeVisible();
 await screenshot(page,testInfo,'phone-switch');
 await switcher.click();
 await page.getByRole('dialog',{name:'Ganti sumber Footprints'}).getByRole('button',{name:/Webcam laptop/i}).click();
 await expect(switcher).toContainText('Webcam laptop');
 await expect(page.locator('.fp-phone-source-panel')).toHaveCount(0);
 await expect(page.locator('.fp-flow-inspector-head')).toContainText('Atur bentuk');
 await expect(page.locator('.fp-compact-transport .fp-transport-blackout')).toBeEnabled();
 await noOverflow(page);
});

test('S6.8.4 MP4 Stage Preview keeps Labs available through QA route',async({page})=>{
 await ready(page);
 await page.goto('/?lab=1');
 const switcher=page.locator('.fp-source-switch-trigger');
 await switcher.click();
 await page.getByRole('dialog',{name:'Ganti sumber Footprints'}).getByRole('button',{name:/Video MP4/i}).click();
 await expect(switcher).toContainText('Video MP4');
 await expect(page.locator('.fp-experiment-dock[data-experiment-kind=video]')).toBeVisible();
 await expect(page.locator('.fp-stage-side-previews')).toBeVisible();
 await expect(page.locator('.fp-preview-body canvas')).toHaveCount(1);
 await expect(page.locator('.fp-preview-floor canvas')).toHaveCount(1);
 await expect(page.locator('.fp-experiment-controls input[type=file]')).toHaveCount(1);
 await page.locator('.fp-experiment-advanced-details summary').click();
 await page.getByRole('button',{name:'Buka Video Motion Lab'}).click();
 await expect(page.locator('.soma-video-lab')).toBeVisible();
 await page.getByRole('button',{name:'Tutup Lab'}).click();
 await expect(page.locator('.soma-video-lab')).toHaveCount(0);
 await switcher.click();
 await page.getByRole('dialog',{name:'Ganti sumber Footprints'}).getByRole('button',{name:/Kamera HP/i}).click();
 await expect(page.locator('.fp-phone-source-panel')).toBeVisible();
 await expect(switcher).toContainText('Kamera HP');
 await expect(page.locator('.fp-experiment-dock')).toHaveCount(0);
 await noOverflow(page);
});

test('S6.8.2 main workspace keeps all live preview canvases mounted across mode changes',async({page},testInfo)=>{
 await ready(page);
 const stage=page.locator('.fp-stage-workspace');
 const preview=page.locator('.fp-stage-side-previews');
 const canvasBody=page.locator('.fp-preview-body canvas');
 const canvasFloor=page.locator('.fp-preview-floor canvas');
 const camera=page.locator('.fp-stage-video-content canvas');
 await expect(stage).toHaveClass(/fp-persistent-layout/);
 await expect(preview).toHaveAttribute('data-preview-mode','split');
 await expect(canvasBody).toBeVisible();
 await expect(canvasFloor).toBeVisible();
 await expect(camera).toBeVisible();
 await expect(page.locator('.fp-flow-inspector-head')).toContainText('Atur bentuk');
 const body=page.locator('.fp-stage-preview-modes button').filter({hasText:'BODY'});
 const floor=page.locator('.fp-stage-preview-modes button').filter({hasText:'FLOOR'});
 const split=page.locator('.fp-stage-preview-modes button').filter({hasText:'Split'});
 await floor.click();
 await expect(preview).toHaveAttribute('data-preview-mode','floor');
 await expect(canvasFloor).toBeVisible();
 await expect(canvasBody).toBeHidden();
 await expect(canvasBody).toHaveCount(1);
 await body.click();
 await expect(preview).toHaveAttribute('data-preview-mode','body');
 await expect(canvasBody).toBeVisible();
 await expect(canvasFloor).toBeHidden();
 await expect(canvasFloor).toHaveCount(1);
 await split.click();
 await expect(canvasFloor).toBeVisible();
 await expect(canvasBody).toBeVisible();
 await expect(camera).toBeVisible();
 await expect(page.locator('#fp-context-panel')).toBeVisible();
 await expect(page.locator('.fp-compact-transport .fp-transport-blackout')).toBeEnabled();
 await noOverflow(page);
 await screenshot(page,testInfo,'persistent-stage');
});

test('S6.8.2 stage preview layout remains mounted when source changes to phone pairing',async({page})=>{
 await ready(page);
 const body=page.locator('.fp-preview-body canvas');
 const floor=page.locator('.fp-preview-floor canvas');
 const camera=page.locator('.fp-stage-video-content canvas');
 const switcher=page.locator('.fp-source-switch-trigger');
 await switcher.click();
 await page.getByRole('dialog',{name:'Ganti sumber Footprints'})
   .getByRole('button',{name:/Kamera HP/i}).click();
 await expect(page.locator('.fp-phone-source-panel')).toBeVisible();
 await expect(body).toHaveCount(1);
 await expect(floor).toHaveCount(1);
 await expect(camera).toHaveCount(1);
 await page.locator('.fp-phone-source-heading button').click();
 await expect(body).toBeVisible();
 await expect(floor).toBeVisible();
 await expect(camera).toBeVisible();
 await expect(page.locator('.fp-stage-preview-toolbar')).toBeVisible();
 await noOverflow(page);
});

test('S6.8.3 inline four-point calibration keeps camera and preview in one workspace',async({page},testInfo)=>{
 await ready(page);
 const tracking=tab(page,'Tracking');
 await tracking.click();
 await page.getByRole('button',{name:'Tandai 4 titik lantai'}).click();
 await expect(page.locator('.fp-stage-workspace')).toHaveAttribute('data-screen','setup');
 await expect(page.locator('.fp-stage-video')).toBeVisible();
 await expect(page.locator('.fp-stage-side-previews')).toBeVisible();
 await expect(page.locator('.fp-preview-body canvas')).toHaveCount(1);
 await expect(page.locator('.fp-preview-floor canvas')).toHaveCount(1);
 await expect(page.locator('.fp-inline-floor-editor')).toBeVisible();
 await expect(page.locator('.soma-guided-setup')).toHaveCount(0);
 await expect(page.locator('.fp-inline-floor-corners button')).toHaveCount(4);
 await expect(page.locator('.fp-inline-floor-primary')).toBeDisabled();
 await expect(page.locator('.fp-compact-transport .fp-transport-blackout')).toBeEnabled();
 if(testInfo.project.name==='mobile-390'){
  const cameraBounds=await page.locator('.fp-stage-video').boundingBox();
  const previewBounds=await page.locator('.fp-stage-side-previews').boundingBox();
  expect(cameraBounds).not.toBeNull();
  expect(previewBounds).not.toBeNull();
  expect(cameraBounds.y,'Calibration camera must appear above preview on mobile')
   .toBeLessThan(previewBounds.y);
 }
 await noOverflow(page);
 await screenshot(page,testInfo,'inline-calibration');
 await page.getByRole('button',{name:'Tutup kalibrasi'}).click();
 await expect(page.locator('.fp-inline-floor-editor')).toHaveCount(0);
 await expect(page.locator('.fp-flow-inspector-head')).toContainText('Baca gerak kaki');
});

test('S6.8.3 assistant follows phone pairing and retains one camera receiver',async({page})=>{
 await ready(page);
 const hint=page.locator('.fp-inline-assistant');
 await expect(hint).toHaveAttribute('data-condition','source');
 await hint.locator('button').click();
 await page.getByRole('dialog',{name:'Ganti sumber Footprints'})
  .getByRole('button',{name:/Kamera HP/i}).click();
 await expect(hint).toHaveAttribute('data-condition','pairing');
 await expect(page.locator('.fp-phone-source-panel')).toBeVisible();
 await expect(page.locator('.fp-phone-source-panel .soma-setup-phone-choices')).toHaveCount(1);
 await page.getByRole('button',{name:'Tutup panel kamera HP'}).click();
 await expect(hint).toHaveAttribute('data-condition','pairing');
 await hint.locator('button').click();
 await expect(page.locator('.fp-phone-source-panel')).toBeVisible();
 await expect(page.locator('.fp-phone-source-panel .soma-setup-phone-choices')).toHaveCount(1);
 await expect(page.locator('.soma-guided-steps')).toHaveCount(0);
 await expect(page.locator('.fp-compact-transport .fp-transport-blackout')).toBeEnabled();
 await noOverflow(page);
});

test('S6.8.3 calibration editor returns focus and never authorizes projector on empty camera',async({page})=>{
 await ready(page);
 const tracking=tab(page,'Tracking');
 await tracking.click();
 const open=page.getByRole('button',{name:'Tandai 4 titik lantai'});
 await open.click();
 await expect(page.locator('.fp-inline-floor-primary')).toBeDisabled();
 await expect(page.locator('.fp-inline-floor-confirm')).toBeDisabled();
 await expect(page.locator('.fp-stage-video-content canvas')).toHaveAttribute('data-calibration-active','false');
 await expect(page.locator('.fp-stage-calibration-hint')).toHaveCount(0);
 await page.locator('.fp-inline-floor-corners button').first().isDisabled();
 await page.getByRole('button',{name:'Tutup kalibrasi'}).click();
 await expect(page.locator('.fp-inline-floor-editor')).toHaveCount(0);
 await expect(tracking).toBeFocused();
 await expect(page.locator('.fp-compact-transport .fp-transport-blackout')).toBeEnabled();
 await noOverflow(page);
});

test('S6.8.4 simulator produces metric virtual contact in the same FLOOR canvas',async({page},testInfo)=>{
 await ready(page);
 const camera=page.locator('.fp-stage-video-content canvas');
 const body=page.locator('.fp-preview-body canvas');
 const floor=page.locator('.fp-preview-floor canvas');
 const switcher=page.locator('.fp-source-switch-trigger');
 await switcher.click();
 await page.getByRole('dialog',{name:'Ganti sumber Footprints'})
   .getByRole('button',{name:/Simulasi 3D/i}).click();
 const dock=page.locator('.fp-experiment-dock[data-experiment-kind=simulator]');
 await expect(dock).toBeVisible();
 await expect(page.locator('.fp-stage-workspace')).toHaveAttribute('data-experimental','true');
 await expect(dock).toContainText('0 kontak sintetis');
 await dock.getByRole('button',{name:'Langkah kanan'}).click();
 await expect(dock).toContainText('1 kontak sintetis');
 await expect(page.locator('.fp-preview-floor .fp-stage-surface-foot')).toContainText('1 kontak sintetis');
 await expect(camera).toBeVisible();
 await expect(body).toBeVisible();
 await expect(floor).toBeVisible();
 const sizes=await page.evaluate(()=>{
  const refs=['.fp-stage-video-content canvas','.fp-preview-body canvas','.fp-preview-floor canvas'];
  return refs.map(s=>{const c=document.querySelector(s);return [c.width,c.height];});
 });
 expect(sizes).toEqual([[768,432],[640,360],[1280,720]]);
 await expect(page.locator('.fp-compact-transport .fp-transport-blackout')).toBeEnabled();
 await noOverflow(page);
 await screenshot(page,testInfo,'simulation-preview');
 // Returning from another source must retain the 3D session.
 await switcher.click();
 await page.getByRole('dialog',{name:'Ganti sumber Footprints'})
  .getByRole('button',{name:/Video MP4/i}).click();
 await expect(page.locator('.fp-experiment-dock[data-experiment-kind=video]')).toBeVisible();
 await switcher.click();
 await page.getByRole('dialog',{name:'Ganti sumber Footprints'})
  .getByRole('button',{name:/Simulasi 3D/i}).click();
 await expect(page.locator('.fp-experiment-dock')).toContainText('1 kontak sintetis');
});

test('S6.8.4 local video input accepts real decoded WebM and keeps physical output isolated',async({page})=>{
 await ready(page);
 await page.locator('.fp-source-switch-trigger').click();
 await page.getByRole('dialog',{name:'Ganti sumber Footprints'})
  .getByRole('button',{name:/Video MP4/i}).click();
 const dock=page.locator('.fp-experiment-dock[data-experiment-kind=video]');
 await expect(dock).toBeVisible();
 const canRecord=await page.evaluate(()=>typeof MediaRecorder!=='undefined'&&
  HTMLCanvasElement.prototype.captureStream!==undefined&&
  MediaRecorder.isTypeSupported('video/webm;codecs=vp8'));
 test.skip(!canRecord,'Browser cannot create a local WebM recording for fixture');
 await page.evaluate(async()=>{
  const canvas=document.createElement('canvas');
  canvas.width=192;canvas.height=108;
  const ctx=canvas.getContext('2d');
  const stream=canvas.captureStream(16);
  const recorder=new MediaRecorder(stream,{mimeType:'video/webm;codecs=vp8'});
  const chunks=[];
  recorder.ondataavailable=e=>{if(e.data.size)chunks.push(e.data);};
  const stopped=new Promise(resolve=>{recorder.onstop=resolve;});
  recorder.start();
  for(let i=0;i<14;i++){
   ctx.fillStyle=i%2?'#2d6241':'#c2da9f';ctx.fillRect(0,0,192,108);
   ctx.fillStyle='#222';ctx.fillRect(40+i*3,38,20,35);
   await new Promise(resolve=>setTimeout(resolve,58));
  }
  recorder.stop();await stopped;
  stream.getTracks().forEach(t=>t.stop());
  const file=new File(chunks,'footprints-qa.webm',{type:'video/webm'});
  const control=document.querySelector('.fp-experiment-upload input[type=file]');
  const transfer=new DataTransfer();transfer.items.add(file);
  control.files=transfer.files;control.dispatchEvent(new Event('change',{bubbles:true}));
 });
 await expect(page.getByRole('button',{name:'Putar video'})).toBeEnabled({timeout:15_000});
 await expect(page.locator('.fp-stage-side-previews')).toBeVisible();
 await expect(page.locator('.fp-stage-video')).toBeVisible();
 await page.getByRole('button',{name:'Putar video'}).click();
 await expect(page.locator('.fp-experiment-meta')).not.toContainText('Video belum dipilih');
 await expect(page.locator('.fp-compact-transport .fp-transport-blackout')).toBeEnabled();
 await noOverflow(page);
});
