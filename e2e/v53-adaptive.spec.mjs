import {test,expect} from '@playwright/test';
const red={name:'archive-red.svg',mimeType:'image/svg+xml',buffer:Buffer.from('<svg xmlns="http://www.w3.org/2000/svg" width="1600" height="900"><rect width="1600" height="900" fill="#d02020"/></svg>')};
test('V5.3 adaptive settings preserve actual output and cue',async({page})=>{
 await page.goto('/?workspace=nodes-v53');await expect(page.locator('[data-version="5.3"]')).toBeVisible();
 await expect(page.locator('.adaptive-inspector')).toBeHidden();
 await page.locator('[data-node="archive"] .sw-node-title').click();
 await expect(page.locator('.adaptive-inspector')).toBeHidden();
 await page.locator('[data-node="archive"] .sw-node-title').dblclick();
 await page.locator('.adaptive-inspector input[type=file]').setInputFiles(red);
 await page.getByRole('button',{name:'F2 Arsip',exact:true}).click();await expect(page.getByRole('button',{name:'GO',exact:true})).toBeEnabled();await page.getByRole('button',{name:'GO',exact:true}).click();
 const pixel=()=>page.locator('[data-surface="canvas"] canvas').evaluate(c=>c.getContext('2d').getImageData(800,450,1,1).data[0]);
 await expect.poll(pixel).toBeGreaterThan(170);
 await page.getByRole('button',{name:'Dock inspector',exact:true}).click();await expect(page.locator('.adaptive-inspector')).toHaveAttribute('data-mode','docked');
 await page.getByRole('button',{name:'Undock inspector',exact:true}).click();await page.getByRole('button',{name:'Close inspector',exact:true}).click();await expect(page.locator('.adaptive-inspector')).toBeHidden();
 await expect(page.locator('.sw-current b')).toHaveText('F2');await expect.poll(pixel).toBeGreaterThan(170);
 await page.keyboard.press('Escape');await expect.poll(pixel).toBe(0);await expect(page.locator('.sw-current b')).toHaveText('F2');
});
test('V5.3 quick decay shared with inspector and contextual capture',async({page})=>{
 await page.goto('/?workspace=nodes-v53');
 await page.getByRole('button',{name:'Settings Footprint',exact:true}).click();
 await page.getByLabel('Quick decay').fill('25000');
 await page.getByRole('button',{name:'Pengaturan lengkap'}).click();await expect(page.getByLabel('Decay',{exact:true})).toHaveValue('25000');
 await page.getByRole('button',{name:'Close inspector'}).click();
 await page.locator('[data-node="hand"] .sw-node-title').dblclick();
 await expect(page.locator('.adaptive-inspector')).not.toContainText('Persetujuan penonton');
 await page.locator('.adaptive-inspector').getByRole('button',{name:'Photo Capture'}).click();
 await expect(page.locator('.adaptive-inspector')).toContainText('Hubungkan kamera penonton');
 await page.getByRole('button',{name:'Close inspector'}).click();
});
test('V5.3 viewport safety controls and no document scroll',async({page})=>{
 await page.goto('/?workspace=nodes-v53');
 for(const [width,height] of [[1440,900],[1280,800],[1024,768],[1280,600],[390,844]]){await page.setViewportSize({width,height});await expect.poll(()=>page.evaluate(()=>document.documentElement.scrollHeight<=innerHeight+1)).toBe(true);await expect(page.getByRole('button',{name:'Blackout semua output'})).toBeInViewport();await expect(page.getByRole('button',{name:'GO',exact:true})).toBeInViewport();}
});
