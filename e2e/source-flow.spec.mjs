import {selectStageSource,openStageMap} from './ia-ux-helpers.mjs';
import {test,expect} from '@playwright/test';

test.setTimeout(90_000);
const stage=page=>page.locator('.fp-stage-workspace');
const sourceMenu=page=>page.locator('.soma-ux01-source-switch > summary');
async function choose(page,label,id){
 await selectStageSource(page,label);
 await expect(stage(page)).toHaveAttribute('data-stage-source',id);
}

test('Camera E2E: Mac device and phone are separate input routes',async({page,context})=>{
 await context.grantPermissions(['camera'],{origin:'http://127.0.0.1:4173'});
 await page.goto('./');
 await expect(sourceMenu(page)).toBeVisible();
 await choose(page,'Kamera lain','webcam');
 await expect(page.locator('.soma-track-mac-camera')).toBeVisible();
 await expect(page.locator('#soma-track-mac-device')).toBeVisible();
 await expect(page.locator('.soma-track-phone-pairing')).not.toBeVisible();

 await choose(page,'Kamera HP','phone');
 await expect(page.locator('.soma-track-phone-pairing')).toBeVisible();
 await expect(page.getByRole('button',{name:'Kamera HP lewat kabel'})).toBeVisible();
 await expect(page.getByRole('button',{name:'Kamera HP nirkabel'})).toBeVisible();
 await expect(page.locator('.soma-track-mac-camera')).toHaveCount(0);
 // Phone capture is only opened by an explicit user action; device labels
 // alone do not prove iPhone/Android hardware exists.
 await expect(page.locator('.soma-usb-primary')).toBeVisible();
});

test('Camera E2E: wireless route exposes code fallback on static-compatible UI',async({page})=>{
 await page.goto('./');
 await choose(page,'Kamera HP','phone');
 await page.getByRole('button',{name:'Kamera HP nirkabel'}).click();
 await expect(page.locator('.soma-auto-pair')).toBeVisible();
 // Local browser QA runs under Vite: no server-side Redis is configured.
 // The fallback is explicit rather than a false claim of automatic connection.
 const manual=page.getByRole('button',{name:'Kode manual'});
 await expect(manual).toBeVisible();
 await manual.click();
 await expect(page.locator('.soma-manual-pair')).toBeVisible();
 await expect(page.getByRole('button',{name:'Kembali ke QR'})).toBeVisible();
});

test('Source E2E: MP4 and simulator enter Perform with source-specific QA',async({page})=>{
 await page.goto('./');
 await choose(page,'Video MP4','video');
 await expect(stage(page)).toHaveAttribute('data-experimental','true');
 await openStageMap(page);
 await expect(stage(page)).toHaveAttribute('data-workspace','map');
 await page.getByRole('button',{name:'Perform workspace'}).click();
 await expect(stage(page)).toHaveAttribute('data-workspace','perform');
 await expect(page.locator('.ops-r1-output-card')).toBeVisible();
 await expect(page.locator('.ops-r1-destination-status')).toContainText('Perlu setup');
 await expect(page.locator('.ops-r1-primary-cta')).toBeVisible();
 await page.locator('.ops-r1-output-details summary').click();
 const openButtons=page.locator('.ops-r1-channel-btns button');
 await expect(openButtons).toHaveCount(2);
 for(const button of await openButtons.all())await expect(button).toBeEnabled();
 await page.getByRole('button',{name:'Track workspace'}).click();
 await choose(page,'Simulasi 3D','simulator');
 await expect(stage(page)).toHaveAttribute('data-experimental','true');
});

test('Stage E2E: four workspaces keep one camera source and one session',async({page})=>{
 await page.goto('./');
 await expect(page.locator('.soma-stage-module-nav .soma-stage-module-tab')).toHaveCount(4);
 for(const name of ['Track','Compose','Map','Perform'])
  await expect(page.getByRole('button',{name:name+' workspace'})).toBeVisible();
 await choose(page,'Simulasi 3D','simulator');
 await page.getByRole('button',{name:'Compose workspace'}).click();
 await expect(stage(page)).toHaveAttribute('data-workspace','compose');
 await expect(stage(page)).toHaveAttribute('data-stage-source','simulator');
 await expect(page.locator('.s64-root')).toBeVisible();
 await page.getByRole('button',{name:'Map workspace'}).click();
 await expect(stage(page)).toHaveAttribute('data-workspace','map');
 await expect(stage(page)).toHaveAttribute('data-stage-source','simulator');
 await page.getByRole('button',{name:'Perform workspace'}).click();
 await expect(stage(page)).toHaveAttribute('data-workspace','perform');
 await expect(stage(page)).toHaveAttribute('data-stage-source','simulator');
 await expect(page.locator('.ops-r1-cue-grid')).toBeVisible();
 await page.getByRole('button',{name:'Track workspace'}).click();
 await expect(stage(page)).toHaveAttribute('data-workspace','track');
 await expect(sourceMenu(page)).toContainText('Simulasi 3D');
});

test('Resolume Clean Feed opens the proper receiver, never silently reuses SOMA Direct',async({page})=>{
 await page.goto('./');
 await choose(page,'Simulasi 3D','simulator');
 await page.getByRole('button',{name:'Langkah kiri'}).click();
 await page.getByRole('button',{name:'Perform workspace'}).click();
 await expect(page.getByRole('group',{name:'Jalur Output Perform'}).getByRole('button')).toHaveCount(3);
 await page.getByRole('button',{name:'Resolume',exact:true}).click();
 await expect(page.getByRole('button',{name:'Buka Feed FLOOR'})).toBeVisible();
 await expect(page.locator('.ops-r1-bridge-guide')).toBeVisible();
 await page.locator('.ops-r1-bridge-guide summary').click();
 await expect(page.locator('.ops-r1-bridge-steps')).toBeVisible();
 await expect(page.locator('.ops-r1-bridge-links a')).toHaveCount(1); // Headless Linux: no platform plugin guessed
 const popupPromise=page.waitForEvent('popup');
 await page.locator('.ops-r1-primary-cta').click();
 const popup=await popupPromise;
 await expect(popup).toHaveURL(/stageSurface=floor/);
 await expect(popup).toHaveURL(/feed=resolume/);
 await expect(popup.locator('canvas[aria-label="Output Footprints berwarna"]')).toHaveCount(1);
 // A connected popup alone is insufficient: require an ACK and visible canvas.
 await expect(page.locator('.ops-r1-destination-status')).toContainText('Feed SOMA aktif',{timeout:20000});
 const artwork=popup.locator('canvas[aria-label="Output Footprints berwarna"]');
 await expect(artwork).toHaveCSS('display','block',{timeout:20000});
 const raster=await artwork.evaluate(canvas=>{
  const ctx=canvas.getContext('2d',{willReadFrequently:true});
  if(!ctx)return {ok:false,width:0,height:0};
  const w=canvas.width,h=canvas.height;
  const data=ctx.getImageData(0,0,w,h).data;
  let nonBlack=0;
  for(let y=0;y<h;y+=32)for(let x=0;x<w;x+=32){
   const index=(y*w+x)*4;
   if(data[index]+data[index+1]+data[index+2]>12)nonBlack++;
  }
  return {ok:nonBlack>0,width:w,height:h};
 });
 expect(raster.width).toBeGreaterThanOrEqual(640);
 expect(raster.ok).toBe(true);
 await page.getByRole('button',{name:'SOMA Direct',exact:true}).click();
 await expect(page.locator('.ops-r1-destination-status')).not.toContainText('Feed SOMA aktif');
});
