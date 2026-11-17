import {test,expect} from '@playwright/test';

test('S0 actual classic Web Worker initializes MediaPipe WASM + D3 image model in Chromium',async({page})=>{
 test.setTimeout(90_000);
 await page.goto('/');
 const boot=await page.evaluate(async()=>{
  const {ReplayInferenceWorkerClient}=await import('/src/stage/replayInferenceWorkerClient.ts');
  const client=new ReplayInferenceWorkerClient();
  try{
   await client.init();
   const ready=client.boot;
   const canvas=document.createElement('canvas');
   canvas.width=320;canvas.height=180;
   const ctx=canvas.getContext('2d');
   if(!ctx)throw Error('Canvas context unavailable');
   ctx.fillStyle='#101010';ctx.fillRect(0,0,320,180);
   const stream=canvas.captureStream(20);
   const video=document.createElement('video');
   video.muted=true;video.playsInline=true;video.srcObject=stream;
   await video.play();
   await new Promise(resolve=>setTimeout(resolve,120));
   const result=await client.detect(video,performance.now(),2,[]);
   stream.getTracks().forEach(track=>track.stop());
   video.pause();video.srcObject=null;
   return {ready,d3:result.d3,poses:result.landmarks.length,
    ms:result.poseMs,workerOutput:true};
  }finally{client.dispose();}
 });
 expect(boot.ready?.runtime).toBe('classic');
 expect(boot.ready?.poseReady).toBe(true);
 expect(boot.ready?.d3Ready).toBe(true);
 expect(boot.d3?.status).toBe('active');
 expect(boot.ms).toBeGreaterThan(0);
});
