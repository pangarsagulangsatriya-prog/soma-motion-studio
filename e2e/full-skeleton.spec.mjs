import {test,expect} from '@playwright/test';

async function selectSource(page,name){
 await page.locator('.fp-source-switch-trigger').click();
 await page.locator('.fp-source-switch-option').filter({hasText:name}).click();
 await expect(page.locator('.fp-source-switch-trigger')).toContainText(name);
}

test('S6.8.8.1 MP4 full skeleton visible by default, isolated from output',async({page})=>{
 await page.goto('/');
 const stage=page.locator('.fp-stage-workspace');
 await expect(stage).toHaveAttribute('data-skeleton-visible','true');
 await selectSource(page,'Video MP4');
 const toggle=page.getByRole('button',{name:'Sembunyikan kerangka tubuh'});
 await expect(toggle).toBeVisible();
 await expect(toggle).toHaveAttribute('aria-pressed','true');
 await expect(page.locator('.fp-preview-body .fp-stage-surface-head')).toContainText('SKELETON 33');
 await expect(page.locator('.fp-preview-floor')).toBeVisible();
 await expect(page.locator('.fp-stage-video .fp-stage-surface-foot')).toContainText('OUTPUT FISIK TERKUNCI');

 await toggle.click();
 await expect(stage).toHaveAttribute('data-skeleton-visible','false');
 await expect(page.getByRole('button',{name:'Tampilkan kerangka tubuh 33 titik'})).toHaveAttribute('aria-pressed','false');
 await expect(page.locator('.fp-preview-body .fp-stage-surface-head')).toContainText('MASK VIDEO 2D');
 await page.getByRole('button',{name:'Tampilkan kerangka tubuh 33 titik'}).click();
 await expect(stage).toHaveAttribute('data-skeleton-visible','true');
 await expect(page.locator('.fp-preview-body .fp-stage-surface-head')).toContainText('SKELETON 33');
});

test('S6.8.8.1 live camera and phone have same skeleton toggle; simulator retains virtual rig',async({page})=>{
 await page.goto('/');
 const stage=page.locator('.fp-stage-workspace');
 await expect(page.getByRole('button',{name:'Sembunyikan kerangka tubuh'})).toBeVisible();
 await selectSource(page,'Kamera HP');
 await expect(page.getByRole('button',{name:'Sembunyikan kerangka tubuh'})).toBeVisible();
 await expect(page.locator('.fp-source-switch-trigger')).toContainText('Kamera HP');
 await selectSource(page,'Simulasi 3D');
 await expect(stage).toHaveAttribute('data-experimental','true');
 await expect(page.locator('.fp-full-skeleton-switch')).toHaveCount(0);
 await expect(page.locator('.fp-preview-body')).toBeVisible();
 await expect(page.locator('.fp-preview-floor')).toBeVisible();
 await selectSource(page,'Video MP4');
 await expect(page.getByRole('button',{name:'Sembunyikan kerangka tubuh'})).toBeVisible();
});

test('S6.8.8.1 visual skeleton mode does not unlock physical MP4 output',async({page})=>{
 await page.goto('/');
 await selectSource(page,'Video MP4');
 await page.getByRole('button',{name:'Sembunyikan kerangka tubuh'}).click();
 await page.getByRole('button',{name:'Tampilkan kerangka tubuh 33 titik'}).click();
 await page.locator('.fp-transport-projector').click();
 const router=page.locator('.stage-dual');
 await expect(router).toContainText('Dua output fisik terkunci');
 const open=router.getByRole('button',{name:'Buka output'});
 await expect(open).toHaveCount(2);
 for(const button of await open.all())await expect(button).toBeDisabled();
});
