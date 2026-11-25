import {test,expect} from '@playwright/test';

test('Perform shows three primary outputs and only one route-specific connection flow',async({page})=>{
 await page.goto('./');
 await page.getByRole('button',{name:'Perform workspace'}).click();
 const output=page.getByRole('region',{name:'Tujuan output'});
 const choices=output.getByRole('group',{name:'Jalur Output Perform'});
 await expect(choices.getByRole('button')).toHaveCount(3);
 for(const label of ['SOMA Direct','Resolume','TouchDesigner'])
  await expect(choices.getByRole('button',{name:label,exact:true})).toBeVisible();
 await choices.getByRole('button',{name:'Resolume',exact:true}).click();
 await expect(choices.getByRole('button',{name:'Resolume',exact:true})).toHaveAttribute('aria-pressed','true');
 await expect(output.getByText('Sumber belum siap')).toBeVisible();
 await expect(output.getByRole('button',{name:'Buka Track'})).toBeVisible();
 await expect(output.locator('.ops-r1-route-step')).toHaveCount(3);
 const presets=page.locator('.ops-r1-monitor-presets');
 await expect(presets).not.toHaveAttribute('open','');
 await expect(presets.locator('.ops-r1-monitor-summary')).toContainText('Preset monitor');
 await presets.locator('.ops-r1-monitor-summary').click();
 await expect(presets.locator('.ops-r1-cue-transport button')).toHaveCount(2);
 await output.getByText(/Cara sambungkan/).click();
 await expect(output.getByText('OBS Browser Source dengan URL feed tidak berbagi sesi SOMA. Pakai Window Capture.')).toBeVisible();
 await choices.getByRole('button',{name:'TouchDesigner',exact:true}).click();
 await expect(output.getByRole('group',{name:'Koneksi TouchDesigner'})).toBeVisible();
 await expect(output.locator('.soma-td-route-steps .ops-r1-route-step')).toHaveCount(3);
 await expect(output.getByRole('button',{name:'Atur Koneksi'})).toBeVisible();
 await output.getByRole('button',{name:'Atur Koneksi'}).click();
 await expect(output.getByLabel('Alamat WebSocket TouchDesigner')).toBeVisible();
 await expect(output.getByLabel('Kode sesi TouchDesigner')).toBeVisible();
 await output.locator('.soma-td-help > summary').click();
 await expect(output.getByRole('link',{name:'Skrip Web Server'})).toBeVisible();
 await expect(output.getByRole('link',{name:'Skrip CHOP'})).toBeVisible();
 await choices.getByRole('button',{name:'SOMA Direct',exact:true}).click();
 await expect(output.getByRole('group',{name:'Koneksi TouchDesigner'})).toHaveCount(0);
 await expect(output.locator('.ops-r1-route-step')).toHaveCount(3);
});

test('Three destinations fit inside the Perform card on desktop and mobile',async({page})=>{
 await page.goto('./');
 await page.getByRole('button',{name:'Perform workspace'}).click();
 const measured=await page.locator('.ops-r1-route-toggle').evaluate(node=>{
  const tabs=[...node.querySelectorAll('button')].map(x=>x.getBoundingClientRect());
  const parent=node.getBoundingClientRect();
  return tabs.map(r=>({left:r.left,right:r.right,width:r.width,within:r.left>=parent.left-2&&r.right<=parent.right+2}));
 });
 expect(measured).toHaveLength(3);
 expect(measured.every(tab=>tab.width>50&&tab.within)).toBe(true);
});
