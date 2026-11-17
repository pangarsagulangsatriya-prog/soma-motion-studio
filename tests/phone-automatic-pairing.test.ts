import test from 'node:test';
import assert from 'node:assert/strict';
import {pairedPhoneUrl,parsePhoneInvite,validRoom,validToken,
 PHONE_PAIR_TTL_MS,parsePairResponse} from '../src/stage/PhonePairProtocol.ts';
import {POST} from '../api/phone-pair.ts';

test('QR URL keeps its secret in URL fragment, never the request path/query',()=>{
 const room='123456789abcdef012345678',ticket='0'.repeat(48);
 const url=pairedPhoneUrl('https://soma-motion-studio.vercel.app',{room,ticket});
 const parsed=new URL(url);
 assert.equal(parsed.pathname,'/');
 assert.equal(parsed.search,'?phoneCamera=1');
 assert.equal(parsed.hash.includes(ticket),true);
 assert.equal(parsed.search.includes(ticket),false);
 assert.deepEqual(parsePhoneInvite(parsed.hash),{room,ticket});
 assert.equal(parsePhoneInvite('#room=a&ticket=not_a_ticket'),null);
 assert.equal(validRoom(room),true);
 assert.equal(validRoom('bad room'),false);
 assert.equal(validToken(ticket),true);
 assert.equal(validToken('123'),false);
 assert.equal(PHONE_PAIR_TTL_MS,180_000);
 assert.deepEqual(parsePairResponse({ok:true,state:'waiting'}),{ok:true,state:'waiting'});
 assert.throws(()=>parsePairResponse('invalid'),/respons/i);
});

const endpoint='https://soma.example/api/phone-pair';
const make=(payload:Record<string,unknown>,origin='https://soma.example')=>
 new Request(endpoint,{method:'POST',headers:{Origin:origin,'Content-Type':'application/json'},
 body:JSON.stringify(payload)});
const send=async(payload:Record<string,unknown>,origin?:string)=>{
 const response=await POST(make(payload,origin));
 return {status:response.status,body:await response.json() as Record<string,unknown>};
};
test('server rejects cross-site requests without reading storage',async()=>{
 const response=await send({action:'create'},'https://attacker.example');
 assert.equal(response.status,403);
 assert.equal(response.body.ok,false);
});
test('server reports missing Redis explicitly and does not invent a usable QR room',async()=>{
 const oldUrl=process.env.UPSTASH_REDIS_REST_URL;
 const oldToken=process.env.UPSTASH_REDIS_REST_TOKEN;
 delete process.env.UPSTASH_REDIS_REST_URL;
 delete process.env.UPSTASH_REDIS_REST_TOKEN;
 try{
  const response=await send({action:'create'});
  assert.equal(response.status,503);
  assert.equal(response.body.code,'NO_SIGNALING_STORAGE');
  assert.equal(response.body.room,undefined);
 }finally{
  if(oldUrl===undefined)delete process.env.UPSTASH_REDIS_REST_URL;
  else process.env.UPSTASH_REDIS_REST_URL=oldUrl;
  if(oldToken===undefined)delete process.env.UPSTASH_REDIS_REST_TOKEN;
  else process.env.UPSTASH_REDIS_REST_TOKEN=oldToken;
 }
});
test('Redis-backed QR rooms enforce same-origin, single-use join, SDP roles and one-time close',async()=>{
 const oldUrl=process.env.UPSTASH_REDIS_REST_URL;
 const oldToken=process.env.UPSTASH_REDIS_REST_TOKEN;
 const originalFetch=globalThis.fetch;
 process.env.UPSTASH_REDIS_REST_URL='https://redis.test.invalid';
 process.env.UPSTASH_REDIS_REST_TOKEN='test-secret';
 type Room={desktop:string;invite:string;phone:string;state:string;offer:string;answer:string};
 const rooms=new Map<string,Room>();
 const counts=new Map<string,number>();
 globalThis.fetch=(async(input:string|URL|Request,init?:RequestInit)=>{
  assert.equal(String(input),'https://redis.test.invalid');
  const command=JSON.parse(String(init?.body)) as (string|number)[];
  assert.equal(command[0],'EVAL');
  const script=String(command[1]),key=String(command[3]);
  const args=command.slice(4).map(String);
  let result:unknown=null;
  const room=rooms.get(key);
  if(script.includes("redis.call('INCR'")){
   result=(counts.get(key)??0)+1;counts.set(key,result as number);
  }else if(script.includes("redis.call('EXISTS'")){
   if(room)result=0;
   else{rooms.set(key,{desktop:args[0],invite:args[1],phone:'',
    state:'waiting',offer:'',answer:''});result=1;}
  }else if(script.includes("'invite')~=ARGV[1]")){
   if(!room||room.state!=='waiting'||room.invite!==args[0])result='expired';
   else{room.phone=args[1];room.invite='';room.state='joined';result='joined';}
  }else if(script.includes("'state')~='joined'")){
   if(!room||room.state!=='joined')result='expired';
   else if(room.desktop!==args[0])result='denied';
   else{room.offer=args[1];room.state='offered';result='offered';}
  }else if(script.includes("'state')~='offered'")){
   if(!room||room.state!=='offered')result='expired';
   else if(room.phone!==args[0])result='denied';
   else{room.answer=args[1];room.state='answered';result='answered';}
  }else if(script.includes("return {'expired','',''}")){
   if(!room)result=['expired','',''];
   else if(room.desktop===args[0])result=[room.state,'',room.answer];
   else if(room.phone===args[0])result=[room.state,room.offer,''];
   else result=['denied','',''];
  }else if(script.includes("redis.call('DEL'")){
   if(room&&(room.desktop===args[0]||room.phone===args[0])){
    rooms.delete(key);result=1;
   }else result=0;
  }else throw Error('Unrecognized Lua script in mock');
  return new Response(JSON.stringify({result}),{status:200,headers:{'Content-Type':'application/json'}});
 }) as typeof fetch;
 try{
  const create=await send({action:'create'});
  assert.equal(create.status,200);
  const room=create.body.room as string,desktopToken=create.body.desktopToken as string;
  const ticket=create.body.ticket as string;
  assert.ok(validRoom(room));
  assert.ok(validToken(desktopToken)&&validToken(ticket));
  assert.ok((create.body.expiresAt as number)>Date.now());
  const invalid=await send({action:'join',room,ticket:'1'.repeat(48)});
  assert.equal(invalid.status,410);
  const joined=await send({action:'join',room,ticket});
  assert.equal(joined.status,200);
  const phoneToken=joined.body.phoneToken as string;
  assert.ok(validToken(phoneToken));
  const replay=await send({action:'join',room,ticket});
  assert.equal(replay.status,410,'QR must not be reused by second phone');
  const offerSdp='v=0\r\no=- 12345 2 IN IP4 127.0.0.1\r\ns=-\r\nt=0 0\r\na=ice-ufrag:abcd\r\n';
  const malicious=await send({action:'offer',room,token:phoneToken,sdp:offerSdp});
  assert.equal(malicious.status,410,'Phone must not publish desktop offer');
  assert.equal((await send({action:'offer',room,token:desktopToken,sdp:offerSdp})).status,200);
  const readPhone=await send({action:'poll',room,token:phoneToken});
  assert.equal(readPhone.body.state,'offered');
  assert.equal(readPhone.body.sdp,offerSdp);
  const answerSdp=offerSdp.replace('12345','67890');
  assert.equal((await send({action:'answer',room,token:phoneToken,sdp:answerSdp})).status,200);
  const readDesktop=await send({action:'poll',room,token:desktopToken});
  assert.equal(readDesktop.body.state,'answered');
  assert.equal(readDesktop.body.sdp,answerSdp);
  assert.equal((await send({action:'close',room,token:desktopToken})).status,200);
  assert.equal((await send({action:'poll',room,token:phoneToken})).status,410);
 }finally{
  globalThis.fetch=originalFetch;
  if(oldUrl===undefined)delete process.env.UPSTASH_REDIS_REST_URL;
  else process.env.UPSTASH_REDIS_REST_URL=oldUrl;
  if(oldToken===undefined)delete process.env.UPSTASH_REDIS_REST_TOKEN;
  else process.env.UPSTASH_REDIS_REST_TOKEN=oldToken;
 }
});
