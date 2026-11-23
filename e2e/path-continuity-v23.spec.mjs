import {test,expect} from '@playwright/test';

test('PC23 browser: accepted hip bridge paints one connected A/B ribbon without white seams',async({page})=>{
 await page.goto('/');
 const result=await page.evaluate(async()=>{
  const {ActorGroundTrajectoryEstimator}=await import('/src/footprints/lines/v3/ActorGroundTrajectoryEstimator.ts');
  const {ActorPathTracker}=await import('/src/footprints/lines/v3/ActorPathTracker.ts');
  const {DualTraceV2Renderer}=await import('/src/footprints/dual-trace/DualTraceV2Renderer.ts');
  const estimator=new ActorGroundTrajectoryEstimator();
  const tracker=new ActorPathTracker();
  const canvasPainter=new DualTraceV2Renderer();
  const sourceKey='video:pc23-browser:0:2';
  const observation=(actor,x,y,ms)=>({
   actorId:actor,sourceKey,clipStableId:'video:pc23-browser',epoch:1,timeMs:ms,
   point:{x,y},confidence:.95,evidence:'estimated-ground-projection',
   provenance:'video-estimate',footEvent:'none',motionBasis:'dual-foot-coherent'
  });
  const frame=(actor,x,y,ms,feet)=>({
   actorId:actor,sourceKey,sourceEpoch:0,timeMs:ms,
   identityConfidence:.95,hipPx:{x,y:y-160},hipConfidence:.95,
   torsoScalePx:100,feetCount:feet,
   ...(feet?{footImageAnchorPx:{x,y}}:{})
  });
  let observedDuringGap=0,accepted=0;
  for(let k=0;k<35;k++){
   const ms=1000+k*45,isGap=k===10||k===11;
   const xa=190+k*14.5,xb=1390-k*14.5;
   const ay=460,by=625;
   const feet=isGap?[]:[
    observation('A',xa,ay,ms),observation('B',xb,by,ms)
   ];
   const out=estimator.ingest(feet,[
    frame('A',xa,ay,ms,isGap?0:2),frame('B',xb,by,ms,isGap?0:2)
   ],undefined,true);
   if(isGap)observedDuringGap+=out.observations.length;
   for(const c of out.cuts){
    const event=tracker.cutActor(c.actorId,c.reason);
    if(event)canvasPainter.ingestPath(event,28);
   }
   for(const e of tracker.ingest(out.observations,ms))canvasPainter.ingestPath(e,28);
  }
  accepted=estimator.continuity.diagnostics.A.acceptedBridges+
           estimator.continuity.diagnostics.B.acceptedBridges;
  const activeBefore=canvasPainter.path.A.diagnostics.pathLengthPx;
  for(const e of tracker.cutAll('end-of-fixture'))canvasPainter.ingestPath(e,28);
  const canvas=document.createElement('canvas');
  canvas.id='pc23-visual-ribbon';
  canvas.width=1600;canvas.height=900;
  canvas.style.cssText='width:800px;height:450px';
  document.body.prepend(canvas);
  const fakeImpressions={visible:()=>[],liveHeads:()=>[],count:0,headsCount:0};
  canvasPainter.paint(canvas.getContext('2d'),{
   impressions:fakeImpressions,timeMs:3000,
   footprintLifeMs:6000,footprintKeep:false,
   footVisible:{A:{left:true,right:true},B:{left:true,right:true}},
   headEnabled:false,shoulderEnabled:false,headOpacity:0,shoulderOpacity:0
  });
  const cx=canvas.getContext('2d');
  const counts={A:0,B:0};
  for(let k=5;k<30;k++){
   for(const actor of ['A','B']){
    const x=Math.round(actor==='A'?190+k*14.5:1390-k*14.5);
    const y=actor==='A'?460:625;
    const pix=cx.getImageData(x-3,y-3,7,7).data;
    let colored=false;
    for(let p=0;p<pix.length;p+=4){
     const brightness=pix[p]+pix[p+1]+pix[p+2];
     if(brightness<670){colored=true;break;}
    }
    if(colored)counts[actor]++;
   }
  }
  return {observedDuringGap,accepted,counts,activeBefore,
   a:canvasPainter.path.A.diagnostics,
   b:canvasPainter.path.B.diagnostics};
 });
 expect(result.observedDuringGap).toBe(0);
 expect(result.accepted).toBe(2);
 expect(result.activeBefore).toBeGreaterThan(250);
 expect(result.counts.A).toBeGreaterThan(20);
 expect(result.counts.B).toBeGreaterThan(20);
 expect(result.a.pathLengthPx).toBeGreaterThan(350);
 expect(result.b.pathLengthPx).toBeGreaterThan(350);
 await page.locator('#pc23-visual-ribbon').screenshot({path:'e2e/test-results/path-continuity-v23-ribbon.png'});
});

test('PC23 operator: beta continuity is opt-in with V2.2 fallback',async({page})=>{
 await page.goto('/');
 await page.getByRole('button',{name:'Compose workspace'}).click();
 const monitor=page.locator('#soma-compose-monitor');
 await monitor.locator('button.lt-beta-trigger').click();
 await page.getByRole('group',{name:'Engine lukisan'})
  .getByRole('button',{name:'Dual Trace V2 · Gabung'}).click();
 const controls=page.getByRole('region',{name:'Kontrol Dual Trace V2'});
 await controls.getByText('Tracking jalur · V2.2').click();
 const v23=controls.getByRole('checkbox',{name:/Path Continuity V2.3/});
 await expect(v23).not.toBeChecked();
 await v23.check();
 await expect(v23).toBeChecked();
 await v23.uncheck();
 await expect(v23).not.toBeChecked();
 const v22=controls.getByRole('checkbox',{name:/Gunakan fusi kaki/});
 await v22.uncheck();
 await expect(v23).toBeDisabled();
 await expect(monitor.locator('.dual-v2-host[data-display="composite"]')).toHaveCount(1);
});
