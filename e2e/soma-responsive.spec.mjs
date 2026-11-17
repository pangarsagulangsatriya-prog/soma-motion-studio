import {test,expect} from '@playwright/test';
import {mkdir} from 'node:fs/promises';

const rail=page=>page.locator('.soma-primary-sidebar');
const nav= (page,label)=>rail(page).locator('button[aria-label="'+label+'"]');
const tab=(page,label)=>page.locator('.fp-flow-local-tabs button').filter({hasText:label});
async function ready(page){
 await page.goto('/');
 await expect(page.locator('.fp-stage-workspace')).toBeVisible({timeout:25_000});
 await expect(page.locator('.fp-compact-transport .fp-transport-blackout')).toBeVisible();
}
async function screenshot(page,testInfo,suffix){
 await mkdir('e2e/artifacts',{recursive:true});
 await page.screenshot({path:'e2e/artifacts/'+testInfo.project.name+'-'+suffix+'.png',
  fullPage:true,animations:'disabled'});
}
async function noOverflow(page){
 const state=await page.evaluate(()=>({
  viewport:document.documentElement.clientWidth,
  content:document.documentElement.scrollWidth,
  body:document.body.scrollWidth
 }));
 expect(state.content,'page overflows horizontally: '+JSON.stringify(state))
  .toBeLessThanOrEqual(state.viewport+2);
}
test('responsive initial source screen, safety access, no horizontal overflow',async({page},testInfo)=>{
 await ready(page);
 const stage=page.locator('.fp-stage-workspace');
 await expect(stage).toHaveAttribute('data-screen','source');
 await expect(page.locator('.fp-source-launchpad')).toBeVisible();
 for(const label of ['Webcam laptop','Kamera HP','Video MP4','Simulasi 3D'])
  await expect(page.locator('.fp-source-launchpad').getByRole('button',{name:new RegExp(label,'i')})).toBeVisible();
 await expect(page.locator('.fp-stage-side-previews')).toBeHidden();
 await expect(page.locator('.fp-compact-transport .fp-transport-blackout')).toBeEnabled();
 await noOverflow(page);
 await screenshot(page,testInfo,'source');
});

test('local workflow inspector opens, keyboard enters, Escape restores focus',async({page},testInfo)=>{
 await ready(page);
 const tracking=tab(page,'Tracking');
 await tracking.click();
 await expect(page.locator('#fp-context-panel')).toBeVisible();
 await expect(page.locator('.fp-flow-inspector-head h2')).toContainText('Baca gerak kaki');
 await screenshot(page,testInfo,'tracking');
 await tracking.focus();
 await page.keyboard.press('ArrowDown');
 await expect(page.locator('.fp-flow-inspector-head button')).toBeFocused();
 await page.keyboard.press('Escape');
 await expect(page.locator('#fp-context-panel')).toHaveCount(0);
 await expect(tracking).toBeFocused();
 await tracking.click();
 await expect(page.locator('#fp-context-panel')).toBeVisible();
 await tracking.click();
 await expect(page.locator('#fp-context-panel')).toHaveCount(0);
 await noOverflow(page);
});

test('Footprints Visual → Projector → Footprints keeps software blackout accessible',async({page},testInfo)=>{
 await ready(page);
 let popups=0;
 page.on('popup',popup=>{popups++;void popup.close();});
 const visual=tab(page,'Visual & Archive');
 await visual.click();
 await expect(page.locator('.fp-flow-inspector-head')).toContainText('Atur bentuk');
 await expect(page.locator('.fp-compact-transport .fp-transport-blackout')).toBeVisible();
 // A Blackout command must remain directly clickable while editing.
 await page.locator('.fp-compact-transport .fp-transport-blackout').click();
 expect(popups).toBe(0);
 if(testInfo.project.name==='mobile-390'){
  await page.getByRole('button',{name:'Buka navigasi SOMA'}).click();
  await expect(rail(page)).toHaveAttribute('data-expanded','true');
 }
 await nav(page,'Projector').click();
 await expect(nav(page,'Projector')).toHaveAttribute('aria-current','page');
 await expect(page.locator('.soma-primary-header .v3-brand')).toContainText('PROJECTOR');
 expect(popups,'navigating to Projector must not open a physical output window').toBe(0);
 if(testInfo.project.name==='mobile-390')
  await page.getByRole('button',{name:'Buka navigasi SOMA'}).click();
 await nav(page,'Footprints').click();
 await expect(page.locator('.fp-stage-workspace')).toBeVisible();
 await expect(page.locator('.fp-compact-transport .fp-transport-blackout')).toBeVisible();
 await noOverflow(page);
});

test('Labs remains searchable and Escape restores focus without activating outputs',async({page},testInfo)=>{
 await ready(page);
 if(testInfo.project.name==='mobile-390')
  await page.getByRole('button',{name:'Buka navigasi SOMA'}).click();
 const labs=nav(page,'SOMA Labs');
 await labs.click();
 const dialog=page.locator('#soma-labs-panel');
 await expect(dialog).toBeVisible();
 const search=dialog.getByRole('searchbox',{name:'Cari modul SOMA Labs'});
 await expect(search).toBeFocused();
 await search.fill('siluet');
 await expect(dialog.getByRole('button',{name:/Siluet/})).toBeVisible();
 await expect(dialog.getByRole('button',{name:/Motion & Sound/})).toHaveCount(0);
 await screenshot(page,testInfo,'labs');
 await page.keyboard.press('Escape');
 await expect(dialog).toHaveCount(0);
 await expect(labs).toBeFocused();
 await noOverflow(page);
});

test('mobile rail can be dismissed with Escape; desktop rail remains non-modal',async({page},testInfo)=>{
 await ready(page);
 const toggle=page.locator('.soma-primary-header .soma-nav-toggle');
 if(testInfo.project.name==='mobile-390'){
  await toggle.click();
  await expect(rail(page)).toHaveAttribute('data-expanded','true');
  await expect(nav(page,'Footprints')).toBeFocused();
  await page.keyboard.press('Escape');
  await expect(rail(page)).toHaveAttribute('data-expanded','false');
  await expect(toggle).toBeFocused();
 }else{
  await toggle.click();
  await expect(rail(page)).toHaveAttribute('data-expanded','true');
  await expect(nav(page,'Footprints')).toBeVisible();
  await toggle.click();
  await expect(rail(page)).toHaveAttribute('data-expanded','false');
 }
 await noOverflow(page);
});

test('denied camera permission displays recoverable source error without projector output',async({page})=>{
 await page.addInitScript(()=>{
  Object.defineProperty(navigator.mediaDevices,'getUserMedia',{
   configurable:true,
   value:async()=>{throw new DOMException('Akses kamera ditolak untuk pengujian','NotAllowedError');}
  });
 });
 await ready(page);
 await page.locator('.fp-source-launchpad').getByRole('button',{name:/Webcam laptop/}).click();
 await expect(page.locator('.fp-stage-workspace')).toHaveAttribute('data-source-mode','recover',{timeout:25_000});
 await expect(page.locator('.fp-source-feedback-error')).toBeVisible();
 await expect(page.locator('.fp-compact-transport .fp-transport-blackout')).toBeEnabled();
 await expect(page.locator('.fp-stage-side-previews')).toBeHidden();
});
