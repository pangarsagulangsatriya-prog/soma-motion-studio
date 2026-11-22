import {test,expect} from '@playwright/test';

async function openLines(page){
 await page.goto('/');
 await page.getByRole('button',{name:'Compose workspace'}).click();
 const monitor=page.locator('#soma-compose-monitor');
 await monitor.locator('.lt-beta-trigger').click();
 const panel=page.getByRole('region',{name:'Kontrol Garis V3'});
 await expect(panel).toBeVisible();
 return {panel,monitor};
}

test('V3.1 default is actor-first: A red, Luwes, compact controls, no foot color on top',async({page})=>{
 const {panel}=await openLines(page);
 await expect(panel.getByText('V3.2 BETA')).toBeVisible();
 await expect(panel.getByLabel('Warna Aktor A')).toHaveValue('#e44f32');
 await expect(panel.getByLabel('Tampilkan Aktor A')).toBeChecked();
 await panel.locator('.lt-painterly-characters summary').click();
 const character=panel.getByRole('group',{name:'Karakter garis'});
 await expect(character.getByRole('button',{name:'Luwes'})).toHaveAttribute('aria-pressed','true');
 await expect(character.getByRole('button',{name:'Presisi'})).toBeVisible();
 await expect(character.getByRole('button',{name:'Lukis'})).toBeVisible();
 await expect(panel.locator('.lt-v31-foot-details')).not.toHaveAttribute('open');
 await expect(panel.getByLabel('Warna Aktor B')).toHaveCount(0); // default 1P
 await expect(panel.getByRole('slider',{name:'Ketebalan lintasan'})).toHaveValue('3');
});

test('changing actor color and character does not erase trajectory observations',async({page})=>{
 const {panel}=await openLines(page);
 await panel.getByRole('button',{name:'Coba Demo'}).click();
 await expect(panel.getByText(/DEMO/)).toBeVisible();
 await expect.poll(async()=>{
  const text=await panel.locator('.lt-beta-count').innerText();
  return Number(text.match(/\d+/)?.[0]??0);
 },{timeout:12000}).toBeGreaterThan(7);
 const original=Number((await panel.locator('.lt-beta-count').innerText()).match(/\d+/)?.[0]??0);
 await panel.getByLabel('Warna Aktor A').fill('#ff0000');
 await expect(panel.getByLabel('Warna Aktor A')).toHaveValue('#ff0000');
 const character=panel.getByRole('group',{name:'Karakter garis'});
 for(const mode of ['Presisi','Lukis','Luwes']){
  await character.getByRole('button',{name:mode}).click();
  await expect(character.getByRole('button',{name:mode})).toHaveAttribute('aria-pressed','true');
 }
 const next=Number((await panel.locator('.lt-beta-count').innerText()).match(/\d+/)?.[0]??0);
 expect(next).toBeGreaterThanOrEqual(original);
 await panel.locator('.lt-v31-foot-details summary').click();
 await panel.getByLabel('Warna khusus A right').check();
 await panel.getByLabel('Warna A right').fill('#00bb99');
 await expect(panel.getByLabel('Warna A right')).toHaveValue('#00bb99');
 await expect(panel.getByLabel('Warna Aktor A')).toHaveValue('#ff0000');
 await panel.getByLabel('Warna khusus A right').uncheck();
 await expect(panel.getByLabel('Warna A right')).toBeDisabled();
 await panel.getByRole('button',{name:'Hentikan Demo'}).click();
 await panel.getByRole('button',{name:'Bersihkan'}).click();
 await expect(panel.locator('.lt-beta-count')).toContainText('0 titik');
});

test('clean fullscreen and legacy V2 rollback still work',async({page})=>{
 const {panel,monitor}=await openLines(page);
 await panel.getByRole('button',{name:'Coba Demo'}).click();
 await monitor.getByRole('button',{name:'Fullscreen Stage Monitor'}).click();
 await expect.poll(()=>page.evaluate(()=>document.fullscreenElement?.classList.contains('lt-v3-stage')??false)).toBe(true);
 expect(await page.evaluate(()=>document.fullscreenElement?.querySelectorAll('button').length)).toBe(0);
 await page.keyboard.press('Escape');
 await expect.poll(()=>page.evaluate(()=>document.fullscreenElement===null)).toBe(true);
 await panel.locator('.lt-v3-advanced summary').click();
 await panel.getByRole('button',{name:'Pakai engine V2 (rollback)'}).click();
 await expect(page.getByRole('region',{name:'Kontrol Garis Beta'})).toBeVisible();
 await page.getByRole('button',{name:'Kembali ke Garis V3'}).click();
 await expect(page.getByRole('region',{name:'Kontrol Garis V3'})).toBeVisible();
});
