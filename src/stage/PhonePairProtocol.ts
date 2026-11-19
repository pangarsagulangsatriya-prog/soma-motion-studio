/** Shared, versioned protocol for ephemeral SOMA phone pairing.
 * QR URL tokens stay in fragment; WebRTC media never passes through signaling.
 */
export const PHONE_PAIR_API='/api/phone-pair';
export const PHONE_PAIR_TTL_MS=180_000;
export const PHONE_PAIR_POLL_MS=850;
export const PHONE_PAIR_MAX_SDP=90_000;
export type PhonePairState='waiting'|'joined'|'offered'|'answered';
export type PairRoom={
 room:string; desktopToken:string; ticket:string; expiresAt:number;
};
export type PhoneJoin={room:string;ticket:string};
export type PairResponse={
 ok:boolean;state?:PhonePairState;room?:string;desktopToken?:string;
 ticket?:string;phoneToken?:string;expiresAt?:number;sdp?:string;
 error?:string;code?:string;
};
export function pairedPhoneUrl(origin:string,pair:PhoneJoin,basePath='/'):string{
 if(!validRoom(pair.room)||!validToken(pair.ticket))throw Error('Identitas QR tidak valid.');
 const url=new URL(basePath,origin);
 url.searchParams.set('phoneCamera','1');
 url.hash=new URLSearchParams({room:pair.room,ticket:pair.ticket}).toString();
 return url.toString();
}
export function parsePhoneInvite(hash:string):PhoneJoin|null{
 const p=new URLSearchParams(hash.replace(/^#/,''));
 const room=p.get('room'),ticket=p.get('ticket');
 return validRoom(room)&&validToken(ticket)?{room,ticket}:null;
}
export const validRoom=(value:unknown):value is string=>
 typeof value==='string'&&/^[a-zA-Z0-9_-]{12,32}$/.test(value);
export const validToken=(value:unknown):value is string=>
 typeof value==='string'&&/^[a-zA-Z0-9_-]{24,64}$/.test(value);
export function parsePairResponse(value:unknown):PairResponse{
 const obj=value as PairResponse|null;
 if(!obj||typeof obj.ok!=='boolean')throw Error('Respons signaling tidak valid.');
 return obj;
}
export async function phonePairRequest(
 action:'create'|'join'|'poll'|'offer'|'answer'|'close',
 payload:Record<string,string>={},
 signal?:AbortSignal
):Promise<PairResponse>{
 const result=await fetch(PHONE_PAIR_API,{
  method:'POST',headers:{'Content-Type':'application/json'},
  cache:'no-store',credentials:'omit',
  body:JSON.stringify({action,...payload}),signal
 });
 let parsed:PairResponse;
 try{parsed=parsePairResponse(await result.json());}
 catch{throw Error('Server pairing mengembalikan respons tidak valid.');}
 if(!result.ok||!parsed.ok)throw Error(parsed.error||
  (result.status===503?'Signaling belum dikonfigurasi di Vercel.':'Pairing ditolak server.'));
 return parsed;
}
export function describePairState(value:PhonePairState):string{
 return ({waiting:'Menunggu HP memindai QR',joined:'HP bergabung. Menyiapkan WebRTC',
  offered:'Menunggu izin kamera dan jawaban HP',answered:'Membangun jalur video'})[value];
}
