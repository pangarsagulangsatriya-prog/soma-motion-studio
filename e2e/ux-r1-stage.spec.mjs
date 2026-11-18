import {test,expect} from '@playwright/test';

async function openVideoSource(page){
 await page.goto('/');
 await expect(page.locator('.fp-stage-workspace')).toBeVisible();
 await page.locator('.fp-source-switch-trigger').click();
 await page.locator('.fp-source-switch-option').filter({hasText:'Video MP4'}).click();
 await expect(page.locator('.fp-stage-workspace')).toHaveAttribute('data-experimental','true');
}

test('UX-R1 focus BODY / FLOOR / INPUT keeps all three original canvas nodes',async({page})=>{
 await openVideoSource(page);
 const stage=page.locator('.fp-stage-workspace');
 await page.evaluate(()=>{
  window.__uxR1Canvases=[
   document.querySelector('.fp-stage-video canvas'),
   document.querySelector('.fp-preview-body canvas'),
   document.querySelector('.fp-preview-floor canvas')
  ];
 });
 for(const [pane,aria] of [
  ['body','Perbesar BODY'],['floor','Perbesar FLOOR'],['input','Perbesar INPUT']
 ]){
  await page.getByRole('button',{name:aria}).click();
  await expect(stage).toHaveAttribute('data-focus-preview',pane);
  const retained=await page.evaluate(()=>window.__uxR1Canvases.every(
   element=>element?.isConnected&&document.contains(element)));
  expect(retained).toBe(true);
  await page.locator('.fp-preview-restore').click();
  await expect(stage).toHaveAttribute('data-focus-preview','split');
 }
 await page.getByRole('button',{name:'Perbesar BODY'}).click();
 await page.keyboard.press('Escape');
 await expect(stage).toHaveAttribute('data-focus-preview','split');
 expect(await page.evaluate(()=>window.__uxR1Canvases.every(
  element=>element?.isConnected&&document.contains(element)))).toBe(true);
 await expect(page.locator('.fp-compact-transport .fp-transport-blackout')).toBeEnabled();
});

test('UX-R1 source picker stays inside viewport and returns focus on Escape',async({page})=>{
 await page.goto('/');
 const trigger=page.locator('.fp-source-switch-trigger');
 await trigger.click();
 const menu=page.locator('.fp-source-switch-menu');
 await expect(menu).toBeVisible();
 const bounds=await menu.boundingBox();
 const viewport=page.viewportSize();
 expect(bounds).not.toBeNull();
 expect(viewport).not.toBeNull();
 expect(bounds.x).toBeGreaterThanOrEqual(0);
 expect(bounds.x+bounds.width).toBeLessThanOrEqual(viewport.width+1);
 expect(bounds.y).toBeGreaterThanOrEqual(0);
 expect(bounds.y+Math.min(bounds.height,viewport.height-bounds.y))
  .toBeLessThanOrEqual(viewport.height+1);
 await page.keyboard.press('Escape');
 await expect(menu).toHaveCount(0);
 await expect(trigger).toBeFocused();
});

test('UX-R1 video timecode and output safety stay stable across focus changes',async({page})=>{
 await openVideoSource(page);
 const stage=page.locator('.fp-stage-workspace');
 const time=page.locator('.fp-stable-timecode');
 await expect(time).toBeVisible();
 await expect(time).toContainText('00:00');
 const before=await time.boundingBox();
 await page.getByRole('button',{name:'Perbesar INPUT'}).click();
 await expect(stage).toHaveAttribute('data-focus-preview','input');
 await expect(page.locator('.fp-stage-video')).toBeVisible();
 await expect(page.locator('.fp-stage-video .fp-stage-surface-foot'))
  .toContainText('OUTPUT FISIK TERKUNCI');
 await expect(page.locator('.fp-compact-transport .fp-transport-blackout')).toBeEnabled();
 await page.locator('.fp-preview-restore').click();
 const after=await time.boundingBox();
 expect(Math.abs((before?.width??0)-(after?.width??0))).toBeLessThan(3);
 await expect(stage).toHaveAttribute('data-focus-preview','split');
});

test('UX-R1 source and focused preview do not create horizontal overflow',async({page})=>{
 await openVideoSource(page);
 for(const aria of ['Perbesar BODY','Perbesar FLOOR','Perbesar INPUT']){
  await page.getByRole('button',{name:aria}).click();
  const horizontalOverflow=await page.evaluate(
   ()=>document.documentElement.scrollWidth>window.innerWidth+2);
  expect(horizontalOverflow).toBe(false);
  await page.locator('.fp-preview-restore').click();
 }
});
