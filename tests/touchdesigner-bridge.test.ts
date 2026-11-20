import test from 'node:test';
import assert from 'node:assert/strict';
import {normalizeTdEndpoint,buildTdState,eligibleTdTrigger,tdNewEvents,poseFootObservations,
 TD_BRIDGE_SCHEMA,type TdSnapshot} from '../src/studio/v3/touchDesignerProtocol.ts';
import {TouchDesignerClient} from '../src/studio/v3/touchDesignerClient.ts';
import type {FootMotionEventV2} from '../src/footprints/scenes/FootMotionEventV2.ts';
import fs from 'node:fs';

function event(overrides:Partial<FootMotionEventV2>={}):FootMotionEventV2{
 return {schema:'soma.foot-motion-event',version:2,eventId:'e1',originEventId:'c1',
  sessionId:'floor-session-1-1',generation:1,actorId:'A',foot:'left',kind:'contact',source:'camera',
  x:.42,y:.61,atMs:1000,speed:0,confidence:.92,verified:true,
  verification:'detected-estimate',coordinateBasis:'calibrated-estimate',...overrides};
}
function snapshot(overrides:Partial<TdSnapshot>={}):TdSnapshot{
 return {source:'camera',sessionId:'floor-session-1-1',generation:1,events:[event()],ready:true,atMs:1020,
  floor:{widthM:5,depthM:5,calibrated:true},...overrides};
}
test('TD endpoint only accepts explicit loopback WebSockets, not arbitrary URLs or credentials',()=>{
 assert.equal(normalizeTdEndpoint('127.0.0.1:8765'),'ws://127.0.0.1:8765/');
 assert.equal(normalizeTdEndpoint('ws://localhost:8765/'),'ws://localhost:8765/');
 for(const bad of ['localhost:80','https://example.com','ws://8.8.8.8:8765/','wss://example.com:8765/',
  'ws://192.168.1.5:8765/','ws://user:secret@localhost:8765/','ws://localhost:8765/?room=1',
  'ws://localhost:8765/path','ws://localhost:8765/#frag','javascript:alert(1)']){
  assert.equal(normalizeTdEndpoint(bad),null,bad);
 }
});
test('TD adapter sends measured per-foot state with provenance; missing feet are null',()=>{
 const state=buildTdState(snapshot(),3);
 assert.equal(state?.coordinateSpace,'floor-uv');
 assert.equal(state?.actors.length,1);
 assert.deepEqual(state?.actors[0].feet.right,null);
 assert.equal(state?.actors[0].feet.left?.coordinateBasis,'calibrated-estimate');
 assert.equal(buildTdState(snapshot({source:'video',events:[event({source:'video',coordinateBasis:'image-2d'})],floor:null}),4)?.coordinateSpace,'image-uv');
 assert.equal(buildTdState(snapshot({source:'simulator',events:[],floor:null}),4)?.mode,'rehearsal');
 assert.equal(buildTdState(snapshot({ready:false}),4),null);
 assert.equal(buildTdState(snapshot({atMs:4000}),4)?.actors.length,0,'stale coordinates must not be reused');
});
test('TD continuous foot XY stays image-space unless simulator; invisible landmarks do not fabricate contact',()=>{
 const landmarks=Array.from({length:33},()=>({x:.5,y:.5,visibility:0}));
 landmarks[29]={x:.20,y:.65,visibility:.95};landmarks[31]={x:.26,y:.70,visibility:.95};
 const feet=poseFootObservations('A',landmarks,1000);
 assert.equal(feet.length,1);
 assert.equal(feet[0].foot,'left');assert.equal(feet[0].coordinateBasis,'image-2d');
 assert.ok(Math.abs(feet[0].x-.23)<.001);
 const state=buildTdState(snapshot({events:[],observations:feet,atMs:1040}),1);
 assert.equal(state?.actors[0].feet.left?.status,'movement');
 assert.equal(state?.actors[0].feet.right,null);
 assert.equal(state?.actors[0].feet.left?.coordinateBasis,'image-2d');
 assert.equal(buildTdState(snapshot({events:[],observations:feet,atMs:2100}),1)?.actors.length,0);
});
test('TD trigger never sends presence-only, anonymous identity or repeated contact',()=>{
 assert.equal(eligibleTdTrigger(event()),true);
 assert.equal(eligibleTdTrigger(event({coordinateBasis:'presence-only'})),false);
 assert.equal(eligibleTdTrigger(event({actorId:'unassigned-0'})),false);
 assert.equal(eligibleTdTrigger(event({verified:false})),false);
 assert.equal(eligibleTdTrigger(event({kind:'presence',foot:'unknown'})),false);
 assert.equal(tdNewEvents(snapshot(),new Set()).length,1);
 assert.equal(tdNewEvents(snapshot(),new Set(['e1'])).length,0);
});
class FakeSocket{
 readyState=0;bufferedAmount=0;messages:string[]=[];
 onopen:(()=>void)|null=null;onmessage:((event:{data:string})=>void)|null=null;
 onerror:(()=>void)|null=null;onclose:(()=>void)|null=null;
 url:string;constructor(url:string){this.url=url;}
 open(){this.readyState=1;this.onopen?.();}
 send(value:string){this.messages.push(value);}
 close(){this.readyState=3;}
 receive(value:unknown){this.onmessage?.({data:JSON.stringify(value)});}
 packets(){return this.messages.map(text=>JSON.parse(text));}
}
test('TD sender requires hello-ack, sends one event only, and resets on source change',()=>{
 let socket:FakeSocket|null=null;
 const client=new TouchDesignerClient(()=>{},(url)=>{socket=new FakeSocket(url);return socket as unknown as WebSocket;});
 assert.equal(client.connect('127.0.0.1:8765','short'),false);
 assert.equal(client.connect('127.0.0.1:8765','abcdefghijklmnop'),true);
 const sock=socket! as FakeSocket;
 sock.open();
 const hello=sock.packets()[0];assert.equal(hello.type,'hello');
 assert.equal(client.status.status,'connecting');
 sock.receive({schema:TD_BRIDGE_SCHEMA,version:1,type:'hello-ack',sessionId:hello.sessionId,nonce:'wrong'});
 assert.equal(client.status.status,'connecting');
 sock.receive({schema:TD_BRIDGE_SCHEMA,version:1,type:'hello-ack',sessionId:hello.sessionId,nonce:hello.nonce});
 assert.equal(client.status.status,'connected');
 assert.equal(client.testTrigger(),true);
 assert.equal(sock.packets().filter(p=>p.test).length,1);
 const state=snapshot();assert.equal(client.start(state),true);
 client.tick({...state,atMs:1060,events:[event(),event({eventId:'e2',atMs:1040})]});
 client.tick({...state,atMs:1100,events:[event(),event({eventId:'e2',atMs:1040})]});
 assert.equal(sock.packets().filter(p=>p.type==='event'&&!p.test).length,1);
 const entries=sock.packets();const eventIdx=entries.findIndex(p=>p.type==='event'&&!p.test);
 assert.equal(entries[eventIdx-1].type,'state','state precedes trigger');
 client.tick(snapshot({generation:2,sessionId:'floor-session-1-2',events:[],atMs:1100}));
 assert.equal(client.status.status,'connected','source change requires manual resume');
 assert.ok(sock.packets().filter(p=>p.type==='control'&&p.action==='reset').length>=2);
 client.blackout();client.disconnect();
 assert.ok(sock.packets().some(p=>p.type==='control'&&p.action==='blackout'));
 assert.equal(sock.readyState,3);
});
test('Perform UI exposes third output route and the TD start is never a physical-live authorization',()=>{
 const consoleCode=fs.readFileSync('src/studio/v3/OperatorStageConsole.tsx','utf8');
 const stageCode=fs.readFileSync('src/studio/v3/FootprintsStageWorkspace.tsx','utf8');
 const recv=fs.readFileSync('touchdesigner/soma_webserver_callbacks.py','utf8');
 assert.match(consoleCode,/TouchDesignerPerformPanel/);
 assert.match(consoleCode,/handleRouteChange\(item.id\)/);
 const routes=fs.readFileSync('src/studio/v3/performDestinationModel.ts','utf8');
 assert.match(routes,/id:'touchdesigner'/);
 assert.match(stageCode,/getTouchDesignerSnapshot/);
 assert.match(recv,/secrets\.compare_digest/);
 assert.match(recv,/data\['blackout'\] = True/);
});
