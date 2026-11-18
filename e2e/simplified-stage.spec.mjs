import {selectStageSource,openStageMap} from './ia-ux-helpers.mjs';
import {test,expect} from '@playwright/test';

async function selectSource(page,name){
 await selectStageSource(page,name);
 await expect(page.locator('.soma-uxr1-source > summary')).toContainText(name);
}

test('S6.8.7 one source switcher and no beginner observation in production',async({page})=>{
 await page.goto('/');
 const stage=page.locator('.fp-stage-workspace');
 await expect(stage).toBeVisible();
 await expect(page.locator('.soma-uxr1-source > summary')).toHaveCount(1);
 await expect(page.getByRole('button',{name:'Uji Pemula'})).toHaveCount(0);
 await expect(page.locator('#fp-beginner-usability')).toHaveCount(0);
 await expect(page.locator('.fp-compact-status')).toHaveCount(0);
 await expect(page.locator('.fp-flow-local-tabs')).toHaveCount(0);
 await expect(page.locator('.soma-primary-nav-list .soma-primary-destination')).toHaveCount(4);
 await expect(stage).toHaveAttribute('data-inspector-open','false');

 await page.locator('.soma-uxr1-source > summary').click();
 const choices=page.locator('.soma-uxr1-source-menu button');
 await expect(choices).toHaveCount(4);
 await expect(page.locator('.soma-uxr1-source-menu')).not.toContainText('Pengaturan jejak dan arsip tetap tersimpan');
 await page.locator('.soma-uxr1-source > summary').click();
 await expect(page.locator('.soma-uxr1-source')).not.toHaveAttribute('open','');
});

test('S6.8.7 video hides advanced config and prioritizes previews',async({page})=>{
 await page.goto('/');
 await selectSource(page,'Video MP4');
 const stage=page.locator('.fp-stage-workspace');
 await expect(stage).toHaveAttribute('data-experimental','true');
 await expect(stage).toHaveAttribute('data-inspector-open','false');
 await expect(page.locator('.fp-inline-assistant')).toHaveCount(0);
 await expect(page.locator('.fp-experiment-dock')).toBeVisible();
 await expect(page.locator('.fp-experiment-intro')).toHaveCount(0);
 await expect(page.locator('.fp-preview-body')).toBeVisible();
 await expect(page.locator('.fp-preview-floor')).toBeVisible();
 await expect(page.locator('.fp-experiment-advanced-details')).toHaveCount(0);
 await expect(page.locator('.fp-d4-performance')).toHaveCount(0);
 await expect(page.getByRole('button',{name:/Buka Video Motion Lab/})).toHaveCount(0);
 const style=await page.locator('.fp-experiment-dock').evaluate(el=>getComputedStyle(el).flexDirection);
 expect(style).toBe('row');

 const preview=await page.locator('.fp-stage-side-previews').boundingBox();
 const camera=await page.locator('.fp-stage-video').boundingBox();
 expect(preview).not.toBeNull();
 expect(camera).not.toBeNull();
 // Above 1050px, the split stage uses two columns. At tablet/mobile
 // widths BODY/FLOOR and camera stack in one full-width column.
 if((page.viewportSize()?.width??0)>1050)
  expect(preview.width).toBeGreaterThan(camera.width*1.7);
 else
  expect(Math.abs(preview.width-camera.width)).toBeLessThan(4);
 // Clicking Tracking in MP4 mode must NOT introduce a second setup flow.
 await page.getByRole('button',{name:'Track',exact:true}).click();
 await expect(stage).toHaveAttribute('data-inspector-open','false');
 await expect(page.locator('.fp-preview-floor')).toBeVisible();
});

test('S6.8.7 source switch preserves input and locked physical output',async({page})=>{
 await page.goto('/');
 await selectSource(page,'Simulasi 3D');
 await expect(page.locator('.fp-stage-workspace')).toHaveAttribute('data-inspector-open','false');
 await expect(page.locator('.fp-experiment-advanced-details')).not.toHaveAttribute('open','');
 await page.locator('.fp-experiment-advanced-details summary').click();
 await expect(page.getByRole('button',{name:/Buka Simulator 3D lengkap/})).toBeVisible();
 await selectSource(page,'Video MP4');
 await expect(page.locator('.fp-stage-workspace')).toHaveAttribute('data-inspector-open','false');
 await expect(page.locator('.fp-stage-video .fp-stage-surface-foot')).toContainText('OUTPUT FISIK TERKUNCI');
 await openStageMap(page);
 await expect(page.locator('.stage-dual')).toContainText('Dua output fisik terkunci');
 await expect(page.locator('.stage-dual').getByRole('button',{name:'Buka output'})).toHaveCount(2);
 for(const button of await page.locator('.stage-dual').getByRole('button',{name:'Buka output'}).all())
  await expect(button).toBeDisabled();
});
