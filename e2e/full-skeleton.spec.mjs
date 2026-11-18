import {test,expect} from '@playwright/test';

async function selectSource(page,name){
 await page.locator('.fp-source-switch-trigger').click();
 await page.locator('.fp-source-switch-option').filter({hasText:name}).click();
 await expect(page.locator('.fp-source-switch-trigger')).toContainText(name);
}

test('S6.8.8.1 MP4 full skeleton visible by default, isolated from output',async({page})=>{
 await page.goto('/');
 const stage=page.locator('.fp-stage-workspace');
 await expect(stage).toHaveAttribute('data-skeleton-visible','true');
 await selectSource(page,'Video MP4');
 const toggle=page.getByRole('button',{name:'Sembunyikan kerangka tubuh'});
 await expect(toggle).toBeVisible();
 await expect(toggle).toHaveAttribute('aria-pressed','true');
 await expect(page.locator('.fp-preview-body .fp-stage-surface-head')).toContainText('SKELETON 33');
 await expect(page.locator('.fp-preview-floor')).toBeVisible();
 await expect(page.locator('.fp-stage-video .fp-stage-surface-foot')).toContainText('OUTPUT FISIK TERKUNCI');

 await toggle.click();
 await expect(stage).toHaveAttribute('data-skeleton-visible','false');
 await expect(page.getByRole('button',{name:'Tampilkan kerangka tubuh 33 titik'})).toHaveAttribute('aria-pressed','false');
 await expect(page.locator('.fp-preview-body .fp-stage-surface-head')).toContainText('MASK VIDEO 2D');
 await page.getByRole('button',{name:'Tampilkan kerangka tubuh 33 titik'}).click();
 await expect(stage).toHaveAttribute('data-skeleton-visible','true');
 await expect(page.locator('.fp-preview-body .fp-stage-surface-head')).toContainText('SKELETON 33');
});

test('S6.8.8.1 live camera and phone have same skeleton toggle; simulator retains virtual rig',async({page})=>{
 await page.goto('/');
 const stage=page.locator('.fp-stage-workspace');
 await expect(page.getByRole('button',{name:'Sembunyikan kerangka tubuh'})).toBeVisible();
 await selectSource(page,'Kamera HP');
 await expect(page.getByRole('button',{name:'Sembunyikan kerangka tubuh'})).toBeVisible();
 await expect(page.locator('.fp-source-switch-trigger')).toContainText('Kamera HP');
 await selectSource(page,'Simulasi 3D');
 await expect(stage).toHaveAttribute('data-experimental','true');
 await expect(page.locator('.fp-full-skeleton-switch')).toHaveCount(0);
 await expect(page.locator('.fp-preview-body')).toBeVisible();
 await expect(page.locator('.fp-preview-floor')).toBeVisible();
 await selectSource(page,'Video MP4');
 await expect(page.getByRole('button',{name:'Sembunyikan kerangka tubuh'})).toBeVisible();
});

test('S6.8.8.1 visual skeleton mode does not unlock physical MP4 output',async({page})=>{
 await page.goto('/');
 await selectSource(page,'Video MP4');
 await page.getByRole('button',{name:'Sembunyikan kerangka tubuh'}).click();
 await page.getByRole('button',{name:'Tampilkan kerangka tubuh 33 titik'}).click();
 await page.locator('.fp-transport-projector').click();
 const router=page.locator('.stage-dual');
 await expect(router).toContainText('Dua output fisik terkunci');
 const open=router.getByRole('button',{name:'Buka output'});
 await expect(open).toHaveCount(2);
 for(const button of await open.all())await expect(button).toBeDisabled();
});


test('S0.6 BODY stays non-black through temporary A/B tracking loss in Chromium',async({page})=>{
 await page.goto('/');
 const observed=await page.evaluate(async()=>{
  const {ActorMotionStateBuffer}=await import('/src/stage/actorMotionStateBuffer.ts');
  const {drawSkeletonBodies}=await import('/src/stage/fullBodySkeleton.ts');
  const pose=x=>Array.from({length:33},(_,i)=>({
   x:x+(i%4)*.006,y:.3+(i%7)*.04,z:0,visibility:.95
  }));
  const actors=(atMs,a=true,b=true,ambiguous=false)=>({
   atMs,segment:1,ambiguous,rawPoses:[...(a?[pose(.2)]:[]),...(b?[pose(.7)]:[])],
   actorStates:[
    {id:'A',presence:a&&!ambiguous?'visible':'lost',rawIndex:a&&!ambiguous?0:null},
    {id:'B',presence:b&&!ambiguous?'visible':'lost',
     rawIndex:b&&!ambiguous?a?1:0:null}
   ]
  });
  const buffer=new ActorMotionStateBuffer();
  const canvas=document.createElement('canvas');canvas.width=640;canvas.height=360;
  const ctx=canvas.getContext('2d');
  if(!ctx)throw Error('No canvas');
  function paint(atMs){
   ctx.fillStyle='#000';ctx.fillRect(0,0,640,360);
   const displayed=buffer.present(atMs);
   for(const person of displayed.actors){
    ctx.save();ctx.globalAlpha=person.opacity;
    drawSkeletonBodies(ctx,[person.pose],{x:0,y:0,width:640,height:360},
     {labels:person.tentative?false:[person.label],colors:[person.color]});
    ctx.restore();
   }
   const pixels=ctx.getImageData(0,0,640,360).data;
   let lit=0;
   for(let i=0;i<pixels.length;i+=4)if(pixels[i]+pixels[i+1]+pixels[i+2]>45)lit++;
   return {lit,actors:displayed.actors.map(p=>({
    id:p.id,label:p.label,mode:p.mode,opacity:p.opacity
   }))};
  }
  buffer.ingest(actors(1000));
  const before=paint(1020);
  buffer.ingest(actors(1080,false,true));
  const missing=paint(1120);
  buffer.ingest(actors(1160,false,true));
  const missingAgain=paint(1200);
  buffer.ingest(actors(1240,true,true));
  const recovered=paint(1260);
  buffer.ingest(actors(1300,true,true,true));
  const crossing=paint(1320);
  return {before,missing,missingAgain,recovered,crossing};
 });
 expect(observed.before.lit).toBeGreaterThan(50);
 expect(observed.missing.lit).toBeGreaterThan(50);
 expect(observed.missing.actors).toHaveLength(2);
 expect(observed.missing.actors.find(p=>p.id==='A').label).toBe('');
 expect(observed.missingAgain.lit).toBeGreaterThan(50);
 expect(observed.recovered.actors.find(p=>p.id==='A').label).toBe('ACTOR A');
 expect(observed.crossing.lit).toBeGreaterThan(50);
 expect(observed.crossing.actors.every(p=>p.label==='')).toBe(true);
});
