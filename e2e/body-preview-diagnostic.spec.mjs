import {test,expect} from '@playwright/test';

// Regression for the actual failure observed in Footprints:
// INPUT can see two MediaPipe poses while BODY SKELETON 33 is entirely black,
// because the lower-body geometric mask did not pass its separate safety gate.
test('BODY SKELETON 33 draws valid diagnostic poses even with no approved mask',async({page})=>{
 await page.goto('/');
 const pixels=await page.evaluate(async()=>{
  const {paintExperimentBody}=await import('/src/studio/v3/experimentStagePainter.ts');
  const canvas=document.createElement('canvas');
  const pose=(cx)=>Array.from({length:33},(_,i)=>({
   x:cx+(i%2===0?-.025:.025),
   y:.12+i/33*.70,z:0,visibility:.96
  }));
  const frame={
   kind:'video',ready:true,video:null,name:'diagnostic fixture',timeMs:1040,
   snapshot:{atMs:1000,rawPoses:[pose(.26),pose(.73)],ambiguous:false,
    actorStates:[{id:'A',presence:'visible',rawIndex:0},
                 {id:'B',presence:'visible',rawIndex:1}]},
   previousSnapshot:null
  };
  const motion={actors:[],atMs:1040,renderDelayMs:50};
  const countBright=()=>{
   const ctx=canvas.getContext('2d');
   const data=ctx.getImageData(0,0,canvas.width,canvas.height).data;
   let count=0;
   for(let i=0;i<data.length;i+=4)
    if(data[i]>40||data[i+1]>40||data[i+2]>40)count++;
   return count;
  };
  // Diagnostic 33 joints can render even when the approved mask list is empty.
  paintExperimentBody(canvas,frame,true,motion,undefined,true);
  const skeleton=countBright();
  // Switching Skeleton OFF must still honor the independent mask safety gate.
  paintExperimentBody(canvas,frame,false,motion,undefined,true);
  const blockedMask=countBright();
  return {skeleton,blockedMask};
 });
 expect(pixels.skeleton).toBeGreaterThan(250);
 expect(pixels.blockedMask).toBe(0);
});

test('BODY keeps two diagnostic actors visible when one identity is unresolved',async({page})=>{
 await page.goto('/');
 const observed=await page.evaluate(async()=>{
  const {paintExperimentBody}=await import('/src/studio/v3/experimentStagePainter.ts');
  const canvas=document.createElement('canvas');
  const pose=(cx)=>Array.from({length:33},(_,i)=>({
   x:cx+(i%2===0?-.03:.03),y:.12+i/33*.74,z:0,visibility:.96
  }));
  const raw=[pose(.25),pose(.75)];
  const frame={kind:'video',ready:true,video:null,name:'crossing diagnostic',
   timeMs:1070,snapshot:{atMs:1000,rawPoses:raw,ambiguous:true,
    actorStates:[{id:'A',presence:'visible',rawIndex:0},
                 {id:'B',presence:'reacquiring',rawIndex:null}]},
   previousSnapshot:null};
  const motion={atMs:1070,renderDelayMs:50,actors:[{
   id:'A',pose:raw[0],label:'ACTOR A',color:'#d4edb3',opacity:1,
   mode:'measured',ageMs:70,tentative:false
  }]};
  paintExperimentBody(canvas,frame,true,motion,undefined,true);
  const data=canvas.getContext('2d').getImageData(0,0,640,360).data;
  const bright=(from,to)=>{
   let count=0;
   for(let y=0;y<360;y++)for(let x=from;x<to;x++){
    const i=(y*640+x)*4;
    if(data[i]>40||data[i+1]>40||data[i+2]>40)count++;
   }
   return count;
  };
  return {left:bright(0,300),right:bright(350,640)};
 });
 expect(observed.left).toBeGreaterThan(100);
 expect(observed.right).toBeGreaterThan(100);
});
