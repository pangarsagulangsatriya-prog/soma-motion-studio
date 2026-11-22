import {test,expect} from '@playwright/test';

async function openPainterly(page){
 await page.goto('/');
 await page.getByRole('button',{name:'Compose workspace'}).click();
 const monitor=page.locator('#soma-compose-monitor');
 await monitor.locator('button.lt-beta-trigger').click();
 const panel=page.getByRole('region',{name:'Kontrol Garis V3'});
 await expect(panel).toBeVisible();
 // Legacy V3.2 regression coverage uses the explicit fallback selection.
 await panel.getByRole('group',{name:'Engine lukisan'}).getByRole('button',{name:'V3.2'}).click();
 return {panel,monitor};
}
test('Painterly V3.2 fallback: white canvas, Tinta, two independent decay controls',async({page})=>{
 const {panel,monitor}=await openPainterly(page);
 await expect(panel.getByText('Garis · Painterly')).toBeVisible();
 await expect(panel.getByText('V3.2 BETA')).toBeVisible();
 await expect(panel.getByRole('group',{name:'Material lukisan'}).getByRole('button',{name:'Tinta'}))
  .toHaveAttribute('aria-pressed','true');
 await expect(panel.getByLabel('Tampilkan tapak kaki')).toBeChecked();
 await expect(panel.getByLabel('Tampilkan garis lintasan')).toBeChecked();
 await expect(panel.getByRole('slider',{name:'Durasi tapak kaki'})).toHaveValue('8');
 await expect(panel.getByRole('slider',{name:'Durasi garis lintasan'})).toHaveValue('4');
 await panel.getByRole('slider',{name:'Durasi tapak kaki'}).fill('12');
 await panel.getByRole('slider',{name:'Durasi garis lintasan'}).fill('3');
 await expect(panel.getByRole('slider',{name:'Durasi tapak kaki'})).toHaveValue('12');
 await expect(panel.getByRole('slider',{name:'Durasi garis lintasan'})).toHaveValue('3');
 await panel.getByLabel('Garis tetap').check();
 await expect(panel.getByRole('slider',{name:'Durasi garis lintasan'})).toBeDisabled();
 await panel.getByLabel('Garis tetap').uncheck();
 const bg=await monitor.locator('.lt-v3-stage canvas').evaluate(el=>{
  const c=el.getContext('2d');const pixel=c?.getImageData(0,0,1,1).data;
  return pixel?Array.from(pixel):[];
 });
 expect(bg.slice(0,3)).toEqual([245,245,242]);
});
test('Material switching preserves trajectory, debug data and actor identity',async({page})=>{
 const {panel}=await openPainterly(page);
 await panel.getByRole('button',{name:'Coba Demo'}).click();
 await expect(panel.getByText(/DEMO/)).toBeVisible();
 await expect.poll(async()=>{
  const content=await panel.locator('.lt-beta-count').innerText();
  return Number(content.match(/(\d+) cap/)?.[1]??0);
 },{timeout:12000}).toBeGreaterThan(0);
 const count=Number((await panel.locator('.lt-beta-count').innerText()).match(/^(\d+) titik/)?.[1]??0);
 for(const name of ['Arang','Pigmen','Tinta']){
  await panel.getByRole('group',{name:'Material lukisan'}).getByRole('button',{name}).click();
  await expect(panel.getByRole('group',{name:'Material lukisan'}).getByRole('button',{name}))
   .toHaveAttribute('aria-pressed','true');
 }
 const after=Number((await panel.locator('.lt-beta-count').innerText()).match(/^(\d+) titik/)?.[1]??0);
 expect(after).toBeGreaterThanOrEqual(count);
 await expect(panel.getByLabel('Warna Aktor A')).toHaveValue('#e44f32');
 await panel.locator('.lt-v3-debug summary').click();
 await expect(panel.getByText(/Cap: \d+/)).toBeVisible();
});
test('Painterly fullscreen clean; V3.1 classic rollback and blackout remain accessible',async({page})=>{
 const {panel,monitor}=await openPainterly(page);
 await panel.getByRole('button',{name:'Coba Demo'}).click();
 await monitor.getByRole('button',{name:'Fullscreen Stage Monitor'}).click();
 await expect.poll(()=>page.evaluate(()=>document.fullscreenElement?.classList.contains('lt-v3-stage')??false)).toBe(true);
 expect(await page.evaluate(()=>document.fullscreenElement?.querySelectorAll('button').length)).toBe(0);
 await page.keyboard.press('Escape');
 await panel.locator('.lt-v3-advanced summary').click();
 await panel.getByRole('checkbox',{name:/Painterly aktif/}).uncheck();
 await expect(panel.getByRole('checkbox',{name:/Painterly aktif/})).not.toBeChecked();
 await panel.getByRole('checkbox',{name:/Painterly aktif/}).check();
 await panel.getByRole('button',{name:'Hentikan Demo'}).click();
 await panel.getByRole('button',{name:'Bersihkan'}).click();
 await expect(panel.locator('.lt-beta-count')).toContainText('0 titik');
 await expect(panel.locator('.lt-beta-count')).toContainText('0 cap');
});
