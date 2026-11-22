import {test,expect} from '@playwright/test';

test('Camera Hub: CRUD camera uses Track pose engine and keeps node while changing internal workspace',async({page})=>{
 await page.goto('/');
 await page.getByRole('button',{name:'Camera Hub',exact:true}).click();
 await expect(page.getByRole('heading',{name:'Camera Hub'})).toBeVisible();
 await page.getByRole('button',{name:'Tambah kamera'}).click();
 const options=page.locator('#ch-device-add option');
 if(await options.count()<2){
  await page.getByRole('button',{name:'Izinkan kamera'}).click();
 }
 await expect.poll(()=>page.locator('#ch-device-add option').count()).toBeGreaterThan(1);
 await page.locator('#ch-device-add').selectOption({index:1});
 await page.getByRole('button',{name:'Sambungkan',exact:true}).click();
 await expect(page.locator('.ch-camera-node')).toHaveCount(1);
 await page.locator('.ch-camera-node').click();
 await expect(page.locator('.ch-inspector .ch-preview canvas')).toBeVisible();
 await expect(page.getByRole('button',{name:'Sembunyikan skeleton'})).toBeVisible();
 await expect(page.locator('.ch-camera-node')).toContainText(/LIVE|Menghubungkan|Memuat/);
 await page.getByRole('button',{name:'Sembunyikan skeleton'}).click();
 await expect(page.getByRole('button',{name:'Tampilkan skeleton'})).toBeVisible();
 await page.getByRole('button',{name:'Tampilkan skeleton'}).click();
 await page.locator('#ch-rename').fill('Camera B · Penonton');
 await page.getByRole('button',{name:'Simpan',exact:true}).click();
 await expect(page.locator('.ch-camera-node')).toContainText('Camera B · Penonton');
 // The node is managed by App, not by the Camera Hub page component.
 await page.getByRole('button',{name:'Engine',exact:true}).click();
 const menu=page.getByRole('dialog',{name:'Pilih Stage'});
 await menu.getByRole('button',{name:/Stage 1/}).click();
 await expect(page.getByRole('heading',{name:'Track'})).toBeVisible();
 await page.getByRole('button',{name:'Camera Hub',exact:true}).click();
 await expect(page.locator('.ch-camera-node')).toHaveCount(1);
 await page.locator('.ch-camera-node').click();
 await expect(page.locator('.ch-node-preview canvas')).toHaveCount(1);
 await page.getByRole('button',{name:'Putus',exact:true}).click();
 await expect(page.locator('.ch-camera-node')).toContainText('Terputus oleh operator');
 await page.getByRole('button',{name:'Sambungkan ulang'}).click();
 await expect(page.locator('.ch-camera-node')).toContainText(/Menghubungkan|Memuat|LIVE/);
 await page.getByRole('button',{name:'Hapus',exact:true}).click();
 await expect(page.locator('.ch-camera-node')).toHaveCount(0);
});
