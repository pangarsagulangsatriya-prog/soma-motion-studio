import {test,expect} from '@playwright/test';
import {selectStageSource} from './ia-ux-helpers.mjs';

async function openBeta(page){
 await page.goto('/');
 await page.getByRole('button',{name:'Compose workspace'}).click();
 const monitor=page.locator('#soma-compose-monitor');
 await expect(monitor).toBeVisible();
 const beta=monitor.getByRole('button',{name:/Garis\s+BETA/});
 await expect(beta).toBeVisible();
 await beta.click();
 await expect(beta).toHaveAttribute('aria-pressed','true');
 await expect(page.getByRole('region',{name:'Kontrol Garis Beta'})).toBeVisible();
 return {monitor,beta,panel:page.getByRole('region',{name:'Kontrol Garis Beta'})};
}
test('Line Trails Beta: two colored strokes in one editor canvas; clean fullscreen and Esc',async({page})=>{
 const {beta,panel}=await openBeta(page);
 await expect(page.locator('.lt-beta-frame canvas')).toHaveCount(1);
 await expect(page.locator('.lt-beta-frame canvas')).toBeVisible();
 await expect(panel.getByLabel('Warna Kaki 1')).toHaveValue('#f34725');
 await expect(panel.getByLabel('Warna Kaki 2')).toHaveValue('#1d1d1d');
 await expect(panel.getByText(/Menunggu kaki|Kaki belum terbaca/)).toBeVisible();
 await panel.getByRole('button',{name:'Coba Demo'}).click();
 await expect(panel.getByText(/DEMO/)).toBeVisible({timeout:7000});
 await expect.poll(async()=>await page.locator('.lt-beta-frame canvas').evaluate(canvas=>{
  const ctx=canvas.getContext('2d');if(!ctx)return 0;
  const {data}=ctx.getImageData(0,0,canvas.width,canvas.height);
  let colored=0;for(let k=0;k<data.length;k+=36){
   if((data[k]>160&&data[k+1]<140&&data[k+2]<130)||
     (data[k]<70&&data[k+1]<70&&data[k+2]<70))colored++;
  }
  return colored;
 }),{timeout:10000}).toBeGreaterThan(10);
 await panel.getByLabel('Warna Kaki 1').fill('#0099cc');
 await expect(panel.getByLabel('Warna Kaki 1')).toHaveValue('#0099cc');
 await panel.getByRole('button',{name:'Memudar'}).click();
 await expect(panel.getByRole('button',{name:'Memudar'})).toHaveAttribute('aria-pressed','true');
 const monitor=page.locator('#soma-compose-monitor');
 await monitor.getByRole('button',{name:'Fullscreen Stage Monitor'}).click();
 await expect.poll(()=>page.evaluate(()=>document.fullscreenElement?.classList.contains('lt-beta-frame')??false)).toBe(true);
 const clean=await page.evaluate(()=>{
  const el=document.fullscreenElement;
  return {canvasCount:el?.querySelectorAll('canvas').length,
   buttons:el?.querySelectorAll('button').length,
   text:(el?.textContent??'').trim(),children:el?.children.length};
 });
 expect(clean).toEqual({canvasCount:1,buttons:0,text:'',children:1});
 await page.keyboard.press('Escape');
 await expect.poll(()=>page.evaluate(()=>document.fullscreenElement===null)).toBe(true);
 await expect(panel.getByRole('button',{name:'Hentikan Demo'})).toBeVisible();
 await expect(beta).toHaveAttribute('aria-pressed','true');
});
test('Line Trails Beta: switch back to the previous Mineral Ink controls',async({page})=>{
 const {beta}=await openBeta(page);
 await beta.click({noWaitAfter:true});
 await expect.poll(async()=>await page.locator('.s64-layout').getAttribute('data-line-trails-active'),{timeout:8000}).toBe('false');
 await expect(beta).toHaveAttribute('aria-pressed','false',{timeout:8000});
 await expect(page.getByText('Style Library')).toBeVisible();
 await expect(page.locator('.lt-beta-frame')).toHaveCount(0);
});
test('Line Trails Beta: clear, visibility switches and blackout preserve Track',async({page})=>{
 const {panel}=await openBeta(page);
 await panel.getByRole('button',{name:'Coba Demo'}).click();
 await expect(panel.getByText(/DEMO/)).toBeVisible({timeout:7000});
 await panel.getByLabel('Tampilkan Kaki 1').uncheck();
 await expect(panel.getByLabel('Tampilkan Kaki 1')).not.toBeChecked();
 await panel.getByLabel('Tampilkan Kaki 2').uncheck();
 await expect(panel.getByLabel('Tampilkan Kaki 2')).not.toBeChecked();
 await panel.getByRole('button',{name:'Hentikan Demo'}).click();
 await panel.getByRole('button',{name:'Bersihkan'}).click();
 await expect(panel.getByText(/0 sampel tersimpan/)).toBeVisible();
 await expect(page.locator('.lt-beta-frame canvas')).toBeVisible();
});

test('Line Trails V2: switch four styles and three motion smoothness levels without restarting Track',async({page})=>{
 const {panel}=await openBeta(page);
 await panel.getByRole('button',{name:'Coba Demo'}).click();
 await expect(panel.getByText(/DEMO/)).toBeVisible({timeout:7000});
 const canvas=page.locator('.lt-beta-frame canvas');
 await expect(canvas).toHaveCount(1);
 for(const label of ['Kontur','Pita','Serat','Tinta']){
  const choice=panel.getByRole('button',{name:'Gaya '+label});
  await choice.click();
  await expect(choice).toHaveAttribute('aria-pressed','true');
  await expect(canvas).toBeVisible();
 }
 for(const label of ['Responsif','Sangat halus','Halus']){
  const choice=panel.getByRole('button',{name:'Kehalusan '+label});
  await choice.click();
  await expect(choice).toHaveAttribute('aria-pressed','true');
 }
 await expect(panel.getByRole('button',{name:'Hentikan Demo'})).toBeVisible();
 await expect(page.locator('.lt-beta-frame canvas')).toHaveCount(1);
});

test('Footprint Brush V3: toggle, sweep/step, layering, size and native fullscreen',async({page})=>{
 const {monitor,panel}=await openBeta(page);
 const brush=panel.getByRole('checkbox',{name:'Jejak Kaki'});
 await expect(brush).not.toBeChecked();
 await brush.check();
 await expect(brush).toBeChecked();
 const sweep=panel.getByRole('button',{name:'Sapuan'});
 await expect(sweep).toHaveAttribute('aria-pressed','true');
 await panel.getByRole('button',{name:'Coba Demo'}).click();
 await expect(panel.getByText(/DEMO/)).toBeVisible({timeout:7000});
 await expect.poll(async()=>{
  const text=await panel.locator('.lt-beta-count').textContent();
  return Number(text?.split('·')[1]?.trim().split(' ')[0]??0);
 },{timeout:12000}).toBeGreaterThan(0);
 await panel.getByRole('checkbox',{name:'Tampilkan garis'}).uncheck();
 await expect(panel.getByRole('group',{name:'Gaya garis'})).toHaveCount(0);
 await panel.getByRole('slider',{name:'Ukuran telapak'}).focus();
 await panel.getByRole('slider',{name:'Ukuran telapak'}).press('End');
 await expect(panel.getByRole('slider',{name:'Ukuran telapak'})).toHaveValue('100');
 await panel.getByRole('button',{name:'Pijakan'}).click();
 await expect(panel.getByRole('button',{name:'Pijakan'})).toHaveAttribute('aria-pressed','true');
 await monitor.getByRole('button',{name:'Fullscreen Stage Monitor'}).click();
 await expect.poll(()=>page.evaluate(()=>document.fullscreenElement?.classList.contains('lt-beta-frame')??false)).toBe(true);
 const clean=await page.evaluate(()=>({
  children:document.fullscreenElement?.children.length,
  buttons:document.fullscreenElement?.querySelectorAll('button').length,
  canvases:document.fullscreenElement?.querySelectorAll('canvas').length
 }));
 expect(clean).toEqual({children:1,buttons:0,canvases:1});
 await page.keyboard.press('Escape');
 await expect.poll(()=>page.evaluate(()=>document.fullscreenElement===null)).toBe(true);
 await brush.uncheck();
 await expect(brush).not.toBeChecked();
 await panel.getByRole('button',{name:'Hentikan Demo'}).click();
 await panel.getByRole('button',{name:'Bersihkan'}).click();
 await expect(panel.locator('.lt-beta-count')).toContainText('0 sapuan');
 await expect(page.locator('.lt-beta-frame canvas')).toBeVisible();
});

test('Fullscreen input and skeleton previews are OFF by default, opt-in via V/K, clean again when OFF',async({page})=>{
 const {monitor,panel}=await openBeta(page);
 const camera=panel.getByRole('checkbox',{name:'Preview Kamera Input'});
 const skeleton=panel.getByRole('checkbox',{name:'Skeleton Fullscreen'});
 await expect(camera).not.toBeChecked();
 await expect(skeleton).not.toBeChecked();
 const canvas=page.locator('.lt-beta-frame canvas');
 const pixel=()=>canvas.evaluate(el=>{
  const ctx=el.getContext('2d');
  return ctx?Array.from(ctx.getImageData(1180,80,1,1).data).slice(0,3):[];
 });
 await monitor.getByRole('button',{name:'Fullscreen Stage Monitor'}).click();
 await expect.poll(()=>page.evaluate(()=>document.fullscreenElement?.classList.contains('lt-beta-frame')??false)).toBe(true);
 await expect.poll(pixel).toEqual([245,245,242]);
 await page.keyboard.press('v');
 await expect.poll(()=>camera.isChecked()).toBe(true);
 await expect.poll(async()=>(await pixel())[0]).toBeLessThan(100);
 await page.keyboard.press('k');
 await expect.poll(()=>skeleton.isChecked()).toBe(true);
 await page.keyboard.press('v');
 await expect.poll(()=>camera.isChecked()).toBe(false);
 await page.keyboard.press('k');
 await expect.poll(()=>skeleton.isChecked()).toBe(false);
 await expect.poll(pixel).toEqual([245,245,242]);
 const clean=await page.evaluate(()=>({
  canvases:document.fullscreenElement?.querySelectorAll('canvas').length,
  buttons:document.fullscreenElement?.querySelectorAll('button').length,
  children:document.fullscreenElement?.children.length
 }));
 expect(clean).toEqual({canvases:1,buttons:0,children:1});
 await page.keyboard.press('Escape');
 await expect.poll(()=>page.evaluate(()=>document.fullscreenElement===null)).toBe(true);
 await camera.check();
 await expect(camera).toBeChecked();
 await expect.poll(pixel).toEqual([245,245,242]); // overlay is fullscreen-only
 await monitor.getByRole('button',{name:'Fullscreen Stage Monitor'}).click();
 await expect.poll(async()=>(await pixel())[0]).toBeLessThan(100);
 await page.keyboard.press('Escape');
});

test('Source parity: 1P and 2P modes stay selectable when switching from camera to MP4',async({page})=>{
 await page.goto('/');
 const performers=page.getByRole('group',{name:'Jumlah performer'});
 await expect(performers).toBeVisible();
 await performers.getByRole('button',{name:'2P'}).click();
 await expect(performers.getByRole('button',{name:'2P'})).toHaveAttribute('aria-pressed','true');
 await selectStageSource(page,'Video MP4');
 await expect(page.getByRole('region',{name:'Sumber video MP4 Footprints'})).toBeVisible();
 await expect(performers.getByRole('button',{name:'2P'})).toHaveAttribute('aria-pressed','true');
 await performers.getByRole('button',{name:'1P'}).click();
 await expect(performers.getByRole('button',{name:'1P'})).toHaveAttribute('aria-pressed','true');
 // Without a decoded MP4, no skeleton or actor may be claimed as valid.
 await expect(page.getByText('Menganalisis video')).toHaveCount(0);
 await expect(page.getByRole('button',{name:'Map workspace'})).toBeVisible();
});


test('Regression: red Garis BETA button remains visible after disabling lines and switching Compose tabs',async({page})=>{
 await page.goto('/');
 await page.getByRole('button',{name:'Compose workspace'}).click();
 const monitor=page.locator('#soma-compose-monitor');
 const beta=monitor.locator('button.lt-beta-trigger');
 await expect(beta).toBeVisible();
 await expect(beta).toContainText('Garis');
 await expect(beta).toContainText('BETA');
 await beta.click();
 await expect(beta).toHaveAttribute('aria-pressed','true');
 await expect(page.getByRole('region',{name:'Kontrol Garis Beta'})).toBeVisible();
 await beta.click();
 await expect(beta).toBeVisible();
 await expect(beta).toHaveAttribute('aria-pressed','false');
 await monitor.getByRole('button',{name:'LEG A'}).click();
 await expect(beta).toBeVisible();
 await monitor.getByRole('button',{name:'FLOOR'}).click();
 await expect(beta).toBeVisible();
 await beta.click();
 await expect(beta).toHaveAttribute('aria-pressed','true');
 await expect(page.locator('.lt-beta-frame canvas')).toBeVisible();
});
