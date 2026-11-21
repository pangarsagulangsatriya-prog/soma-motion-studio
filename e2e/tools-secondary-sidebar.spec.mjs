import {test,expect} from '@playwright/test';

test('Stage 1 and Stage 2 keep their own active workspaces and engines',async({page})=>{
 await page.setViewportSize({width:1440,height:900});
 await page.goto('/');
 await expect(page.locator('.fp-stage-workspace')).toBeVisible();
 await expect(page.getByRole('button',{name:'Stage 1'})).toHaveAttribute('aria-current','page');
 await expect(page.getByRole('button',{name:'Instrumen Stage 2'})).toHaveCount(0);
 await page.getByRole('button',{name:'Stage 2',exact:true}).click();
 await expect(page).toHaveURL(/stage=2/);
 await expect(page.locator('.soma-stage2-app')).toHaveCount(1);
 await expect(page.getByRole('heading',{name:'Visual, teks & suara'})).toBeVisible();
 await expect(page.locator('.instrument-grid')).toBeVisible();
 await expect(page.locator('.fp-stage-workspace')).toHaveCount(0);
 await expect(page.getByRole('button',{name:'Stage 2',exact:true})).toHaveAttribute('aria-current','page');
 await expect(page.getByRole('button',{name:'Kirim perintah blackout SOMA'})).toBeEnabled();

 const selector=page.locator('.soma-stage2-instrument-tabs');
 await expect(selector.getByRole('button',{name:/Textaire/})).toHaveAttribute('aria-current','page');
 await selector.getByRole('button',{name:'Jejak Berulang'}).click();
 await expect(selector.getByRole('button',{name:'Jejak Berulang'})).toHaveAttribute('aria-current','page');
 await expect(page.locator('.instrument-grid')).toBeVisible();
 await selector.getByRole('button',{name:/Textaire/}).click();

 await expect(page.locator('.soma-primary-header').getByRole('button',{name:'Instrumen Stage 2'})).toBeVisible();
 await expect(page.locator('.soma-primary-sidebar').getByRole('button',{name:'Instrumen Stage 2'})).toHaveCount(0);
 await page.getByRole('button',{name:'Instrumen Stage 2'}).click();
 const labs=page.locator('#soma-labs-panel');
 await expect(labs).toBeVisible();
 const search=labs.getByRole('searchbox',{name:'Cari modul SOMA Labs'});
 await search.fill('textaire');
 await expect(labs.getByRole('button',{name:/Textaire/})).toBeVisible();
 await expect(labs.getByRole('button',{name:/Video Motion Lab/})).toHaveCount(0);
 await page.keyboard.press('Escape');
 await expect(labs).toHaveCount(0);

 await page.getByRole('button',{name:'Stage 1'}).click();
 await expect(page).not.toHaveURL(/stage=2/);
 await expect(page.locator('.fp-stage-workspace')).toBeVisible();
 await expect(page.getByRole('button',{name:'Instrumen Stage 2'})).toHaveCount(0);
});

test('direct Stage 2 URL renders legacy instruments, not Stage 1 Footprints',async({page})=>{
 await page.goto('/?stage=2');
 await expect(page.getByRole('heading',{name:'Visual, teks & suara'})).toBeVisible();
 await expect(page.locator('.soma-stage2-instrument-tabs button')).toHaveCount(8);
 await expect(page.locator('.instrument-grid')).toBeVisible();
 await expect(page.locator('.fp-stage-workspace')).toHaveCount(0);
 await expect(page.locator('.fp-preview-floor')).toHaveCount(0);
 await page.getByRole('button',{name:'Kirim perintah blackout SOMA'}).click();
 await expect(page.locator('.soma-stage2-app')).toBeVisible();
});

test('Stage 2 exposes text, sound, archive, and capture without remounting Stage 1',async({page})=>{
 await page.goto('/?stage=2');
 const tools=page.locator('.soma-stage2-instrument-tabs');
 for(const label of ['Potongan','Siluet × Teks','Hydra / Generatif','Motion & Sound']){
  await tools.getByRole('button',{name:label}).click();
  await expect(tools.getByRole('button',{name:label})).toHaveAttribute('aria-current','page');
  await expect(page.locator('.fp-stage-workspace')).toHaveCount(0);
 }
 await tools.getByRole('button',{name:'Capture Experiments'}).click();
 await expect(page.locator('.fp-stage-workspace')).toHaveCount(0);
 await expect(tools.getByRole('button',{name:'Capture Experiments'})).toHaveAttribute('aria-current','page');
});

test('mobile Stage 2 has its own controls and returns to Stage 1',async({page})=>{
 await page.setViewportSize({width:390,height:844});
 await page.goto('/');
 await page.getByRole('button',{name:'Buka navigasi SOMA'}).click();
 await page.getByRole('button',{name:'Stage 2',exact:true}).click();
 await expect(page).toHaveURL(/stage=2/);
 await expect(page.locator('.soma-stage2-instrument-tabs')).toBeVisible();
 await expect(page.getByRole('heading',{name:'Visual, teks & suara'})).toBeVisible();
 await page.getByRole('button',{name:'Buka navigasi SOMA'}).click();
 await page.getByRole('button',{name:'Stage 1'}).click();
 await expect(page.locator('.fp-stage-workspace')).toBeVisible();
 const widths=await page.evaluate(()=>({
  viewport:document.documentElement.clientWidth,
  content:document.documentElement.scrollWidth
 }));
 expect(widths.content).toBeLessThanOrEqual(widths.viewport+2);
});
