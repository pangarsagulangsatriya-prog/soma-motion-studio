/** Session-tab only recovery credentials: never SDP, ICE, camera images or
 * credentials in localStorage or URL query. The server also enforces TTL.
 */
import {validRoom,validToken} from './PhonePairProtocol.ts';

export const PHONE_DESKTOP_SESSION_KEY='soma-phone-desktop-session-v2';
export const PHONE_SENDER_SESSION_KEY='soma-phone-sender-session-v2';

export type StoredPhoneSession={
 version:2;role:'desktop'|'phone';room:string;token:string;
 expiresAt:number;ticket?:string;
};
type SessionStore=Pick<Storage,'getItem'|'setItem'|'removeItem'>;
const resolveStore=(storage?:SessionStore):SessionStore|null=>{
 if(storage)return storage;
 try{return typeof sessionStorage==='undefined'?null:sessionStorage;}catch{return null;}
};
const keyFor=(role:StoredPhoneSession['role'])=>
 role==='desktop'?PHONE_DESKTOP_SESSION_KEY:PHONE_SENDER_SESSION_KEY;

export function readPhoneSession(role:StoredPhoneSession['role'],
 storage?:SessionStore,now=Date.now()):StoredPhoneSession|null{
 const target=resolveStore(storage);
 if(!target)return null;
 const key=keyFor(role);
 try{
  const raw=target.getItem(key);
  if(!raw)return null;
  const value=JSON.parse(raw) as Partial<StoredPhoneSession>;
  if(value.version!==2||value.role!==role||
   !validRoom(value.room)||!validToken(value.token)||
   typeof value.expiresAt!=='number'||!Number.isFinite(value.expiresAt)||
   value.expiresAt<=now||value.expiresAt>now+3*60*60*1000+60_000||
   (value.ticket!==undefined&&!validToken(value.ticket))){
   target.removeItem(key);return null;
  }
  return value as StoredPhoneSession;
 }catch{
  try{target.removeItem(key);}catch{}
  return null;
 }
}
export function savePhoneSession(value:StoredPhoneSession,storage?:SessionStore):boolean{
 const target=resolveStore(storage);
 if(!target||!validRoom(value.room)||!validToken(value.token)||
  value.version!==2||!Number.isFinite(value.expiresAt)||
  value.expiresAt<=Date.now())return false;
 try{target.setItem(keyFor(value.role),JSON.stringify(value));return true;}
 catch{return false;}
}
export function clearPhoneSession(role:StoredPhoneSession['role'],storage?:SessionStore){
 try{resolveStore(storage)?.removeItem(keyFor(role));}catch{}
}
export const hasRestorableDesktopPhone=()=>!!readPhoneSession('desktop');
