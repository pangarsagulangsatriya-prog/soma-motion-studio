import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {PHONE_LINK_GRACE_MS,PHONE_HEARTBEAT_WARN_MS,
 PHONE_HEARTBEAT_EXPIRE_MS,phoneLinkAction,phoneHeartbeatAction}
 from '../src/stage/phoneLinkRecovery.ts';

test('short WebRTC disconnect stays recoverable; expired and failed link stop',()=>{
 assert.equal(PHONE_LINK_GRACE_MS,12000);
 assert.equal(phoneLinkAction('connected'), 'healthy');
 assert.equal(phoneLinkAction('disconnected',800), 'recovering');
 assert.equal(phoneLinkAction('disconnected',11999), 'recovering');
 assert.equal(phoneLinkAction('disconnected',12000), 'fatal');
 assert.equal(phoneLinkAction('failed'), 'fatal');
 assert.equal(phoneLinkAction('closed'), 'fatal');
 assert.equal(phoneLinkAction('connecting'), 'connecting');
});
test('heartbeat gap immediately marks stream interrupted, but allows short recovery',()=>{
 assert.equal(PHONE_HEARTBEAT_WARN_MS,4500);
 assert.equal(PHONE_HEARTBEAT_EXPIRE_MS,12000);
 assert.equal(phoneHeartbeatAction(600,'connected',true),'healthy');
 assert.equal(phoneHeartbeatAction(4800,'connected',true),'recovering');
 assert.equal(phoneHeartbeatAction(9000,'connected',false),'recovering');
 assert.equal(phoneHeartbeatAction(12000,'connected',true),'fatal');
 assert.equal(phoneHeartbeatAction(100,'disconnected',true),'recovering');
 assert.equal(phoneHeartbeatAction(100,'failed',true),'fatal');
});
test('both QR peers preserve capture during short disruptions and use new QR after terminal loss',()=>{
 const root=new URL('../src/stage/',import.meta.url);
 const receiver=readFileSync(new URL('AutomaticPhoneReceiver.tsx',root),'utf8');
 const sender=readFileSync(new URL('AutomaticPhoneSender.tsx',root),'utf8');
 assert.match(receiver,/onInterrupted\?\.\(\)/);
 assert.match(receiver,/PHONE_LINK_GRACE_MS/);
 assert.match(receiver,/setPhase\('recovering'\)/);
 assert.match(receiver,/phoneHeartbeatAction/);
 assert.match(receiver,/if\(generation.current===version&&!interrupted.current\)/);
 assert.doesNotMatch(receiver,/failed'\|\|pc\.connectionState==='disconnected'\)\{/);
 assert.match(sender,/usePhoneWakeLock/);
 assert.match(sender,/setPhase\('recovering'\)/);
 assert.match(sender,/PHONE_LINK_GRACE_MS/);
 assert.match(sender,/window\.confirm/);
 assert.match(sender,/beforeunload/);
});
test('manual QR/codes and landscape bridge revoke projector approval on loss',()=>{
 const root=new URL('../src/',import.meta.url);
 const manual=readFileSync(new URL('stage/PhoneCameraReceiver.tsx',root),'utf8');
 const phone=readFileSync(new URL('stage/PhoneCameraSender.tsx',root),'utf8');
 const app=readFileSync(new URL('App.tsx',root),'utf8');
 const bridge=readFileSync(new URL('engine/landscapePhoneCamera.ts',root),'utf8');
 assert.match(manual,/onInterruptedRef\.current\?\.\(\)/);
 assert.match(manual,/PHONE_LINK_GRACE_MS/);
 assert.match(manual,/clearRetry/);
 assert.match(phone,/usePhoneWakeLock/);
 assert.match(phone,/window\.confirm/);
 assert.match(app,/function interruptPhoneCamera\(\)/);
 assert.match(app,/requestStageBlackout\(\(\)=>projection\.setTransport\('blackout'\)\)/);
 assert.match(app,/liveFloorEngine\.revoke\('Video kamera HP tertahan/);
 assert.match(bridge,/onSourceInterrupted\?\.\(\)/);
 assert.match(bridge,/frameIsFresh/);
 assert.match(bridge,/PHONE_LINK_GRACE_MS/);
 assert.doesNotMatch(bridge,/setTimeout\(\(\)=>\{if\(track\.muted\)onEnded\(\);\},1500\)/);
 assert.doesNotMatch(bridge,/performance\.now\(\)-lastDecodedFrame>3200\)onEnded\(\)/);
});
test('refresh warning never impersonates a persistent live peer',()=>{
 const root=new URL('../src/stage/',import.meta.url);
 const source=readFileSync(new URL('PhoneCameraReceiver.tsx',root),'utf8');
 const auto=readFileSync(new URL('AutomaticPhoneReceiver.tsx',root),'utf8');
 const protocol=readFileSync(new URL('PhonePairProtocol.ts',root),'utf8');
 assert.match(source,/beforeunload/);
 assert.match(auto,/beforeunload/);
 assert.match(protocol,/PHONE_PAIR_TTL_MS=180_000/);
 assert.match(auto,/QR lama sekali pakai/);
});
