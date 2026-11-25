import {test,expect} from '@playwright/test';
import {selectStageSource} from './ia-ux-helpers.mjs';

test('Perform uses completed Compose output instead of the Track skeleton monitor',async({page})=>{
 await page.goto('/');
 await page.getByRole('button',{name:'Compose workspace'}).click();
 await expect(page.locator('#soma-compose-monitor')).toBeVisible();
 await page.getByRole('button',{name:'Map workspace'}).click();
 await expect(page.locator('.map-r2-monitor')).toBeVisible();
 await page.getByRole('button',{name:'Perform workspace'}).click();
 await expect(page.locator('.fp-stage-workspace')).toHaveAttribute('data-utility','none');
 const preview=page.getByRole('region',{name:'Perform Final Preview'});
 await expect(preview).toBeVisible();
 await expect(preview.locator('canvas[aria-label="Visual final hasil komposisi FLOOR dan BODY"]')).toBeVisible();
 await expect(preview.getByRole('button',{name:'Pilih sumber'})).toBeVisible();
 await expect(preview.locator('canvas[aria-label="Monitor kamera asli dari sumber Track"]')).toHaveCount(0);
 await expect(page.locator('.fp-stage-overview')).toBeHidden();
 await expect(page.locator('.soma-composer-host')).toBeHidden();
 await expect(page.locator('.soma-composer-host canvas[aria-label="BODY compositor raster"]')).toHaveCount(1);
 await expect(page.locator('.soma-composer-host canvas[aria-label="FLOOR compositor raster"]')).toHaveCount(1);

 await preview.getByRole('button',{name:'BODY'}).click();
 await expect(preview.locator('canvas[data-final-surface="body"]')).toBeVisible();
 await preview.getByRole('button',{name:'SPLIT'}).click();
 await expect(preview.locator('canvas[data-final-surface="split"]')).toBeVisible();
 await expect(page.locator('button[aria-label="Kirim perintah blackout SOMA"]')).toHaveCount(1);
});

test('Final Preview fullscreen contains only the output image, no panels or camera',async({page})=>{
 await page.goto('/');
 await page.getByRole('button',{name:'Perform workspace'}).click();
 const preview=page.getByRole('region',{name:'Perform Final Preview'});
 await preview.getByRole('button',{name:'Fullscreen Final Preview'}).click();
 await expect.poll(()=>page.evaluate(()=>document.fullscreenElement?.className??'')).toContain('pf-final-viewport');
 await expect(preview.locator('.pf-final-viewport > canvas')).toBeVisible();
 await expect(preview.locator('.pf-final-viewport button')).toHaveCount(0);
 await expect(preview.locator('.pf-final-viewport .pf-final-camera-image')).toHaveCount(0);
 const extent=await page.evaluate(()=>{
  const node=document.fullscreenElement;const box=node?.getBoundingClientRect();
  return {width:box?.width??0,height:box?.height??0,viewportWidth:window.innerWidth,viewportHeight:window.innerHeight};
 });
 expect(extent.width).toBeGreaterThanOrEqual(extent.viewportWidth-2);
 expect(extent.height).toBeGreaterThanOrEqual(extent.viewportHeight-2);
 await page.keyboard.press('Escape');
 await expect.poll(()=>page.evaluate(()=>document.fullscreenElement===null)).toBe(true);
 await expect(preview.getByRole('button',{name:'Fullscreen Final Preview'})).toBeVisible();
});

test('Compose visual recipe remains mounted after visiting Perform',async({page})=>{
 await page.goto('/');
 await page.getByRole('button',{name:'Compose workspace'}).click();
 const compose=page.locator('#soma-compose-monitor');
 await expect(compose).toBeVisible();
 await page.getByRole('button',{name:'Perform workspace'}).click();
 await expect(page.locator('.fp-stage-workspace')).toHaveAttribute('data-utility','none');
 await expect(page.getByRole('region',{name:'Perform Final Preview'})).toBeVisible();
 await page.getByRole('button',{name:'Compose workspace'}).click();
 await expect(compose).toBeVisible();
 await expect(page.locator('.soma-composer-host')).toBeVisible();
});

test('Perform V8: one optional input monitor, hidden Track panels, and collapsed output diagnostics',async({page})=>{
 await page.goto('/');
 await page.getByRole('button',{name:'Perform workspace'}).click();
 const preview=page.getByRole('region',{name:'Perform Final Preview'});
 await preview.getByRole('button',{name:'Pilih sumber'}).click();
 await expect(page.locator('.fp-stage-workspace')).toHaveAttribute('data-workspace','track');
 await selectStageSource(page,'Simulasi 3D');
 await page.getByRole('button',{name:'Langkah kiri'}).click();
 await page.getByRole('button',{name:'Perform workspace'}).click();
 await expect(page.locator('.fp-stage-overview')).toBeHidden();
 await expect(preview.locator('.pf-v8-camera')).toBeVisible();
 await expect(preview.getByRole('button',{name:'Tampilkan Skeleton di kamera Perform'})).toHaveAttribute('aria-pressed','false');
 await preview.getByRole('button',{name:'Tampilkan Skeleton di kamera Perform'}).click();
 await expect(preview.getByRole('button',{name:'Tampilkan Skeleton di kamera Perform'})).toHaveAttribute('aria-pressed','true');
 await preview.getByRole('button',{name:'Sembunyikan monitor kamera'}).click();
 await expect(preview.locator('.pf-v8-camera')).toHaveCount(0);
 await preview.getByRole('button',{name:'Tampilkan monitor kamera'}).click();
 await expect(preview.locator('.pf-v8-camera')).toBeVisible();
 const diagnostics=page.locator('.ops-r1-output-card .ops-r1-route-steps');
 await expect(diagnostics).toBeHidden();
 await page.locator('.ops-r1-output-details summary').click();
 await expect(diagnostics).toBeVisible();
 await preview.getByRole('button',{name:'Fullscreen Final Preview'}).click();
 await expect.poll(()=>page.evaluate(()=>document.fullscreenElement?.className??'')).toContain('pf-final-viewport');
 await expect(preview.locator('.pf-final-viewport .pf-v8-camera')).toHaveCount(0);
 await page.keyboard.press('Escape');
});
