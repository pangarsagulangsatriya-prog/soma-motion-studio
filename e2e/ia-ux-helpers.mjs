/** IA-R1: browser tests use the one global Source selector and dedicated Map route. */
export async function selectStageSource(page,name){
 await page.locator('.soma-uxr1-source > summary').click();
 await page.locator('.soma-uxr1-source-menu button').filter({hasText:name}).click();
}
export async function openStageMap(page){
 await page.getByRole('button',{name:'Map',exact:true}).click();
}
