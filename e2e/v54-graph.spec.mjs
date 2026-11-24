import {test,expect} from '@playwright/test';
test('V5.4 exact cue dimming, group title, hand pan and layout undo',async({page})=>{
 await page.goto('/?workspace=nodes-v54');await expect(page.locator('.soma-signal')).toHaveAttribute('data-version','5.4');
 await expect(page.locator('[data-group]')).toHaveCount(4);
 await expect(page.locator('[data-node="archive"]')).toHaveClass(/is-muted/);
 await expect(page.locator('[data-node="foot"]')).toHaveClass(/is-planned/);
 await page.getByRole('button',{name:'F2 Arsip',exact:true}).click();
 await expect(page.locator('[data-node="foot"]')).toHaveClass(/is-muted/);
 await expect(page.locator('[data-edge="edge-06"] path').first()).toHaveClass(/muted/);
 await expect(page.locator('[data-edge="edge-12"] path').first()).toHaveClass(/planned/);
 const name=page.getByRole('button',{name:'Group Process',exact:true});await name.dblclick();
 await page.getByLabel('Rename Process').fill('Visual engines');await page.getByLabel('Rename Process').press('Enter');
 await expect(page.getByRole('button',{name:'Group Visual engines',exact:true})).toBeVisible();
 const foot=page.locator('[data-node="foot"]');const left=await foot.evaluate(n=>n.style.left);
 await page.getByRole('button',{name:'Hand tool',exact:true}).click();const b=await foot.locator('.sw-node-title').boundingBox();await page.mouse.move(b.x+b.width/2,b.y+b.height/2);await page.mouse.down();await page.mouse.move(b.x+b.width/2+60,b.y+b.height/2+30,{steps:5});await page.mouse.up();expect(await foot.evaluate(n=>n.style.left)).toBe(left);await expect(page.locator('.adaptive-inspector')).toBeHidden();
 await page.getByRole('button',{name:'Select tool',exact:true}).click();await page.getByRole('button',{name:'Fit graph'}).click();const group=await page.getByRole('button',{name:'Group Visual engines',exact:true}).boundingBox();await page.mouse.move(group.x+group.width/2,group.y+group.height/2);await page.mouse.down();await page.mouse.move(group.x+group.width/2+35,group.y+group.height/2+40,{steps:5});await page.mouse.up();await expect.poll(()=>foot.evaluate(n=>n.style.left)).not.toBe(left);
 await page.getByRole('button',{name:'Undo layout',exact:true}).click();await expect.poll(()=>foot.evaluate(n=>n.style.left)).toBe(left);
 await page.getByRole('button',{name:'Note Visual engines',exact:true}).click();await page.getByLabel('Note text Visual engines').fill('Floor and canvas');await page.locator('.v54-note-editor').getByRole('button',{name:'Save'}).click();
 await expect(page.locator('.v54-note')).toHaveText('Floor and canvas');await expect.poll(()=>page.evaluate(()=>JSON.parse(localStorage.getItem('soma.graph-view.v1')||'{}').groups?.process?.note)).toBe('Floor and canvas');
 await page.reload();await page.getByRole('button',{name:'Fit graph'}).click();await expect(page.getByRole('button',{name:'Group Visual engines',exact:true})).toBeVisible();await expect(page.locator('.v54-note')).toHaveText('Floor and canvas');
});
test('V5.4 actual archive output continues when next cue changes; Escape remains blackout',async({page})=>{
 await page.goto('/?workspace=nodes-v54');
 await page.locator('[data-node="archive"] .sw-node-title').dblclick();
 await page.locator('.adaptive-inspector input[type=file]').setInputFiles({name:'red.svg',mimeType:'image/svg+xml',buffer:Buffer.from('<svg xmlns="http://www.w3.org/2000/svg" width="1600" height="900"><rect width="1600" height="900" fill="#d02020"/></svg>')});
 await page.getByRole('button',{name:'F2 Arsip',exact:true}).click();await expect(page.getByRole('button',{name:'GO',exact:true})).toBeEnabled();await page.getByRole('button',{name:'GO',exact:true}).click();
 const pixel=()=>page.locator('[data-surface="canvas"] canvas').evaluate(c=>c.getContext('2d').getImageData(800,450,1,1).data[0]);await expect.poll(pixel).toBeGreaterThan(170);
 await page.getByRole('button',{name:'Close inspector',exact:true}).click();await page.getByRole('button',{name:'F1 Jejak',exact:true}).click();await expect(page.locator('.sw-current b')).toHaveText('F2');await expect(page.locator('[data-node="archive"]')).toHaveClass(/is-running/);await expect(page.locator('[data-edge="edge-12"] path').first()).toHaveClass(/running/);await expect.poll(pixel).toBeGreaterThan(170);await page.keyboard.press('Escape');await expect.poll(pixel).toBe(0);
});

test('V5.4 collapses view only, preserves external wire ids and restores nodes',async({page})=>{
 await page.goto('/?workspace=nodes-v54');await page.getByRole('button',{name:'Collapse Process',exact:true}).click();
 await expect(page.locator('[data-node="foot"]')).toHaveCount(0);await expect(page.locator('[data-edge="edge-06"] path').first()).toBeAttached();
 await expect(page.locator('[data-proxy]').first()).toBeAttached();
 await page.getByRole('button',{name:'Expand Process',exact:true}).click();await expect(page.locator('[data-node="foot"]')).toBeAttached();
 await page.locator('[data-node="foot"] .sw-node-title').click();await page.locator('[data-node="trace"] .sw-node-title').click({modifiers:['Shift']});
 await expect(page.locator('[data-node="foot"]')).toHaveClass(/is-selected/);await expect(page.locator('[data-node="trace"]')).toHaveClass(/is-selected/);
 await page.getByRole('button',{name:'Snap to grid',exact:true}).click();await expect(page.getByRole('button',{name:'Snap to grid',exact:true})).toHaveAttribute('aria-pressed','true');
});