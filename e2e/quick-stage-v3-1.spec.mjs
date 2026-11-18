import {test,expect} from '@playwright/test';

test('V3.1 Quick Start remains inside existing Footprints and diagnoses missing hardware',async({page})=>{
 await page.goto('/');
 await expect(page.locator('.fp-stage-workspace')).toBeVisible();
 const setup=page.locator('.fp-quick-setup');
 await expect(setup.locator('summary')).toBeVisible();
 await setup.locator('summary').click();
 await expect(setup).toHaveAttribute('open','');
 await expect(setup.locator('.fp-quick-setup-panel')).toBeVisible();
 await expect(setup.locator('.fp-quick-setup-readiness [role=listitem]')).toHaveCount(4);
 await expect(setup.getByRole('button',{name:'Simpan profil'})).toBeVisible();
 await expect(setup.getByRole('button',{name:/Periksa Projector/})).toBeVisible();
 await setup.getByRole('button',{name:'Simpan profil'}).click();
 await expect(setup.locator('.fp-quick-setup-message'))
  .toContainText('Konfirmasi empat titik');
 await expect(page.locator('.fp-compact-transport .fp-transport-blackout'))
  .toBeEnabled();
 await expect(page.locator('.fp-preview-body canvas')).toHaveCount(1);
 await expect(page.locator('.fp-preview-floor canvas')).toHaveCount(1);
});
test('V3.1 Quick Start does not overflow mobile and retains input picker',async({page})=>{
 await page.goto('/');
 const setup=page.locator('.fp-quick-setup');
 await setup.locator('summary').click();
 const panel=setup.locator('.fp-quick-setup-panel');
 await expect(panel).toBeVisible();
 const bounds=await panel.boundingBox(),viewport=page.viewportSize();
 expect(bounds).not.toBeNull();expect(viewport).not.toBeNull();
 expect(bounds.x).toBeGreaterThanOrEqual(0);
 expect(bounds.x+bounds.width).toBeLessThanOrEqual(viewport.width+2);
 await setup.locator('summary').click();
 await page.locator('.fp-source-switch-trigger').click();
 await expect(page.locator('.fp-source-switch-menu')).toBeVisible();
});
