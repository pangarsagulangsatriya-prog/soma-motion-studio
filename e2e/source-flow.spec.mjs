import {test,expect} from '@playwright/test';

test.setTimeout(90_000);

async function chooseSource(page,label){
 await page.locator('.fp-source-switch-trigger').click();
 const choice=page.locator('.fp-source-switch-option').filter({hasText:label});
 await expect(choice).toBeVisible();
 await choice.click();
 await expect(page.locator('.fp-source-switch-trigger')).toContainText(label);
}

async function createLocalVideo(page){
 await page.evaluate(async()=>{
  const canvas=document.createElement('canvas');
  canvas.width=320;canvas.height=240;
  const ctx=canvas.getContext('2d');
  const stream=canvas.captureStream(12);
  if(!MediaRecorder.isTypeSupported('video/webm;codecs=vp8'))
   throw new Error('Browser test codec VP8 is unavailable');
  const recorder=new MediaRecorder(stream,{mimeType:'video/webm;codecs=vp8'});
  const chunks=[];
  const stopped=new Promise((resolve,reject)=>{
   recorder.ondataavailable=e=>{if(e.data.size)chunks.push(e.data);};
   recorder.onerror=e=>reject(e.error||new Error('Recorder error'));
   recorder.onstop=resolve;
  });
  recorder.start();
  for(let n=0;n<15;n++){
   ctx.fillStyle=n%2?'#f5f5f5':'#151515';ctx.fillRect(0,0,320,240);
   ctx.fillStyle='#53be80';ctx.fillRect(30+n*8,80,60,100);
   await new Promise(r=>setTimeout(r,90));
  }
  recorder.stop();await stopped;
  stream.getTracks().forEach(track=>track.stop());
  const file=new File([new Blob(chunks,{type:'video/webm'})],'s6-8-5.webm',
   {type:'video/webm'});
  const input=document.querySelector('.fp-experiment-upload input[type=file]');
  if(!input)throw Error('Video upload absent');
  const dt=new DataTransfer();dt.items.add(file);
  input.files=dt.files;input.dispatchEvent(new Event('change',{bubbles:true}));
 });
}

test('Source E2E: webcam → phone → video → simulator → webcam',async({page,context})=>{
 await context.grantPermissions(['camera'],{origin:'http://127.0.0.1:4173'});
 await page.goto('/');
 await expect(page.locator('.fp-source-switch-trigger')).toBeVisible();

 await chooseSource(page,'Webcam laptop');
 await expect(page.locator('.fp-stage-workspace')).toHaveAttribute('data-experimental','false');

 await chooseSource(page,'Kamera HP');
 await expect(page.locator('.fp-source-switch-trigger')).toContainText('Kamera HP');
 // Pairing UI only; a physical phone and WebRTC connectivity still require bench QA.

 await chooseSource(page,'Video MP4');
 await expect(page.locator('.fp-stage-workspace')).toHaveAttribute('data-experimental','true');
 await expect(page.locator('.fp-stage-workspace')).toHaveAttribute('data-screen','live');
 await expect(page.locator('.fp-preview-body')).toBeVisible();
 await expect(page.locator('.fp-preview-floor')).toBeVisible();
 await createLocalVideo(page);
 await expect(page.locator('.fp-experiment-upload')).toContainText('Ganti video');
 await expect(page.locator('.fp-experiment-controls output')).not.toHaveText('0.0 / 0.0 dtk');
 await expect(page.locator('.fp-stage-video .fp-stage-surface-foot'))
  .toContainText('OUTPUT FISIK TERKUNCI');
 await chooseSource(page,'Video MP4');
 await expect(page.locator('.fp-experiment-upload')).toContainText('Ganti video');

 await chooseSource(page,'Simulasi 3D');
 await expect(page.locator('.fp-stage-workspace')).toHaveAttribute('data-screen','live');
 await expect(page.locator('.fp-stage-video .fp-stage-surface-head')).toContainText('PUPPET 3D');
 await page.getByRole('button',{name:'Langkah kiri'}).click();
 await expect(page.locator('.fp-preview-floor .fp-stage-surface-foot'))
  .toContainText('kontak sintetis');
 await page.getByRole('button',{name:/Buka Simulator 3D lengkap/}).click();
 const dialog=page.locator('dialog.puppet-dialog');
 await expect(dialog).toBeVisible();
 await dialog.locator('canvas[aria-label^="Kanvas simulator 3D"]').focus();
 await page.keyboard.press('w');
 await dialog.getByRole('button',{name:'Tutup simulator'}).click();
 await expect(page.locator('.fp-preview-floor .fp-stage-surface-foot'))
  .toContainText('kontak sintetis');

 await chooseSource(page,'Webcam laptop');
 await expect(page.locator('.fp-stage-workspace')).toHaveAttribute('data-experimental','false');
 await expect(page.locator('.fp-stage-video .fp-stage-surface-head')).toContainText('KAMERA');
 await expect(page.locator('.fp-preview-floor .fp-stage-surface-foot'))
  .not.toContainText('kontak sintetis');
});

test('Source E2E: MP4 cannot open physical projector output',async({page})=>{
 await page.goto('/');
 await chooseSource(page,'Video MP4');
 await expect(page.locator('.fp-stage-workspace')).toHaveAttribute('data-experimental','true');
 await page.locator('.fp-transport-projector').click();
 const router=page.locator('.stage-dual');
 await expect(router).toBeVisible();
 await expect(router).toContainText('Dua output fisik terkunci');
 const open=router.getByRole('button',{name:'Buka output'});
 await expect(open).toHaveCount(2);
 for(const button of await open.all())await expect(button).toBeDisabled();
 const safety=router.locator('.stage-dual-check input[type=checkbox]').first();
 await expect(safety).toBeDisabled();
 let popups=0;page.on('popup',()=>popups++);
 await router.getByRole('button',{name:'Sinyal dikirim'}).click();
 await expect(router.locator('.stage-wysiwyg-card[data-preview-signal=blackout]')).toHaveCount(2);
 expect(popups).toBe(0);
});
