/** E2E uses the active Track source menu, not the removed global popover. */
export async function selectStageSource(page,name){
 const source=page.locator('.soma-ux01-source-switch');
 await source.locator('summary').click();
 const button=source.locator('.soma-ux01-source-options button').filter({hasText:name});
 if(await button.isDisabled())await source.locator('summary').click();
 else await button.click();
}
export async function openStageMap(page){
 await page.getByRole('button',{name:'Map workspace'}).click();
}
