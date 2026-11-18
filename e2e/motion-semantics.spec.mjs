import {selectStageSource,openStageMap} from './ia-ux-helpers.mjs';
import {test,expect} from '@playwright/test';

async function openVideoLab(page){
 await page.goto('/?lab=1');
 await selectStageSource(page,'Video MP4');
 await page.locator('.fp-experiment-advanced-details summary').click();
 await page.getByRole('button',{name:'Buka Video Motion Lab'}).click();
}
test('S6.8.8.6 compact seven-kind event timeline supports A/B filters and safe empty state',async({page})=>{
 await openVideoLab(page);
 const panel=page.locator('.vml-semantics');
 await expect(panel).toBeVisible();
 await expect(panel.locator('summary')).toContainText('Motion Semantics');
 await panel.locator('summary').click();
 const kind=page.getByRole('combobox',{name:'Jenis Motion Semantics'});
 const actor=page.getByRole('combobox',{name:'Aktor Motion Semantics'});
 await expect(kind.locator('option')).toHaveCount(8);
 await expect(actor.locator('option')).toHaveCount(3);
 await expect(panel.locator('.vml-semantic-counts>span')).toHaveCount(7);
 await actor.selectOption('B');
 await kind.selectOption('pivot');
 await expect(actor).toHaveValue('B');
 await expect(kind).toHaveValue('pivot');
 await expect(panel.getByRole('button',{name:'CSV'})).toBeDisabled();
 await expect(panel).toContainText('Belum ada perubahan gerak');
 await expect(page.locator('.vml-temporal')).toBeVisible();
 await expect(page.locator('.vml-hand-limb')).toBeVisible();
});

test('S6.8.8.6 semantic timeline cannot unlock physical BODY/FLOOR projector',async({page})=>{
 await page.goto('/');
 await selectStageSource(page,'Video MP4');
 await expect(page.locator('.fp-preview-body')).toBeVisible();
 await expect(page.locator('.fp-preview-floor')).toBeVisible();
 await openStageMap(page);
 const outputs=page.locator('.stage-dual').getByRole('button',{name:'Buka output'});
 await expect(outputs).toHaveCount(2);
 for(const output of await outputs.all())await expect(output).toBeDisabled();
});
