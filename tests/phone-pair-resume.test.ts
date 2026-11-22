import test from 'node:test';
import assert from 'node:assert/strict';
import {POST} from '../api/phone-pair.ts';
import {PHONE_DESKTOP_SESSION_KEY,PHONE_SENDER_SESSION_KEY,readPhoneSession,
 savePhoneSession,clearPhoneSession,type StoredPhoneSession}
 from '../src/stage/PhonePairPersistence.ts';
import {PHONE_SESSION_TTL_MS,PHONE_PAIR_TTL_MS}
 from '../src/stage/PhonePairProtocol.ts';

const storage=()=>{
 const m=new Map<string,string>();
 return {getItem:(k:string)=>m.get(k)??null,
  setItem:(k:string,v:string)=>{m.set(k,v);},
  removeItem:(k:string)=>{m.delete(k);},
  dump:m};
};
test('short-lived credentials remain tab-scoped, validate roles, expire and can be revoked',()=>{
 const area=storage(),now=Date.now();
 const desktop:StoredPhoneSession={version:2,role:'desktop',
  room:'a'.repeat(24),token:'c'.repeat(48),ticket:'b'.repeat(48),
  expiresAt:now+PHONE_PAIR_TTL_MS};
 assert.equal(savePhoneSession(desktop,area),true);
 assert.equal(area.dump.has(PHONE_DESKTOP_SESSION_KEY),true);
 assert.equal(area.dump.has(PHONE_SENDER_SESSION_KEY),false);
 assert.deepEqual(readPhoneSession('desktop',area,now),desktop);
 assert.equal(readPhoneSession('phone',area,now),null);
 assert.equal(readPhoneSession('desktop',area,now+PHONE_PAIR_TTL_MS+1),null);
 assert.equal(area.dump.size,0);
 assert.equal(savePhoneSession({...desktop,expiresAt:now+PHONE_SESSION_TTL_MS+9000000},area),true);
 assert.equal(readPhoneSession('desktop',area,now),null,'implausible TTL is purged');
 const phone:StoredPhoneSession={version:2,role:'phone',room:desktop.room,
  token:'d'.repeat(48),expiresAt:now+PHONE_SESSION_TTL_MS};
 assert.equal(savePhoneSession(phone,area),true);
 assert.equal(readPhoneSession('phone',area,now)?.token,phone.token);
 clearPhoneSession('phone',area);
 assert.equal(area.dump.size,0);
 area.dump.set(PHONE_DESKTOP_SESSION_KEY,'{broken json');
 assert.equal(readPhoneSession('desktop',area,now),null);
 assert.equal(area.dump.size,0);
});
test('authenticated QR room resumes on either device; epoch rejects stale offers and one-use QR',async()=>{
 type Room={desktop:string;invite:string;phone:string;state:string;offer:string;
  answer:string;epoch:number;ttl:number};
 const oldFetch=globalThis.fetch;
 const envKeys=['UPSTASH_REDIS_REST_URL','UPSTASH_REDIS_REST_TOKEN','KV_REST_API_URL','KV_REST_API_TOKEN'] as const;
 const env=Object.fromEntries(envKeys.map(k=>[k,process.env[k]]));
 process.env.KV_REST_API_URL='https://redis.test.invalid';
 process.env.KV_REST_API_TOKEN='temporary-test-secret';
 delete process.env.UPSTASH_REDIS_REST_URL;
 delete process.env.UPSTASH_REDIS_REST_TOKEN;
 const rooms=new Map<string,Room>(),rates=new Map<string,number>();
 globalThis.fetch=(async(input:string|URL|Request,init?:RequestInit)=>{
  assert.equal(String(input),'https://redis.test.invalid');
  const [opcode,script,,key,...args]=JSON.parse(String(init?.body)) as Array<string|number>;
  assert.equal(opcode,'EVAL');
  const text=String(script),id=String(key),a=args.map(String);
  const room=rooms.get(id);
  let result:unknown;
  if(text.includes("redis.call('INCR'")){
   result=(rates.get(id)??0)+1;rates.set(id,result as number);
  }else if(text.includes("redis.call('EXISTS'")){
   if(room)result=0;
   else{rooms.set(id,{desktop:a[0],invite:a[1],phone:'',state:'waiting',
    offer:'',answer:'',epoch:0,ttl:Number(a[2])});result=1;}
  }else if(text.includes("redis.call('HINCRBY'")){
   if(!room)result=['expired','0'];
   else if(room.desktop!==a[0]&&room.phone!==a[0])result=['denied','0'];
   else if(!room.phone)result=['waiting',String(room.epoch)];
   else{room.epoch++;room.state='joined';room.offer='';room.answer='';
    result=['joined',String(room.epoch)];}
  }else if(text.includes("'invite')~=ARGV[1]")){
   if(!room||room.state!=='waiting'||room.invite!==a[0])result='expired';
   else{room.phone=a[1];room.invite='';room.state='joined';room.epoch=1;
    room.ttl=Number(a[2]);result='joined';}
  }else if(text.includes("'state')~='joined'")){
   if(!room||room.state!=='joined')result='expired';
   else if(room.desktop!==a[0])result='denied';
   else if(a[2]!==String(room.epoch)&&!(a[2]===''&&room.epoch===1))result='stale';
   else{room.state='offered';room.offer=a[1];result='offered';}
  }else if(text.includes("'state')~='offered'")){
   if(!room||room.state!=='offered')result='expired';
   else if(room.phone!==a[0])result='denied';
   else if(a[2]!==String(room.epoch)&&!(a[2]===''&&room.epoch===1))result='stale';
   else{room.state='answered';room.answer=a[1];result='answered';}
  }else if(text.includes("return {'expired','',''}")){
   if(!room)result=['expired','',''];
   else if(room.desktop===a[0])result=[room.state,'',room.answer,String(room.epoch),room.ttl];
   else if(room.phone===a[0])result=[room.state,room.offer,'',String(room.epoch),room.ttl];
   else result=['denied','',''];
  }else if(text.includes("redis.call('DEL'")){
   if(room&&(room.desktop===a[0]||room.phone===a[0])){
    rooms.delete(id);result=1;
   }else result=0;
  }else throw Error('Unrecognized server transition: '+text.slice(0,90));
  return new Response(JSON.stringify({result}),{status:200,headers:{'Content-Type':'application/json'}});
 }) as typeof fetch;
 const endpoint='https://soma.example/api/phone-pair';
 const send=async(action:string,other:Record<string,string>={})=>{
  const r=await POST(new Request(endpoint,{method:'POST',
   headers:{Origin:'https://soma.example','Content-Type':'application/json'},
   body:JSON.stringify({action,...other})}));
  return {http:r.status,data:await r.json() as Record<string,unknown>};
 };
 const sdp='v=0\r\no=- 12345 2 IN IP4 127.0.0.1\r\ns=-\r\nt=0 0\r\na=ice-ufrag:test\r\n';
 try{
  const created=await send('create');
  assert.equal(created.http,200);
  const room=String(created.data.room),desktopToken=String(created.data.desktopToken),
   ticket=String(created.data.ticket);
  const phone=await send('join',{room,ticket});
  assert.equal(phone.http,200);
  assert.equal(phone.data.epoch,1);
  assert.ok(Number(phone.data.expiresAt)>Date.now()+PHONE_PAIR_TTL_MS);
  const phoneToken=String(phone.data.phoneToken);
  assert.equal((await send('join',{room,ticket})).http,410);
  assert.equal((await send('offer',{room,token:desktopToken,sdp,epoch:'1'})).http,200);
  assert.equal((await send('answer',{room,token:phoneToken,sdp,epoch:'1'})).http,200);
  assert.equal((await send('poll',{room,token:desktopToken})).data.state,'answered');
  const resumed=await send('resume',{room,token:desktopToken});
  assert.equal(resumed.http,200);
  assert.equal(resumed.data.epoch,2);
  assert.equal(resumed.data.state,'joined');
  const polled=await send('poll',{room,token:phoneToken});
  assert.equal(polled.data.epoch,2);
  assert.equal(polled.data.state,'joined');
  assert.equal((await send('offer',{room,token:desktopToken,sdp,epoch:'1'})).http,409);
  assert.equal((await send('offer',{room,token:desktopToken,sdp,epoch:'2'})).http,200);
  assert.equal((await send('answer',{room,token:phoneToken,sdp,epoch:'1'})).http,409);
  assert.equal((await send('answer',{room,token:phoneToken,sdp,epoch:'2'})).http,200);
  const fromPhone=await send('resume',{room,token:phoneToken});
  assert.equal(fromPhone.data.epoch,3);
  assert.equal((await send('poll',{room,token:desktopToken})).data.state,'joined');
  assert.equal((await send('resume',{room,token:'z'.repeat(48)})).http,403);
  assert.equal((await send('close',{room,token:phoneToken})).http,200);
  assert.equal((await send('poll',{room,token:desktopToken})).http,410);
 }finally{
  globalThis.fetch=oldFetch;
  for(const key of envKeys){
   if(env[key]===undefined)delete process.env[key];
   else process.env[key]=env[key];
  }
 }
});

test('desktop and HP refresh handoff preserves role-owned session and blackout gate',async()=>{
 const {readFileSync}=await import('node:fs');
 const source=(path:string)=>readFileSync(new URL('../'+path,import.meta.url),'utf8');
 const app=source('src/App.tsx');
 const stage=source('src/studio/v3/FootprintsStageWorkspace.tsx');
 const receiver=source('src/stage/AutomaticPhoneReceiver.tsx');
 const sender=source('src/stage/AutomaticPhoneSender.tsx');
 const phonePage=source('src/stage/PhoneCameraSender.tsx');
 const server=source('api/phone-pair.ts');
 assert.match(app,/hasRestorableDesktopPhone\(\)\?'phone':null/);
 assert.match(stage,/setPhonePanelOpen\]=useState\(\(\)=>hasRestorableDesktopPhone\(\)\)/);
 assert.match(receiver,/phonePairRequest\('resume'/);
 assert.match(receiver,/onInterrupted\?\.\(\)/);
 assert.match(receiver,/phonePairRequest\('offer'/);
 assert.match(receiver,/epoch:String\(epoch\)/);
 assert.doesNotMatch(receiver,/Room is spent after the answer/);
 assert.match(sender,/readPhoneSession\('phone'\)/);
 assert.match(sender,/phonePairRequest\('resume'/);
 assert.match(sender,/epoch>handledEpoch/);
 assert.match(phonePage,/return restored\?\{room:restored\.room,ticket:''\}:null/);
 assert.match(server,/if ARGV\[3\]~=epoch/);
 assert.match(server,/HINCRBY/);
 assert.match(app,/function interruptPhoneCamera\(\)/);
 assert.match(app,/liveFloorEngine\.revoke\('Video kamera HP tertahan/);
 assert.match(app,/requestStageBlackout\(\(\)=>projection\.setTransport\('blackout'\)\)/);
});
