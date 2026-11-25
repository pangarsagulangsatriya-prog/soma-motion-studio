import {test,expect} from '@playwright/test';
test('Map V6 separates stage space, source, and projector draft',async({page})=>{
 await page.goto('/');
 await page.getByRole('button',{name:'Map workspace'}).click();
 const map=page.locator('.soma-map-wysiwyg');
 await expect(map.getByLabel('Denah lantai berskala meter dan estimasi posisi tapak')).toBeVisible();
 await map.getByRole('button',{name:'Coba simulasi'}).click();
 await expect(map.locator('.soma-map-v6-source')).toBeHidden();
 await map.getByRole('button',{name:'Periksa gambar sumber'}).click();
 await expect(map.locator('.soma-map-v6-source')).toBeVisible();
 await map.getByRole('button',{name:'Sesuaikan proyektor'}).click();
 await expect(map.locator('.soma-map-v6-inspector .soma-map-wysiwyg-handle')).toHaveCount(4);
 await expect(map.locator('.soma-map-v6-checklist')).toContainText('Periksa di Perform');
});
