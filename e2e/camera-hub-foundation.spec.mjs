import {test,expect} from '@playwright/test';

test('Global Camera Hub opens in Stage 1, uses true registry and closes on Escape',async({page})=>{
 await page.goto('/');
 for(const name of ['Stage 1','Stage 2','F3 Capture'])
  await expect(page.getByRole('button',{name,exact:true})).toBeVisible();
 const open=page.getByRole('button',{name:/Camera Hub · .* kamera aktif/});
 await expect(open).toBeVisible();
 await open.click();
 const panel=page.getByRole('dialog',{name:'Camera Hub'});
 await expect(panel).toBeVisible();
 await expect(panel.getByText('Perangkat di browser ini')).toBeVisible();
 await expect(panel.getByRole('button',{name:'Perbarui'})).toBeVisible();
 await panel.getByRole('button',{name:'Perbarui'}).click();
 await expect(panel.getByText(/terdaftar · .* aktif/)).toBeVisible();
 await page.keyboard.press('Escape');
 await expect(panel).toHaveCount(0);
 await expect(open).toHaveAttribute('aria-expanded','false');
});
test('Camera Hub stays a header utility in F3 and Stage 2, never fourth Stage',async({page})=>{
 await page.goto('/');
 await page.getByRole('button',{name:'F3 Capture',exact:true}).click();
 await expect(page.getByRole('button',{name:/Camera Hub · .* kamera aktif/})).toBeVisible();
 await page.getByRole('button',{name:/Camera Hub · .* kamera aktif/}).click();
 await expect(page.getByRole('dialog',{name:'Camera Hub'})).toBeVisible();
 await page.keyboard.press('Escape');
 await page.getByRole('button',{name:'Stage 2',exact:true}).click();
 await expect(page.getByRole('button',{name:/Camera Hub · .* kamera aktif/})).toBeVisible();
 await expect(page.getByRole('button',{name:'Stage 1',exact:true})).toBeVisible();
 await expect(page.getByRole('button',{name:'Stage 2',exact:true})).toBeVisible();
 await expect(page.getByRole('button',{name:'F3 Capture',exact:true})).toBeVisible();
});
