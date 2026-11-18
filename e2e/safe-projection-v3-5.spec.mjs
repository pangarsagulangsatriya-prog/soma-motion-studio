import {test,expect} from '@playwright/test';

test('V3.5: MP4 One-Click Projector opens QA preview but never unlocks physical FLOOR',async({page})=>{
 await page.goto('/');
 await expect(page.locator('.fp-stage-workspace')).toBeVisible();
 await page.locator('.fp-source-switch-trigger').click();
 await page.locator('.fp-source-switch-option').filter({hasText:'Video MP4'}).click();
 await expect(page.locator('.fp-stage-workspace')).toHaveAttribute('data-experimental','true');
 await page.locator('.fp-transport-projector').click();
 const composer=page.getByRole('region',{name:'Interactive Surface Composer'});
 await expect(composer).toBeVisible();
 const output=page.locator('.stage-dual');
 await expect(output).toBeVisible();
 await expect(output).toContainText('MP4/3D');
 const perform=output.getByRole('button',{name:'PERFORM · FLOOR'});
 await expect(perform).toBeDisabled();
 await output.locator('.stage-dual-profile summary').click();
 await output.getByRole('button',{name:'Simpan draf output'}).click();
 await expect(output.locator('.stage-dual-status')).toContainText('Aktifkan kamera');
 await expect(output.getByRole('button',{name:'BLACKOUT KEDUA OUTPUT'})).toBeEnabled();
 await expect(page.locator('.fp-transport-projector')).toBeVisible();
});

test('V3.5: existing Quick Start shows next safe action rather than fake Stage Ready',async({page})=>{
 await page.goto('/');
 const quick=page.locator('.fp-quick-setup');
 await quick.locator('summary').click();
 await expect(quick.locator('.fp-quick-projection')).toBeVisible();
 await expect(quick.locator('.fp-quick-projection')).toContainText('PROJECTION');
 await expect(quick.locator('.fp-quick-projection .fp-quick-setup-primary')).toBeVisible();
 await expect(quick.locator('.fp-quick-projection .fp-quick-setup-output')).toBeVisible();
 const bound=await quick.locator('.fp-quick-setup-panel').boundingBox();
 const viewport=page.viewportSize();
 expect(bound).not.toBeNull();
 expect(viewport).not.toBeNull();
 expect(bound.x).toBeGreaterThanOrEqual(0);
 expect(bound.x+bound.width).toBeLessThanOrEqual(viewport.width+2);
});
