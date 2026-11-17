/** Ephemeral distributed pairing state, backed by Redis EVAL (atomic transitions).
 * Redis keys expire automatically; no local instance state or stored video frames.
 */
import {PHONE_PAIR_MAX_SDP,PHONE_PAIR_TTL_MS,validRoom,validToken} from '../src/stage/PhonePairProtocol.ts';

type Action='create'|'join'|'poll'|'offer'|'answer'|'close';
type RedisPrimitive=string|number|null|Array<string|number|null>;
type RequestPayload={action?:Action;room?:string;token?:string;ticket?:string;sdp?:string};
const TTL_SECONDS=PHONE_PAIR_TTL_MS/1000;
const HEADER={'Content-Type':'application/json','Cache-Control':'no-store, max-age=0',
 'Referrer-Policy':'no-referrer','X-Content-Type-Options':'nosniff'};
const json=(data:Record<string,unknown>,status=200)=>new Response(JSON.stringify(data),
 {status,headers:HEADER});
const randomToken=(bytes=24)=>{
 const a=new Uint8Array(bytes);crypto.getRandomValues(a);
 return Array.from(a,v=>v.toString(16).padStart(2,'0')).join('');
};
async function digest(text:string):Promise<string>{
 const raw=await crypto.subtle.digest('SHA-256',new TextEncoder().encode(text));
 return Array.from(new Uint8Array(raw),b=>b.toString(16).padStart(2,'0')).join('');
}
const ALLOCATE=[
 "if redis.call('EXISTS',KEYS[1])==1 then return 0 end",
 "redis.call('HSET',KEYS[1],'desktop',ARGV[1],'invite',ARGV[2], 'phone','','state','waiting','offer','','answer','')",
 "redis.call('EXPIRE',KEYS[1],tonumber(ARGV[3]))",
 "return 1"
].join('\n');
const JOIN=[
 "if redis.call('HGET',KEYS[1],'state')~='waiting' then return 'expired' end",
 "if redis.call('HGET',KEYS[1],'invite')~=ARGV[1] then return 'denied' end",
 "redis.call('HSET',KEYS[1],'state','joined','phone',ARGV[2],'invite','')",
 "return 'joined'"
].join('\n');
const SEND_OFFER=[
 "if redis.call('HGET',KEYS[1],'state')~='joined' then return 'expired' end",
 "if redis.call('HGET',KEYS[1],'desktop')~=ARGV[1] then return 'denied' end",
 "redis.call('HSET',KEYS[1],'state','offered','offer',ARGV[2])",
 "return 'offered'"
].join('\n');
const SEND_ANSWER=[
 "if redis.call('HGET',KEYS[1],'state')~='offered' then return 'expired' end",
 "if redis.call('HGET',KEYS[1],'phone')~=ARGV[1] then return 'denied' end",
 "redis.call('HSET',KEYS[1],'state','answered','answer',ARGV[2])",
 "return 'answered'"
].join('\n');
const READ=[
 "local s=redis.call('HGET',KEYS[1],'state')",
 "if not s then return {'expired','',''} end",
 "local d=redis.call('HGET',KEYS[1],'desktop')",
 "local p=redis.call('HGET',KEYS[1],'phone')",
 "if d==ARGV[1] then return {s,'',redis.call('HGET',KEYS[1],'answer') or ''} end",
 "if p~='' and p==ARGV[1] then return {s,redis.call('HGET',KEYS[1],'offer') or '',''} end",
 "return {'denied','',''}"
].join('\n');
const CLOSE=[
 "local d=redis.call('HGET',KEYS[1],'desktop')",
 "local p=redis.call('HGET',KEYS[1],'phone')",
 "if (d==ARGV[1]) or (p~='' and p==ARGV[1]) then return redis.call('DEL',KEYS[1]) end",
 "return 0"
].join('\n');
const RATELIMIT=[
 "local count=redis.call('INCR',KEYS[1])",
 "if count==1 then redis.call('EXPIRE',KEYS[1],60) end",
 "return count"
].join('\n');
function environment(){
 // Vercel Upstash integration uses KV_REST_API_*; standalone Upstash
 // integrations may use UPSTASH_REDIS_REST_* instead.
 const url=process.env.UPSTASH_REDIS_REST_URL||process.env.KV_REST_API_URL;
 const token=process.env.UPSTASH_REDIS_REST_TOKEN||process.env.KV_REST_API_TOKEN;
 if(!url||!token||!url.startsWith('https://'))throw Error('NO_SIGNALING_STORAGE');
 return {url,token};
}
async function redis(command:unknown[]):Promise<RedisPrimitive>{
 const {url,token}=environment();
 const response=await fetch(url,{
  method:'POST',headers:{Authorization:'Bearer '+token,'Content-Type':'application/json'},
  body:JSON.stringify(command),signal:AbortSignal.timeout(7000),cache:'no-store'
 });
 if(!response.ok)throw Error('SIGNALING_STORAGE_UNAVAILABLE');
 const data=await response.json() as {result?:RedisPrimitive;error?:string};
 if(data.error)throw Error('SIGNALING_STORAGE_REJECTED');
 return data.result??null;
}
const evalRedis=(script:string,key:string,...args:string[])=>redis(['EVAL',script,1,key,...args]);
const key=(room:string)=>'soma:phone:room:'+room;
async function rateLimit(request:Request,action:Action):Promise<boolean>{
 const source=request.headers.get('x-vercel-forwarded-for')||
  request.headers.get('x-real-ip')||'unknown';
 const ipHash=(await digest(source)).slice(0,32);
 const limit=action==='create'?8:240;
 const count=await evalRedis(RATELIMIT,'soma:phone:rate:'+action+':'+ipHash);
 return typeof count==='number'&&count<=limit;
}
export async function POST(request:Request):Promise<Response>{
 if(request.method!=='POST')return json({ok:false,error:'Metode tidak didukung.'},405);
 const origin=request.headers.get('origin');
 const hostname=new URL(request.url).origin;
 if(!origin||origin!==hostname)
  return json({ok:false,error:'Pairing hanya dari halaman SOMA pada origin yang sama.'},403);
 if(Number(request.headers.get('content-length')||0)>110000)
  return json({ok:false,error:'Payload pairing terlalu panjang.'},413);
 try{
  environment();
  const raw=await request.text();
  if(raw.length>110000)return json({ok:false,error:'Payload pairing terlalu panjang.'},413);
  let value:RequestPayload;
  try{value=JSON.parse(raw) as RequestPayload;}catch{return json({ok:false,error:'JSON pairing tidak valid.'},400);}
  if(!value||!['create','join','poll','offer','answer','close'].includes(value.action??''))
   return json({ok:false,error:'Aksi pairing tidak dikenal.'},400);
  const action=value.action!;
  if(!await rateLimit(request,action))return json({ok:false,error:'Terlalu banyak permintaan. Coba lagi.',code:'RATE_LIMIT'},429);
  if(action==='create'){
   for(let attempt=0;attempt<3;attempt++){
    const room=randomToken(12),desktopToken=randomToken(),ticket=randomToken();
    const stored=await evalRedis(ALLOCATE,key(room),
     await digest(desktopToken),await digest(ticket),String(TTL_SECONDS));
    if(stored===1)return json({ok:true,state:'waiting',room,desktopToken,ticket,
     expiresAt:Date.now()+PHONE_PAIR_TTL_MS});
   }
   return json({ok:false,error:'Ruang pairing tidak tersedia.'},503);
  }
  if(!validRoom(value.room))return json({ok:false,error:'Kode ruang tidak valid.'},400);
  const roomKey=key(value.room);
  if(action==='join'){
   if(!validToken(value.ticket))return json({ok:false,error:'Tiket QR tidak valid.'},400);
   const phoneToken=randomToken();
   const state=await evalRedis(JOIN,roomKey,await digest(value.ticket),await digest(phoneToken));
   if(state==='joined')return json({ok:true,state:'joined',phoneToken});
   return json({ok:false,error:'QR sudah digunakan atau kedaluwarsa. Buat QR baru.',code:'ROOM_EXPIRED'},410);
  }
  if(!validToken(value.token))return json({ok:false,error:'Kunci sesi tidak valid.'},403);
  const auth=await digest(value.token);
  if(action==='close'){
   const closed=await evalRedis(CLOSE,roomKey,auth);
   return json({ok:closed===1,state:'waiting'});
  }
  if(action==='poll'){
   const result=await evalRedis(READ,roomKey,auth);
   if(!Array.isArray(result)||result[0]==='expired')
    return json({ok:false,error:'Ruang pairing berakhir. Buat QR baru.',code:'ROOM_EXPIRED'},410);
   if(result[0]==='denied')return json({ok:false,error:'Kunci pairing tidak cocok.'},403);
   return json({ok:true,state:result[0],sdp:result[2]||result[1]||undefined});
  }
  if(typeof value.sdp!=='string'||value.sdp.length<40||
   value.sdp.length>PHONE_PAIR_MAX_SDP||!value.sdp.startsWith('v=0'))
   return json({ok:false,error:'SDP WebRTC tidak valid.'},400);
  const state=await evalRedis(action==='offer'?SEND_OFFER:SEND_ANSWER,
   roomKey,auth,value.sdp);
  if(state===(action==='offer'?'offered':'answered'))
   return json({ok:true,state});
  return json({ok:false,error:'Sesi tidak sah atau sudah digunakan.',code:'ROOM_EXPIRED'},410);
 }catch(error){
  const message=error instanceof Error?error.message:'';
  if(message==='NO_SIGNALING_STORAGE')
   return json({ok:false,error:'Pairing QR belum aktif: hubungkan Upstash Redis di Vercel Preview.',
    code:'NO_SIGNALING_STORAGE'},503);
  return json({ok:false,error:'Signaling sementara tidak dapat diakses. Gunakan pairing manual.',
   code:'SIGNALING_UNAVAILABLE'},503);
 }
}
export const config={runtime:'nodejs'};
