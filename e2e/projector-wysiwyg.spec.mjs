import {selectStageSource,openStageMap} from './ia-ux-helpers.mjs';
import {test,expect} from '@playwright/test';

test('Projector WYSIWYG: BODY/FLOOR draft and sent blackout share QA surface',async({page})=>{
 await page.goto('/');
 await expect(page.locator('.soma-uxr1-source > summary')).toBeVisible();
 await openStageMap(page);

 const panel=page.locator('.stage-wysiwyg');
 await expect(panel).toBeVisible();
 await expect(panel.locator('.stage-wysiwyg-card')).toHaveCount(2);
 const body=panel.locator('[data-surface="body"]');
 const floor=panel.locator('[data-surface="floor"]');
 await expect(body).toHaveAttribute('data-preview-view','draft');
 await expect(floor).toHaveAttribute('data-preview-signal','artwork');
 await expect(body.locator('canvas.stage-wysiwyg-artwork')).toBeVisible();

 await panel.getByRole('button',{name:'Sinyal dikirim'}).click();
 await expect(body).toHaveAttribute('data-preview-view','sent');
 await expect(body).toHaveAttribute('data-preview-signal','blackout');
 await expect(floor).toHaveAttribute('data-preview-signal','blackout');
 await expect(body).toContainText('BLACKOUT');
 await expect(floor).toContainText('BLACKOUT');

 await panel.getByRole('button',{name:'Draf lokal'}).click();
 await expect(body).toHaveAttribute('data-preview-signal','artwork');
 await expect(floor).toHaveAttribute('data-preview-signal','artwork');
 await expect(panel).toContainText('belum mengukur cahaya');
});

test('Projector WYSIWYG: surface brightness and corners adjust local matrix while output stays blocked',async({page})=>{
 await page.goto('/');
 await openStageMap(page);
 const body=page.locator('[data-surface="body"] canvas.stage-wysiwyg-artwork');
 const before=await body.evaluate(el=>({opacity:el.style.opacity,transform:el.style.transform}));

 // Editing the plan does not arm the physical output or fabricate QA approval.
 const brightness=page.locator('.stage-dual-calibration input[type=range]').first();
 await brightness.fill('0.2');
 await expect(body).toHaveJSProperty('tagName','CANVAS');
 const after=await body.evaluate(el=>({opacity:el.style.opacity,transform:el.style.transform}));
 expect(after.opacity).not.toBe(before.opacity);
 await expect(page.locator('[data-surface="body"]')).toContainText('20% kecerahan software');

 // Operator-only four corner calibration must keep the same preview surface.
 await page.locator('.stage-dual-calibration details').first().locator('summary').click();
 const quad=page.locator('.stage-dual-quad input[type=number]');
 await expect(quad.first()).toBeVisible();
 await quad.first().fill('0.1');
 const transformed=await body.evaluate(el=>el.style.transform);
 expect(transformed).not.toBe(before.transform);
 await expect(page.locator('.stage-dual-qa')).toContainText('Five-Point Physical QA');
 await expect(page.locator('.stage-dual')).toContainText('Blackout');
});
