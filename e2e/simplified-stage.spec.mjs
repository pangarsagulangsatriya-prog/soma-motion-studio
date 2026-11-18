import {selectStageSource,openStageMap} from './ia-ux-helpers.mjs';
import {test,expect} from '@playwright/test';

async function selectSource(page,name){
 await selectStageSource(page,name);
 await expect(page.locator('.soma-uxr1-source > summary')).toContainText(name);
}

test('S6.8.7 one source switcher and no beginner observation in production',async({page})=>{
 await page.goto('/');
 const stage=page.locator('.fp-stage-workspace');
 await expect(stage).toBeVisible();
 await expect(page.locator('.soma-uxr1-source > summary')).toHaveCount(1);
 await expect(page.getByRole('button',{name:'Uji Pemula'})).toHaveCount(0);
 await expect(page.locator('#fp-beginner-usability')).toHaveCount(0);
 await expect(page.locator('.fp-compact-status')).toHaveCount(0);
 await expect(page.locator('.fp-flow-local-tabs')).toHaveCount(0);
 await expect(page.locator('.soma-primary-nav-list .soma-primary-destination')).toHaveCount(1);
 await expect(page.locator('.soma-stage-module-nav .soma-stage-module-tab')).toHaveCount(4);
 await expect(stage).toHaveAttribute('data-inspector-open','false');

 await page.locator('.soma-uxr1-source > summary').click();
 const choices=page.locator('.soma-uxr1-source-menu button');
 await expect(choices).toHaveCount(4);
 await expect(page.locator('.soma-uxr1-source-menu')).not.toContainText('Pengaturan jejak dan arsip tetap tersimpan');
 await page.locator('.soma-uxr1-source > summary').click();
 await expect(page.locator('.soma-uxr1-source')).not.toHaveAttribute('open','');
});

test('S6.8.7 video hides advanced config and prioritizes previews',async({page})=>{
 await page.goto('/');
 await selectSource(page,'Video MP4');
 const stage=page.locator('.fp-stage-workspace');
 await expect(stage).toHaveAttribute('data-experimental','true');
 await expect(stage).toHaveAttribute('data-inspector-open','false');
 await expect(page.locator('.fp-inline-assistant')).toHaveCount(0);
 await expect(page.locator('.fp-experiment-dock')).toBeVisible();
 await expect(page.locator('.fp-experiment-intro')).toHaveCount(0);
 await expect(page.locator('.fp-preview-body')).toBeVisible();
 await expect(page.locator('.fp-preview-floor')).toBeVisible();
 await expect(page.locator('.fp-experiment-advanced-details')).toHaveCount(0);
 await expect(page.locator('.fp-d4-performance')).toHaveCount(0);
 await expect(page.getByRole('button',{name:/Buka Video Motion Lab/})).toHaveCount(0);
 const style=await page.locator('.fp-experiment-dock').evaluate(el=>getComputedStyle(el).flexDirection);
 expect(style).toBe('row');

 const preview=await page.locator('.fp-stage-side-previews').boundingBox();
 const camera=await page.locator('.fp-stage-video').boundingBox();
 expect(preview).not.toBeNull();
 expect(camera).not.toBeNull();
 // Above 1050px, the split stage uses two columns. At tablet/mobile
 // widths BODY/FLOOR and camera stack in one full-width column.
 if((page.viewportSize()?.width??0)>1050)
  expect(preview.width).toBeGreaterThan(camera.width*1.7);
 else
  expect(Math.abs(preview.width-camera.width)).toBeLessThan(4);
 // Clicking Tracking in MP4 mode must NOT introduce a second setup flow.
 await page.getByRole('button',{name:'Track',exact:true}).click();
 await expect(stage).toHaveAttribute('data-inspector-open','false');
 await expect(page.locator('.fp-preview-floor')).toBeVisible();
});

test('S6.8.7 source switch preserves input and locked physical output',async({page})=>{
 await page.goto('/');
 await selectSource(page,'Simulasi 3D');
 await expect(page.locator('.fp-stage-workspace')).toHaveAttribute('data-inspector-open','false');
 await expect(page.locator('.fp-experiment-advanced-details')).not.toHaveAttribute('open','');
 await page.locator('.fp-experiment-advanced-details summary').click();
 await expect(page.getByRole('button',{name:/Buka Simulator 3D lengkap/})).toBeVisible();
 await selectSource(page,'Video MP4');
 await expect(page.locator('.fp-stage-workspace')).toHaveAttribute('data-inspector-open','false');
 await expect(page.locator('.fp-stage-video .fp-stage-surface-foot')).toContainText('OUTPUT FISIK TERKUNCI');
 await openStageMap(page);
 await expect(page.locator('.stage-dual')).toContainText('Dua output fisik terkunci');
 await expect(page.locator('.stage-dual').getByRole('button',{name:'Buka output'})).toHaveCount(2);
 for(const button of await page.locator('.stage-dual').getByRole('button',{name:'Buka output'}).all())
  await expect(button).toBeDisabled();
});

test('IA-R1: shared source crosses all four workspaces with one active selection',async({page})=>{
 await page.goto('/');
 const stage=page.locator('.fp-stage-workspace');
 const modules=page.locator('.soma-primary-nav-list .soma-primary-destination');
 const workspaces=page.locator('.soma-stage-module-nav .soma-stage-module-tab');
 await expect(modules).toHaveCount(1);
 await expect(modules.first()).toHaveAttribute('aria-label','Stage 1');
 await expect(workspaces).toHaveCount(4);
 await expect(stage).toHaveAttribute('data-workspace','track');

 await selectSource(page,'Simulasi 3D');
 await expect(stage).toHaveAttribute('data-experimental','true');
 await expect(stage).toHaveAttribute('data-workspace','track');

 await page.getByRole('button',{name:'Compose',exact:true}).click();
 await expect(stage).toHaveAttribute('data-workspace','compose');
 await expect(page.locator('.s64-root')).toBeVisible();
 await expect(page.locator('.uxr3-scene-card')).toHaveCount(14);
 await expect(page.locator('.soma-uxr1-source > summary')).toContainText('Simulasi 3D');

 await openStageMap(page);
 await expect(stage).toHaveAttribute('data-workspace','map');
 await expect(page.locator('.map-r1-workspace')).toBeVisible();
 const panel=page.locator('.stage-dual');
 await expect(panel).toContainText('Dua output fisik terkunci');
 for(const button of await panel.getByRole('button',{name:'Buka output'}).all())
  await expect(button).toBeDisabled();

 await page.getByRole('button',{name:'Perform',exact:true}).click();
 await expect(stage).toHaveAttribute('data-workspace','perform');
 await expect(page.locator('.ops-r1-cue-grid')).toBeVisible();
 await expect(page.locator('.ops-r1-slot')).toHaveCount(8);
 await expect(page.locator('.ops-r1-status')).toContainText('simulator');

 await page.getByRole('button',{name:'Kembali Build'}).click();
 await expect(stage).toHaveAttribute('data-workspace','compose');
 await expect(page.locator('.s64-root')).toBeVisible();
 await expect(page.locator('.soma-uxr1-source > summary')).toContainText('Simulasi 3D');
});

test('IA-R1: global blackout remains latched across Track / Compose until manual Resume',async({page})=>{
 await page.goto('/');
 await selectSource(page,'Simulasi 3D');
 await page.getByRole('button',{name:'Compose',exact:true}).click();
 const stage=page.locator('.fp-stage-workspace');
 await expect(stage).toHaveAttribute('data-workspace','compose');

 await page.getByRole('button',{name:'Kirim perintah blackout SOMA'}).click();
 const preview=page.locator('.s64-safety input[type=checkbox]').first();
 await expect(preview).not.toBeChecked();
 await expect(preview).toBeDisabled();

 await page.getByRole('button',{name:'Track',exact:true}).click();
 await expect(stage).toHaveAttribute('data-workspace','track');
 await page.getByRole('button',{name:'Compose',exact:true}).click();
 await expect(stage).toHaveAttribute('data-workspace','compose');
 await expect(page.locator('.s64-safety input[type=checkbox]').first()).toBeDisabled();

 await page.getByRole('button',{name:'Resume preview',exact:true}).click();
 await expect(page.locator('.s64-safety input[type=checkbox]').first()).toBeEnabled();
 await expect(page.locator('.s64-safety input[type=checkbox]').first()).toBeChecked();
});

test('Stage 1 recovery: SOURCE menu opens visibly below the header and switches to MP4',async({page})=>{
 await page.goto('/');
 const trigger=page.locator('.soma-uxr1-source > summary');
 const menu=page.locator('.soma-uxr1-source-menu');
 await expect(trigger).toBeVisible();
 await expect(menu).toBeHidden();
 await trigger.click();
 await expect(menu).toBeVisible();
 const rect=await menu.boundingBox();
 const headerRect=await page.locator('.soma-primary-header').boundingBox();
 expect(rect).not.toBeNull();
 expect(headerRect).not.toBeNull();
 expect(rect.y).toBeGreaterThanOrEqual(headerRect.y+headerRect.height-5);
 const video=menu.getByRole('button',{name:/Video MP4/});
 await expect(video).toBeVisible();
 await video.click();
 await expect(page.locator('.fp-stage-workspace')).toHaveAttribute('data-stage-source','video');
 await expect(page.locator('.soma-uxr1-source > summary')).toContainText('Video MP4');
 await expect(menu).toBeHidden();
});

test('Stage 1 recovery: four direct source actions replace empty HOLD panes',async({page})=>{
 await page.goto('/');
 const stage=page.locator('.fp-stage-workspace');
 await expect(stage).toHaveAttribute('data-stage-source','none');
 await expect(page.locator('.soma-ia-source-setup')).toBeVisible();
 await expect(page.locator('.soma-ia-source-options button')).toHaveCount(4);
 await expect(page.locator('.fp-stage-layout')).toBeHidden();
 await expect(page.locator('.fp-stage-hold-label')).toHaveCount(0);
 await page.getByRole('button',{name:'Gunakan Simulasi 3D'}).click();
 await expect(stage).toHaveAttribute('data-stage-source','simulator');
 await expect(page.locator('.fp-stage-layout')).toBeVisible();
 await expect(page.locator('.fp-stage-video .fp-stage-surface-head')).toContainText('PUPPET 3D');
});
