import {test,expect} from '@playwright/test';
async function chooseVideo(page){
 await page.goto('/?lab=1');
 await page.locator('.fp-source-switch-trigger').click();
 await page.locator('.fp-source-switch-option').filter({hasText:'Video MP4'}).click();
 await page.locator('.fp-experiment-advanced-details summary').click();
 await page.getByRole('button',{name:'Buka Video Motion Lab'}).click();
}
test('Pose-based arms and legs panel retains independent actors without finger tracking',async({page})=>{
 await chooseVideo(page);
 const panel=page.locator('.vml-hand-limb');
 await expect(panel).toBeVisible();
 await expect(panel.locator('summary')).toContainText('Arms & Legs');
 await panel.locator('summary').click();
 const buttons=panel.getByRole('group',{name:'Pilih aktor detail lengan dan kaki'});
 await expect(buttons.getByRole('button',{name:'Actor A'})).toHaveAttribute('aria-pressed','true');
 await buttons.getByRole('button',{name:'Actor B'}).click();
 await expect(buttons.getByRole('button',{name:'Actor B'})).toHaveAttribute('aria-pressed','true');
 await expect(panel.getByRole('button',{name:'Ekspor JSON'})).toBeDisabled();
 await expect(page.locator('.vml-temporal')).toBeVisible();
 await expect(page.getByRole('combobox',{name:'Mode jumlah aktor video'})).toHaveValue('auto');
});

test('MP4 pose-based limb tracking keeps physical projector outputs locked',async({page})=>{
 await page.goto('/');
 await page.locator('.fp-source-switch-trigger').click();
 await page.locator('.fp-source-switch-option').filter({hasText:'Video MP4'}).click();
 await expect(page.getByRole('button',{name:'Sembunyikan kerangka tubuh'})).toBeVisible();
 await expect(page.locator('.fp-preview-body')).toBeVisible();
 await expect(page.locator('.fp-preview-floor')).toBeVisible();
 await page.locator('.fp-transport-projector').click();
 const route=page.locator('.stage-dual');
 await expect(route).toContainText('Dua output fisik terkunci');
 const open=route.getByRole('button',{name:'Buka output'});
 await expect(open).toHaveCount(2);
 for(const button of await open.all())await expect(button).toBeDisabled();
});
