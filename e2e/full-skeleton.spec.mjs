import {selectStageSource,openStageMap} from './ia-ux-helpers.mjs';
import {test,expect} from '@playwright/test';

async function selectSource(page,name){
 await selectStageSource(page,name);
 await expect(page.locator('.soma-uxr1-source > summary')).toContainText(name);
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
 await expect(page.locator('.soma-uxr1-source > summary')).toContainText('Kamera HP');
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
 await openStageMap(page);
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


test('S0.6.3 Chromium alpha mask keeps A/B pixels visible during temporary pose loss',async({page})=>{
 await page.goto('/');
 const state=await page.evaluate(async()=>{
  const {PersistentBodyMaskEngine,paintIndependentBodyMasks}=
   await import('/src/stage/persistentBodyMaskEngine.ts');
  const {sampleLowerBodyFrame}=
   await import('/src/footprints/stage-optics/LowerBodyMaskEngine.ts');
  const fixture=sampleLowerBodyFrame(1000,2);
  const save=(id,atMs=1000,observed=true,delta=0)=>({
   id,registered:true,observed,presence:observed?'visible':'occluded',
   rawIndex:observed?id==='A'?0:1:null,
   lastObservedAtMs:atMs,ageMs:0,
   lastPose:fixture.poses[id==='A'?0:1].map(p=>({...p,x:p.x+delta})),
   center:{x:(id==='A'?.29:.72)+delta,y:.44},
   velocity:{x:0,y:0},box:null,confidence:.95,observedFrames:5
  });
  const engine=new PersistentBodyMaskEngine();
  const canvas=document.createElement('canvas');
  canvas.width=640;canvas.height=360;
  const ctx=canvas.getContext('2d',{willReadFrequently:true});
  if(!ctx)throw Error('Canvas unavailable');
  const raster=mask=>{
   ctx.fillStyle='#000';ctx.fillRect(0,0,640,360);
   const count=paintIndependentBodyMasks(ctx,mask,{x:0,y:0,width:640,height:360},1);
   const pixels=ctx.getImageData(0,0,640,360).data;
   let left=0,right=0;
   for(let y=0;y<360;y+=3)for(let x=0;x<640;x+=3){
    const n=(y*640+x)*4;
    if(pixels[n]+pixels[n+1]+pixels[n+2]>36){
     if(x<320)left++;else right++;
    }
   }
   return {count,left,right,actors:mask.actors.map(a=>({
    id:a.id,mode:a.mode,dx:a.dx,alpha:a.alpha
   }))};
  };
  engine.ingest({atMs:1000,segment:0,persistentActors:[save('A'),save('B')]});
  const start=raster(engine.present(1010));
  engine.ingest({atMs:1080,segment:0,
   persistentActors:[save('A',1080,true,.01),save('B',1000,false)]});
  const missing=raster(engine.present(1120,{
   atMs:1120,actors:[{id:'B',anchorAtMs:1000,trackedAtMs:1120,
    dx:-.035,dy:0,confidence:.92,inliers:9}]
  }));
  engine.ingest({atMs:1200,segment:0,
   persistentActors:[save('A',1200,true,.015),save('B',1200,true,-.012)]});
  const recovered=raster(engine.present(1220));
  engine.reset();
  const cleared=raster(engine.present(1240));
  return {start,missing,recovered,cleared};
 });
 expect(state.start.count).toBe(2);
 expect(state.start.left).toBeGreaterThan(25);
 expect(state.start.right).toBeGreaterThan(25);
 expect(state.missing.count).toBe(2);
 expect(state.missing.left).toBeGreaterThan(25);
 expect(state.missing.right).toBeGreaterThan(25);
 expect(state.missing.actors.find(a=>a.id==='B').mode).toBe('propagated');
 expect(state.missing.actors.find(a=>a.id==='B').dx).toBeLessThan(-.02);
 expect(state.recovered.actors.every(a=>a.mode==='measured')).toBe(true);
 expect(state.cleared.count).toBe(0);
 expect(state.cleared.left+state.cleared.right).toBe(0);
});
