import test from 'node:test';
import assert from 'node:assert/strict';
import {claimPhoneTransport,releasePhoneTransport,reportPhoneTransport,
 readPhoneTransport,extractPhoneRtpStats,PHONE_DIAGNOSTIC_TTL_MS,
 type PhoneTransportSample} from '../src/stage/PhoneDeviceTelemetry.ts';
import {appendDeviceSample,assessDeviceTrial,beginDeviceTrial,
 DEVICE_PROVISIONAL_GATES,exportDeviceTrial,finishDeviceTrial,
 recordDeviceObservation,recordSoftwareBlackout,summarizeDeviceTrial,
 withDeviceChecklist,type DeviceTrial,type DeviceSample} from '../src/stage/RealDeviceTrial.ts';

const phone:PhoneTransportSample={
 mode:'qr',state:'connected',reported:true,sampledAtMs:2000,
 framesDecoded:100,fps:24,packetsReceived:200,packetsLost:0,
 jitterMs:12,rttMs:35,bytesReceived:123456,frameWidth:1280,frameHeight:720,
 reason:'connected'
};
const sample=(i:number,over:Partial<DeviceSample>={}):DeviceSample=>({
 elapsedMs:i*1000,transport:'connected',source:'qr',phoneActive:true,
 framesDecoded:100+i*22,fps:22,packetsReceived:1000+i*45,packetsLost:i,
 jitterMs:10,rttMs:30,frameWidth:1280,frameHeight:720,
 frameAgeMs:140,poseTracked:true,identityAmbiguous:false,
 observedTwo:true,calibrated:true,calibrationMatched:true,
 cameraContacts:10+Math.floor(i/8),inferenceMs:15,pipelineMs:28,...over
});
function populated(performers:1|2=2):DeviceTrial{
 let t=beginDeviceTrial({nowMs:1000,source:'qr',performers,phoneActive:true,
  transport:phone,phoneModel:'Android lab device',browserLabel:'Chrome',
  networkLabel:'Wi-Fi test',videoReference:'take-01.mp4'});
 for(let i=1;i<=70;i++)t=appendDeviceSample(t,sample(i,{observedTwo:performers===2}));
 t=appendDeviceSample(t,sample(71,{transport:'offline',phoneActive:false,
  frameAgeMs:null,poseTracked:false}));
 t=recordSoftwareBlackout(t,70500);
 const cases=performers===2?
  ['walk','slow-walk','pivot','slide','crossing','disconnect'] as const:
  ['walk','slow-walk','pivot','slide','disconnect'] as const;
 for(const kind of cases){
  const actors=performers===2&&!['crossing','disconnect'].includes(kind)?
   ['A','B'] as const:performers===1&&!['disconnect'].includes(kind)?
   ['performer-1'] as const:['both'] as const;
  for(const id of actors)t=recordDeviceObservation(t,{case:kind,performer:id,
   atMs:2000,videoFrame:60,note:'Foot action documented in separate video'});
 }
 t=withDeviceChecklist(t,{phoneMounted:true,feetAndFloorVisible:true,
  externalVideoRecorded:true,physicalBlackoutWitnessed:true});
 return finishDeviceTrial(t,73000,'Stage QA witness','All checks performed in fixture');
}
test('WebRTC measurement strips candidate IPs and distinguishes network RTT from optical latency',()=>{
 const extracted=extractPhoneRtpStats([
  {type:'candidate-pair',selected:true,currentRoundTripTime:.073,
   remoteAddress:'10.2.3.4'} as never,
  {type:'inbound-rtp',kind:'audio',packetsLost:200},
  {type:'inbound-rtp',kind:'video',framesDecoded:240,
   framesPerSecond:24,packetsReceived:900,packetsLost:6,
   jitter:.019,bytesReceived:82000,frameWidth:1280,frameHeight:720},
 ]);
 assert.equal(extracted.fps,24);
 assert.equal(extracted.jitterMs,19);
 assert.equal(extracted.rttMs,73);
 assert.equal(extracted.framesDecoded,240);
 assert.equal(extracted.packetsLost,6);
 assert.ok(!('remoteAddress' in extracted));
 assert.ok(!('localCandidateId' in extracted));
 assert.equal(extractPhoneRtpStats([{type:'outbound-rtp',framesDecoded:10}]).fps,null);
});
test('telemetry is claimed by exact receiver, with stale and old-session updates fail-closed',()=>{
 claimPhoneTransport('session-A','qr');
 reportPhoneTransport('session-A',{...phone,sampledAtMs:2000});
 assert.equal(readPhoneTransport(2001).state,'connected');
 reportPhoneTransport('session-B',{state:'interrupted',sampledAtMs:3000});
 assert.equal(readPhoneTransport(2001).state,'connected');
 claimPhoneTransport('session-B','manual');
 reportPhoneTransport('session-A',{state:'connected',sampledAtMs:4000});
 assert.equal(readPhoneTransport(performance.now()).mode,'manual');
 reportPhoneTransport('session-B',{state:'connected',sampledAtMs:performance.now()});
 const current=readPhoneTransport(performance.now());
 assert.equal(current.state,'connected');
 assert.equal(readPhoneTransport(current.sampledAtMs+PHONE_DIAGNOSTIC_TTL_MS+1).state,'interrupted');
 releasePhoneTransport('session-A');
 assert.equal(readPhoneTransport(performance.now()).reported,true);
 releasePhoneTransport('session-B');
 assert.equal(readPhoneTransport(performance.now()).state,'offline');
});
test('trial cannot begin from simulation, stale source, laptop camera or disconnected HP',()=>{
 assert.throws(()=>beginDeviceTrial({nowMs:1000,source:'qr',performers:1,
  phoneActive:false,transport:phone,phoneModel:'',browserLabel:'',networkLabel:'',
  videoReference:''}),/HP sungguhan/);
 assert.throws(()=>beginDeviceTrial({nowMs:1000,source:'manual',performers:1,
  phoneActive:true,transport:phone,phoneModel:'',browserLabel:'',networkLabel:'',
  videoReference:''}),/HP sungguhan/);
 assert.throws(()=>beginDeviceTrial({nowMs:1000,source:'qr',performers:1,
  phoneActive:true,transport:{...phone,state:'offline'},phoneModel:'',
  browserLabel:'',networkLabel:'',videoReference:''}),/HP sungguhan/);
});
test('connected full two-performer fixture produces review-only outcome, never approval for physical light',()=>{
 const t=populated();
 const s=summarizeDeviceTrial(t,73000),gate=assessDeviceTrial(t,73000);
 assert.equal(s.durationMs,72000);
 assert.ok(s.decodedFrames>DEVICE_PROVISIONAL_GATES.minInboundFrames);
 assert.equal(s.fpsMedian,22);
 assert.ok(s.frameFreshFraction!>.95);
 assert.ok(s.trackedFraction!>.95);
 assert.ok(s.ambiguousFraction!<.05);
 assert.ok(s.packetLossFraction!<.05);
 assert.equal(s.contactDelta,8);
 assert.equal(s.disconnectRecorded,true);
 assert.equal(s.softwareBlackoutAfterLoss,true);
 assert.equal(gate.status,'ready-for-physical-review');
 const exportData=JSON.parse(exportDeviceTrial(t,73000));
 assert.equal(exportData.schema,'soma.phone-real-device-report');
 assert.equal(exportData.assessment.status,'ready-for-physical-review');
 assert.match(exportData.disclaimer,/bukan bukti otomatis cahaya/);
 assert.ok(!JSON.stringify(exportData).includes('desktopToken'));
 assert.ok(!JSON.stringify(exportData).includes('remoteAddress'));
});
test('camera disconnect event does not count as physical blackout; manual witness remains required',()=>{
 let t=populated(1);
 t={...t,checklist:{...t.checklist,physicalBlackoutWitnessed:false}};
 const status=assessDeviceTrial(t,73000);
 assert.equal(status.status,'incomplete');
 assert.ok(status.missing.some(x=>x.includes('cahaya fisik')));
 t={...t,softwareBlackoutAtMs:[]};
 const second=assessDeviceTrial(t,73000);
 assert.ok(second.missing.some(x=>x.includes('Blackout software')));
});
test('poor frame rate, missing camera tracking and ambiguous A/B cannot pass',()=>{
 let t=populated();
 t={...t,samples:t.samples.map(s=>({
  ...s,fps:8,framesDecoded:s.framesDecoded===null?null:Math.round(s.framesDecoded/3),
  poseTracked:false,identityAmbiguous:true,frameAgeMs:1500
 }))};
 const summary=assessDeviceTrial(t,73000);
 assert.equal(summary.status,'needs-adjustment');
 assert.ok(summary.failed.some(x=>x.includes('Frame rate')));
 assert.ok(summary.failed.some(x=>x.includes('Tracking')));
 assert.ok(summary.failed.some(x=>x.includes('Identitas')));
});
test('missing real-world evidence leaves trial incomplete even if synthetic numbers are excellent',()=>{
 let t=populated();
 t={...t,observations:t.observations.filter(o=>o.performer!=='B')};
 const result=assessDeviceTrial(t,73000);
 assert.equal(result.status,'incomplete');
 assert.ok(result.missing.some(x=>x.includes('performer B')));
 t={...t,endedAtMs:null,reviewComplete:false};
 const result2=assessDeviceTrial(t,73000);
 assert.ok(result2.missing.some(x=>x.includes('pemeriksa')));
});
test('same-source ownership and strict ordering prevent fake healthy samples',()=>{
 let trial=beginDeviceTrial({nowMs:1000,source:'qr',performers:1,
  phoneActive:true,transport:phone,phoneModel:'Android',
  browserLabel:'Chrome',networkLabel:'Wi-Fi',videoReference:'video.mp4'});
 trial=appendDeviceSample(trial,sample(1,{transport:'connected',source:'manual'}));
 assert.equal(trial.samples[0].transport,'interrupted');
 assert.equal(trial.samples[0].phoneActive,false);
 assert.throws(()=>appendDeviceSample(trial,sample(1)),/berurutan/);
 const stopped=finishDeviceTrial(trial,3000,'Witness','Manual');
 assert.throws(()=>appendDeviceSample(stopped,sample(2)),/ditutup/);
});
