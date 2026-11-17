import {test,expect} from '@playwright/test';

test('D1-D4 duet benchmark opens inside the existing MP4 laboratory',async({page})=>{
 await page.goto('/');
 await page.locator('.fp-source-switch-trigger').click();
 await page.locator('.fp-source-switch-option').filter({hasText:'Video MP4'}).click();
 await page.locator('.fp-experiment-advanced-details summary').click();
 await page.getByRole('button',{name:'Buka Video Motion Lab'}).click();
 const panel=page.locator('.duet-v2-lab');
 await expect(panel).toBeVisible();
 await expect(panel.locator('summary')).toContainText('Duet V2');
 await panel.locator('summary').click();
 await expect(panel).toContainText('D1 membandingkan 384 dan 512');
 await expect(panel.getByRole('button',{name:/D1.*192 frame/})).toBeDisabled();
 await expect(panel.getByRole('button',{name:/D4.*Preview live A\/B/})).toBeDisabled();
 await expect(panel.locator('input[type=checkbox]')).toBeChecked();
 await expect(page.locator('.vml-hand-limb')).toBeVisible();
 await expect(page.locator('.vml-perf')).toBeVisible();
});

test('D1-D4 diagnostic UI cannot open MP4 physical projector outputs',async({page})=>{
 await page.goto('/');
 await page.locator('.fp-source-switch-trigger').click();
 await page.locator('.fp-source-switch-option').filter({hasText:'Video MP4'}).click();
 await page.locator('.fp-transport-projector').click();
 const outputs=page.locator('.stage-dual').getByRole('button',{name:'Buka output'});
 await expect(outputs).toHaveCount(2);
 for(const output of await outputs.all())await expect(output).toBeDisabled();
});
