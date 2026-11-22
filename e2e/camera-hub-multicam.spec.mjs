import {test,expect} from '@playwright/test';

test('Camera Hub adds webcam from the canvas, previews skeleton and keeps CRUD across Engine navigation',async({page})=>{
 await page.goto('/');
 await page.getByRole('button',{name:'Camera Hub',exact:true}).click();
 await expect(page.getByRole('heading',{name:'Camera Hub'})).toBeVisible();
 await page.getByRole('button',{name:'Tambah kamera di kanvas'}).click();
 const picker=page.getByRole('dialog',{name:'Tambah sumber kamera'});
 await expect(picker.getByRole('button',{name:/Kamera biasa/})).toBeVisible();
 await expect(picker.getByRole('button',{name:/Kamera HP/})).toBeVisible();
 await expect(picker).not.toContainText('Simulasi 3D');
 await picker.getByRole('button',{name:/Kamera biasa/}).click();
 let options=picker.locator('.ch-picker-devices>button:not(.ch-device-refresh)');
 if(await options.count()===0){
  await picker.getByRole('button',{name:/Periksa \/ izinkan kamera/}).click();
  options=picker.locator('.ch-picker-devices>button:not(.ch-device-refresh)');
 }
 await expect.poll(()=>options.count()).toBeGreaterThan(0);
 await options.first().click();
 await expect(page.locator('.ch-camera-node')).toHaveCount(1);
 await page.locator('.ch-camera-node').click();
 await expect(page.locator('.ch-inspector .ch-preview canvas')).toBeVisible();
 await expect(page.getByRole('button',{name:'Sembunyikan skeleton'})).toBeVisible();
 await page.getByRole('button',{name:'Sembunyikan skeleton'}).click();
 await expect(page.getByRole('button',{name:'Tampilkan skeleton'})).toBeVisible();
 await page.getByRole('button',{name:'Tampilkan skeleton'}).click();
 await page.locator('#ch-rename').fill('Camera B · Penonton');
 await page.getByRole('button',{name:'Simpan',exact:true}).click();
 await expect(page.locator('.ch-camera-node')).toContainText('Camera B · Penonton');
 await page.getByRole('button',{name:'Engine',exact:true}).click();
 await page.getByRole('dialog',{name:'Pilih Stage'}).getByRole('button',{name:/Stage 1/}).click();
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

test('Camera Hub creates wireless phone node, shows existing pairing and preserves receiver across workspace switches',async({page})=>{
 await page.goto('/');
 await page.getByRole('button',{name:'Camera Hub',exact:true}).click();
 await page.getByRole('button',{name:'Tambah kamera di kanvas'}).click();
 const picker=page.getByRole('dialog',{name:'Tambah sumber kamera'});
 await picker.getByRole('button',{name:/Kamera HP/}).click();
 await expect(picker.getByRole('button',{name:/Lewat kabel/})).toBeVisible();
 await picker.getByRole('button',{name:/Nirkabel \/ QR/}).click();
 await expect(page.locator('.ch-camera-node')).toHaveCount(1);
 await expect(page.getByRole('button',{name:'Kamera HP nirkabel'})).toBeVisible();
 await expect(page.getByRole('button',{name:'Kamera HP lewat kabel'})).toBeVisible();
 await expect(page.locator('.ch-phone-dock-active')).toHaveCount(1);
 await page.getByRole('button',{name:'Engine',exact:true}).click();
 await page.getByRole('dialog',{name:'Pilih Stage'}).getByRole('button',{name:/Stage 1/}).click();
 await expect(page.locator('.ch-workspace')).toBeHidden();
 await page.getByRole('button',{name:'Camera Hub',exact:true}).click();
 await expect(page.locator('.ch-phone-dock-active')).toHaveCount(1);
 await page.getByRole('button',{name:'Hapus kamera HP'}).click();
 await expect(page.locator('.ch-camera-node')).toHaveCount(0);
});
