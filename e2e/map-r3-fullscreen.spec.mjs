import {test,expect} from '@playwright/test';

test('MAP-R3: full screen can show camera+stage and uses meter spacing',async({page})=>{
 await page.goto('/');
 await page.getByRole('button',{name:'Map workspace'}).click();
 const monitor=page.locator('.map-r2-monitor');
 await expect(monitor).toBeVisible();
 await expect(monitor.getByRole('button',{name:'Fullscreen Map Monitor'})).toBeVisible();
 await monitor.getByRole('button',{name:'Kamera + Panggung'}).click();
 await expect(monitor.locator('canvas[aria-label="Tampilan feed kamera Map"]')).toBeVisible();
 await expect(monitor.locator('canvas[aria-label="Kanvas kalibrasi panggung Map"]')).toBeVisible();
 await monitor.locator('.map-r5-pattern-options > summary').click();
 await monitor.getByRole('button',{name:'0,25 m'}).click();
 await expect(monitor.locator('.map-r5-pattern-options > summary')).toContainText('Grid 0,25 m');
 await monitor.getByRole('button',{name:'Fullscreen Map Monitor'}).click();
 await expect.poll(()=>page.evaluate(()=>document.fullscreenElement?.getAttribute('aria-label')??''))
  .toBe('Stage Map Monitor');
 await expect(monitor.getByRole('button',{name:'Keluar fullscreen Map Monitor'})).toBeVisible();
 await expect(monitor.locator('canvas[aria-label="Tampilan feed kamera Map"]')).toBeVisible();
 await monitor.getByRole('button',{name:'Keluar fullscreen Map Monitor'}).click();
 await expect.poll(()=>page.evaluate(()=>document.fullscreenElement===null)).toBe(true);
 await expect(page.getByRole('button',{name:'Kirim perintah blackout SOMA'})).toHaveCount(1);
});

test('MAP-R3: advanced diagnostics remain accessible, separate from physical QA',async({page})=>{
 await page.goto('/');
 await page.getByRole('button',{name:'Map workspace'}).click();
 const rail=page.locator('.map-r2-rail');
 await expect(rail.getByText('Uji proyektor & QA')).toBeVisible();
 await expect(rail.locator('.stage-dual-qa-disclosure')).toBeVisible();
 const advanced=rail.locator('details.map-r2-advanced');
 await advanced.locator('summary').first().click();
 await expect(advanced.locator('.stage-dual-cal-controls')).toBeVisible();
 await expect(advanced.locator('.map-r1-editor')).toBeHidden();
 await advanced.locator('details.map-r2-aux-details').first().locator('summary').click();
 await expect(advanced.locator('.map-r1-editor')).toBeVisible();
 await expect(page.locator('.map-r2-monitor')).toBeVisible();
});
