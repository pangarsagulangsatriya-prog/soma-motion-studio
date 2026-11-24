import {test,expect} from '@playwright/test';
test('shared Compose audio panel starts off, can unlock, switches visual mode and blackouts',async({page})=>{
 await page.goto('/');await page.getByRole('button',{name:'Compose workspace'}).click();
 const panel=page.getByRole('region',{name:'Audio gerak'});await expect(panel).toBeVisible();
 await expect(panel.getByRole('button',{name:'Aktifkan audio'})).toBeEnabled();
 await panel.getByRole('button',{name:'Aktifkan audio'}).click();
 await expect(panel.getByRole('button',{name:'Matikan audio'})).toBeVisible();
 await panel.getByLabel('Karakter suara').selectOption('raw');
 await panel.getByRole('slider',{name:'Volume audio gerak'}).fill('0.2');
 await panel.getByRole('button',{name:'Tes audio'}).click();
 await expect(panel.getByRole('status',{name:'Status audio gerak'})).toContainText(/Tes audio|Menunggu/);
 await expect.poll(()=>panel.getByRole('meter',{name:'Level audio'}).evaluate(m=>m.value),{timeout:2000,intervals:[20,30,50]}).toBeGreaterThan(.001);
 await page.locator('#soma-compose-monitor button.lt-beta-trigger').click();
 await expect(panel).toContainText('Pijakan + gerak');await expect(panel.getByLabel('Karakter suara')).toHaveValue('raw');
 await page.getByRole('button',{name:'Blackout',exact:true}).click();
 await expect(panel.getByRole('button',{name:'Aktifkan audio'})).toBeDisabled();
 await expect(panel.getByRole('button',{name:'Matikan audio'})).toHaveCount(0);
});
