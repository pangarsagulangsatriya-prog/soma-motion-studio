import {selectStageSource,openStageMap} from './ia-ux-helpers.mjs';
import {test,expect} from '@playwright/test';
test('Video Lab profiler stays available without hand inference controls',async({page})=>{
 await page.goto('/?lab=1');
 await selectStageSource(page,'Video MP4');
 await page.locator('.fp-experiment-advanced-details summary').click();
 await page.getByRole('button',{name:'Buka Video Motion Lab'}).click();
 const panel=page.locator('.vml-perf');
 await expect(panel).toBeVisible();
 await expect(panel.locator('summary')).toContainText('Performance Profiler');
 await panel.locator('summary').click();
 await expect(page.getByRole('combobox',{name:'Frekuensi deteksi tangan'})).toHaveCount(0);
 await expect(panel.locator('.vml-perf-metrics>span')).toHaveCount(12);
 await expect(panel).toContainText('Pipeline p50');
 await expect(panel).toContainText('Pipeline p95');
 await expect(panel).toContainText('Lag video → AI');
 await expect(panel).toContainText('Hasil AI terlambat');
 await expect(panel).toContainText('Frame dilewati');
 await expect(panel).toContainText('Pose AI');
 await expect(panel).not.toContainText('Hands AI');
 await expect(panel).toContainText('Analisis event');
 await expect(panel).toContainText('Render');
});
test('S6.8.8.7 profiler and worker code retain operator gating of MP4 output',async({page})=>{
 await page.goto('/');
 await selectStageSource(page,'Video MP4');
 await expect(page.locator('.fp-preview-body')).toHaveCount(1);
 await expect(page.locator('.fp-preview-floor')).toHaveCount(1);
 await openStageMap(page);
 const controls=page.locator('.stage-dual').getByRole('button',{name:'Buka output'});
 await expect(controls).toHaveCount(2);
 for(const item of await controls.all())await expect(item).toBeDisabled();
 await page.locator('.stage-dual-check input[type=checkbox]').check();
 for(const item of await controls.all())await expect(item).toBeEnabled();
 for(const live of await page.locator('.stage-dual-output').getByRole('button',{name:'LIVE'}).all())
  await expect(live).toBeDisabled();
});
