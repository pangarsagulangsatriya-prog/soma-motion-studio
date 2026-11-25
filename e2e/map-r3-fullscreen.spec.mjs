import {test,expect} from '@playwright/test';

test('MAP-V2: active camera view and output preview stay visible in fullscreen',async({page})=>{
 await page.goto('/');
 await page.getByRole('button',{name:'Map workspace'}).click();
 const map=page.locator('.soma-map-wysiwyg');
 await expect(map).toBeVisible();
 await map.getByRole('button',{name:'Kamera',exact:true}).click();
 await expect(map.locator('canvas[aria-label="Gambar input kamera atau video"]')).toBeVisible();
 await expect(map.locator('canvas[aria-label="Hasil visual Compose dengan perspektif proyeksi"]')).toBeVisible();
 await expect(map.getByRole('button',{name:'Coba simulasi'})).toBeVisible();
 await map.getByRole('button',{name:'Coba simulasi'}).click();
 await map.getByRole('button',{name:'Kamera',exact:true}).click();
 await expect(map.locator('.soma-map-v7-camera').getByText('SIMULASI',{exact:true})).toBeVisible();
 await expect(map.locator('.soma-map-v7-output').getByText('VIRTUAL',{exact:true})).toBeVisible();
 await expect(map.locator('.soma-map-v3-empty')).toHaveCount(0);
 const left=map.locator('canvas[aria-label="Gambar input kamera atau video"]');
 await expect.poll(()=>left.evaluate(el=>{
  const pixel=el.getContext('2d').getImageData(320,240,1,1).data;
  return pixel[0]+pixel[1]+pixel[2];
 })).toBeGreaterThan(45);
 await expect(map.getByRole('button',{name:'Jeda'})).toBeVisible();
 await map.getByRole('button',{name:'Layar penuh Map'}).click();
 await expect.poll(()=>page.evaluate(()=>document.fullscreenElement?.getAttribute('aria-label'))).toBe('Kalibrasi Map langsung');
 await expect(map.locator('canvas[aria-label="Gambar input kamera atau video"]')).toBeVisible();
 await map.getByRole('button',{name:'Tutup layar penuh'}).click();
 await expect.poll(()=>page.evaluate(()=>document.fullscreenElement===null)).toBe(true);
 await expect(page.getByRole('button',{name:'Kirim perintah blackout SOMA'})).toHaveCount(1);
});

test('MAP-V5: Map uses Track-standard top CTA and has no projector testing panel',async({page})=>{
 await page.goto('/');
 await page.getByRole('button',{name:'Map workspace'}).click();
 const nav=page.locator('.soma-stage-module-nav');
 const map=page.locator('.stage-dual.map-r2-shell');
 await expect(nav.getByRole('button',{name:'Lanjut Perform'})).toBeVisible();
 await expect(map.locator('.soma-map-v2-main')).toBeVisible();
 await expect(map.getByRole('button',{name:'Lanjut Perform'})).toHaveCount(0);
 await expect(map.locator('.map-r8-projector-setup')).toHaveCount(0);
 await expect(map.getByText('Uji proyektor',{exact:true})).toHaveCount(0);
 await expect(map.getByText('QA fisik',{exact:true})).toHaveCount(0);
 await expect(map.locator('.map-r2-advanced')).toHaveCount(0);
 await expect(page.getByRole('button',{name:'Kirim perintah blackout SOMA'})).toHaveCount(1);
});
 
test('MAP-V3: idle state offers simulation and real Track/Compose navigation',async({page})=>{
 await page.goto('/');
 await page.getByRole('button',{name:'Map workspace'}).click();
 const map=page.locator('.soma-map-wysiwyg');
 await map.getByRole('button',{name:'Kamera',exact:true}).click();
 await expect(map.locator('.soma-map-v3-empty')).toBeVisible();
 await expect(map.locator('.soma-map-v3-result-empty')).toBeVisible();
 await expect(map.getByRole('button',{name:'Sesuaikan proyektor'})).toHaveCount(0);
 await expect(map.getByRole('button',{name:'Coba simulasi'})).toBeVisible();
 await map.getByRole('button',{name:'Pilih kamera di Track'}).click();
 await expect(page.locator('[data-workspace="track"]')).toBeVisible();
 await page.getByRole('button',{name:'Map workspace'}).click();
 await page.locator('.soma-map-wysiwyg').getByRole('button',{name:'Buka Compose'}).click();
 await expect(page.locator('[data-workspace="compose"]')).toBeVisible();
});

test('MAP-V3: simulation can pause and resume without reconnecting a camera',async({page})=>{
 await page.goto('/');
 await page.getByRole('button',{name:'Map workspace'}).click();
 const map=page.locator('.soma-map-wysiwyg');
 await map.getByRole('button',{name:'Coba simulasi'}).click();
 await expect(map.getByRole('button',{name:'Jeda'})).toBeVisible();
 await map.getByRole('button',{name:'Jeda'}).click();
 await expect(map.getByRole('button',{name:'Lanjutkan'})).toBeVisible();
 await map.getByRole('button',{name:'Lanjutkan'}).click();
 await expect(map.getByRole('button',{name:'Jeda'})).toBeVisible();
 await map.getByRole('button',{name:'Hentikan'}).click();
 await expect(map.getByRole('button',{name:'Coba simulasi'})).toBeVisible();
});
