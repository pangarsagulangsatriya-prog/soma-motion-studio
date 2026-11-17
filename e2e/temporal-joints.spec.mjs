import {test,expect} from '@playwright/test';

test('S6.8.8.3 temporal inspector exposes all 33 joints, metrics, and safe export controls',async({page})=>{
 await page.goto('/');
 await page.locator('.fp-source-switch-trigger').click();
 await page.locator('.fp-source-switch-option').filter({hasText:'Video MP4'}).click();
 await page.locator('.fp-experiment-advanced-details summary').click();
 await page.getByRole('button',{name:'Buka Video Motion Lab'}).click();

 const inspector=page.locator('.vml-temporal');
 await expect(inspector).toBeVisible();
 await expect(inspector.locator('summary')).toContainText('Motion Timeline');
 await inspector.locator('summary').click();
 const actor=page.getByRole('combobox',{name:'Aktor Motion Timeline'});
 const joint=page.getByRole('combobox',{name:'Sendi Motion Timeline'});
 const metric=page.getByRole('combobox',{name:'Metrik Motion Timeline'});
 await expect(actor).toHaveValue('A');
 await expect(joint.locator('option')).toHaveCount(33);
 await expect(metric.locator('option')).toHaveCount(5);
 await joint.selectOption('13');
 await actor.selectOption('B');
 await metric.selectOption('acceleration');
 await expect(actor).toHaveValue('B');
 await expect(joint).toHaveValue('13');
 await expect(metric).toHaveValue('acceleration');
 await expect(page.getByRole('slider',{name:'Jelajahi sampel waktu gerak'})).toBeDisabled();
 await expect(page.getByRole('button',{name:'CSV sendi terpilih'})).toBeDisabled();
 await expect(page.getByRole('button',{name:'JSON semua sendi'})).toBeDisabled();
 await expect(inspector).toContainText('Belum ada sampel valid');
 await expect(page.locator('.soma-video-lab')).toBeVisible();
 // Stage preview remains mounted under the dedicated Video Motion Lab.
 await expect(page.locator('.fp-preview-body')).toHaveCount(1);
 await expect(page.locator('.fp-preview-floor')).toHaveCount(1);
});

test('S6.8.8.3 video temporal diagnostics never bypass physical projector safety',async({page})=>{
 await page.goto('/');
 await page.locator('.fp-source-switch-trigger').click();
 await page.locator('.fp-source-switch-option').filter({hasText:'Video MP4'}).click();
 await page.locator('.fp-transport-projector').click();
 const gate=page.locator('.stage-dual');
 await expect(gate).toContainText('Dua output fisik terkunci');
 const buttons=gate.getByRole('button',{name:'Buka output'});
 await expect(buttons).toHaveCount(2);
 for(const button of await buttons.all())await expect(button).toBeDisabled();
});
