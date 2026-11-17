import {test,expect} from '@playwright/test';

test.setTimeout(90_000);

async function selectSource(page,name){
 await page.locator('.fp-source-switch-trigger').click();
 await page.locator('.fp-source-switch-option').filter({hasText:name}).click();
 await expect(page.locator('.fp-source-switch-trigger')).toContainText(name);
}

test('S6.8.8.2 video defaults to automatic actor count and exposes manual override only in Lab',async({page})=>{
 await page.goto('/?lab=1');
 await selectSource(page,'Video MP4');
 await expect(page.locator('.fp-source-switch-trigger')).toContainText('Video MP4');
 await expect(page.locator('.fp-preview-body')).toBeVisible();
 await expect(page.locator('.fp-preview-floor')).toBeVisible();
 const advanced=page.locator('.fp-experiment-advanced-details summary');
 await advanced.click();
 await page.getByRole('button',{name:'Buka Video Motion Lab'}).click();
 const select=page.getByRole('combobox',{name:'Mode jumlah aktor video'});
 await expect(select).toBeVisible();
 await expect(select).toHaveValue('auto');
 await select.selectOption('2');
 await expect(select).toHaveValue('2');
 await select.selectOption('auto');
 await expect(select).toHaveValue('auto');
});

test('S6.8.8.2 A/B diagnostics do not authorize physical projector for MP4',async({page})=>{
 await page.goto('/');
 await selectSource(page,'Video MP4');
 await expect(page.getByRole('button',{name:'Sembunyikan kerangka tubuh'})).toBeVisible();
 await page.locator('.fp-transport-projector').click();
 const router=page.locator('.stage-dual');
 await expect(router).toContainText('Dua output fisik terkunci');
 const open=router.getByRole('button',{name:'Buka output'});
 await expect(open).toHaveCount(2);
 for(const button of await open.all())await expect(button).toBeDisabled();
});
