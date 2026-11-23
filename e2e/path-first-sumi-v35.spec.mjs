import {test,expect} from '@playwright/test';

async function openPath(page){
 await page.goto('/');
 await page.getByRole('button',{name:'Compose workspace'}).click();
 const monitor=page.locator('#soma-compose-monitor');
 await monitor.locator('button.lt-beta-trigger').click();
 const panel=page.getByRole('region',{name:'Kontrol Garis V3'});
 await expect(panel).toBeVisible();
 return {panel,monitor};
}
test('V3.5 Path Sumi is a real default, not a V3.4 label',async({page})=>{
 const {panel,monitor}=await openPath(page);
 const group=panel.getByRole('group',{name:'Engine lukisan'});
 await expect(panel.getByText('V3.5 PATH')).toBeVisible();
 await expect(group.getByRole('button',{name:'Path Sumi V3.5'}))
  .toHaveAttribute('aria-pressed','true');
 await expect(panel.getByRole('slider',{name:'Bobot jalur Sumi'})).toHaveValue('26');
 await expect(panel.getByRole('slider',{name:'Durasi tapak kaki'})).toHaveValue('6');
 await expect(panel.getByLabel('Garis tetap')).toBeChecked();
 await expect(panel.getByRole('group',{name:'Aksen tinta'}).getByRole('button',{name:'Halus'}))
  .toHaveAttribute('aria-pressed','true');
 await panel.getByLabel('Periksa presisi jalur').check();
 await expect(panel.getByLabel('Periksa presisi jalur')).toBeChecked();
 await panel.getByRole('button',{name:'Coba Demo'}).click();
 await expect(panel.getByText(/DEMO/)).toBeVisible();
 await expect.poll(()=>monitor.locator('.lt-v3-stage canvas').evaluate(c=>{
  const {data}=c.getContext('2d').getImageData(0,0,c.width,c.height);
  let n=0;for(let i=0;i<data.length;i+=40){
   if(data[i]>150&&data[i+1]<155&&data[i+2]<150)n++;
  }
  return n;
 }),{timeout:15000}).toBeGreaterThan(15);
 await monitor.locator('.lt-v3-stage canvas').screenshot({path:'e2e/test-results/path-v35-demo.png'});
 await panel.getByRole('button',{name:'Hentikan Demo'}).click();
 await expect(panel.getByRole('button',{name:'Simpan lukisan PNG'})).toBeVisible();
 await panel.getByRole('button',{name:'Bersihkan Lukisan'}).click();
 await expect.poll(()=>monitor.locator('.lt-v3-stage canvas').evaluate(c=>{
  const d=c.getContext('2d').getImageData(0,0,1,1).data;
  return Array.from(d.slice(0,3)).join(',');
 })).toBe('245,245,242');
 await group.getByRole('button',{name:'Sumi V3.4'}).click();
 await expect(panel.getByText('V3.4 SUMI')).toBeVisible();
 await group.getByRole('button',{name:'Path Sumi V3.5'}).click();
 await expect(panel.getByText('V3.5 PATH')).toBeVisible();
});
test('render fixture: two long paths, white space and thumbnail readability',async({page})=>{
 await page.goto('/');
 const output=await page.evaluate(async()=>{
  const {PathObservationRouter}=await import('/src/footprints/lines/v3/PathObservationRouter.ts');
  const {ActorPathTracker}=await import('/src/footprints/lines/v3/ActorPathTracker.ts');
  const {PersistentPathStore}=await import('/src/footprints/lines/v3/PersistentPathStore.ts');
  const router=new PathObservationRouter(),tracker=new ActorPathTracker(),store=new PersistentPathStore();
  for(let i=0;i<180;i++){
   const tm=1000+i*90,t=i/179;
   const poses=[];
   for(const [actor,x,y] of [
    ['A',.12+.67*t,.36+.085*Math.sin(t*Math.PI*2)],
    ['B',.87-.65*t,.64-.09*Math.sin(t*Math.PI*2)]
   ]){
    for(const foot of ['left','right']){
     poses.push({actorId:actor,foot,sourceKey:'video:visual-fixture:0:2',epoch:1,
      atMs:tm,coordinateBasis:'image-2d',
      center:{x:x+(foot==='left'?-0.009:0.009),y},
      confidence:.98,provenance:'video-estimate'});
    }
   }
   for(const event of tracker.ingest(router.ingest(poses),tm))
    store.ingest(event,{color:event.actorId==='A'?'#E44F32':'#242424',
     weightPx:26,material:'path-sumi',accents:'subtle'});
  }
  store.cutAll('fixture-end');
  const canvas=document.createElement('canvas');
  canvas.id='soma-path-qa-canvas';canvas.width=1600;canvas.height=900;
  canvas.style.width='800px';canvas.style.height='450px';
  const ctx=canvas.getContext('2d');ctx.fillStyle='#F5F5F2';ctx.fillRect(0,0,1600,900);
  ctx.globalAlpha=.85;ctx.drawImage(store.getCanvas(),0,0);
  document.body.prepend(canvas);
  const {data}=ctx.getImageData(0,0,1600,900);
  let red=0,charcoal=0,ink=0,x0=1600,x1=0,y0=900,y1=0;
  for(let y=0;y<900;y+=4)for(let x=0;x<1600;x+=4){
   const i=(y*1600+x)*4,r=data[i],g=data[i+1],b=data[i+2];
   if(r<215||g<175||b<170){
    ink++;if(r>g+38&&r>b+25)red++;
    if(r<105&&g<105&&b<105)charcoal++;
    x0=Math.min(x0,x);x1=Math.max(x1,x);y0=Math.min(y0,y);y1=Math.max(y1,y);
   }
  }
  return {red,charcoal,ink,occupancy:ink/(400*225),span:x1-x0,vertical:y1-y0};
 });
 expect(output.red).toBeGreaterThan(100);
 expect(output.charcoal).toBeGreaterThan(100);
 expect(output.occupancy).toBeLessThan(.16);
 expect(output.span).toBeGreaterThan(650);
 expect(output.vertical).toBeGreaterThan(160);
 const canvas=page.locator('#soma-path-qa-canvas');
 await canvas.screenshot({path:'e2e/test-results/path-v35-two-actors-1600.png'});
 await canvas.evaluate(c=>{c.style.width='320px';c.style.height='180px';});
 await canvas.screenshot({path:'e2e/test-results/path-v35-two-actors-thumbnail-320.png'});
});
