import {test,expect} from '@playwright/test';
async function openDual(page){
 await page.goto('/');
 await page.getByRole('button',{name:'Compose workspace'}).click();
 const monitor=page.locator('#soma-compose-monitor');
 await monitor.locator('button.lt-beta-trigger').click();
 await page.getByRole('group',{name:'Engine lukisan'})
  .getByRole('button',{name:'Dual Trace · BETA'}).click();
 return {monitor,panel:page.getByRole('region',{name:'Kontrol Dual Trace'})};
}
test('end to end Compose: two canvases, independent Clear, fullscreen and truthful demo',async({page})=>{
 const {monitor,panel}=await openDual(page);
 await expect(panel).toBeVisible();
 await expect(monitor.locator('.dual-trace-layout canvas')).toHaveCount(2);
 await expect(monitor.getByRole('region',{name:'Kanvas Foot Path'})).toBeVisible();
 await expect(monitor.getByRole('region',{name:'Kanvas Head & Shoulder'})).toBeVisible();
 await expect(panel.getByRole('slider',{name:'Amplifikasi kepala'})).toHaveValue('1.35');
 await expect(panel.getByRole('slider',{name:'Bobot garis bahu'})).toHaveValue('16');
 await expect(panel.getByRole('slider',{name:'Durasi footprint'})).toHaveValue('6');
 await panel.getByRole('button',{name:'Coba Demo'}).click();
 await expect(monitor.getByText('Pose kepala/bahu belum tersedia · demo kaki')).toBeVisible();
 await expect.poll(()=>monitor.getByLabel('Foot Path — jejak dan jalur kaki').evaluate(c=>{
  const d=c.getContext('2d').getImageData(0,0,c.width,c.height).data;
  let hit=0;for(let i=0;i<d.length;i+=64)
   if(d[i]>170&&d[i+1]<170&&d[i+2]<160)hit++;
  return hit;
 }),{timeout:15000}).toBeGreaterThan(10);
 const upper=monitor.getByLabel('Head & Shoulder — lukisan gestur');
 const pixel=await upper.evaluate(c=>
  Array.from(c.getContext('2d').getImageData(4,4,1,1).data).slice(0,3));
 expect(pixel).toEqual([247,246,242]);
 await monitor.getByRole('button',{name:'Clear Gesture'}).click();
 await expect(monitor.getByRole('button',{name:'Clear Foot'})).toBeVisible();
 await monitor.getByRole('button',{name:'Clear Both'}).click();
 await panel.getByRole('button',{name:'Hentikan Demo'}).click();
 await panel.getByRole('button',{name:'Path Sumi V3.5.1'}).click();
 await expect(monitor.locator('.dual-trace-layout')).toHaveCount(0);
});
test('pixel fixture: A/B upper head/shoulder strokes actually paint, then clear independently',async({page})=>{
 await page.goto('/');
 const result=await page.evaluate(async()=>{
  const {upperGestureAnchors}=await import('/src/footprints/dual-trace/UpperGestureAnchorAdapter.ts');
  const {UpperGestureStrokeTracker}=await import('/src/footprints/dual-trace/UpperGestureStrokeTracker.ts');
  const {UpperGestureInkRenderer}=await import('/src/footprints/dual-trace/UpperGestureInkRenderer.ts');
  const tracker=new UpperGestureStrokeTracker(),renderer=new UpperGestureInkRenderer();
  const colors={A:'#E84B32',B:'#202226'};
  const settings={headEnabled:true,shoulderEnabled:true,
   headWidth:8,shoulderWidth:16,headOpacity:.75,shoulderOpacity:.9,colors};
  const pose=(x,y,headOffset)=>{
   const pts=Array.from({length:33},()=>({x:.5,y:.5,z:0,visibility:.98}));
   pts[7]={x:x-.03+headOffset,y:y-.11,z:0,visibility:.98};
   pts[8]={x:x+.03+headOffset,y:y-.11,z:0,visibility:.98};
   pts[11]={x:x-.085,y,z:0,visibility:.98};
   pts[12]={x:x+.085,y,z:0,visibility:.98};
   return pts;
  };
  for(let i=0;i<110;i++){
   const t=1000+i*65,u=i/109;
   const frames=[{id:'A',x:.17+.58*u,y:.35+.045*Math.sin(u*7)},
    {id:'B',x:.82-.55*u,y:.63-.07*Math.sin(u*6)}];
   const anchors=frames.flatMap(f=>upperGestureAnchors({
    actorId:f.id,source:'video',sourceKey:'video:dual-qa:0:2',
    epoch:0,timeMs:t,identityConfidence:.98,
    landmarks:pose(f.x,f.y,.024*Math.sin(u*19)),
    coordinateBasis:'image-2d'
   },1.35));
   const events=tracker.ingest(anchors,t);
   for(const e of events)renderer.ingest(e,settings);
  }
  for(const ev of tracker.cutAll('qa-end'))renderer.ingest(ev,settings);
  const canvas=document.createElement('canvas');
  canvas.width=1600;canvas.height=900;canvas.id='dual-trace-e2e-canvas';
  canvas.style.width='800px';canvas.style.height='450px';
  renderer.paint(canvas.getContext('2d'),settings);
  const painting=document.createElement('canvas');
  painting.id='dual-trace-e2e-painting';painting.width=1600;painting.height=900;
  painting.style.width='800px';painting.style.height='450px';
  painting.getContext('2d').drawImage(canvas,0,0);
  document.body.prepend(painting);
  document.body.prepend(canvas);
  const pixels=canvas.getContext('2d').getImageData(0,0,1600,900).data;
  let red=0,dark=0;
  for(let i=0;i<pixels.length;i+=16){
   const r=pixels[i],g=pixels[i+1],b=pixels[i+2];
   if(r>g+35&&r>b+28)red++;
   if(r<125&&g<125&&b<125)dark++;
  }
  const before=renderer.committedCount;
  renderer.clear();
  renderer.paint(canvas.getContext('2d'),settings);
  return {red,dark,before,after:renderer.committedCount,
   cleared:Array.from(canvas.getContext('2d').getImageData(10,10,1,1).data).slice(0,3)};
 });
 expect(result.red).toBeGreaterThan(70);
 expect(result.dark).toBeGreaterThan(70);
 expect(result.before).toBeGreaterThan(0);
 expect(result.after).toBe(0);
 expect(result.cleared).toEqual([247,246,242]);
 await page.locator('#dual-trace-e2e-painting').screenshot({
  path:'e2e/test-results/dual-trace-clear.png'
 });
});

test('both canvases have independent fullscreen actions with clean projection surfaces',async({page})=>{
 const {monitor}=await openDual(page);
 const foot=monitor.getByRole('region',{name:'Kanvas Foot Path'});
 const upper=monitor.getByRole('region',{name:'Kanvas Head & Shoulder'});
 await monitor.getByRole('button',{name:'Fullscreen Foot Path'}).click();
 await expect.poll(()=>page.evaluate(()=>
  document.fullscreenElement?.getAttribute('aria-label'))).toBe('Kanvas Foot Path');
 await expect(foot.locator('.dual-trace-view-controls')).toBeHidden();
 await page.keyboard.press('Escape');
 await expect.poll(()=>page.evaluate(()=>document.fullscreenElement)).toBe(null);
 await monitor.getByRole('button',{name:'Fullscreen Head & Shoulder'}).click();
 await expect.poll(()=>page.evaluate(()=>
  document.fullscreenElement?.getAttribute('aria-label'))).toBe('Kanvas Head & Shoulder');
 await expect(upper.locator('.dual-trace-view-controls')).toBeHidden();
 await page.keyboard.press('Escape');
 await expect.poll(()=>page.evaluate(()=>document.fullscreenElement)).toBe(null);
});
