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

test('MAP-V4: QA, status and Perform share one bottom dock, no detached foot cards',async({page})=>{
 await page.goto('/');
 await page.getByRole('button',{name:'Map workspace'}).click();
 const map=page.locator('.soma-map-wysiwyg');
 const dock=map.locator('.soma-map-wysiwyg-bottom');
 await expect(dock).toBeVisible();
 await expect(page.locator('.soma-map-v2-foot')).toHaveCount(0);
 await expect(dock.getByRole('button',{name:'Lanjut Perform'})).toBeVisible();
 await expect(dock.locator('.soma-map-v4-status [role="status"]')).toBeVisible();
 const qa=dock.locator('.map-r8-projector-setup');
 if(await qa.count()){
  await expect(qa.locator(':scope > summary')).toBeVisible();
  await qa.locator(':scope > summary').click();
  await expect(qa.locator('.soma-map-v4-qa-popover')).toBeVisible();
  const screen=page.viewportSize();
  const popup=await qa.locator('.soma-map-v4-qa-popover').boundingBox();
  expect(popup).toBeTruthy();
  expect(popup.x).toBeGreaterThanOrEqual(-2);
  expect(popup.x+popup.width).toBeLessThanOrEqual(screen.width+2);
  await qa.locator(':scope > summary').click();
 }
 const box=await dock.boundingBox();
 expect(box).toBeTruthy();
 expect(box.height).toBeLessThan(105);
});
