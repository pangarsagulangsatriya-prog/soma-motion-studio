import {selectStageSource,openStageMap} from './ia-ux-helpers.mjs';
import {test,expect} from '@playwright/test';

test.setTimeout(90_000);

async function selectSource(page,name){
 await selectStageSource(page,name);
 await expect(page.locator('.soma-uxr1-source > summary')).toContainText(name);
}

test('S6.8.8.2 video defaults to automatic actor count and exposes manual override only in Lab',async({page})=>{
 await page.goto('/?lab=1');
 await selectSource(page,'Video MP4');
 await expect(page.locator('.soma-uxr1-source > summary')).toContainText('Video MP4');
 await expect(page.locator('.fp-preview-body')).toBeVisible();
 await expect(page.locator('.fp-preview-floor')).toBeVisible();
 const advanced=page.locator('.fp-experiment-advanced-details summary');
 await advanced.click();
 await page.getByRole('button',{name:'Buka Video Motion Lab'}).click();
 const select=page.getByRole('combobox',{name:'Mode jumlah aktor video'});
 await expect(select).toBeVisible();
 await expect(select).toHaveValue('auto');
 await select.selectOption('2');
 await expect(select).toHaveValue('2');
 await select.selectOption('auto');
 await expect(select).toHaveValue('auto');
});

test('S6.8.8.2 A/B diagnostics do not authorize physical projector for MP4',async({page})=>{
 await page.goto('/');
 await selectSource(page,'Video MP4');
 await expect(page.getByRole('button',{name:'Sembunyikan kerangka tubuh'})).toBeVisible();
 await openStageMap(page);
 const router=page.locator('.stage-dual');
 await expect(router).toContainText('Dua output fisik terkunci');
 const open=router.getByRole('button',{name:'Buka output'});
 await expect(open).toHaveCount(2);
 for(const button of await open.all())await expect(button).toBeDisabled();
});


test('S0.6.1 main Tracking registry retains A/B between skipped AI frames in Chromium',async({page})=>{
 await page.goto('/');
 const result=await page.evaluate(async()=>{
  const {PersistentActorRegistry}=await import('/src/stage/persistentActorRegistry.ts');
  const {ActorMotionStateBuffer}=await import('/src/stage/actorMotionStateBuffer.ts');
  const pose=x=>Array.from({length:33},(_,i)=>({
   x:x+(i%2)*.005,y:.2+(i%7)*.045,z:0,visibility:.96
  }));
  const state=(id,presence,rawIndex,atMs)=>({id,presence,rawIndex,
   lastSeenAtMs:atMs,confidence:presence==='visible'?.95:0});
  const r=new PersistentActorRegistry(),b=new ActorMotionStateBuffer();
  const ingest=(atMs,actors,rawPoses,assignments,ambiguous=false)=>{
   const persisted=r.observe(atMs,actors,assignments);
   b.ingest({atMs,segment:1,actorStates:actors,rawPoses,
    persistentActors:persisted,ambiguous});
  };
  ingest(1000,[state('A','visible',0,1000),state('B','visible',1,1000)],
   [pose(.2),pose(.8)],
   [{id:'A',rawIndex:0,pose:pose(.2),confidence:.96},
    {id:'B',rawIndex:1,pose:pose(.8),confidence:.96}]);
  ingest(1080,[state('A','visible',0,1080),state('B','occluded',null,1000)],
   [pose(.25)],[{id:'A',rawIndex:0,pose:pose(.25),confidence:.96}],true);
  const partial=b.present(1100),persisted=r.snapshot;
  ingest(1160,[state('A','occluded',null,1080),state('B','occluded',null,1000)],
   [],[],true);
  const missing=b.present(1180);
  ingest(1240,[state('A','visible',1,1240),state('B','visible',0,1240)],
   [pose(.74),pose(.30)],
   [{id:'A',rawIndex:1,pose:pose(.30),confidence:.96},
    {id:'B',rawIndex:0,pose:pose(.74),confidence:.96}]);
  const returned=b.present(1260);
  return {
   partial:partial.actors.map(a=>({id:a.id,tentative:a.tentative,label:a.label})),
   missing:missing.actors.map(a=>({id:a.id,tentative:a.tentative,label:a.label})),
   stored:persisted.map(a=>({id:a.id,registered:a.registered,
    observed:a.observed,lastObservedAtMs:a.lastObservedAtMs})),
   returned:returned.actors.map(a=>({id:a.id,label:a.label}))
  };
 });
 expect(result.partial).toHaveLength(2);
 expect(result.partial.find(a=>a.id==='A').tentative).toBe(false);
 expect(result.partial.find(a=>a.id==='B').tentative).toBe(true);
 expect(result.stored.every(a=>a.registered)).toBe(true);
 expect(result.missing.every(a=>a.tentative)).toBe(true);
 expect(result.returned.map(a=>a.label)).toEqual(['ACTOR A','ACTOR B']);
});


test('S0.6.2 Chromium: BODY follows independently moving A/B pixels between AI observations',async({page})=>{
 await page.goto('/');
 const observed=await page.evaluate(async()=>{
  const {SparseVideoOpticalFlow}=await import('/src/stage/footprintsVideoOpticalFlow.ts');
  const {ActorMotionStateBuffer}=await import('/src/stage/actorMotionStateBuffer.ts');
  const W=256,H=144;
  const pose=cx=>{
   const out=Array.from({length:33},()=>({x:cx/W,y:.5,z:0,visibility:.96}));
   for(const [i,dx,y] of [[11,-.036,.30],[12,.036,.30],[23,-.032,.62],[24,.032,.62]])
    out[i]={x:cx/W+dx,y,z:0,visibility:.96};
   return out;
  };
  const saved=(id,cx)=>({id,registered:true,observed:true,presence:'visible',
   lastObservedAtMs:1000,ageMs:0,lastPose:pose(cx),center:{x:cx/W,y:.46},
   velocity:{x:0,y:0},box:null,rawIndex:id==='A'?0:1,confidence:.95,observedFrames:3});
  const paint=(atMs,ca,cb)=>{
   const gray=new Uint8Array(W*H).fill(18);
   for(const [cx,code] of [[ca,1],[cb,2]]){
    for(let y=-24;y<=24;y++)for(let x=-14;x<=14;x++){
     const xx=cx+x,yy=66+y,raw=(x*41+y*29+x*y*7+code*37)%173;
     if(xx>=0&&xx<W&&yy>=0&&yy<H)gray[yy*W+xx]=40+(raw+173)%173;
    }
   }
   return {atMs,width:W,height:H,gray};
  };
  const list=[saved('A',62),saved('B',194)];
  const flow=new SparseVideoOpticalFlow();
  const bank=new ActorMotionStateBuffer();
  bank.ingest({atMs:1000,segment:0,rawPoses:[pose(62),pose(194)],ambiguous:false,
   actorStates:[{id:'A',presence:'visible',rawIndex:0},
    {id:'B',presence:'visible',rawIndex:1}]});
  flow.ingest(paint(1000,62,194),list);
  flow.ingest(paint(1040,65,191),list);
  const optical=flow.ingest(paint(1080,68,188),list);
  const body=bank.present(1080,optical);
  return {optical:optical.actors.map(a=>({id:a.id,dx:a.dx,confidence:a.confidence})),
   body:body.actors.map(a=>({id:a.id,mode:a.mode,x:a.pose[11].x}))};
 });
 expect(observed.optical.map(a=>a.id)).toEqual(['A','B']);
 expect(observed.optical[0].dx).toBeGreaterThan(.016);
 expect(observed.optical[1].dx).toBeLessThan(-.016);
 expect(observed.body.every(a=>a.mode==='flow')).toBe(true);
 expect(observed.body[0].x).toBeGreaterThan(observed.body[1].x-.6);
});
