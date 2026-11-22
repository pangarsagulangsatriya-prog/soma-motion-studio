import {test,expect} from '@playwright/test';
async function openSumi(page){
 await page.goto('/');
 await page.getByRole('button',{name:'Compose workspace'}).click();
 const monitor=page.locator('#soma-compose-monitor');
 await monitor.locator('button.lt-beta-trigger').click();
 const panel=page.getByRole('region',{name:'Kontrol Garis V3'});
 await expect(panel).toBeVisible();
 await panel.getByRole('group',{name:'Engine lukisan'}).getByRole('button',{name:'Sumi V3.4'}).click();
 return {panel,monitor};
}
test('Sumi V3.4 enables bold 36px, permanent ink and 6s footprints',async({page})=>{
 const {panel,monitor}=await openSumi(page);
 await expect(panel.getByText('V3.4 SUMI')).toBeVisible();
 await expect(panel.getByRole('group',{name:'Material lukisan'}).getByRole('button',{name:'Sumi'}))
  .toHaveAttribute('aria-pressed','true');
 await expect(panel.getByRole('slider',{name:'Bobot kuas Sumi'})).toHaveValue('36');
 await expect(panel.getByRole('slider',{name:'Durasi tapak kaki'})).toHaveValue('6');
 await expect(panel.getByLabel('Garis tetap')).toBeChecked();
 await expect(panel.getByRole('slider',{name:'Durasi garis lintasan'})).toBeDisabled();
 await panel.getByRole('slider',{name:'Bobot kuas Sumi'}).fill('64');
 await expect(panel.getByRole('slider',{name:'Bobot kuas Sumi'})).toHaveValue('64');
 await panel.getByRole('button',{name:'Coba Demo'}).click();
 await expect(panel.getByText(/DEMO/)).toBeVisible();
 // Visual pixels must exist beyond the white background after movement.
 await expect.poll(async()=>{
  return monitor.locator('.lt-v3-stage canvas').evaluate(c=>{
   const ctx=c.getContext('2d'),data=ctx.getImageData(0,0,c.width,c.height).data;
   let count=0;for(let i=0;i<data.length;i+=160){
    if(data[i]<215||data[i+1]<200||data[i+2]<190)count++;
   }return count;
  });
 },{timeout:12000}).toBeGreaterThan(10);
 await panel.getByRole('button',{name:'Hentikan Demo'}).click();
 await expect(panel.getByRole('button',{name:'Simpan lukisan PNG'})).toBeVisible();
 await panel.getByRole('button',{name:'Bersihkan Lukisan'}).click();
 const bg=await monitor.locator('.lt-v3-stage canvas').evaluate(c=>{
  const p=c.getContext('2d').getImageData(0,0,1,1).data;
  return Array.from(p.slice(0,3));
 });
 expect(bg).toEqual([245,245,242]);
});
test('Sumi preview fit and fallbacks remain controllable',async({page})=>{
 const {panel}=await openSumi(page);
 await panel.getByLabel('Komposisi preview').check();
 await expect(panel.getByLabel('Komposisi preview')).toBeChecked();
 await panel.getByRole('group',{name:'Engine lukisan'}).getByRole('button',{name:'Kuas V3.3'}).click();
 await expect(panel.getByText('V3.3 BETA')).toBeVisible();
 await panel.getByRole('group',{name:'Engine lukisan'}).getByRole('button',{name:'V3.2'}).click();
 await expect(panel.getByText('V3.2 BETA')).toBeVisible();
});
