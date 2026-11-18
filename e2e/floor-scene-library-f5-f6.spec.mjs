import {test,expect} from '@playwright/test';
const catalogue=[
 'Snowfall','Christmas','Hanukkah','Spring Garden','Fall Leaves',
 'The Swarm','Ectoplasmic Fog','Ground Smoke','Cursed Fluid',
 'Living Water','Fireworks','Pool Splash','Fireflies'
];
test('F5: thirteen named procedural scenes render without restarting source',async({page})=>{
 await page.goto('/');
 const floor=page.locator('.fp-preview-floor');
 await expect(floor).toBeVisible();
 const picker=floor.getByRole('combobox',{name:'Pilih scene FLOOR'});
 const options=await picker.locator('option').allTextContents();
 for(const name of catalogue)expect(options).toContain(name);
 await floor.locator('.fp-floor-touch-toggle').click();
 await expect(floor.locator('.fp-floor-touch-toggle')).toHaveAttribute('aria-pressed','true');
 const originalSource=await page.locator('.fp-stage-video .fp-stage-surface-head').innerText();
 for(const id of [
  'christmas','hanukkah','spring-garden','fall-leaves','the-swarm',
  'ectoplasmic-fog','ground-smoke','cursed-fluid','living-water',
  'fireworks','pool-splash','fireflies'
 ]){
  await picker.selectOption(id);
  await expect(floor).toHaveAttribute('data-procedural','true');
  await expect(floor.locator('.fp-floor-procedural-canvas')).toBeVisible();
  await expect.poll(async()=>floor.locator('.fp-floor-procedural-canvas').evaluate(canvas=>{
   const ctx=canvas.getContext('2d');
   if(!ctx)return 0;
   const data=ctx.getImageData(640,360,2,2).data;
   return data[0]+data[1]+data[2]+data[3];
  })).toBeGreaterThan(255);
  expect(await page.locator('.fp-stage-video .fp-stage-surface-head').innerText())
   .toEqual(originalSource);
 }
 await picker.selectOption('snowfall');
 await expect(floor.locator('.fp-floor-snowfall-canvas')).toBeVisible();
 await picker.selectOption('footprints');
 await expect(floor.locator('.fp-floor-legacy-canvas')).toBeVisible();
});
test('F5: fireworks contact once, new scenes keep input active and presets survive reload',async({page})=>{
 await page.goto('/');
 const floor=page.locator('.fp-preview-floor');
 const picker=floor.getByRole('combobox',{name:'Pilih scene FLOOR'});
 await floor.locator('.fp-floor-touch-toggle').click();
 await picker.selectOption('fireworks');
 const area=floor.locator('.fp-stage-canvas-area');
 const bound=await area.boundingBox();
 expect(bound).not.toBeNull();
 await area.click({position:{x:bound.width*.32,y:bound.height*.4}});
 await expect(floor.locator('.fp-snowfall-counter')).toContainText('1 kontak');
 await page.waitForTimeout(600);
 await expect(floor.locator('.fp-snowfall-counter')).toContainText('1 kontak');
 await floor.locator('.fp-scene-advanced summary').click();
 await expect(floor.getByRole('combobox',{name:'Sumber audio scene FLOOR'})).toHaveValue('off');
 await floor.getByRole('textbox',{name:'Nama preset FLOOR'}).fill('Fireworks Test');
 await floor.getByRole('button',{name:'Simpan preset'}).click();
 await expect(floor.getByRole('combobox',{name:'Preset scene FLOOR'})).toContainText('Fireworks Test');
 await picker.selectOption('living-water');
 await floor.getByRole('combobox',{name:'Preset scene FLOOR'}).selectOption('saved:0');
 await expect(picker).toHaveValue('fireworks');
 await page.reload();
 const reloaded=page.locator('.fp-preview-floor');
 await reloaded.locator('.fp-scene-advanced summary').click();
 await expect(reloaded.getByRole('combobox',{name:'Preset scene FLOOR'}))
  .toContainText('Fireworks Test');
});
test('F6: audio opt-in defaults OFF, SOMA analyser reuse never creates contact',async({page})=>{
 await page.goto('/');
 const floor=page.locator('.fp-preview-floor');
 await floor.getByRole('combobox',{name:'Pilih scene FLOOR'}).selectOption('fireflies');
 await floor.locator('.fp-scene-advanced summary').click();
 const audio=floor.getByRole('combobox',{name:'Sumber audio scene FLOOR'});
 await expect(audio).toHaveValue('off');
 await audio.selectOption('soma');
 await expect(audio).toHaveValue('soma');
 await expect(floor.locator('.fp-scene-audio-level')).toContainText('Audio SOMA');
 await expect(floor.locator('.fp-snowfall-counter')).toContainText('0 kontak');
 await audio.selectOption('off');
 await expect(audio).toHaveValue('off');
 await expect(floor.locator('.fp-scene-audio-level')).toContainText('Off');
 // The pinned Chromium runner uses a fake, permission-approved media device.
 // Switching back to Footprints must stop the mic and reset the source.
 await audio.selectOption('microphone');
 await expect(audio).toHaveValue('microphone');
 await expect(floor.locator('.fp-scene-audio-level')).toContainText('Mikrofon lokal');
 await floor.getByRole('combobox',{name:'Pilih scene FLOOR'}).selectOption('footprints');
 await floor.getByRole('combobox',{name:'Pilih scene FLOOR'}).selectOption('fireflies');
 await floor.locator('.fp-scene-advanced summary').click();
 await expect(floor.getByRole('combobox',{name:'Sumber audio scene FLOOR'})).toHaveValue('off');
});
