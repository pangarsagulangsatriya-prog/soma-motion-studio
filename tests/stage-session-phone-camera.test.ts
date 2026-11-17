import test from 'node:test';
import assert from 'node:assert/strict';
import {defaultStageMeta,validateStageMeta,STAGE_DB,STAGE_MEDIA_LIMIT} from '../src/stage/StageSessionStore.ts';
import {encodePhoneSignal,parsePhoneSignal,phoneCameraUrl,PHONE_CAMERA_PATH} from '../src/stage/PhoneSignal.ts';

test('S6.0 Stage session stores two validated archival playback configurations',()=>{
 const project=defaultStageMeta();
 assert.equal(project.schema,'soma.stage-session');
 assert.equal(project.version,1);
 assert.equal(project.id,'local-stage');
 assert.equal(project.performers,1);
 assert.equal(project.source,'laptop');
 assert.ok(project.archiveSettings.A.zoom>=1);
 assert.ok(project.archiveSettings.B.zoom>=1);
 assert.ok(project.bridgeHoldMs>=100);
 assert.deepEqual(validateStageMeta(project),project);
 assert.ok(STAGE_DB.includes('soma-stage'));
 assert.equal(STAGE_MEDIA_LIMIT,300*1024*1024);
});
test('S6.0 Stage session validates serialized project and rejects stale or unsafe config',()=>{
 const project=defaultStageMeta();
 assert.throws(()=>validateStageMeta({...project,version:2}));
 assert.throws(()=>validateStageMeta({...project,source:'untrusted'}));
 assert.throws(()=>validateStageMeta({...project,performers:3}));
 assert.throws(()=>validateStageMeta({...project,bridgeHoldMs:0}));
 assert.throws(()=>validateStageMeta({...project,archiveSettings:{
  ...project.archiveSettings,A:{...project.archiveSettings.A,zoom:999}
 }}));
 assert.equal(validateStageMeta({...project,source:'phone',performers:2}).source,'phone');
});
test('S6.1 direct phone signal creates/accepts complete SDP offers and answers',()=>{
 const sdp='v=0\r\no=- 12345 2 IN IP4 127.0.0.1\r\ns=-\r\nt=0 0\r\na=ice-ufrag:abcd\r\n';
 const offer=encodePhoneSignal({type:'offer',sdp});
 assert.equal(parsePhoneSignal(offer,'offer').sdp,sdp);
 const answer=encodePhoneSignal({type:'answer',sdp});
 assert.equal(parsePhoneSignal(answer,'answer').type,'answer');
 assert.deepEqual(parsePhoneSignal(JSON.stringify({type:'offer',sdp}),'offer'),{type:'offer',sdp});
 assert.throws(()=>parsePhoneSignal(offer,'answer'),/tidak cocok/);
 assert.throws(()=>parsePhoneSignal('bad','offer'));
 assert.throws(()=>parsePhoneSignal(JSON.stringify({type:'offer',sdp:'bad'}),'offer'));
 assert.equal(phoneCameraUrl('https://soma-motion-studio.vercel.app'),
  'https://soma-motion-studio.vercel.app'+PHONE_CAMERA_PATH);
});
