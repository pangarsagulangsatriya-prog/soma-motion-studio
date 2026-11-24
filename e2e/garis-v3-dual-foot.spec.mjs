import {test,expect} from '@playwright/test';

async function openV3(page){
 await page.goto('/');
 await page.getByRole('button',{name:'Compose workspace'}).click();
 const monitor=page.locator('#soma-compose-monitor');
 await expect(monitor).toBeVisible();
 const beta=monitor.locator('button.lt-beta-trigger');
 await expect(beta).toBeVisible();
 await beta.click();
 const panel=page.getByRole('region',{name:'Kontrol Garis V3'});
 await expect(panel).toBeVisible();
 // Legacy V3.2 painterly controls are intentionally selected for regression QA.
 await panel.getByRole('group',{name:'Engine lukisan'}).getByRole('button',{name:'V3.2'}).click();
 await expect(monitor.locator('.lt-v3-stage canvas')).toHaveCount(1);
 return {beta,panel,monitor};
}
test('V3 uses two-foot precise default, a compact control panel and a clean canvas',async({page})=>{
 const {panel}=await openV3(page);
 await expect(panel.getByRole('group',{name:'Material lukisan'}).getByRole('button',{name:'Tinta'}))
  .toHaveAttribute('aria-pressed','true');
 await expect(panel.getByLabel('Tampilkan tapak kaki')).toBeChecked();
 await expect(panel.getByLabel('Warna Aktor A')).toHaveValue('#e44f32');
 await panel.locator('.lt-painterly-characters summary').click();
 await expect(panel.getByRole('group',{name:'Karakter garis'}).getByRole('button',{name:'Luwes'}))
  .toHaveAttribute('aria-pressed','true');
 await expect(panel.getByRole('slider',{name:'Ketebalan lintasan'})).toHaveValue('3');
 await panel.getByRole('button',{name:'Coba Demo'}).click();
 await expect(panel.getByText(/DEMO/)).toBeVisible({timeout:9000});
 await expect.poll(()=>page.locator('.lt-v3-stage canvas').evaluate(canvas=>{
  const ctx=canvas.getContext('2d');if(!ctx)return 0;
  const {data}=ctx.getImageData(0,0,canvas.width,canvas.height);
  let n=0;
  for(let i=0;i<data.length;i+=40){
   if((data[i]>175&&data[i+1]<145&&data[i+2]<140)||
      (data[i]<100&&data[i+1]>100&&data[i+1]<215&&data[i+2]>90))n++;
  }
  return n;
 }),{timeout:12000}).toBeGreaterThan(5);
 await panel.getByLabel('Warna Aktor A').fill('#ff0000');
 await expect(panel.getByLabel('Warna Aktor A')).toHaveValue('#ff0000');
 await panel.getByRole('slider',{name:'Durasi tapak kaki'}).fill('8');
 await expect(panel.getByRole('slider',{name:'Durasi tapak kaki'})).toHaveValue('8');
 await panel.getByRole('button',{name:'Hentikan Demo'}).click();
 await panel.getByRole('button',{name:'Bersihkan'}).click();
 await expect(panel.locator('.lt-beta-count')).toContainText('0 titik');
});
test('V3 traces in one canvas and fullscreen remains clean with no controls',async({page})=>{
 const {panel,monitor,beta}=await openV3(page);
 await panel.getByRole('button',{name:'Coba Demo'}).click();
 await monitor.getByRole('button',{name:'Fullscreen Stage Monitor'}).click();
 await expect.poll(()=>page.evaluate(()=>document.fullscreenElement?.classList.contains('lt-v3-stage')??false)).toBe(true);
 const clean=await page.evaluate(()=>({
  canvases:document.fullscreenElement?.querySelectorAll('canvas').length,
  buttons:document.fullscreenElement?.querySelectorAll('button').length,
  children:document.fullscreenElement?.children.length
 }));
 expect(clean).toEqual({canvases:1,buttons:0,children:1});
 await page.keyboard.press('Escape');
 await expect.poll(()=>page.evaluate(()=>document.fullscreenElement===null)).toBe(true);
 await expect(beta).toHaveAttribute('aria-pressed','true');
});
test('V3 debug is optional; V2 rollback restores old styles without losing navigation',async({page})=>{
 const {panel,monitor,beta}=await openV3(page);
 await panel.locator('.lt-v3-debug summary').click();
 const debug=panel.getByRole('checkbox',{name:'Titik mentah dan hasil filter'});
 await debug.check();
 await expect(debug).toBeChecked();
 await panel.locator('.lt-v3-advanced summary').click();
 await panel.getByRole('button',{name:'Pakai engine V2 (rollback)'}).click();
 const v2=page.getByRole('region',{name:'Kontrol Garis Beta'});
 await expect(v2).toBeVisible();
 await expect(v2.getByRole('group',{name:'Gaya garis'})).toBeVisible();
 await page.getByRole('button',{name:'Kembali ke Garis V3'}).click();
 await expect(page.getByRole('region',{name:'Kontrol Garis V3'})).toBeVisible();
 await beta.click();
 await expect(beta).toHaveAttribute('aria-pressed','false');
 // Quick hides diagnostic LEG A/B until operator chooses the Advanced inspector.
 await expect(page.getByRole('button',{name:'Sederhana',exact:true})).toHaveAttribute('aria-pressed','true');
 await page.getByRole('button',{name:'Lanjutan',exact:true}).click();
 await monitor.getByRole('button',{name:'LEG A'}).click();
 await expect(beta).toBeVisible();
 await monitor.getByRole('button',{name:'FLOOR'}).click();
 await beta.click();
 await expect(page.getByRole('region',{name:'Kontrol Garis V3'})).toBeVisible();
});
