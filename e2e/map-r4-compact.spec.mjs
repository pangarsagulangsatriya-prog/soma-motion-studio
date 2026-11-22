import {test,expect} from '@playwright/test';

test('MAP-V2: room size is a compact control and does not obscure the monitor',async({page})=>{
 await page.goto('/');
 await page.getByRole('button',{name:'Map workspace'}).click();
 const map=page.locator('.stage-dual.map-r2-shell');
 const room=map.locator('.soma-map-v2-room');
 await expect(room.locator('summary')).toContainText('5 × 5 m');
 await expect(room.getByLabel('Lebar (m)')).toBeHidden();
 await room.locator('summary').click();
 await expect(room.getByLabel('Lebar (m)')).toBeVisible();
 await room.getByLabel('Lebar (m)').fill('6');
 await expect(room.locator('summary')).toContainText('6 × 5 m');
 await room.locator('summary').click();
 await expect(room.getByLabel('Lebar (m)')).toBeHidden();
 await expect(map.locator('.soma-map-wysiwyg-grid')).toBeVisible();
});

test('MAP-V2: projector edit is contextual and no UV technical editor remains',async({page})=>{
 await page.goto('/');
 await page.getByRole('button',{name:'Map workspace'}).click();
 const map=page.locator('.soma-map-wysiwyg');
 const output=map.locator('.soma-map-wysiwyg-pane').last();
 await expect(output.getByRole('button',{name:'Sesuaikan proyektor'})).toHaveCount(0);
 await map.getByRole('button',{name:'Coba simulasi'}).click();
 await expect(output.getByRole('button',{name:'Sesuaikan proyektor'})).toBeVisible();
 await expect(output.locator('.soma-map-wysiwyg-handle')).toHaveCount(0);
 await output.getByRole('button',{name:'Sesuaikan proyektor'}).click();
 await expect(output.locator('.soma-map-wysiwyg-handle')).toHaveCount(4);
 await expect(output.getByRole('button',{name:'Simpan bidang'})).toBeVisible();
 await output.getByRole('button',{name:'Simpan bidang'}).click();
 await expect(output.locator('.soma-map-wysiwyg-handle')).toHaveCount(0);
 await expect(page.getByRole('button',{name:'Kirim perintah blackout SOMA'})).toHaveCount(1);
});

test('MAP-V5: compact footer retains only inline status and top navigation owns Perform',async({page})=>{
 await page.goto('/');
 await page.getByRole('button',{name:'Map workspace'}).click();
 const map=page.locator('.soma-map-wysiwyg');
 const dock=map.locator('.soma-map-wysiwyg-bottom');
 const nav=page.locator('.soma-stage-module-nav');
 await expect(dock.locator('.soma-map-v4-status [role="status"]')).toBeVisible();
 await expect(dock.locator('.map-r8-projector-setup')).toHaveCount(0);
 await expect(dock.getByRole('button',{name:'Lanjut Perform'})).toHaveCount(0);
 await expect(nav.getByRole('button',{name:'Lanjut Perform'})).toBeVisible();
 const dockBox=await dock.boundingBox();
 expect(dockBox).toBeTruthy();
 expect(dockBox.height).toBeLessThan(page.viewportSize().width<600?85:65);
 const navBox=await nav.boundingBox();
 const mapBox=await page.locator('.stage-dual.map-r2-shell').boundingBox();
 expect(navBox&&mapBox).toBeTruthy();
 expect(Math.abs(navBox.x-mapBox.x)).toBeLessThan(12);
 await nav.getByRole('button',{name:'Lanjut Perform'}).click();
 await expect(page.locator('[data-workspace="perform"]')).toBeVisible();
});

test('MAP-V6: perspective footprint preview has visible sample/live provenance and safe ON/OFF',async({page})=>{
 await page.goto('/');
 await page.getByRole('button',{name:'Map workspace'}).click();
 const map=page.locator('.soma-map-wysiwyg');
 await map.getByRole('button',{name:'Coba simulasi'}).click();
 const output=map.locator('.soma-map-wysiwyg-pane').last();
 const input=map.locator('.soma-map-wysiwyg-pane').first();
 const toggle=output.getByRole('button',{name:'Tampilkan jejak kaki perspektif'});
 await expect(toggle).toHaveAttribute('aria-pressed','true');
 await expect(toggle).toContainText('ON');
 await expect(output.locator('canvas[aria-label="Hasil visual Compose dengan perspektif proyeksi"]')).toBeVisible();
 await expect(input.locator('canvas[aria-label="Gambar input kamera atau video"]')).toBeVisible();
 await toggle.click();
 await expect(toggle).toHaveAttribute('aria-pressed','false');
 await expect(toggle).toContainText('OFF');
 await toggle.click();
 await expect(toggle).toHaveAttribute('aria-pressed','true');
 await map.getByRole('button',{name:'Layar penuh Map'}).click();
 await expect(toggle).toBeVisible();
 await expect.poll(()=>page.evaluate(()=>document.fullscreenElement?.getAttribute('aria-label'))).toBe('Kalibrasi Map langsung');
 await map.getByRole('button',{name:'Tutup layar penuh'}).click();
 await expect.poll(()=>page.evaluate(()=>document.fullscreenElement===null)).toBe(true);
 // Diagnostic preview must not unlock physical output.
 await expect(page.getByRole('button',{name:'Kirim perintah blackout SOMA'})).toHaveCount(1);
});
