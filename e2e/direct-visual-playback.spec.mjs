import {test,expect} from '@playwright/test';
import {selectStageSource} from './ia-ux-helpers.mjs';
test('SOMA Direct opens black, explicitly plays virtual artwork, and returns to blackout',async({page})=>{
 test.setTimeout(90000);
 await page.goto('/');
 await selectStageSource(page,'Simulasi 3D');
 await page.getByRole('button',{name:'Langkah kiri'}).click();
 await page.getByRole('button',{name:'Perform workspace'}).click();
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
  const data=ctx.getImageData(0,0,w,h).data;
  for(let y=0;y<h;y+=8)for(let x=0;x<w;x+=8){
   const k=(y*w+x)*4;if(data[k]+data[k+1]+data[k+2]>20)return true;
  }
  return false;
 }),{timeout:10000}).toBe(true);
 await page.getByRole('button',{name:'Kirim perintah blackout SOMA'}).click();
 await expect(output.locator('.ops-r1-destination-status')).not.toContainText('Playback aktif');
 await expect(artwork).toBeHidden({timeout:10000});
 await popup.close();
});
