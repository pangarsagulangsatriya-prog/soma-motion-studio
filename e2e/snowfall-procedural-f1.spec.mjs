import {test,expect} from '@playwright/test';

test('F1 Snowfall: six touch steps create six persistent marks without standing duplicates',async({page})=>{
 await page.goto('/');
 const floor=page.locator('.fp-preview-floor');
 await expect(floor).toBeVisible();
 await floor.locator('.fp-floor-touch-toggle').click();
 await expect(floor.locator('.fp-floor-touch-toggle')).toHaveAttribute('aria-pressed','true');
 await floor.getByRole('combobox',{name:'Pilih scene FLOOR'}).selectOption('snowfall');
 await expect(floor).toHaveAttribute('data-floor-scene','snowfall');
 await expect(floor.locator('.fp-floor-snowfall-canvas')).toBeVisible();
 const interaction=floor.locator('.fp-stage-canvas-area');
 const bound=await interaction.boundingBox();
 expect(bound).not.toBeNull();
 for(let i=0;i<6;i++){
  const position={x:bound.width*(.18+i*.12),y:bound.height*(i%2?.63:.37)};
  await interaction.click({position});
  await expect(floor.locator('.fp-snowfall-counter')).toContainText((i+1)+' jejak');
 }
 await page.waitForTimeout(650);
 await expect(floor.locator('.fp-snowfall-counter')).toContainText('6 jejak');
 await expect(floor.locator('.fp-snowfall-counter')).toContainText(/GPU WebGL2|2D fallback/);
 await floor.getByRole('button',{name:'Jeda'}).click();
 await expect(floor.getByRole('button',{name:'Lanjut'})).toBeVisible();
 await page.waitForTimeout(450);
 await expect(floor.locator('.fp-snowfall-counter')).toContainText('6 jejak');
 await floor.getByRole('button',{name:'Lanjut'}).click();
 await floor.getByRole('button',{name:'Reset salju'}).click();
 await expect(floor.locator('.fp-snowfall-counter')).toContainText('0 jejak');
 await floor.getByRole('combobox',{name:'Pilih scene FLOOR'}).selectOption('footprints');
 await expect(floor.locator('.fp-floor-legacy-canvas')).toBeVisible();
});
test('F1 Snowfall remains a clean local preview for MP4/3D input',async({page})=>{
 await page.goto('/');
 await page.locator('.fp-source-switch-trigger').click();
 await page.locator('.fp-source-switch-option').filter({hasText:'Video MP4'}).click();
 const floor=page.locator('.fp-preview-floor');
 await floor.getByRole('combobox',{name:'Pilih scene FLOOR'}).selectOption('snowfall');
 await expect(floor.locator('.fp-floor-snowfall-canvas')).toBeVisible();
 await expect(page.locator('.fp-stage-video .fp-stage-surface-foot')).toContainText('OUTPUT FISIK TERKUNCI');
 await page.locator('.fp-transport-projector').click();
 await expect(page.locator('.stage-dual')).toContainText('MP4/3D');
 await expect(page.locator('.stage-dual-perform-go')).toBeDisabled();
});
