import {test,expect} from '@playwright/test';

test.setTimeout(90_000);

async function selectSource(page,name){
 await page.locator('.fp-source-switch-trigger').click();
 await page.locator('.fp-source-switch-option').filter({hasText:name}).click();
 await expect(page.locator('.fp-source-switch-trigger')).toContainText(name);
}

test('S6.8.8.2 video defaults to automatic actor count and exposes manual override only in Lab',async({page})=>{
 await page.goto('/?lab=1');
 await selectSource(page,'Video MP4');
 await expect(page.locator('.fp-source-switch-trigger')).toContainText('Video MP4');
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
 await page.locator('.fp-transport-projector').click();
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
