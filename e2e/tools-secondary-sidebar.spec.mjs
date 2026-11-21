import {test,expect} from '@playwright/test';

test('wide desktop: Stage workflow and persistent Tools sidebar stay independent',async({page})=>{
 await page.setViewportSize({width:1440,height:900});
 let popups=0;
 page.on('popup',popup=>{popups++;void popup.close();});
 await page.goto('/');
 const stage=page.getByRole('button',{name:'Stage 1'});
 const tools=page.getByRole('button',{name:'Tools · SOMA Labs'});
 await expect(stage).toBeVisible();
 await expect(page.locator('.soma-stage-module-nav')).toBeVisible();
 await tools.click();
 const side=page.locator('#soma-labs-panel');
 await expect(side).toBeVisible();
 await expect(side).toHaveAttribute('role','navigation');
 await expect.poll(()=>page.locator('.workspace>main').evaluate(
  element=>getComputedStyle(element).gridColumnStart)).toBe('3');
 const search=side.getByRole('searchbox',{name:'Cari modul SOMA Labs'});
 await search.fill('Textaire');
 const textaire=side.getByRole('button',{name:/Textaire/});
 await expect(textaire).toBeVisible();
 await textaire.click();
 await expect(side).toBeVisible();
 await expect(page.locator('.soma-primary-header .v3-brand')).toContainText('TOOLS');
 expect(popups,'choosing a legacy tool must not launch a projection window').toBe(0);
 await stage.click();
 await expect(side).toHaveCount(0);
 await expect(page.locator('.soma-stage-module-nav')).toBeVisible();
 await expect(page.getByRole('button',{name:'Map workspace'})).toBeVisible();
 await expect(page.getByRole('button',{name:'Kirim perintah blackout SOMA'})).toBeVisible();
});

test('compact desktop: tool selection closes the sidecar to protect working area',async({page})=>{
 await page.setViewportSize({width:1024,height:768});
 await page.goto('/');
 await page.getByRole('button',{name:'Tools · SOMA Labs'}).click();
 const side=page.locator('#soma-labs-panel');
 await expect(side).toBeVisible();
 await side.getByRole('searchbox',{name:'Cari modul SOMA Labs'}).fill('textaire');
 await side.getByRole('button',{name:/Textaire/}).click();
 await expect(side).toHaveCount(0);
 await expect(page.getByRole('button',{name:'Kirim perintah blackout SOMA'})).toBeVisible();
});

test('mobile: Tools remains a dismissible modal without obscuring safety controls',async({page})=>{
 await page.setViewportSize({width:390,height:844});
 await page.goto('/');
 await page.getByRole('button',{name:'Buka navigasi SOMA'}).click();
 await page.getByRole('button',{name:'Tools · SOMA Labs'}).click();
 const side=page.locator('#soma-labs-panel');
 await expect(side).toHaveAttribute('role','dialog');
 await expect(side).toHaveAttribute('aria-modal','true');
 await page.keyboard.press('Escape');
 await expect(side).toHaveCount(0);
 await expect(page.getByRole('button',{name:'Kirim perintah blackout SOMA'})).toBeVisible();
});
