import {test,expect} from '@playwright/test';

test('GT22 browser: hip-assisted actor paths paint two retained ink lines',async({page})=>{
 await page.goto('/');
 const result=await page.evaluate(async()=>{
  const {ActorGroundTrajectoryEstimator}=await import('/src/footprints/lines/v3/ActorGroundTrajectoryEstimator.ts');
  const {ActorPathTracker}=await import('/src/footprints/lines/v3/ActorPathTracker.ts');
  const {DualTraceV2Renderer}=await import('/src/footprints/dual-trace/DualTraceV2Renderer.ts');
  const est=new ActorGroundTrajectoryEstimator();
  const path=new ActorPathTracker();
  const painter=new DualTraceV2Renderer();
  const sourceKey='video:browser-golden:0:2';
  const observations=(a,x,y,ms)=>({
   actorId:a,sourceKey,clipStableId:'video:browser-golden',epoch:1,
   timeMs:ms,point:{x,y},confidence:.92,
   evidence:'estimated-ground-projection',provenance:'video-estimate',
   footEvent:'none',motionBasis:'single-foot'
  });
  const body=(a,x,y,ms,feet)=>({
   actorId:a,sourceKey,sourceEpoch:0,timeMs:ms,
   identityConfidence:.95,hipPx:{x,y:y-175},
   hipConfidence:.92,torsoScalePx:110,feetCount:feet,
   ...(feet?{footImageAnchorPx:{x,y}}:{})
  });
  let noFeetPainted=false,bufferedFrames=0,history=0;
  for(let k=0;k<32;k++){
   const ms=1000+k*50,xa=200+k*16,xb=1320-k*15;
   const isGap=k===10||k===11;
   const feet=isGap?[]:[observations('A',xa,540,ms),observations('B',xb,615,ms)];
   const result=est.ingest(feet,[
    body('A',xa,540,ms,isGap?0:2),
    body('B',xb,615,ms,isGap?0:2)
   ]);
   if(isGap){bufferedFrames+=1;if(result.observations.length)noFeetPainted=true;}
   for(const cut of result.cuts){
    const event=path.cutActor(cut.actorId,cut.reason);
    if(event)painter.ingestPath(event,24);
   }
   const events=path.ingest(result.observations,ms);
   for(const ev of events){painter.ingestPath(ev,24);history+=1;}
  }
  for(const e of path.cutAll('fixture-end'))painter.ingestPath(e,24);
  const canvas=document.createElement('canvas');canvas.id='ground-trajectory-golden';
  canvas.width=1600;canvas.height=900;
  canvas.style.width='800px';canvas.style.height='450px';
  document.body.prepend(canvas);
  const impressions={visible:()=>[],liveHeads:()=>[],count:0,headsCount:0};
  painter.paint(canvas.getContext('2d'),{
   impressions,timeMs:3000,footprintLifeMs:6000,footprintKeep:false,
   footVisible:{A:{left:true,right:true},B:{left:true,right:true}},
   headEnabled:false,shoulderEnabled:false,headOpacity:0,shoulderOpacity:0
  });
  const pix=canvas.getContext('2d').getImageData(0,0,1600,900).data;
  let red=0,dark=0;
  for(let i=0;i<pix.length;i+=16){
   const [r,g,b]=pix.slice(i,i+3);
   if(r>g+24&&r>b+18&&r<230)red++;
   if(r<165&&g<165&&b<165&&Math.abs(r-g)<25)dark++;
  }
  return {red,dark,history,noFeetPainted,bufferedFrames,
   pathCount:painter.pathCount,mode:est.getStatus()};
 });
 expect(result.noFeetPainted).toBe(false);
 expect(result.bufferedFrames).toBe(2);
 expect(result.history).toBeGreaterThan(15);
 expect(result.pathCount).toBeGreaterThan(0);
 expect(result.red).toBeGreaterThan(30);
 expect(result.dark).toBeGreaterThan(30);
 await page.locator('#ground-trajectory-golden').screenshot({
  path:'e2e/test-results/ground-trajectory-v22-golden.png'
 });
});

test('GT22 operator: Dual Trace offers V2.1 rollback without removing the V2 artwork',async({page})=>{
 await page.goto('/');
 await page.getByRole('button',{name:'Compose workspace'}).click();
 const monitor=page.locator('#soma-compose-monitor');
 await monitor.locator('button.lt-beta-trigger').click();
 await page.getByRole('group',{name:'Engine lukisan'})
  .getByRole('button',{name:'Dual Trace V2 · Gabung'}).click();
 const control=page.getByRole('region',{name:'Kontrol Dual Trace V2'});
 await control.getByText('Tracking jalur · V2.2').click();
 const toggle=control.getByRole('checkbox',{name:'Gunakan fusi kaki + pinggul (V2.2)'});
 await expect(toggle).toBeChecked();
 await toggle.uncheck();
 await expect(toggle).not.toBeChecked();
 await expect(monitor.locator('.dual-v2-host[data-display="composite"]')).toHaveCount(1);
 await toggle.check();
 await expect(toggle).toBeChecked();
});
