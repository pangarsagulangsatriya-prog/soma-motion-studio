import {test,expect} from '@playwright/test';

async function chooseSource(page,name){
 await page.locator('.fp-source-switch-trigger').click();
 await page.locator('.fp-source-switch-option').filter({hasText:name}).click();
 await expect(page.locator('.fp-source-switch-trigger')).toContainText(name);
}

test('S6.8.6 beginner study: first visit → switching → observer tasks → export',async({page})=>{
 await page.goto('/');
 const stage=page.locator('.fp-stage-workspace');
 await expect(stage).toHaveAttribute('data-flow','input');
 const open=page.getByRole('button',{name:'Uji Pemula'});
 await expect(open).toBeVisible();
 await open.click();
 const lab=page.getByRole('region',{name:'S6.8.6 — Uji penggunaan pertama'});
 await expect(lab).toBeVisible();
 await lab.getByRole('button',{name:'Mulai sesi observasi'}).click();
 await expect(lab.locator('.fp-usability-task')).toHaveAttribute('data-task','select');

 await chooseSource(page,'Simulasi 3D');
 await expect(lab).toContainText('simulator');
 await lab.getByRole('button',{name:'Berhasil'}).click();
 await expect(lab.locator('.fp-usability-task')).toHaveAttribute('data-task','switch');
 await chooseSource(page,'Video MP4');
 await lab.getByRole('checkbox',{name:'Peserta meminta bantuan moderator'}).check();
 await lab.getByRole('textbox',{name:/Catatan hambatan/}).fill('Butuh bantuan memilih video');
 await lab.getByRole('button',{name:'Ada kendala'}).click();
 await expect(lab.locator('.fp-usability-task')).toHaveAttribute('data-task','recover');

 await chooseSource(page,'Webcam laptop');
 await lab.getByRole('button',{name:'Lewati'}).click();
 await expect(lab.locator('.fp-usability-task')).toHaveAttribute('data-task','preview');
 await expect(page.locator('.fp-preview-body')).toBeVisible();
 await expect(page.locator('.fp-preview-floor')).toBeVisible();
 await lab.getByRole('button',{name:'Berhasil'}).click();
 await expect(lab).toHaveAttribute('data-finished','true');
 await expect(lab).toContainText('Tugas selesai');
 await expect(lab).toContainText('Perpindahan sumber');
 const downloads=page.waitForEvent('download');
 await lab.getByRole('button',{name:'Ekspor hasil JSON'}).click();
 const file=await downloads;
 expect(file.suggestedFilename()).toBe('SOMA-S6-8-6-beginner-usability.json');

 await lab.getByRole('button',{name:'Ulangi sesi'}).click();
 await expect(lab).toHaveAttribute('data-running','true');
 await expect(lab.locator('.fp-usability-task')).toHaveAttribute('data-task','select');
});

test('S6.8.6 beginner test stays optional and can be hidden during Stage work',async({page})=>{
 await page.goto('/');
 const launch=page.getByRole('button',{name:'Uji Pemula'});
 const lab=page.getByRole('region',{name:'S6.8.6 — Uji penggunaan pertama',hidden:true});
 await expect(lab).toBeHidden();
 await launch.click();
 await page.getByRole('button',{name:'Mulai sesi observasi'}).click();
 await page.getByRole('button',{name:'Tutup panel Uji Pemula'}).click();
 await expect(lab).toBeHidden();
 await chooseSource(page,'Simulasi 3D');
 await launch.click();
 await expect(lab).toBeVisible();
 await expect(lab).toContainText('Perpindahan sumber');
 await expect(lab.locator('.fp-usability-summary')).toContainText('Perpindahan sumber');
});

test('S6.8.6 camera permission denial shows recovery and alternative-source fallback',async({page})=>{
 await page.addInitScript(()=>{
  const media=navigator.mediaDevices;
  if(!media?.getUserMedia)return;
  const original=media.getUserMedia.bind(media);
  let rejectFirstCamera=true;
  Object.defineProperty(media,'getUserMedia',{
   configurable:true,
   value:async constraints=>{
    if(rejectFirstCamera&&constraints?.video){
     rejectFirstCamera=false;
     throw new DOMException('Camera permission denied for test','NotAllowedError');
    }
    return original(constraints);
   }
  });
 });
 await page.goto('/');
 await page.getByRole('button',{name:'Uji Pemula'}).click();
 const lab=page.getByRole('region',{name:'S6.8.6 — Uji penggunaan pertama'});
 await lab.getByRole('button',{name:'Mulai sesi observasi'}).click();
 await chooseSource(page,'Webcam laptop');
 await expect(page.locator('.fp-source-switch-trigger')).toHaveAttribute('data-phase','error');
 await expect(page.getByRole('button',{name:'Coba lagi'})).toBeVisible();
 await expect(lab.locator('.fp-usability-summary')).toContainText('Error / pemulihan');

 // Safe recovery by choosing a working local source, with no physical projector access.
 await chooseSource(page,'Simulasi 3D');
 await expect(page.locator('.fp-source-switch-trigger')).toHaveAttribute('data-phase','experiment');
 await expect(page.locator('.fp-stage-workspace')).toHaveAttribute('data-experimental','true');
 await expect(lab.locator('.fp-usability-summary')).toContainText('Error / pemulihan');
 await expect(lab.locator('.fp-usability-task')).toHaveAttribute('data-task','select');
 const reportDownload=page.waitForEvent('download');
 await lab.getByRole('button',{name:'Ekspor hasil JSON'}).click();
 const file=await reportDownload;
 expect(file.suggestedFilename()).toMatch(/beginner-usability\.json$/);
});
