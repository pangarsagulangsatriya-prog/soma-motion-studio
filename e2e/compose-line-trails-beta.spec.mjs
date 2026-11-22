import {test,expect} from '@playwright/test';

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
