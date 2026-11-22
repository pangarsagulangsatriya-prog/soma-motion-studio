import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {POST} from '../api/phone-pair.ts';
import {normalizeCameraDevices,openUniversalCamera} from '../src/engine/universalCamera.ts';

type Room={desktop:string;invite:string;phone:string;state:string;
 offer:string;answer:string;epoch:number;ttl:number};
type Reply={status:number;data:Record<string,unknown>};
const endpoint='https://soma-stress.example/api/phone-pair';
const sharedNetwork='198.51.100.42';
const sdp=(name:string)=>'v=0\r\no=- 73535 2 IN IP4 127.0.0.1\r\ns='+name+'\r\nt=0 0\r\n';
async function withMockRedis<T>(run:(env:{
 send:(action:string,payload?:Record<string,string>,ip?:string)=>Promise<Reply>;
 advanceMinute:()=>void;stats:()=>{rooms:number,rateBuckets:number,queries:number};
 })=>Promise<T>):Promise<T>{
 const oldFetch=globalThis.fetch;
 const keys=['UPSTASH_REDIS_REST_URL','UPSTASH_REDIS_REST_TOKEN',
  'KV_REST_API_URL','KV_REST_API_TOKEN'] as const;
 const previous=Object.fromEntries(keys.map(k=>[k,process.env[k]]));
 process.env.KV_REST_API_URL='https://redis-mock.invalid';
 process.env.KV_REST_API_TOKEN='mock-token';
 delete process.env.UPSTASH_REDIS_REST_URL;
 delete process.env.UPSTASH_REDIS_REST_TOKEN;
 const rooms=new Map<string,Room>();
 const rate=new Map<string,number>();let calls=0;
 const increment=(key:string)=>{const value=(rate.get(key)??0)+1;rate.set(key,value);return value;};
 globalThis.fetch=(async(input:string|URL|Request,init?:RequestInit)=>{
  assert.equal(String(input),'https://redis-mock.invalid');
  calls++;
  const arr=JSON.parse(String(init?.body)) as Array<string|number>;
  assert.equal(arr[0],'EVAL');
  const script=String(arr[1]),numberOfKeys=Number(arr[2]);
  const key=String(arr[3]),args=arr.slice(3+numberOfKeys).map(String);
  const room=rooms.get(key);
  let result:unknown=null;
  if(script.includes("local global=redis.call('INCR'")){
   assert.equal(numberOfKeys,2);
   const globalCount=increment(key),actorCount=increment(String(arr[4]));
   result=globalCount<=Number(args[0])&&actorCount<=Number(args[1])?1:0;
  }else if(script.includes("redis.call('INCR'")){
   assert.equal(numberOfKeys,1);
   result=increment(key);
  }else if(script.includes("redis.call('EXISTS'")){
   if(room)result=0;
   else{
    rooms.set(key,{desktop:args[0],invite:args[1],phone:'',state:'waiting',
     offer:'',answer:'',epoch:0,ttl:Number(args[2])});
    result=1;
   }
  }else if(script.includes("redis.call('HINCRBY'")){
   if(!room)result=['expired','0'];
   else if(room.desktop!==args[0]&&room.phone!==args[0])result=['denied','0'];
   else if(!room.phone)result=['waiting',String(room.epoch)];
   else{room.epoch++;room.state='joined';room.offer='';room.answer='';
    result=['joined',String(room.epoch)];}
  }else if(script.includes("'invite')~=ARGV[1]")){
   if(!room||room.state!=='waiting'||room.invite!==args[0])result='expired';
   else{room.phone=args[1];room.invite='';room.state='joined';room.epoch=1;
    room.ttl=Number(args[2]);result='joined';}
  }else if(script.includes("'state')~='joined'")){
   if(!room||room.state!=='joined')result='expired';
   else if(room.desktop!==args[0])result='denied';
   else if(args[2]!==String(room.epoch)&&!(args[2]===''&&room.epoch===1))
    result='stale';
   else{room.state='offered';room.offer=args[1];result='offered';}
  }else if(script.includes("'state')~='offered'")){
   if(!room||room.state!=='offered')result='expired';
   else if(room.phone!==args[0])result='denied';
   else if(args[2]!==String(room.epoch)&&!(args[2]===''&&room.epoch===1))
    result='stale';
   else{room.state='answered';room.answer=args[1];result='answered';}
  }else if(script.includes("redis.call('HSET',KEYS[1],'state','connected'")){
   if(!room||room.desktop!==args[0])result='denied';
   else if(String(room.epoch)!==args[1])result='stale';
   else if(room.state!=='answered')result='expired';
   else{room.state='connected';room.offer='';room.answer='';result='connected';}
  }else if(script.includes("return {'expired','',''}")){
   if(!room)result=['expired','',''];
   else if(room.desktop===args[0])
    result=[room.state,'',room.answer,String(room.epoch),room.ttl];
   else if(room.phone===args[0])
    result=[room.state,room.offer,'',String(room.epoch),room.ttl];
   else result=['denied','',''];
  }else if(script.includes("redis.call('DEL'")){
   if(room&&(room.desktop===args[0]||room.phone===args[0])){
    rooms.delete(key);result=1;
   }else result=0;
  }else throw Error('Unsupported Redis script '+script.slice(0,80));
  return new Response(JSON.stringify({result}),{
   status:200,headers:{'Content-Type':'application/json'}
  });
 }) as typeof fetch;
 const send=async(action:string,payload:Record<string,string>={},
  ip=sharedNetwork):Promise<Reply>=>{
  const response=await POST(new Request(endpoint,{
   method:'POST',headers:{Origin:'https://soma-stress.example',
    'Content-Type':'application/json','x-vercel-forwarded-for':ip},
   body:JSON.stringify({action,...payload})
  }));
  return {status:response.status,data:await response.json() as Record<string,unknown>};
 };
 try{return await run({send,advanceMinute:()=>rate.clear(),
  stats:()=>({rooms:rooms.size,rateBuckets:rate.size,queries:calls})});}
 finally{
  globalThis.fetch=oldFetch;
  for(const k of keys){if(previous[k]===undefined)delete process.env[k];
   else process.env[k]=previous[k];}
 }
}
for(const count of [3,10]){
 test('QR signaling '+count+' distinct cameras: same-NAT polling, isolation, loss and recovery',async()=>{
  await withMockRedis(async({send,advanceMinute,stats})=>{
   const first=await Promise.all(Array.from({length:count},()=>send('create')));
   const admitted=first.filter(r=>r.status===200);
   const denied=first.filter(r=>r.status===429);
   assert.equal(admitted.length,Math.min(8,count),
    'Security guard permits at most eight new QR invitations per shared-IP minute');
   assert.equal(denied.length,Math.max(0,count-8));
   const created=[...admitted];
   if(denied.length){
    advanceMinute(); // Ten invites are deliberately staggered, not burst-opened.
    const later=await Promise.all(denied.map(()=>send('create')));
    assert.ok(later.every(r=>r.status===200));
    created.push(...later);
   }
   const credentials=created.map((r,i)=>({
    room:String(r.data.room),ticket:String(r.data.ticket),
    desktopToken:String(r.data.desktopToken),name:'camera-'+i
   }));
   assert.equal(new Set(credentials.map(c=>c.room)).size,count);
   const joined=await Promise.all(credentials.map(c=>send('join',{
    room:c.room,ticket:c.ticket
   })));
   assert.ok(joined.every(r=>r.status===200));
   const cases=credentials.map((c,i)=>({...c,phoneToken:String(joined[i].data.phoneToken)}));
   const replay=await send('join',{room:cases[0].room,ticket:cases[0].ticket});
   assert.equal(replay.status,410,'A second phone cannot reuse the first invite');
   const negotiated=await Promise.all(cases.map(async c=>{
    const offer=await send('offer',{room:c.room,token:c.desktopToken,
     epoch:'1',sdp:sdp('offer-'+c.name)});
    const answer=await send('answer',{room:c.room,token:c.phoneToken,
     epoch:'1',sdp:sdp('answer-'+c.name)});
    return [offer.status,answer.status];
   }));
   assert.ok(negotiated.every(([offer,answer])=>offer===200&&answer===200));
   const stolen=await send('poll',{room:cases[0].room,token:cases[count-1].phoneToken});
   assert.equal(stolen.status,403,'A token from another room must never read its SDP');
   const wrongRole=await send('offer',{room:cases[0].room,token:cases[0].phoneToken,
    epoch:'1',sdp:sdp('wrong-role')});
   assert.notEqual(wrongRole.status,200,'A phone token cannot send an offer');
   // Confirm every role sees only its own offer/answer before acknowledgement.
   const firstPolls=await Promise.all(cases.flatMap(c=>[
    send('poll',{room:c.room,token:c.desktopToken}),
    send('poll',{room:c.room,token:c.phoneToken})
   ]));
   firstPolls.forEach((r,i)=>{
    const c=cases[Math.floor(i/2)];
    assert.equal(r.status,200);
    assert.equal(r.data.sdp,sdp((i%2===0?'answer-':'offer-')+c.name));
   });
   // Clear network-address-bearing SDP immediately after handshake.
   const acknowledgments=await Promise.all(cases.map(c=>send('ack',{
    room:c.room,token:c.desktopToken,epoch:'1'
   })));
   assert.ok(acknowledgments.every(r=>r.status===200));
   assert.equal((await send('ack',{room:cases[0].room,
    token:cases[0].phoneToken,epoch:'1'})).status,403);
   // About one minute of simultaneous receiver and sender polling at 850ms.
   // This models signaling only; no real video decoder, USB or radio exists here.
   let polled=0;
   for(let round=0;round<70;round++){
    const replies=await Promise.all(cases.flatMap(c=>[
     send('poll',{room:c.room,token:c.desktopToken}),
     send('poll',{room:c.room,token:c.phoneToken})
    ]));
    assert.ok(replies.every(r=>r.status===200),'No healthy session should be throttled at round '+round+' count '+count+' '+JSON.stringify(replies.map((r,i)=>({i,status:r.status,error:r.data.error})).filter(x=>x.status!==200))+' stats '+JSON.stringify(stats()));
    replies.forEach((r,i)=>{
     const c=cases[Math.floor(i/2)];
     assert.equal(r.data.epoch,1);
     assert.equal(r.data.state,'connected');
     assert.equal(r.data.sdp,undefined,'SDP is cleared after desktop ACK');
    });
    polled+=replies.length;
   }
   assert.equal(polled,count*2*70);
   // A single excessive peer is throttled while a separate peer stays healthy.
   const attacker=cases[0],throttled=await Promise.all(Array.from({length:26},
    ()=>send('poll',{room:attacker.room,token:attacker.phoneToken})));
   assert.equal(throttled.filter(r=>r.status===429).length,2);
   assert.equal((await send('poll',{room:cases[1].room,
    token:cases[1].phoneToken})).status,200,'Do not throttle healthy role via noisy peer');
   // A refreshed desktop rotates only its room epoch and rejects old answers.
   const recovered=await send('resume',{room:attacker.room,token:attacker.desktopToken});
   assert.equal(recovered.status,200);
   assert.equal(recovered.data.epoch,2);
   assert.equal((await send('answer',{room:attacker.room,token:attacker.phoneToken,
    sdp:sdp('old-response'),epoch:'1'})).status,410);
   assert.equal((await send('offer',{room:attacker.room,token:attacker.desktopToken,
    sdp:sdp('old-offer'),epoch:'1'})).status,409);
   assert.equal((await send('offer',{room:attacker.room,token:attacker.desktopToken,
    sdp:sdp('new-offer'),epoch:'2'})).status,200);
   assert.equal((await send('answer',{room:attacker.room,token:attacker.phoneToken,
    sdp:sdp('new-answer'),epoch:'2'})).status,200);
   const otherRoom=cases[count-1];
   assert.equal((await send('poll',{room:otherRoom.room,
    token:otherRoom.desktopToken})).data.epoch,1);
   assert.equal((await send('close',{room:attacker.room,
    token:attacker.phoneToken})).status,200);
   assert.equal((await send('poll',{room:attacker.room,
    token:attacker.desktopToken})).status,410);
   assert.equal((await send('poll',{room:otherRoom.room,
    token:otherRoom.desktopToken})).status,200);
   console.log('MOCK SIGNALING STRESS',JSON.stringify({
    cameras:count,simulatedPolls:polled,
    redisTransactions:stats().queries,remainingRooms:stats().rooms,
    sameNat:true,physicalMedia:'not-tested'
   }));
  });
 });
}
test('10 USB/virtual devices are enumerated and deduplicated; one selected source only',async()=>{
 const candidates=Array.from({length:10},(_,i)=>({
  deviceId:'usb-'+(i+1),kind:'videoinput' as const,
  label:i%2===0?'Phone Webcam '+i:'HDMI Capture '+i
 }));
 const normalized=normalizeCameraDevices([
  ...candidates,{...candidates[0]},{deviceId:'mic-1',
   kind:'audioinput' as MediaDeviceKind,label:'Microphone'}
 ]);
 assert.equal(normalized.length,10);
 assert.equal(new Set(normalized.map(x=>x.deviceId)).size,10);
 const attempts:string[]=[];
 const getUserMedia=async(constraints:MediaStreamConstraints)=>{
  const track=(constraints.video as MediaTrackConstraints).deviceId as {exact:string};
  attempts.push(track.exact);
  const fakeTrack={readyState:'live',stop:()=>{}};
  return {getVideoTracks:()=>[fakeTrack],getTracks:()=>[fakeTrack],
   active:true} as unknown as MediaStream;
 };
 const chosen=await openUniversalCamera({getUserMedia} as MediaDevices,'usb-7');
 assert.equal(chosen.profile,'wide-720');
 assert.deepEqual(attempts,['usb-7']);
 const root=new URL('../src/',import.meta.url);
 const app=readFileSync(new URL('App.tsx',root),'utf8');
 const source=readFileSync(new URL('studio/v3/sourceSwitchModel.ts',root),'utf8');
 assert.match(app,/const video=useRef<HTMLVideoElement>\(null\)/);
 assert.match(app,/const phoneLandscapeRef=useRef<LandscapePhoneCamera\|null>\(null\)/);
 assert.match(app,/const sourceChangeLock=useRef\(false\)/);
 assert.match(source,/export type FootprintsInputChoice='webcam'\|'phone'\|'video'\|'simulator'/);
 console.log('USB CAMERA REGISTRY: 10 devices recognized; 1 active pipeline, concurrent video NOT tested');
});
test('signaling enforces same-origin and rejects excessive payload before Redis',async()=>{
 await withMockRedis(async({send,stats})=>{
  const valid=await send('create');
  assert.equal(valid.status,200);
  const wrong=await POST(new Request(endpoint,{method:'POST',headers:{
   Origin:'https://attacker.example','Content-Type':'application/json'
  },body:JSON.stringify({action:'poll',room:valid.data.room,token:valid.data.desktopToken})}));
  assert.equal(wrong.status,403);
  const oversized=await POST(new Request(endpoint,{method:'POST',
   headers:{Origin:'https://soma-stress.example','Content-Type':'application/json'},
   body:JSON.stringify({action:'offer',sdp:'x'.repeat(112000)})
  }));
  assert.equal(oversized.status,413);
  assert.equal(stats().rooms,1);
 });
});
