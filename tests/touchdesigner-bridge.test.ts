import test from 'node:test';
import assert from 'node:assert/strict';
import {TouchDesignerBridge,localBridgeUrl} from '../src/footprints/touchdesigner/TouchDesignerBridge.ts';
import {FloorInteractionEngine} from '../src/footprints/scenes/FloorInteractionEngine.ts';

class FakeSocket{
 readyState=0;bufferedAmount=0;packets:any[]=[];
 onopen:any=null;onmessage:any=null;onclose:any=null;onerror:any=null;
 send(raw:string){this.packets.push(JSON.parse(raw));}
 close(){this.readyState=3;this.onclose?.();}
 open(){this.readyState=1;this.onopen?.();}
 reply(type:string,extra={}){this.onmessage?.({data:JSON.stringify({schema:'soma.td-bridge',version:1,type,connectionId:this.packets[0].connectionId,...extra})});}
}
const ctx={ready:true,calibrationKey:'c1',floor:{widthM:5,depthM:5},cue:{index:0,label:'Jalan'}};
function setup(){
 let time=100;const sockets:FakeSocket[]=[];
 const bridge=new TouchDesignerBridge(()=>{const s=new FakeSocket();sockets.push(s);return s as any;},()=>time);
 const engine=new FloorInteractionEngine();engine.reset('simulator');bridge.attach(engine);bridge.tick(ctx);
 bridge.connect('127.0.0.1:8765','pairing-test-1234');const socket=sockets[0];socket.open();
 const ack=()=>socket.reply('heartbeat-ack',{ackSeq:socket.packets.at(-1).seq});
 return {bridge,engine,socket,sockets,advance:(ms:number)=>{time+=ms;ack();bridge.tick(ctx);},setTime:(value:number)=>time=value,ack};
}
function contact(engine:FloorInteractionEngine,id='c1',actor='A'){
 engine.contact({source:'simulator',actorId:actor,foot:'left',x:.4,y:.6,atMs:100,eventId:id,confidence:1,basis:'simulated',verified:true});
}
test('loopback URL only; no credentials/query or remote data destinations',()=>{
 assert.equal(localBridgeUrl('127.0.0.1:8765'),'ws://127.0.0.1:8765/');
 for(const url of ['https://localhost','ws://example.com','ws://localhost@evil.com','ws://localhost/?token=x'])assert.throws(()=>localBridgeUrl(url));
});
test('handshake required; start is explicit; no historic contacts; exact event once; blackout stops',()=>{
 const {bridge,engine,socket}=setup();contact(engine,'old');
 assert.equal(bridge.start(),false);assert.equal(socket.packets.length,1);
 socket.reply('hello-ack');assert.equal(bridge.getSnapshot().phase,'connected');
 assert.equal(bridge.start(),true);contact(engine,'new');contact(engine,'new');
 assert.equal(socket.packets.filter(p=>p.type==='event').length,1);
 bridge.stop('blackout');contact(engine,'after');
 assert.equal(socket.packets.filter(p=>p.type==='event').length,1);
 assert.equal(socket.packets.at(-1).action,'blackout');
});
test('fresh per-foot samples, provenance and null missing foot; expire with wall time even paused media clock',()=>{
 const {bridge,engine,socket,advance}=setup();socket.reply('hello-ack');bridge.start();
 engine.observe({source:'simulator',actorId:'A',x:.5,y:.5,confidence:1,atMs:10,basis:'simulated'});
 engine.observeFoot({source:'simulator',actorId:'A',foot:'left',x:.3,y:.7,confidence:1,atMs:10,basis:'simulated'});
 advance(50);let state=socket.packets.filter(p=>p.type==='state').at(-1);
 assert.equal(state.actors[0].feet.left.coordinateSpace,'simulated-floor-uv');
 assert.equal(state.actors[0].feet.left.status,null);assert.equal(state.actors[0].feet.right,null);
 advance(650);state=socket.packets.filter(p=>p.type==='state').at(-1);
 assert.equal(state.actors[0].feet.left,null);assert.equal(state.actors[0].tracking,'lost');
});
test('state rate <=20Hz, events immediate, uncertainty never stamps assigned actor',()=>{
 const {bridge,engine,socket,advance}=setup();socket.reply('hello-ack');bridge.start();
 for(let i=0;i<100;i++)advance(10);
 assert.ok(socket.packets.filter(p=>p.type==='state').length<=20);
 contact(engine,'bad','unassigned-0');assert.equal(socket.packets.filter(p=>p.type==='event').length,0);
 contact(engine);assert.equal(socket.packets.at(-1).type,'event');
});
test('source generation, lost source, calibration and stop all require manual resume',()=>{
 for(const reason of ['generation','source','calibration']){
  const {bridge,engine,socket}=setup();socket.reply('hello-ack');bridge.start();
  if(reason==='generation')engine.reset('video');
  if(reason==='source')bridge.tick({...ctx,ready:false});
  if(reason==='calibration')bridge.tick({...ctx,calibrationKey:'c2'});
  assert.equal(bridge.getSnapshot().phase,'connected');
  assert.ok(socket.packets.some(p=>p.type==='control'&&p.action==='reset'));
 }
});
test('handshake timeout, missed receiver, backpressure and reconnect never auto resume',()=>{
 const first=setup();first.setTime(6000);first.bridge.tick(ctx);assert.equal(first.bridge.getSnapshot().phase,'error');
 const second=setup();second.socket.reply('hello-ack');second.bridge.start();second.setTime(1800);second.bridge.tick(ctx);
 assert.equal(second.bridge.getSnapshot().phase,'error');
 const third=setup();third.socket.reply('hello-ack');third.bridge.start();third.socket.bufferedAmount=70000;
 contact(third.engine);assert.equal(third.bridge.getSnapshot().phase,'error');assert.equal(third.socket.readyState,3);
 third.bridge.connect('localhost:8765','pairing-test-1234');third.sockets[1].open();third.sockets[1].reply('hello-ack');
 assert.equal(third.bridge.getSnapshot().phase,'connected');
});
test('test events explicitly synthetic and uniquely identified',()=>{
 const {bridge,socket}=setup();bridge.test();assert.equal(socket.packets.length,1);
 socket.reply('hello-ack');bridge.test();bridge.test();
 const events=socket.packets.filter(p=>p.type==='event');assert.equal(events.length,2);
 assert.notEqual(events[0].event.eventId,events[1].event.eventId);assert.equal(events[0].test,true);
});
