/** Browser tests use the one global Source control and explicit Map route. */
export async function selectStageSource(page,name){
 const source=page.locator('.soma-uxr1-source');
 await source.locator('summary').click();
 const button=source.locator('.soma-uxr1-source-menu button').filter({hasText:name});
 if(await button.isDisabled()){
  await source.locator('summary').click();
 }else await button.click();
}
export async function openStageMap(page){
 await page.getByRole('button',{name:'Map',exact:true}).click();
}
