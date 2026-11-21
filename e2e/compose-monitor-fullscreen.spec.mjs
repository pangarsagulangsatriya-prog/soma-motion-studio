import {test,expect} from '@playwright/test';

test('Compose Stage Monitor enters fullscreen, switches surfaces and returns',async({page})=>{
 await page.goto('/');
 await page.getByRole('button',{name:'Compose workspace'}).click();
 const monitor=page.locator('#soma-compose-monitor');
 await expect(monitor).toBeVisible();
 await expect(monitor.getByRole('button',{name:'Fullscreen Stage Monitor'})).toBeVisible();
 await monitor.getByRole('button',{name:'Fullscreen Stage Monitor'}).click();
 await expect.poll(()=>page.evaluate(()=>document.fullscreenElement?.id??'')).toBe('soma-compose-monitor');
 await expect(monitor.getByRole('button',{name:'Keluar fullscreen Stage Monitor'})).toBeVisible();
 await expect(monitor.locator('.cpux-timeline-drawer')).toBeHidden();
 await monitor.getByRole('button',{name:'LEG A'}).click();
 await expect(monitor.getByRole('button',{name:'LEG A'})).toHaveAttribute('aria-pressed','true');
 const bounds=await monitor.locator('.s64-stage').boundingBox();
 expect(bounds).toBeTruthy();
 expect(bounds.height).toBeGreaterThan(200);
 await monitor.getByRole('button',{name:'Keluar fullscreen Stage Monitor'}).click();
 await expect.poll(()=>page.evaluate(()=>document.fullscreenElement===null)).toBe(true);
 await expect(monitor.locator('.cpux-timeline-drawer')).toBeVisible();
 await expect(page.locator('#soma-compose-leg-inspector')).toBeVisible();
});

test('Fullscreen Stage Monitor is a preview and does not arm physical output',async({page})=>{
 await page.goto('/');
 await page.getByRole('button',{name:'Compose workspace'}).click();
 const monitor=page.locator('#soma-compose-monitor');
 await monitor.getByRole('button',{name:'Fullscreen Stage Monitor'}).click();
 await expect.poll(()=>page.evaluate(()=>document.fullscreenElement?.id??'')).toBe('soma-compose-monitor');
 await expect(monitor.locator('canvas[aria-label^="Visual preview composer"]')).toBeVisible();
 await expect(page.getByRole('button',{name:'Kirim perintah blackout SOMA'})).toHaveCount(1);
 await monitor.getByRole('button',{name:'Keluar fullscreen Stage Monitor'}).click();
 await expect.poll(()=>page.evaluate(()=>document.fullscreenElement===null)).toBe(true);
});
