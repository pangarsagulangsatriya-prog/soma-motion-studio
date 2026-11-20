/** E2E uses the active Track source menu, not the removed global popover. */
import {expect} from '@playwright/test';
export async function selectStageSource(page,name){
 const source=page.locator('.soma-ux01-source-switch');
 await expect(source.locator('summary')).toBeVisible();
 await source.locator('summary').click();
 const button=source.locator('.soma-ux01-source-options button').filter({hasText:name});
 await expect(button).toBeVisible();
 if(await button.getAttribute('aria-pressed')==='true'){
  await source.locator('summary').click();return;
 }
 // New camera routes can be temporarily locked during async tracker startup.
 // Wait for the previous transaction instead of silently ignoring the click.
 await expect(button).toBeEnabled({timeout:40000});
 await button.click();
}
export async function openStageMap(page){
 await page.getByRole('button',{name:'Map workspace'}).click();
}
