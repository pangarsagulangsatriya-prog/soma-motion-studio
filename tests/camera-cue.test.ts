import test from 'node:test';import assert from 'node:assert/strict';
import {CameraFraming,cameraCrop} from '../src/photos/framing.ts';
import {cameraCommand,CameraVoice,type Recognition,type VoiceStatus} from '../src/photos/voice.ts';
import {emptyFrame,type Landmark} from '../src/engine/types.ts';

function frame(t:number,left:[number,number]|null,right:[number,number]|null){
 const f=emptyFrame();f.time=t;f.tracked=true;
 f.pose=Array.from({length:33},()=>({x:.5,y:.5,z:0,visibility:0}));
 const place=(i:number,x:number,y:number)=>{f.pose[i]={x,y,z:0,visibility:1};};
 place(11,.4,.4);place(12,.6,.4);place(23,.4,.76);place(24,.6,.76);
 if(left)place(15,left[0],left[1]);
 if(right)place(16,right[0],right[1]);
 return f;
}
function step(g:CameraFraming,t:number,left:[number,number]|null,right:[number,number]|null,now=t){
 return g.step(frame(t,left,right),now,true);
}
test('voice recognizes whole camera words and cancel, not word fragments',()=>{for(const s of ['Kamera!','kamera','camera','oke kamera sekarang'])assert.equal(cameraCommand(s),'camera');for(const s of ['batal kamera','Tutup kamera','batal'])assert.equal(cameraCommand(s),'cancel');for(const s of ['kameramen','kameraku','pukulan','diam'])assert.equal(cameraCommand(s),null);});
test('body camera starts closed; body pose never captures until frame opens',()=>{
 const g=new CameraFraming();
 for(let t=0;t<=300;t+=50)assert.equal(step(g,t,[.34,.65],[.66,.65]).fired,false);
 assert.equal(g.state.open,false);
});
test('frame uses body wrists and ignores hand landmark input',()=>{
 const g=new CameraFraming();g.open();
 const f=frame(0,null,null);f.hands=[Array.from({length:21},()=>({x:.5,y:.5,z:0}))];
 assert.equal(g.step(f,0,true).fired,false);
 assert.equal(g.state.phase,'waiting');
});
test('paired wrists resize smoothly and do not trigger shutter',()=>{
 const g=new CameraFraming();g.open();
 step(g,0,[.38,.62],[.62,.62]);
 for(let t=50;t<=300;t+=50)assert.equal(step(g,t,[.38-t*.00034,.62],[.62+t*.00034,.62]).fired,false);
 assert.ok(g.state.size>.6);
});
test('frame size control is independent and crop supports 12 to 100 percent',()=>{
 const g=new CameraFraming();g.open();g.setSize(.12);assert.equal(g.state.size,.12);
 g.setSize(1);assert.equal(g.state.size,1);
 for(const [w,h] of [[640,480],[480,640],[1920,1080]])
  for(const size of [-1,.12,.6,1,4,NaN]){
   const crop=cameraCrop(w,h,size);
   assert.equal(crop.width,crop.height);
   assert.ok(crop.x>=0&&crop.y>=0&&crop.x+crop.width<=w&&crop.y+crop.height<=h);
  }
});
for(const [label,dx,dy] of [['right',.16,0],['left',-.16,0],['up',0,-.16],['down',0,.16]] as const){
 test('body wrist strike '+label+' captures once',()=>{
  const g=new CameraFraming();g.open();
  for(let t=0;t<=200;t+=50)step(g,t,[.34,.62],[.66,.62]);
  const out=step(g,250,[.34+dx,.62+dy],[.66,.62]);
  assert.equal(out.fired,true);
  assert.equal(out.open,false);
  assert.equal(step(g,300,[.34+dx,.62+dy],[.66,.62]).fired,false);
 });
}
test('slow one-arm motion and torso translation do not trigger capture',()=>{
 const g=new CameraFraming();g.open();
 for(let t=0;t<550;t+=50){
  const v=t*.00010;
  assert.equal(step(g,t,[.34+v,.62],[.66,.62]).fired,false);
 }
 const h=new CameraFraming();h.open();
 for(let t=0;t<600;t+=50){
  const f=frame(t,[.34+t*.00015,.62],[.66+t*.00015,.62]);
  for(const i of [11,12,23,24])f.pose[i].x+=t*.00015;
  assert.equal(h.step(f,t,true).fired,false);
 }
});
test('tracking lost and stale samples require a new sequence',()=>{
 const g=new CameraFraming();g.open();
 step(g,0,[.34,.62],[.66,.62]);step(g,100,[.34,.62],[.66,.62]);
 const stale=frame(150,[.34,.62],[.66,.62]);
 assert.equal(g.step(stale,800,true).fired,false);
 assert.equal(step(g,850,[.5,.62],[.66,.62]).fired,false);
 const absent=frame(900,null,null);assert.equal(g.step(absent,900,true).fired,false);
 assert.equal(step(g,950,[.2,.62],[.66,.62]).fired,false);
});
test('resize does not produce a spurious photo and open command preserves size',()=>{
 const g=new CameraFraming();g.open();step(g,0,[.38,.62],[.62,.62]);
 for(let t=50;t<=300;t+=50)step(g,t,[.38-t*.00034,.62],[.62+t*.00034,.62]);
 const size=g.state.size;g.open();assert.equal(g.state.size,size);
 for(let t=350;t<=650;t+=50)assert.equal(step(g,t,[.28,.62],[.72,.62]).fired,false);
});
class FakeRecognition implements Recognition {
 static instances:FakeRecognition[]=[];lang='';continuous=false;interimResults=false;maxAlternatives=1;
 onstart:Recognition['onstart']=null;onend:Recognition['onend']=null;onerror:Recognition['onerror']=null;onresult:Recognition['onresult']=null;aborted=false;
 constructor(){FakeRecognition.instances.push(this);}start(){this.onstart?.();}abort(){this.aborted=true;this.onend?.();}
 say(text:string,index=0,final=false){this.onresult?.({resultIndex:index,results:{length:index+1,[index]:{length:1,isFinal:final,0:{transcript:text}}}});}
}
test('recognition deduplicates interim/final camera, accepts cancellation and obeys stop',()=>{const commands:string[]=[],statuses:VoiceStatus[]=[];const v=new CameraVoice(FakeRecognition,c=>commands.push(c),s=>statuses.push(s));v.start();const r=FakeRecognition.instances.at(-1)!;assert.equal(r.lang,'id-ID');r.say('kamera');r.say('kamera',0,true);r.say('kamera',1,true);r.say('batal',2,true);assert.deepEqual(commands,['camera','cancel']);v.stop();r.say('kamera',3,true);assert.equal(commands.length,2);assert.equal(r.aborted,true);assert.equal(statuses.at(-1),'off');});
test('permission denial terminates recognition without a retry loop',()=>{const statuses:VoiceStatus[]=[];const v=new CameraVoice(FakeRecognition,()=>assert.fail('unexpected command'),s=>statuses.push(s));v.start();const r=FakeRecognition.instances.at(-1)!;r.onerror?.({error:'not-allowed'});assert.equal(v.enabled,false);assert.equal(statuses.at(-1),'error');assert.equal(r.aborted,true);});
test('unsupported recognition reports a usable fallback instead of starting',()=>{let status='';const v=new CameraVoice(null,()=>{},s=>status=s);v.start();assert.equal(status,'unsupported');assert.equal(v.enabled,false);});
