import {test,expect} from '@playwright/test';
async function openV2(page){
 await page.goto('/');
 await page.getByRole('button',{name:'Compose workspace'}).click();
 const monitor=page.locator('#soma-compose-monitor');
 await monitor.locator('button.lt-beta-trigger').click();
 await page.getByRole('group',{name:'Engine lukisan'})
  .getByRole('button',{name:'Dual Trace V2 · Gabung'}).click();
 return {monitor,panel:page.getByRole('region',{name:'Kontrol Dual Trace V2'})};
}
test('Dual Trace V2: one stage canvas, optional split debug, and actor/channel colors',async({page})=>{
 const {monitor,panel}=await openV2(page);
 await expect(panel).toBeVisible();
 await expect(monitor.locator('.dual-v2-host[data-display="composite"]')).toHaveCount(1);
 await expect(monitor.getByLabel('Dual Trace V2 — lukisan gabungan')).toBeVisible();
 await expect(monitor.locator('.dual-v2-debug-layout')).toHaveCount(0);
 await panel.getByRole('button',{name:'Gesture depan'}).click();
 await expect(panel.getByRole('button',{name:'Gesture depan'})).toHaveAttribute('aria-pressed','true');
 await panel.getByLabel('Tapak Aktor A').fill('#ff9944');
 await expect(panel.getByLabel('Tapak Aktor A')).toHaveValue('#ff9944');
 await expect(panel.getByLabel('Garis Aktor A')).not.toHaveValue('#ff9944');
 await panel.getByRole('button',{name:'Pisah · Debug'}).click();
 await expect(monitor.locator('.dual-v2-debug-layout canvas')).toHaveCount(2);
 await expect(monitor.locator('.dual-v2-canvas-wrap canvas')).toHaveCount(1);
 await panel.getByRole('button',{name:'Gabung'}).click();
 await expect(monitor.locator('.dual-v2-debug-layout')).toHaveCount(0);
});
test('Dual Trace V2: default white stage still paints simulated foot traces',async({page})=>{
 const {monitor,panel}=await openV2(page);
 await panel.getByRole('button',{name:'Coba demo'}).click();
 await expect(monitor.getByText('Simulasi kaki · gesture belum tersedia')).toBeVisible();
 const canvas=monitor.getByLabel('Dual Trace V2 — lukisan gabungan');
 await expect.poll(()=>canvas.evaluate(el=>{
  const d=el.getContext('2d').getImageData(0,0,el.width,el.height).data;
  let pigment=0;for(let i=0;i<d.length;i+=32){
   if((d[i]>d[i+1]+12&&d[i]>d[i+2]+12)||d[i]<130&&d[i+1]<130) pigment++;
  }
  return pigment;
 }),{timeout:15000}).toBeGreaterThan(5);
 await panel.getByRole('button',{name:'Stop demo'}).click();
});
test('Layer compositor: recoloring retained actor A ink does not erase existing stroke',async({page})=>{
 await page.goto('/');
 const result=await page.evaluate(async()=>{
  const {DualTraceV2Renderer,DEFAULT_DUAL_TRACE_PALETTE}=
   await import('/src/footprints/dual-trace/DualTraceV2Renderer.ts');
  const engine=new DualTraceV2Renderer();
  const event=(kind,x,t)=>({kind,actorId:'A',strokeId:'A-1',point:{x,y:400},
   timeMs:t,confidence:.95,epoch:0,sourceKey:'video:qa:0:2',clipStableId:'video:qa',
   provenance:'video-estimate'});
  engine.ingestPath(event('START',300,1000));
  engine.ingestPath(event('ADD',380,1100));
  engine.ingestPath(event('ADD',460,1200));
  engine.ingestPath(event('CUT',460,1250));
  const canvas=document.createElement('canvas');canvas.width=1600;canvas.height=900;
  const c=canvas.getContext('2d');
  const impressions={visible:()=>[],liveHeads:()=>[],count:0,headsCount:0};
  const base={impressions,timeMs:1250,footprintLifeMs:6000,footprintKeep:false,
   footVisible:{A:{left:true,right:true},B:{left:true,right:true}},
   headEnabled:true,shoulderEnabled:true,headOpacity:1,shoulderOpacity:1};
  engine.paint(c,base);
  const before=Array.from(c.getImageData(400,400,1,1).data).slice(0,3);
  const palette={...DEFAULT_DUAL_TRACE_PALETTE,
   A:{...DEFAULT_DUAL_TRACE_PALETTE.A,path:'#174ad1'}};
  engine.paint(c,{...base,palette});
  const after=Array.from(c.getImageData(400,400,1,1).data).slice(0,3);
  return {before,after,count:engine.pathCount};
 });
 expect(result.count).toBeGreaterThan(0);
 expect(result.after).not.toEqual(result.before);
 expect(result.after[2]).toBeGreaterThan(result.after[0]);
});
