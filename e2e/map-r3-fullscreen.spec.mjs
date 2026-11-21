import {test,expect} from '@playwright/test';

test('MAP-V2: source and projected result stay side by side in fullscreen',async({page})=>{
 await page.goto('/');
 await page.getByRole('button',{name:'Map workspace'}).click();
 const map=page.locator('.soma-map-wysiwyg');
 await expect(map).toBeVisible();
 await expect(map.locator('canvas[aria-label="Gambar input kamera atau video"]')).toBeVisible();
 await expect(map.locator('canvas[aria-label="Hasil visual Compose dengan perspektif proyeksi"]')).toBeVisible();
 await expect(map.getByRole('button',{name:'Coba simulasi'})).toBeVisible();
 await map.getByRole('button',{name:'Coba simulasi'}).click();
 await expect(map.getByText('SIMULASI JEJAK')).toBeVisible();
 await expect(map.getByRole('button',{name:'Jeda'})).toBeVisible();
 await map.getByRole('button',{name:'Layar penuh Map'}).click();
 await expect.poll(()=>page.evaluate(()=>document.fullscreenElement?.getAttribute('aria-label'))).toBe('Kalibrasi Map langsung');
 await expect(map.locator('canvas[aria-label="Gambar input kamera atau video"]')).toBeVisible();
 await map.getByRole('button',{name:'Tutup layar penuh'}).click();
 await expect.poll(()=>page.evaluate(()=>document.fullscreenElement===null)).toBe(true);
 await expect(page.getByRole('button',{name:'Kirim perintah blackout SOMA'})).toHaveCount(1);
});

test('MAP-V2: no duplicate technical panel; projector QA is opt-in',async({page})=>{
 await page.goto('/');
 await page.getByRole('button',{name:'Map workspace'}).click();
 const map=page.locator('.stage-dual.map-r2-shell');
 await expect(map.locator('.soma-map-v2-main')).toBeVisible();
 await expect(map.locator('.map-r2-advanced')).toHaveCount(0);
 await expect(map.getByText('Teknis & diagnostik')).toHaveCount(0);
 const qa=map.locator('.map-r8-projector-setup');
 if(await qa.count()){
  await expect(qa).not.toHaveAttribute('open');
  await qa.locator('summary').click();
  await expect(qa.locator('.stage-dual-qa-disclosure')).toBeVisible();
 }
 await expect(map.getByRole('button',{name:'Lanjut Perform'})).toBeVisible();
});
