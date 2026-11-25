import {test,expect} from '@playwright/test';
import {selectStageSource} from './ia-ux-helpers.mjs';
test('SOMA Direct opens black, explicitly plays virtual artwork, and returns to blackout',async({page})=>{
 test.setTimeout(90000);
 await page.goto('./');
 await selectStageSource(page,'Simulasi 3D');
 await page.getByRole('button',{name:'Langkah kiri'}).click();
 await page.getByLabel('Performer simulasi aktif').selectOption('B');
 await page.getByRole('button',{name:'Langkah kiri'}).click();
 const track=await page.locator('.fp-floor-legacy-canvas').elementHandle();
 await page.getByRole('button',{name:'Perform workspace'}).click();
 expect(await track.evaluate(canvas=>canvas.isConnected)).toBe(true);
 const output=page.getByRole('region',{name:'Tujuan output'});
 const cta=output.locator('.ops-r1-primary-cta');
 await expect(cta).toContainText('Buka Output',{timeout:20000});
 const popupPromise=page.waitForEvent('popup');
 await cta.click();
 const popup=await popupPromise;
 await expect(popup).toHaveURL(/stageSurface=floor/);
 expect(new URL(popup.url()).searchParams.has('feed')).toBe(false);
 await expect(cta).toContainText('Aktifkan Playback FLOOR',{timeout:20000});
 await expect(output.locator('.ops-r1-destination-status')).toContainText('Blackout');
 const resume=output.getByRole('button',{name:'Lanjutkan Visual'});
 if(await resume.isVisible())await resume.click();
 await cta.click();
 await expect(output.locator('.ops-r1-destination-status')).toContainText('Playback aktif',{timeout:20000});
 const artwork=popup.locator('canvas[aria-label="Output Footprints berwarna"]');
 await expect(artwork).toHaveCSS('display','block',{timeout:20000});
 await expect.poll(async()=>artwork.evaluate(canvas=>{
  const ctx=canvas.getContext('2d');if(!ctx)return false;
  const {width:w,height:h}=canvas;
  // First A/left landing on the 8 x 6 m rig: (2.81, 2.72) m.
  const x=Math.round(2.81/8*w),y=Math.round((1-2.72/6)*h);
  const stamp=ctx.getImageData(x-4,y-4,9,9).data;
  const mark=stamp.some((value,i)=>i%4!==3&&value>60);
  const sample=u=>Array.from(ctx.getImageData(Math.round(u*w),Math.round(.32*h),1,1).data);
  const bx=Math.round(4.61/8*w),by=Math.round((1-4.27/6)*h);
  const bStamp=ctx.getImageData(bx-4,by-4,9,9).data;
  const bMark=bStamp.some((value,i)=>i%4!==3&&value>60);
  return mark&&bMark&&sample(.20).every((value,i)=>i===3||value===0)&&
   sample(.202).every((value,i)=>i===3||value===0);
 }),{timeout:10000}).toBe(true);
 for(const key of ['b','Escape']){
  await popup.bringToFront();await popup.keyboard.press(key);
  await expect(artwork).toBeHidden();
  await expect(output.locator('.ops-r1-destination-status')).not.toContainText('Playback aktif');
  await expect(cta).toContainText('Aktifkan Playback FLOOR');
  await cta.click();await expect(artwork).toBeVisible();
  await expect(output.locator('.ops-r1-destination-status')).toContainText('Playback aktif');
 }
 await page.getByRole('button',{name:'Kirim perintah blackout SOMA'}).click();
 await expect(output.locator('.ops-r1-destination-status')).not.toContainText('Playback aktif');
 await expect(artwork).toBeHidden({timeout:10000});
 if(await resume.isVisible())await resume.click();
 await cta.click();await expect(artwork).toBeVisible();
 await popup.setViewportSize({width:880,height:600});
 await expect(artwork).toBeHidden();
 await expect(output.locator('.ops-r1-destination-status')).not.toContainText('Playback aktif');
 await popup.close();
});

test('MP4 decoded in Chromium can arm once, blanks on a seek, and requires a new action',async({page})=>{
 await page.goto('./');
 await selectStageSource(page,'Video MP4');
 await page.getByLabel('Pilih file video Footprints').setInputFiles(
  new URL('./fixtures/black-60s.mp4',import.meta.url).pathname
 );
 const player=page.locator('video[aria-label="Pemutar MP4 untuk Footprints"]');
 await expect.poll(()=>player.evaluate(v=>v.readyState>=2&&v.videoWidth===160)).toBe(true);
 await page.getByRole('button',{name:'Perform workspace'}).click();
 const output=page.getByRole('region',{name:'Tujuan output'});
 const cta=output.locator('.ops-r1-primary-cta');
 const pending=page.waitForEvent('popup');await cta.click();
 const popup=await pending;
 const artwork=popup.getByLabel('Output Footprints berwarna');
 await expect(artwork).toBeHidden();
 const resume=output.getByRole('button',{name:'Lanjutkan Visual'});
 if(await resume.isVisible())await resume.click();
 await expect(cta).toContainText('Aktifkan Playback FLOOR');
 await expect(cta).toBeEnabled();
 await cta.click();await expect(artwork).toBeVisible();
 const status=output.locator('.ops-r1-destination-status');
 await expect(status).toContainText('Playback aktif');
 const isBlack=await artwork.evaluate(canvas=>{
  const {data}=canvas.getContext('2d').getImageData(0,0,canvas.width,canvas.height);
  for(let i=0;i<data.length;i+=4)if(data[i]||data[i+1]||data[i+2])return false;
  return true;
 });
 expect(isBlack).toBe(true);
 await player.evaluate(v=>{v.pause();v.currentTime=12;});
 await expect.poll(()=>player.evaluate(v=>!v.seeking&&v.currentTime>=12)).toBe(true);
 await expect(artwork).toBeHidden();
 await expect(status).not.toContainText('Playback aktif');
 await expect(cta).toContainText('Aktifkan Playback FLOOR');
 if(await resume.isVisible())await resume.click();
 await expect(cta).toBeEnabled();
 await cta.click();await expect(status).toContainText('Playback aktif');
 await popup.reload();await expect(artwork).toBeHidden();
 await expect(status).not.toContainText('Playback aktif');
 await expect(cta).toContainText('Aktifkan Playback FLOOR');
 await popup.close();
});
