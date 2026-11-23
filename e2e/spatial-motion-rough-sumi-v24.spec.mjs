import {test,expect} from '@playwright/test';

test('V2.4 UI: beta spatial tracking, motion preset and rough Sumi keep V2.3 fallback',async({page})=>{
 await page.goto('/');
 await page.getByRole('button',{name:'Compose workspace'}).click();
 const monitor=page.locator('#soma-compose-monitor');
 await monitor.locator('button.lt-beta-trigger').click();
 await page.getByRole('group',{name:'Engine lukisan'})
  .getByRole('button',{name:'Dual Trace V2 · Gabung'}).click();
 const panel=page.getByRole('region',{name:'Kontrol Dual Trace V2'});
 await panel.getByText('Sapuan & gestur').click();
 await panel.getByLabel('Karakter tinta').selectOption('rough-sumi');
 await expect(panel.getByRole('slider',{name:'Kekasaran tepi (%)'})).toBeVisible();
 await panel.getByRole('slider',{name:'Kekasaran tepi (%)'}).fill('85');
 await panel.getByText('Tracking jalur · V2.2').click();
 const v24=panel.getByRole('checkbox',{name:/Spatial V2.4/});
 await expect(v24).not.toBeChecked();
 await v24.check();
 await expect(v24).toBeChecked();
 await expect(panel.getByRole('button',{name:'Ekspor posisi A/B · JSON'})).toBeEnabled();
 await panel.getByLabel('Stabilitas gerak V2.4').selectOption('responsive');
 await expect(panel.getByLabel('Stabilitas gerak V2.4')).toHaveValue('responsive');
 await v24.uncheck();
 await expect(v24).not.toBeChecked();
 const v23=panel.getByRole('checkbox',{name:/Path Continuity V2.3/});
 await v23.check();await expect(v23).toBeChecked();
 await expect(monitor.locator('.dual-v2-host[data-display="composite"]')).toHaveCount(1);
});

test('V2.4 browser: raw A/B travel reaches both stage sides and rough ink still paints connected centerlines',async({page})=>{
 await page.goto('/');
 const result=await page.evaluate(async()=>{
  const {GroundTrajectoryEngineV2}=await import('/src/footprints/lines/v3/GroundTrajectoryEngineV2.ts');
  const {DualTraceV2Renderer}=await import('/src/footprints/dual-trace/DualTraceV2Renderer.ts');
  const route=new GroundTrajectoryEngineV2();
  const painter=new DualTraceV2Renderer();
  const sourceKey='video:v24-golden:0:2',samples=[];
  const makePose=(actor,foot,x,y,timeMs)=>({
   actorId:actor,foot,sourceKey,epoch:1,atMs:timeMs,
   coordinateBasis:'image-2d',center:{x:x/1600,y:y/900},
   confidence:.96,provenance:'video-estimate'
  });
  const makeFrame=(actor,x,y,timeMs)=>({
   actorId:actor,sourceKey,sourceEpoch:0,timeMs,
   identityConfidence:.97,hipPx:{x,y:y-195},hipConfidence:.97,
   torsoScalePx:100,feetCount:2,footImageAnchorPx:{x,y},
   feetStagePx:{
    left:{point:{x:x-12,y},confidence:.97},
    right:{point:{x:x+12,y},confidence:.97}
   }
  });
  let cuts=0,events=0;
  for(let k=0;k<57;k++){
   const atMs=1000+k*45,ax=180+k*17,bx=1420-k*17;
   const poses=[
    makePose('A','left',ax-12,430,atMs),
    makePose('A','right',ax+12,430,atMs),
    makePose('B','left',bx-12,615,atMs),
    makePose('B','right',bx+12,615,atMs)
   ];
   const frames=[makeFrame('A',ax,430,atMs),makeFrame('B',bx,615,atMs)];
   const result=route.ingest(sourceKey,atMs,poses,[],undefined,undefined,frames,true,true,true,'balanced');
   for(const event of result.events){
    if(event.kind==='CUT')cuts++;
    painter.ingestPath(event,32,'rough-sumi',false,1,.88);events++;
   }
  }
  const ranges=route.coverage.summary;
  for(const e of route.cutAll('end'))painter.ingestPath(e,32,'rough-sumi',false,1,.88);
  const canvas=document.createElement('canvas');canvas.width=1600;canvas.height=900;
  canvas.id='v24-golden-ribbon';document.body.prepend(canvas);
  const c=canvas.getContext('2d');
  painter.paint(c,{
   impressions:{visible:()=>[],liveHeads:()=>[],count:0,headsCount:0},
   timeMs:3800,footprintLifeMs:6000,footprintKeep:false,
   footVisible:{A:{left:true,right:true},B:{left:true,right:true}},
   headEnabled:false,shoulderEnabled:false,headOpacity:0,shoulderOpacity:0
  });
  let aCount=0,bCount=0;
  const pixels=c.getImageData(0,0,1600,900).data;
  for(let y=0;y<900;y+=3)for(let x=0;x<1600;x+=3){
   const off=(y*1600+x)*4,r=pixels[off],g=pixels[off+1],b=pixels[off+2];
   if(r>g+22&&r>b+22&&r<230)aCount++;
   if(r<160&&g<160&&b<160&&Math.abs(r-g)<28)bCount++;
  }
  return {ranges,cuts,events,aCount,bCount,
   paths:[painter.path.A.diagnostics.pathLengthPx,painter.path.B.diagnostics.pathLengthPx]};
 });
 expect(result.cuts).toBe(0);
 expect(result.events).toBeGreaterThan(35);
 expect(result.paths[0]).toBeGreaterThan(700);
 expect(result.paths[1]).toBeGreaterThan(700);
 expect(result.ranges[0].smoothed.maxX-result.ranges[0].smoothed.minX).toBeGreaterThan(700);
 expect(result.ranges[1].smoothed.maxX-result.ranges[1].smoothed.minX).toBeGreaterThan(700);
 expect(result.aCount).toBeGreaterThan(120);
 expect(result.bCount).toBeGreaterThan(120);
 await page.locator('#v24-golden-ribbon').screenshot({path:'e2e/test-results/v24-golden-rough-ribbon.png'});
});
