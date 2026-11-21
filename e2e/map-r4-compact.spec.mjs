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
 await expect(output.getByRole('button',{name:'Sesuaikan proyektor'})).toBeVisible();
 await expect(output.locator('.soma-map-wysiwyg-handle')).toHaveCount(0);
 await output.getByRole('button',{name:'Sesuaikan proyektor'}).click();
 await expect(output.locator('.soma-map-wysiwyg-handle')).toHaveCount(4);
 await expect(output.getByRole('button',{name:'Simpan bidang'})).toBeVisible();
 await output.getByRole('button',{name:'Simpan bidang'}).click();
 await expect(output.locator('.soma-map-wysiwyg-handle')).toHaveCount(0);
 await expect(page.getByRole('button',{name:'Kirim perintah blackout SOMA'})).toHaveCount(1);
});
