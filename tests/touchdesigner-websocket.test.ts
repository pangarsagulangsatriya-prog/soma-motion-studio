import {spawn} from 'node:child_process';
import test from 'node:test';
import assert from 'node:assert/strict';
import {TouchDesignerBridge} from '../src/footprints/touchdesigner/TouchDesignerBridge.ts';
import {FloorInteractionEngine} from '../src/footprints/scenes/FloorInteractionEngine.ts';
const pause=(ms:number)=>new Promise(resolve=>setTimeout(resolve,ms));
async function until(check:()=>boolean){for(let i=0;i<80;i++){if(check())return;await pause(25);}throw Error('Timed out waiting for WebSocket fixture');}
// Optional integration fixture uses Python websockets; ordinary npm test stays dependency-free.
test('real WebSocket exchanges sender JSON with the Python receiver', {skip:process.env.SOMA_TD_INTEGRATION!=='1'},async()=>{
 const child=spawn('python3',['tests/touchdesigner-websocket-server.py']);let log='';
 child.stdout.on('data',data=>{log+=data;});child.stderr.on('data',data=>{log+=data;});
 const bridge=new TouchDesignerBridge();let timer:ReturnType<typeof setInterval>|undefined;
 try{
  await until(()=>log.includes('READY'));
  const engine=new FloorInteractionEngine();engine.reset('simulator');bridge.attach(engine);
  const context={ready:true,calibrationKey:'test',floor:{widthM:5,depthM:5},cue:{index:0,label:'Jalan'}};
  bridge.tick(context);timer=setInterval(()=>bridge.tick(context),50);
  bridge.connect('ws://127.0.0.1:18765','test-pairing-1234');await until(()=>bridge.getSnapshot().phase==='connected');
  bridge.test();await until(()=>log.includes('EVENT 1'));
  assert.equal(bridge.start(),true);
  engine.observe({source:'simulator',actorId:'A',x:.4,y:.5,confidence:1,atMs:1,basis:'simulated'});
  engine.observeFoot({source:'simulator',actorId:'A',foot:'left',x:.4,y:.5,confidence:1,atMs:1,basis:'simulated'});
  await until(()=>log.includes('STATE 1'));
  await pause(1100);assert.equal(bridge.getSnapshot().phase,'streaming');
  bridge.stop('blackout');await until(()=>log.includes('CONTROL blackout'));
  assert.equal(log.includes('ERROR'),false,log);
 }finally{clearInterval(timer);bridge.dispose();child.kill();}
});
