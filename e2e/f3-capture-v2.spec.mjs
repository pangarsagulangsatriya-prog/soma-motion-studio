import {test,expect} from '@playwright/test';
import {mkdirSync} from 'node:fs';
const screenshotDir='artifacts/f3-capture';
function hand(x,y,{pinch=false,fist=true}={}){
 const p=(x,y)=>({x,y,z:0,visibility:1});
 const a=Array.from({length:21},()=>p(x,y));
 a[0]=p(x,y);for(const i of [5,9,13,17])a[i]=p(x+.015,y-.04);
 for(const i of [8,12,16,20])a[i]=p(x+(fist?.018:.18),y+(fist?-.037:-.15));
 a[4]=pinch?p(a[8].x+.005,a[8].y):p(x-.11,y-.13);
 return a;
}
function frame(id,x=.7,y=.54,{pinch=false,resize=false,fist=true,fresh=true,otherX=.35}={}){
 const p=(x,y)=>({x,y,z:0,visibility:1});
 const pose=Array.from({length:33},()=>p(.5,.5));
 pose[11]=p(.4,.4);pose[12]=p(.6,.4);pose[13]=p(.34,.51);pose[14]=p(.68,.51);
 pose[15]=p(otherX,.54);pose[16]=p(x,y);
 const hands=resize?[hand(.35,.52,{pinch,fist:false}),hand(x,y,{fist:false})]:[hand(x,y,{pinch,fist})];
 return {frameId:id,timestamp:id*100,videoTime:id/15,pose,hands,confidence:1,fresh};
}
async function inject(page,...frames){
 return page.evaluate(frames=>{
  if(!window.__SOMA_F3_QA__)throw Error('DEV fixture-only QA harness missing');
  return frames.map(f=>window.__SOMA_F3_QA__.inject(f));
 },frames);
}
async function startFixtures(page){
 await page.goto('/?f3=1&f3qa=1');
 await expect(page.getByRole('button',{name:'F3 Capture'})).toHaveAttribute('aria-current','page');
 const details=page.locator('.f3-device-details');
 await details.locator('summary').click();
 const inputs=details.locator('input[type="file"]');
 await inputs.nth(0).setInputFiles('artifacts/f3-fixtures/actor-a.mp4');
 await inputs.nth(1).setInputFiles('artifacts/f3-fixtures/feet-b.mp4');
 await expect(page.getByRole('button',{name:'Coba Fullscreen'}).first()).toBeEnabled({timeout:20000});
 await expect(page.locator('.f3-pill[data-live="true"]')).toHaveCount(2);
 const ids=await page.evaluate(()=>window.__SOMA_F3_QA__.registry());
 expect(ids.A.id).not.toEqual(ids.B.id);
 expect(ids.A.kind).toEqual('fixture');expect(ids.B.kind).toEqual('fixture');
}
async function stageScreenshot(page,name,project){
 mkdirSync(screenshotDir,{recursive:true});
 await page.screenshot({path:`${screenshotDir}/${project}-${name}.png`,animations:'disabled'});
}
async function enterStage(page){
 await page.getByRole('button',{name:'Coba Fullscreen'}).first().click();
 const stage=page.locator('.f3-stage-shell');
 await expect(stage).toBeVisible();
 await expect.poll(()=>page.evaluate(()=>!!document.fullscreenElement)).toBe(true);
 const box=await stage.locator('canvas').boundingBox();
 expect(box).not.toBeNull();
 expect(Math.abs(box.width/box.height-2)).toBeLessThan(.03);
 await expect(page.getByRole('button',{name:'F3 Capture'})).not.toBeVisible();
 return stage;
}
test('F3 V2: Setup -> fullscreen 0/4, 2/4, 4/4; B-only pixels and Esc keep sources alive',async({page},testInfo)=>{
 if(!['laptop-1366','wide-1440'].includes(testInfo.project.name))test.skip();
 await startFixtures(page);
 await stageScreenshot(page,'setup',testInfo.project.name);
 const before=await page.locator('video[aria-label="Live video Kamera B"]').evaluate(v=>({src:v.src,time:v.currentTime}));
 await enterStage(page);
 await stageScreenshot(page,'fullscreen-0-of-4',testInfo.project.name);
 await page.keyboard.press('Escape');
 await expect.poll(()=>page.evaluate(()=>document.fullscreenElement===null)).toBe(true);
 const after=await page.locator('video[aria-label="Live video Kamera B"]').evaluate(v=>({src:v.src,time:v.currentTime}));
 expect(after.src).toBe(before.src);expect(after.time).toBeGreaterThanOrEqual(before.time);
 await page.locator('.f3-consent input[type="checkbox"]').check();
 for(let i=0;i<2;i++){
  await page.getByRole('button',{name:'Jepret manual'}).click();
  await expect(page.locator('.f3-operator-card').last().getByText(`${i+1}/4`)).toBeVisible();
 }
 await enterStage(page);
 await stageScreenshot(page,'fullscreen-2-of-4',testInfo.project.name);
 await page.keyboard.press('Escape');
 await page.getByRole('button',{name:'Mulai latihan'}).click();
 // Resize deliberately uses two hands; it must not add photographs.
 let count=await page.locator('.f3-slot img').count();
 await inject(page,frame(100,.65,.52,{resize:true,pinch:true}),frame(101,.9,.52,{resize:true,pinch:true}));
 await expect.poll(async()=>Number((await page.locator('.f3-b-card p').textContent()).match(/Crop (\d+)%/)?.[1]??60)).toBeLessThan(60);
 expect(await page.locator('.f3-slot img').count()).toBe(count);
 await inject(page,frame(102,.7,.54,{resize:true,pinch:false,fist:false}));
 await page.waitForTimeout(375);
 await inject(page,frame(103,.7,.54,{resize:true,pinch:false,fist:false}));
 await page.waitForTimeout(390);
 await inject(page,frame(200),frame(201,.90,.54));
 await expect(page.getByText(/Pukulan terbaca: 1/)).toBeVisible();
 await page.getByRole('button',{name:'Konfirmasi uji negatif'}).click();
 await page.getByRole('button',{name:'Verifikasi gestur'}).click();
 await page.waitForTimeout(900);
 await inject(page,frame(202));
 await page.getByRole('button',{name:'Arm',exact:true}).click();
 await inject(page,frame(203),frame(204,.9,.54));
 await expect(page.locator('.f3-slot img')).toHaveCount(3);
 await page.waitForTimeout(900);
 await inject(page,frame(205));
 await inject(page,frame(206),frame(207,.9,.54));
 await expect(page.locator('.f3-slot img')).toHaveCount(4);
 await expect(page.getByRole('button',{name:'Jepret manual'})).toBeDisabled();
 await enterStage(page);
 await stageScreenshot(page,'fullscreen-4-of-4',testInfo.project.name);
 await page.keyboard.press('Escape');
 await expect.poll(()=>page.evaluate(()=>document.fullscreenElement===null)).toBe(true);
 const end=await page.evaluate(()=>window.__SOMA_F3_QA__.registry());
 expect(end.A.state).toBe('live');expect(end.B.state).toBe('live');
});
