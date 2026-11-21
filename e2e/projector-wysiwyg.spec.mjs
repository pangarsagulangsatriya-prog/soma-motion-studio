import {openStageMap} from './ia-ux-helpers.mjs';
import {test,expect} from '@playwright/test';

test('Projector WYSIWYG: FLOOR and BODY share the real Compose output and global Blackout',async({page})=>{
 await page.goto('/');
 await openStageMap(page);
 const map=page.locator('.soma-map-wysiwyg');
 await expect(map).toBeVisible();
 await expect(map.locator('canvas[aria-label="Hasil visual Compose dengan perspektif proyeksi"]')).toBeVisible();
 await expect(map.getByText('Hasil visual lantai')).toBeVisible();
 await page.getByRole('button',{name:'Tubuh',exact:true}).click();
 await expect(map.getByText('Hasil visual tubuh')).toBeVisible();
 await page.getByRole('button',{name:'Lantai',exact:true}).click();
 await expect(map.getByText('Hasil visual lantai')).toBeVisible();
 await expect(page.getByRole('button',{name:'Kirim perintah blackout SOMA'})).toHaveCount(1);
 await expect(page.locator('.map-r2-advanced')).toHaveCount(0);
 await expect(page.locator('.map-r8-projector-setup')).toHaveCount(0);
 await expect(page.locator('.soma-stage-module-nav').getByRole('button',{name:'Lanjut Perform'})).toBeVisible();
});

test('Projector WYSIWYG: quad preview can be cancelled or saved without arming physical output',async({page})=>{
 await page.goto('/');
 await openStageMap(page);
 const map=page.locator('.soma-map-wysiwyg');
 const output=map.locator('.soma-map-wysiwyg-pane').last();
 await map.getByRole('button',{name:'Coba simulasi'}).click();
 const overlay=output.locator('svg.soma-map-wysiwyg-overlay');
 await output.getByRole('button',{name:'Sesuaikan proyektor'}).click();
 const before=await overlay.locator('polygon').getAttribute('points');
 const handle=overlay.locator('.soma-map-wysiwyg-handle').first();
 const rect=await handle.boundingBox();
 expect(rect).toBeTruthy();
 const x=rect.x+rect.width/2,y=rect.y+rect.height/2;
 await page.mouse.move(x,y);
 await page.mouse.down();
 await page.mouse.move(x+26,y+16,{steps:6});
 await page.mouse.up();
 await expect.poll(()=>overlay.locator('polygon').getAttribute('points')).not.toBe(before);
 await output.getByRole('button',{name:'Batalkan'}).click();
 await expect.poll(()=>overlay.locator('polygon').getAttribute('points')).toBe(before);
 await output.getByRole('button',{name:'Simpan bidang'}).click();
 await expect(output.locator('.soma-map-wysiwyg-handle')).toHaveCount(0);
 await expect(page.getByRole('button',{name:'Kirim perintah blackout SOMA'})).toHaveCount(1);
});
