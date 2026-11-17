import {test,expect} from '@playwright/test';

async function openVideoLab(page){
 await page.goto('/');
 await page.locator('.fp-source-switch-trigger').click();
 await page.locator('.fp-source-switch-option').filter({hasText:'Video MP4'}).click();
 await page.locator('.fp-experiment-advanced-details summary').click();
 await page.getByRole('button',{name:'Buka Video Motion Lab'}).click();
}

test('S6.8.8.5 recovery QA visibly tracks actor A and B independently',async({page})=>{
 await openVideoLab(page);
 // Identity QA appears once a video is loaded and analysis starts.
 // In the empty lab it must not claim a body was detected.
 await expect(page.locator('.vml-identity-qa')).toHaveCount(0);
 await expect(page.locator('.vml-actor-readout')).toHaveCount(0);
 await expect(page.locator('.vml-temporal')).toBeVisible();
 await expect(page.locator('.vml-hand-limb')).toBeVisible();
 await expect(page.getByRole('button',{name:'Reset identitas & event'})).toBeVisible();
 await expect(page.getByRole('combobox',{name:'Mode jumlah aktor video'})).toHaveValue('auto');
});

test('S6.8.8.5 provisional identity never unlocks MP4 physical outputs',async({page})=>{
 await page.goto('/');
 await page.locator('.fp-source-switch-trigger').click();
 await page.locator('.fp-source-switch-option').filter({hasText:'Video MP4'}).click();
 await expect(page.locator('.fp-preview-body')).toBeVisible();
 await expect(page.locator('.fp-preview-floor')).toBeVisible();
 await expect(page.getByRole('button',{name:'Sembunyikan kerangka tubuh'})).toBeVisible();
 await page.locator('.fp-transport-projector').click();
 const outputs=page.locator('.stage-dual').getByRole('button',{name:'Buka output'});
 await expect(outputs).toHaveCount(2);
 for(const output of await outputs.all())await expect(output).toBeDisabled();
});
