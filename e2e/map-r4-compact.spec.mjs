import {test,expect} from '@playwright/test';

test('MAP-R4: only essential room presets and corners are visible by default',async({page})=>{
 await page.goto('/');
 await page.getByRole('button',{name:'Map workspace'}).click();
 const rail=page.locator('.map-r2-rail');
 const common=rail.locator('.map-r4-main-presets');
 const room=rail.locator('.map-r4-room-extra');
 await expect(room.locator('summary')).toContainText('5×5 m');
 await expect(common.getByRole('button',{name:'5×5 m'})).toBeHidden();
 await room.locator('summary').click();
 await expect(common.getByRole('button',{name:'5×5 m'})).toBeVisible();
 await expect(common.getByRole('button')).toHaveCount(3);
 await expect(rail.getByLabel('Lebar (m)')).toBeHidden();
 await expect(rail.getByRole('button',{name:'Geser sudut ke kiri'})).toBeHidden();
 await expect(rail.locator('.map-r4-active-corner')).toContainText('Titik 1');
 await expect(rail.locator('.stage-dual-qa-disclosure')).toBeVisible();
 await expect(rail.locator('.map-r2-test-btn')).toBeVisible();
 await expect(rail.getByLabel('Lebar (m)')).toBeVisible();
 await rail.getByLabel('Lebar (m)').fill('6');
 await expect(rail.locator('.map-r4-room-extra > summary')).toContainText('6×5 m');
 await rail.locator('.map-r4-room-extra > summary').click();
 await expect(rail.getByLabel('Lebar (m)')).toBeHidden();
});

test('MAP-R4: precision and profile stay accessible behind clear disclosures',async({page})=>{
 await page.goto('/');
 await page.getByRole('button',{name:'Map workspace'}).click();
 const rail=page.locator('.map-r2-rail');
 const precision=rail.locator('.map-r4-precision');
 await expect(precision.locator('.map-r2-corner-picks')).toBeHidden();
 await precision.locator('summary').click();
 await precision.locator('.map-r2-corner-picks').getByRole('button',{name:'2 TR'}).click();
 await expect(precision.locator('.map-r4-active-corner')).toContainText('Titik 2');
 await expect(rail.getByRole('button',{name:'Geser sudut ke kiri'})).toBeVisible();
 await expect(rail.getByRole('button',{name:'Batalkan perubahan sudut'})).toBeVisible();
 const advanced=rail.locator('details.map-r2-advanced');
 await expect(advanced.locator('summary').first()).toContainText('Pengaturan teknis');
 await advanced.locator('summary').first().click();
 await expect(advanced.locator('details.stage-dual-profile')).toBeVisible();
 await advanced.locator('details.stage-dual-profile > summary').click();
 await expect(advanced.getByRole('button',{name:'Simpan draf output'})).toBeVisible();
 await expect(page.getByRole('button',{name:'Kirim perintah blackout SOMA'})).toHaveCount(1);
});
