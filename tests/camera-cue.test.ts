import test from 'node:test';import assert from 'node:assert/strict';
import {CameraFraming,cameraCrop} from '../src/photos/framing.ts';
import {cameraCommand,CameraVoice,type Recognition,type VoiceStatus} from '../src/photos/voice.ts';
import {emptyFrame,type Landmark} from '../src/engine/types.ts';

function hand(cx:number,y=.72,fist=false):Landmark[]{
 const h=Array.from({length:21},()=>({x:cx,y,z:0}));h[0]={x:cx,y,z:0};h[4]={x:cx-.08,y:y-.15,z:0};
 for(let k=0;k<4;k++)for(let j=0;j<4;j++)h[5+k*4+j]={x:cx+(k-1.5)*.025,y:y-.1-(fist?[0,.035,.01,-.015][j]:j*.06),z:0};
 return h;
}
function frame(t:number,hands:Landmark[][]){const f=emptyFrame();f.time=t;f.tracked=!!hands.length;f.hands=hands;return f;}
function step(g:CameraFraming,t:number,hands:Landmark[][]){return g.step(frame(t,hands),t,true);}
function arm(g:CameraFraming,start=0){for(let t=start;t<=start+200;t+=50)step(g,t,[hand(.45,.6,true)]);}
test('voice recognizes whole camera words and cancel, not word fragments',()=>{for(const s of ['Kamera!','kamera','camera','oke kamera sekarang'])assert.equal(cameraCommand(s),'camera');for(const s of ['batal kamera','Tutup kamera','batal'])assert.equal(cameraCommand(s),'cancel');for(const s of ['kameramen','kameraku','pukulan','diam'])assert.equal(cameraCommand(s),null);});
test('frame starts closed and never shoots before a camera command',()=>{const g=new CameraFraming();arm(g);assert.equal(step(g,300,[hand(.45,.8,true)]).fired,false);assert.equal(g.state.open,false);});
test('two open hands resize smoothly in both directions and do not fire',()=>{const g=new CameraFraming();g.open();step(g,0,[hand(.3),hand(.7)]);for(let t=50;t<=350;t+=50)assert.equal(step(g,t,[hand(.1),hand(.9)]).fired,false);assert.ok(g.state.size>.8);for(let t=400;t<=800;t+=50)step(g,t,[hand(.45),hand(.55)]);assert.ok(g.state.size<.35);assert.equal(g.state.open,true);});
test('one held fist then fast downward strike fires exactly once and freezes size',()=>{const g=new CameraFraming();g.open();arm(g);assert.equal(g.state.phase,'ready');step(g,250,[hand(.45,.64,true)]);const result=step(g,300,[hand(.45,.73,true)]);assert.equal(result.fired,true);assert.equal(result.open,false);assert.equal(result.size,.6);for(let t=350;t<=600;t+=50)assert.equal(step(g,t,[hand(.45,.73,true)]).fired,false);});
test('fast open hand, slow fist, pinch and horizontal movement cannot fire',()=>{
 for(const type of ['open','slow','pinch','horizontal']){const g=new CameraFraming();g.open();arm(g);for(let t=250;t<=600;t+=50){const h=hand(type==='horizontal'?.45+(t-200)*.0004:.45,type==='slow'?.6+(t-200)*.0001:.6+(t-200)*.0005,type!=='open'&&type!=='pinch');if(type==='pinch')h[4]={...h[8]};assert.equal(step(g,t,[h]).fired,false,type);}}
});
test('lost, stale, off-screen, disabled and swapped hands do not invent a punch',()=>{
 for(const mode of ['lost','stale','offscreen','disabled']){const g=new CameraFraming();g.open();arm(g);const f=frame(250,[hand(.45,.6,true)]);if(mode==='lost')f.hands=[];if(mode==='offscreen')f.hands[0][0].x=-1;g.step(f,mode==='stale'?900:250,mode!=='disabled');assert.equal(step(g,300,[hand(.45,.75,true)]).fired,false,mode);}
 const g=new CameraFraming();g.open();for(let t=0;t<=300;t+=50)assert.equal(step(g,t,t%100?[hand(.7,.8,true),hand(.3,.5,true)]:[hand(.3,.5,true),hand(.7,.8,true)]).fired,false);
});
test('new command is idempotent while open, and rearming requires a fresh held fist',()=>{const g=new CameraFraming();g.open();step(g,0,[hand(.2),hand(.8)]);step(g,100,[hand(.1),hand(.9)]);const size=g.state.size;g.open();assert.equal(g.state.size,size);g.close();g.open();assert.equal(step(g,150,[hand(.4,.8,true)]).fired,false);});
test('crop stays centered and bounded at different video ratios',()=>{for(const [w,h] of [[640,480],[480,640],[1920,1080]])for(const s of [-1,.25,.6,.9,4,NaN]){const c=cameraCrop(w,h,s);assert.equal(c.width,c.height);assert.ok(c.x>=0&&c.y>=0&&c.x+c.width<=w&&c.y+c.height<=h);assert.ok(Math.abs(c.x+c.width/2-w/2)<1);}});

class FakeRecognition implements Recognition {
 static instances:FakeRecognition[]=[];lang='';continuous=false;interimResults=false;maxAlternatives=1;
 onstart:Recognition['onstart']=null;onend:Recognition['onend']=null;onerror:Recognition['onerror']=null;onresult:Recognition['onresult']=null;aborted=false;
 constructor(){FakeRecognition.instances.push(this);}start(){this.onstart?.();}abort(){this.aborted=true;this.onend?.();}
 say(text:string,index=0,final=false){this.onresult?.({resultIndex:index,results:{length:index+1,[index]:{length:1,isFinal:final,0:{transcript:text}}}});}
}
test('recognition deduplicates interim/final camera, accepts cancellation and obeys stop',()=>{const commands:string[]=[],statuses:VoiceStatus[]=[];const v=new CameraVoice(FakeRecognition,c=>commands.push(c),s=>statuses.push(s));v.start();const r=FakeRecognition.instances.at(-1)!;assert.equal(r.lang,'id-ID');r.say('kamera');r.say('kamera',0,true);r.say('kamera',1,true);r.say('batal',2,true);assert.deepEqual(commands,['camera','cancel']);v.stop();r.say('kamera',3,true);assert.equal(commands.length,2);assert.equal(r.aborted,true);assert.equal(statuses.at(-1),'off');});
test('permission denial terminates recognition without a retry loop',()=>{const statuses:VoiceStatus[]=[];const v=new CameraVoice(FakeRecognition,()=>assert.fail('unexpected command'),s=>statuses.push(s));v.start();const r=FakeRecognition.instances.at(-1)!;r.onerror?.({error:'not-allowed'});assert.equal(v.enabled,false);assert.equal(statuses.at(-1),'error');assert.equal(r.aborted,true);});
test('unsupported recognition reports a usable fallback instead of starting',()=>{let status='';const v=new CameraVoice(null,()=>{},s=>status=s);v.start();assert.equal(status,'unsupported');assert.equal(v.enabled,false);});
