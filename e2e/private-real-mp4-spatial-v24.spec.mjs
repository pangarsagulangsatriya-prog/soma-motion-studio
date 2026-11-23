import {test,expect} from '@playwright/test';
import {readFile} from 'node:fs/promises';
import {createHash} from 'node:crypto';
import {selectStageSource} from './ia-ux-helpers.mjs';

/** Optional PRIVATE benchmark. User's MP4 stays on the local QA machine.
 * Run: SOMA_V24_PRIVATE_MP4=/absolute/video.mp4 npx playwright test \
 *   -c e2e/playwright.config.mjs --project=wide-1440 private-real-mp4-spatial-v24.spec.mjs
 * Standard CI skips this file: neither the video nor face screenshots
 * are committed or uploaded automatically.
 */
test('SP24-07 PRIVATE real MP4: end-to-end pose, A/B trace export and screenshots',async({page})=>{
 test.skip(!process.env.SOMA_V24_PRIVATE_MP4,
  'Real MP4 file is private and not part of the public repository');
 test.setTimeout(120000);
 const file=process.env.SOMA_V24_PRIVATE_MP4;
 const video=await readFile(file);
 const sha=createHash('sha256').update(video).digest('hex');
 if(process.env.SOMA_V24_PRIVATE_MP4_SHA)
  expect(sha).toBe(process.env.SOMA_V24_PRIVATE_MP4_SHA);
 await page.goto('/');
 await selectStageSource(page,'Video MP4');
 await page.getByLabel('Pilih file video Footprints').setInputFiles(file);
 await expect(page.getByRole('button',{name:'Putar video'})).toBeEnabled({timeout:30000});
 await page.getByRole('button',{name:'Compose workspace'}).click();
 const monitor=page.locator('#soma-compose-monitor');
 await monitor.locator('button.lt-beta-trigger').click();
 await page.getByRole('group',{name:'Engine lukisan'})
  .getByRole('button',{name:'Dual Trace V2 · Gabung'}).click();
 const panel=page.getByRole('region',{name:'Kontrol Dual Trace V2'});
 await panel.getByText('Sapuan & gestur').click();
 await panel.getByLabel('Karakter tinta').selectOption('rough-sumi');
 await panel.getByText('Tracking jalur · V2.2').click();
 await panel.getByRole('checkbox',{name:/Spatial V2.4/}).check();
 // Return to Track for playback, then Compose keeps receiving its source.
 await page.getByRole('button',{name:'Track workspace'}).click();
 await page.getByRole('button',{name:'Putar video'}).click();
 await page.getByRole('button',{name:'Compose workspace'}).click();
 await page.waitForTimeout(4300);
 await monitor.screenshot({path:'e2e/test-results/v24-private-mp4-t4.png'});
 await page.waitForTimeout(4200);
 await monitor.screenshot({path:'e2e/test-results/v24-private-mp4-t8.png'});
 await page.waitForTimeout(6500);
 await monitor.screenshot({path:'e2e/test-results/v24-private-mp4-t14.png'});
 const download=page.waitForEvent('download');
 await panel.getByRole('button',{name:'Ekspor posisi A/B · JSON'}).click();
 const fileDownload=await download;
 const json=JSON.parse(await readFile(await fileDownload.path(),'utf-8'));
 expect(json.schema).toBe('soma.spatial-v24-motion-trace');
 const a=json.samples.filter(x=>x.actorId==='A'),b=json.samples.filter(x=>x.actorId==='B');
 expect(a.length).toBeGreaterThan(8);
 expect(b.length).toBeGreaterThan(8);
 const extent=values=>values.length?Math.max(...values)-Math.min(...values):0;
 const report={
  videoSha256:sha,framesA:a.length,framesB:b.length,
  spanX_A:extent(a.map(x=>x.smoothed?.x).filter(Number.isFinite)),
  spanX_B:extent(b.map(x=>x.smoothed?.x).filter(Number.isFinite)),
  coordinateBasis:[...new Set(json.samples.map(x=>x.coordinateBasis))],
  warning:'Requires human foot-ground annotation before any accuracy claim.'
 };
 await test.info().attach('local spatial QA report',{
  body:JSON.stringify(report,null,2),contentType:'application/json'
 });
});
