import {test,expect} from '@playwright/test';

test('Stage 1 and Stage 2 are separate destinations, not a secondary Tools sidebar',async({page})=>{
 await page.setViewportSize({width:1440,height:900});
 await page.goto('/');
 await expect(page.locator('.fp-stage-workspace')).toBeVisible();
 await expect(page.getByRole('button',{name:'Stage 1'})).toHaveAttribute('aria-current','page');
 await expect(page.getByRole('button',{name:'Stage 2'})).toBeVisible();
 await page.getByRole('button',{name:'Stage 2'}).click();
 await expect(page).toHaveURL(/stage=2/);
 await expect(page.getByRole('heading',{name:'Stage 2'})).toBeVisible();
 await expect(page.locator('.soma-stage2-app')).toHaveCount(1);
 await expect(page.locator('.fp-stage-workspace')).toHaveCount(0);
 await expect(page.locator('.instrument-grid')).toHaveCount(0);
 await expect(page.locator('.soma-labs-panel')).toHaveCount(0);
 await expect(page.locator('.soma-primary-sidebar')).toBeVisible();
 await expect(page.getByRole('button',{name:'Stage 2'})).toHaveAttribute('aria-current','page');
 await expect(page.getByRole('button',{name:'Kirim perintah blackout SOMA'})).toBeEnabled();
 await page.getByRole('button',{name:'Stage 1'}).click();
 await expect(page).not.toHaveURL(/stage=2/);
 await expect(page.locator('.fp-stage-workspace')).toBeVisible();
 await expect(page.getByRole('button',{name:'Stage 1'})).toHaveAttribute('aria-current','page');
});

test('direct Stage 2 load does not mount Stage 1 camera, projection or Labs',async({page})=>{
 await page.goto('/?stage=2');
 await expect(page.locator('.soma-stage2-workspace')).toBeVisible();
 await expect(page.getByRole('heading',{name:'Stage 2'})).toBeVisible();
 await expect(page.getByText('Ruang ini belum diisi.')).toBeVisible();
 await expect(page.locator('video')).toHaveCount(0);
 await expect(page.locator('.fp-stage-workspace')).toHaveCount(0);
 await expect(page.locator('.soma-labs-panel')).toHaveCount(0);
 await page.getByRole('button',{name:'Kirim perintah blackout SOMA'}).click();
 await expect(page.locator('.soma-stage2-app')).toBeVisible();
});

test('mobile: second Stage can open from rail and return without layout overflow',async({page})=>{
 await page.setViewportSize({width:390,height:844});
 await page.goto('/');
 await page.getByRole('button',{name:'Buka navigasi SOMA'}).click();
 await page.getByRole('button',{name:'Stage 2'}).click();
 await expect(page).toHaveURL(/stage=2/);
 await expect(page.getByRole('heading',{name:'Stage 2'})).toBeVisible();
 await page.getByRole('button',{name:'Buka navigasi SOMA'}).click();
 await page.getByRole('button',{name:'Stage 1'}).click();
 await expect(page.locator('.fp-stage-workspace')).toBeVisible();
 const width=await page.evaluate(()=>({
  viewport:document.documentElement.clientWidth,
  content:document.documentElement.scrollWidth
 }));
 expect(width.content).toBeLessThanOrEqual(width.viewport+2);
});
