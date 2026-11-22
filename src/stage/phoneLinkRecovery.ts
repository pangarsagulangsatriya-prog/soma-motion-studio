/** QR/manual WebRTC session policy. A temporary 'disconnected' state must
 * not destroy camera tracks; any link loss still revokes projector approval.
 * A full browser reload destroys RTCPeerConnection and requires new signaling.
 */
export const PHONE_LINK_GRACE_MS=12_000;
export const PHONE_HEARTBEAT_WARN_MS=4_500;
export const PHONE_HEARTBEAT_EXPIRE_MS=12_000;
export type PhoneLinkAction='healthy'|'recovering'|'fatal'|'connecting';
export function phoneLinkAction(
 state:RTCPeerConnectionState,disconnectedForMs=0
):PhoneLinkAction{
 if(state==='connected')return 'healthy';
 if(state==='disconnected')return disconnectedForMs>=PHONE_LINK_GRACE_MS?'fatal':'recovering';
 if(state==='closed'||state==='failed')return 'fatal';
 return 'connecting';
}
export function phoneHeartbeatAction(
 ageMs:number,connection:RTCPeerConnectionState,channelOpen:boolean
):PhoneLinkAction{
 if(connection==='failed'||connection==='closed')return 'fatal';
 if(connection==='disconnected')return 'recovering';
 if(connection!=='connected')return 'connecting';
 if(!channelOpen)return ageMs>=PHONE_HEARTBEAT_EXPIRE_MS?'fatal':'recovering';
 return ageMs>=PHONE_HEARTBEAT_EXPIRE_MS?'fatal':
  ageMs>=PHONE_HEARTBEAT_WARN_MS?'recovering':'healthy';
}
