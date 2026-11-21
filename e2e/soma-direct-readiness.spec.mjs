import {test,expect} from '@playwright/test';

test('SOMA Direct diagnoses missing source instead of claiming only a build lock',async({page})=>{
 await page.goto('/');
 await expect(page.locator('.fp-stage-workspace')).toBeVisible({timeout:25000});
 await page.getByRole('button',{name:'Perform workspace'}).click();
 await expect(page.getByRole('button',{name:'SOMA Direct'})).toBeVisible();
 await expect(page.locator('.ops-r1-destination-status')).toContainText('Perlu setup');
 await expect(page.locator('.ops-r1-direct-reason')).toContainText('Track');
 await expect(page.locator('.ops-r1-primary-cta')).toHaveAttribute('data-kind','fix-setup');
 await expect(page.getByRole('button',{name:'Kirim perintah blackout SOMA'})).toBeEnabled();
 await page.locator('.ops-r1-primary-cta').click();
 await expect(page.locator('.fp-stage-workspace')).toHaveAttribute('data-workspace','track');
});

test('SOMA Direct build marker is auditable without arming a projector',async({page})=>{
 await page.goto('/');
 await page.getByRole('button',{name:'Perform workspace'}).click();
 const output=page.getByRole('region',{name:'Tujuan output'});
 await expect(output).toHaveCount(1);
 await expect(page.locator('.ops-r1-output-card')).toHaveAttribute('data-stage-build',/output-enabled|output-locked/);
 await expect(page.locator('.ops-r1-direct-reason')).toBeVisible();
 await expect(page.getByRole('button',{name:'Kirim perintah blackout SOMA'})).toBeEnabled();
});
