import {test,expect} from '@playwright/test';

test('MCA V1: Tes tapak synthesizes clearly labeled markers in both Map preview canvases',async({page})=>{
 await page.goto('/');
 await page.getByRole('button',{name:'Map workspace'}).click();
 const map=page.locator('.soma-map-wysiwyg');
 const controls=map.getByRole('group',{name:'Bantuan kalibrasi tapak'});
 await expect(controls.getByRole('button',{name:'Tes tapak'})).toBeVisible();
 await expect(controls.getByRole('button',{name:'Jejak otomatis aktif'})).toBeHidden();
 const panes=map.locator('.soma-map-wysiwyg-pane');
 await expect(map.locator('.soma-map-v7-camera canvas.soma-map-assist-overlay')).toHaveCount(1);
 await expect(panes.last().locator('canvas.soma-map-assist-overlay')).toHaveCount(1);
 await controls.getByRole('button',{name:'Tes tapak'}).click();
 await expect(controls.getByRole('status')).toContainText('SIMULASI');
 await expect.poll(()=>panes.last().locator('canvas.soma-map-assist-overlay').evaluate(el=>{
  const {data}=el.getContext('2d').getImageData(0,0,el.width,el.height);
  let total=0;for(let k=3;k<data.length;k+=4)if(data[k]>0)total++;
  return total;
 })).toBeGreaterThan(20);
 const pointer=await panes.last().locator('canvas.soma-map-assist-overlay').evaluate(
  el=>getComputedStyle(el).pointerEvents
 );
 expect(pointer).toBe('none');
});

test('MCA V1: Auto/replay/freeze/clear controls are responsive while physical output remains locked',async({page})=>{
 await page.goto('/');
 await page.getByRole('button',{name:'Map workspace'}).click();
 const map=page.locator('.soma-map-wysiwyg');
 const controls=map.getByRole('group',{name:'Bantuan kalibrasi tapak'});
 await controls.getByRole('button',{name:'Tes tapak'}).click();
 await controls.locator('.soma-map-assist-more summary').click();
 await controls.getByRole('button',{name:'Replay 5 detik'}).click();
 await expect(controls.getByRole('button',{name:'Stop replay'})).toBeVisible();
 await controls.getByRole('button',{name:'Bekukan jejak'}).click();
 await expect(controls.getByRole('button',{name:'Lanjut jejak'})).toBeVisible();
 await controls.getByRole('button',{name:'Lanjut jejak'}).click();
 await controls.getByRole('button',{name:'Stop replay'}).click();
 await controls.getByRole('button',{name:'Jejak otomatis aktif'}).click();
 await expect(controls.getByRole('button',{name:'Jejak otomatis mati'})).toBeVisible();
 await controls.getByRole('button',{name:'Bersihkan'}).click();
 await expect(controls.getByRole('status')).toContainText('dibersihkan');
 await expect(page.getByRole('button',{name:'Kirim perintah blackout SOMA'})).toHaveCount(1);
});

test('MCA V1: calibration overlays remain attached in fullscreen Map',async({page})=>{
 await page.goto('/');
 await page.getByRole('button',{name:'Map workspace'}).click();
 const map=page.locator('.soma-map-wysiwyg');
 await map.getByRole('button',{name:'Layar penuh Map'}).click();
 await expect.poll(()=>page.evaluate(()=>document.fullscreenElement?.getAttribute('aria-label'))).toBe('Kalibrasi Map langsung');
 await expect(map.getByRole('button',{name:'Tes tapak'})).toBeVisible();
 await expect(map.locator('canvas.soma-map-assist-overlay')).toHaveCount(2);
 await map.getByRole('button',{name:'Tutup layar penuh'}).click();
});
