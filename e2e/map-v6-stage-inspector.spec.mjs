import {test,expect} from '@playwright/test';
test('Map V7 uses a single primary viewport with a persistent projector preview',async({page})=>{
 await page.goto('/');
 await page.getByRole('button',{name:'Map workspace'}).click();
 const map=page.locator('.soma-map-wysiwyg');
 const grid=map.locator('.soma-map-v7-grid');
 await expect(grid).toHaveAttribute('data-view','room');
 await expect(map.getByLabel('Denah lantai berskala meter dan estimasi posisi tapak')).toBeVisible();
 await expect(map.locator('.soma-map-v7-camera')).toBeHidden();
 await map.getByRole('button',{name:'Coba simulasi'}).click();
 await map.getByRole('button',{name:'Kamera',exact:true}).click();
 await expect(grid).toHaveAttribute('data-view','camera');
 await expect(map.locator('.soma-map-v7-camera')).toBeVisible();
 await expect(map.locator('.soma-map-v7-room')).toBeHidden();
 await map.getByRole('button',{name:'Sesuaikan proyektor'}).click();
 await expect(grid).toHaveAttribute('data-view','projector');
 await expect(map.locator('.soma-map-v7-output .soma-map-wysiwyg-handle')).toHaveCount(4);
 await map.getByRole('button',{name:'Ruang',exact:true}).click();
 await expect(grid).toHaveAttribute('data-view','projector');
 await map.getByRole('button',{name:'Simpan bidang'}).click();
 await expect(grid).toHaveAttribute('data-view','room');
 await expect(map.locator('.soma-map-v7-output .soma-map-wysiwyg-handle')).toHaveCount(0);
 await expect(map.getByText('Uji fisik di Perform')).toBeVisible();
});

test('Map V7.1 has one set of view controls and actionable empty room',async({page})=>{
 await page.goto('/');
 await page.getByRole('button',{name:'Map workspace'}).click();
 const map=page.locator('.soma-map-wysiwyg');
 const room=map.locator('.soma-map-v7-room');
 await expect(map.getByRole('button',{name:'Kamera',exact:true})).toHaveCount(1);
 await expect(map.getByRole('button',{name:'Proyektor',exact:true})).toHaveCount(1);
 await expect(room.getByRole('button',{name:'Pilih kamera di Track'})).toBeVisible();
 await expect(room.getByRole('button',{name:'Coba simulasi'})).toBeVisible();
 await expect(map.getByRole('button',{name:'Coba simulasi'})).toHaveCount(1);
 await map.getByRole('button',{name:'Tes tapak'}).click();
 await expect(room.locator('.soma-map-v71-empty')).toHaveCount(0);
 await expect(map.locator('.soma-map-v7-output')).toContainText('TES VIRTUAL');
 await map.getByRole('button',{name:'Coba simulasi'}).click();
 await expect(room.locator('.soma-map-v71-empty')).toHaveCount(0);
});

test('Map V7.2 locks the selected surface while editing and releases it on cancel',async({page})=>{
 await page.goto('/');
 await page.getByRole('button',{name:'Map workspace'}).click();
 const map=page.locator('.soma-map-wysiwyg');
 const body=page.getByRole('group',{name:'Pilih bidang kalibrasi'}).getByRole('button',{name:'Tubuh'});
 await map.getByRole('button',{name:'Coba simulasi'}).click();
 await map.getByRole('button',{name:'Sesuaikan proyektor'}).click();
 await expect(body).toBeDisabled();
 const quad=map.getByRole('group',{name:'Empat sudut proyeksi'});
 await quad.focus();await quad.press('ArrowRight');
 await expect(body).toBeDisabled();
 await map.getByRole('button',{name:'Batalkan'}).click();
 await expect(body).toBeEnabled();
 await body.click();
 await expect(map.locator('.soma-map-v7-grid')).toHaveAttribute('data-view','projector');
});
