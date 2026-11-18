import {test,expect} from '@playwright/test';

test('F0: Touch Demo uses the same live FLOOR preview without granting projector access',async({page})=>{
 await page.goto('/');
 await expect(page.locator('.fp-stage-workspace')).toBeVisible();
 await page.locator('.fp-source-switch-trigger').click();
 await page.locator('.fp-source-switch-option').filter({hasText:'Video MP4'}).click();
 const stage=page.locator('.fp-stage-workspace');
 await expect(stage).toHaveAttribute('data-experimental','true');
 const toggle=page.locator('.fp-preview-floor .fp-floor-touch-toggle');
 await expect(toggle).toBeVisible();
 await toggle.click();
 await expect(toggle).toHaveAttribute('aria-pressed','true');
 const area=page.locator('.fp-preview-floor .fp-stage-canvas-area');
 await expect(area).toHaveAttribute('data-touch-demo','true');
 const box=await area.boundingBox();
 expect(box).not.toBeNull();
 const x1=box.x+box.width*.32,x2=box.x+box.width*.68,y=box.y+box.height*.54;
 await page.mouse.click(x1,y);
 await page.mouse.click(x2,y);
 await expect(page.locator('.fp-floor-bus-status')).toContainText('2 kontak');
 expect(await page.locator('.fp-floor-interaction-layer').evaluate(canvas=>{
  const pixels=canvas.getContext('2d').getImageData(0,0,canvas.width,canvas.height).data;
  let count=0;
  for(let i=3;i<pixels.length;i+=4)if(pixels[i]>0)count++;
  return count;
 })).toBeGreaterThan(300);
 await expect(stage).toHaveAttribute('data-focus-preview','split');
 await expect(page.locator('.fp-stage-video .fp-stage-surface-foot'))
  .toContainText('OUTPUT FISIK TERKUNCI');
 await expect(page.locator('.fp-compact-transport .fp-transport-blackout'))
  .toBeEnabled();
 await toggle.click();
 await expect(toggle).toHaveAttribute('aria-pressed','false');
 await expect(page.locator('.fp-floor-bus-status')).toContainText('0 kontak');
});
