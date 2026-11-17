import test from 'node:test';
import assert from 'node:assert/strict';
import type {Landmark} from '../src/engine/types.ts';
import type {VideoActorAssignment,VideoActorState} from '../src/stage/videoAutoActorTracker.ts';
import {TemporalJointAnalyzer} from '../src/stage/temporalJointIntelligence.ts';
import {HAND_LIMB_MAX_FRAMES,HAND_RECENT_MS,HandLimbDetailAnalyzer,
 findActorHandSlots,matchHandsToActors,handAngle2D,handFingers,handPinchRatio}
 from '../src/stage/videoHandLimbDetail.ts';
import {HAND_CONNECTIONS,drawHandDetailOverlay} from '../src/stage/videoHandLimbOverlay.ts';

const point=(x:number,y:number):Landmark=>({x,y,z:0,visibility:.99});
function pose(x=.2):Landmark[]{
 const data=Array.from({length:33},(_,i)=>point(x+(i%2? .01:-.01),.12+i*.017));
 data[11]=point(x-.03,.22);data[12]=point(x+.03,.22);
 data[13]=point(x-.045,.30);data[14]=point(x+.045,.30);
 data[15]=point(x-.07,.40);data[16]=point(x+.07,.40);
 data[23]=point(x-.028,.46);data[24]=point(x+.028,.46);
 data[25]=point(x-.045,.62);data[26]=point(x+.045,.62);
 data[27]=point(x-.05,.79);data[28]=point(x+.05,.79);
 data[29]=point(x-.05,.82);data[30]=point(x+.05,.82);
 data[31]=point(x-.05,.83);data[32]=point(x+.05,.83);
 return data;
}
const actor=(id:'A'|'B',p:Landmark[]):VideoActorAssignment=>
 ({id,rawIndex:id==='A'?0:1,pose:p,confidence:.99});
const status=(both=true):VideoActorState[]=>[
 {id:'A',presence:'visible',confidence:.99,rawIndex:0,lastSeenAtMs:0},
 {id:'B',presence:both?'visible':'not-detected',confidence:both?.99:0,
  rawIndex:both?1:null,lastSeenAtMs:both?0:null}
];
function hand(x:number,y:number):Landmark[]{
 const result=Array.from({length:21},(_,i)=>point(
  x+(i%4)*.008,y-Math.floor(i/4)*.011));
 result[0]=point(x,y);
 result[5]=point(x-.02,y-.02);
 result[17]=point(x+.02,y-.02);
 result[4]=point(x-.008,y-.065);
 result[8]=point(x+.010,y-.055);
 return result;
}
function observe(analyzer:HandLimbDetailAnalyzer,
 temporal:TemporalJointAnalyzer,people:VideoActorAssignment[],
 statuses:VideoActorState[],atMs:number,hands:Landmark[][]|null,available=true){
 const frame=temporal.observe(people,statuses,atMs);
 return analyzer.observe(people,statuses,frame,atMs,{
  hands:hands?.map((landmarks,rawIndex)=>({rawIndex,landmarks}))??null,
  handModelAvailable:available
 });
}
test('S6.8.8.4 four hands attach to four actor wrist slots independent of raw order',()=>{
 const people=[actor('A',pose(.26)),actor('B',pose(.72))];
 const slots=findActorHandSlots(people);
 assert.equal(slots.length,4);
 const positions=[slots[3],slots[1],slots[2],slots[0]];
 const result=matchHandsToActors(positions.map((s,i)=>({
  rawIndex:i,landmarks:hand(s.wristX,s.wristY)
 })),slots);
 assert.equal(result.matches.length,4);
 assert.deepEqual(result.matches.map(m=>[m.actor,m.side,m.rawIndex]),
  [['A','left',3],['A','right',1],['B','left',2],['B','right',0]]);
 assert.equal(result.ambiguous.length,0);
 assert.equal(result.unassigned.length,0);
});

test('S6.8.8.4 crossing wrists cannot silently assign a finger hand to either actor',()=>{
 const slots=[{actor:'A' as const,side:'left' as const,wristX:.4,wristY:.5},
  {actor:'B' as const,side:'right' as const,wristX:.425,wristY:.5}];
 const result=matchHandsToActors([{rawIndex:0,landmarks:hand(.411,.5)}],slots);
 assert.equal(result.matches.length,0);
 assert.deepEqual(result.ambiguous.map(s=>s.actor),['A','B']);
 assert.deepEqual(result.unassigned,[0]);
});

test('S6.8.8.4 rejected low-visibility pose wrist does not steal a detected hand',()=>{
 const p=pose(.3);
 p[15].visibility=.01;
 const slots=findActorHandSlots([actor('A',p)]);
 assert.equal(slots.length,1);
 assert.equal(slots[0].side,'right');
 const result=matchHandsToActors([
  {rawIndex:0,landmarks:hand(.23,.4)}
 ],slots);
 assert.equal(result.matches.length,1===0?1:0); // left hand does not jump to right wrist
});

test('S6.8.8.4 hand finger 21-joint angles, pinch and invalid coordinates are explicit',()=>{
 const h=hand(.25,.4);
 assert.equal(handFingers(h).length,5);
 assert.equal(handFingers(h)[0].name,'thumb');
 assert.ok(handFingers(h).some(f=>f.tipX!==null));
 assert.ok(handPinchRatio(h)!>=0);
 assert.ok(Math.abs(handAngle2D(point(.3,.4),point(.3,.5),point(.4,.5))!-90)<1e-9);
 const invalid=h.map(p=>({...p}));
 invalid[8].x=NaN;
 assert.equal(handPinchRatio(invalid),null);
 assert.equal(handFingers(invalid)[1].tipX,null);
});

test('S6.8.8.4 each arm and leg advances independently, despite a missing wrist',()=>{
 const engine=new HandLimbDetailAnalyzer(),temporal=new TemporalJointAnalyzer();
 const people=[actor('A',pose(.3))];
 const first=observe(engine,temporal,people,status(false),0,[]);
 assert.equal(first.actors[0].limbs.length,4);
 const leftArm=first.actors[0].limbs.find(l=>l.name==='left-arm')!;
 const rightArm=first.actors[0].limbs.find(l=>l.name==='right-arm')!;
 assert.equal(leftArm.presence,'visible');
 assert.equal(rightArm.presence,'visible');
 assert.ok(leftArm.angleDeg!==null&&rightArm.angleDeg!==null);
 const next=pose(.34);
 next[15].visibility=.12;
 const second=observe(engine,temporal,[actor('A',next)],status(false),100,[]);
 assert.equal(second.actors[0].limbs.find(l=>l.name==='left-arm')?.presence,'partial');
 assert.equal(second.actors[0].limbs.find(l=>l.name==='right-arm')?.presence,'visible');
 assert.ok(second.actors[0].limbs.find(l=>l.name==='right-arm')?.tipSpeed!==null);
 assert.equal(second.actors[0].limbs.find(l=>l.name==='left-arm')?.tipSpeed,null);
 assert.equal(second.actors[0].limbs.find(l=>l.name==='left-leg')?.presence,'visible');
 assert.ok(second.actors[0].relations.find(r=>r.side==='right')?.handToHip2D!==null);
});

test('S6.8.8.4 no fabricated hand on unscanned frame; recent sample clearly marked',()=>{
 const engine=new HandLimbDetailAnalyzer(),temporal=new TemporalJointAnalyzer();
 const people=[actor('A',pose(.3))],slots=findActorHandSlots(people);
 const first=observe(engine,temporal,people,status(false),0,[hand(slots[0].wristX,slots[0].wristY)]);
 const left=first.actors[0].hands.find(h=>h.side==='left')!;
 assert.equal(left.presence,'visible');
 assert.equal(left.landmarks.length,21);
 const held=observe(engine,temporal,people,status(false),100,null);
 assert.equal(held.handScanned,false);
 assert.equal(held.actors[0].hands[0].presence,'recent');
 assert.equal(held.actors[0].hands[0].observedAtMs,0);
 const stale=observe(engine,temporal,people,status(false),HAND_RECENT_MS+50,null);
 assert.equal(stale.actors[0].hands[0].presence,'missing');
 assert.equal(stale.actors[0].hands[0].landmarks.length,0);
});

test('S6.8.8.4 failure of optional hand model preserves both independent limbs',()=>{
 const engine=new HandLimbDetailAnalyzer(),temporal=new TemporalJointAnalyzer();
 const f=observe(engine,temporal,[actor('A',pose(.25))],status(false),0,null,false);
 assert.equal(f.handModelAvailable,false);
 assert.equal(f.actors[0].hands[0].presence,'unavailable');
 assert.equal(f.actors[0].limbs.filter(l=>l.presence==='visible').length,4);
});

test('S6.8.8.4 lost B never inherits A hand details',()=>{
 const engine=new HandLimbDetailAnalyzer(),temporal=new TemporalJointAnalyzer();
 const both=[actor('A',pose(.25)),actor('B',pose(.72))];
 const bWrist=findActorHandSlots(both).find(slot=>slot.actor==='B'&&slot.side==='left')!;
 observe(engine,temporal,both,status(),0,[hand(bWrist.wristX,bWrist.wristY)]);
 const single=[actor('A',pose(.25))];
 const hidden=observe(engine,temporal,single,status(false),100,[]);
 assert.equal(hidden.actors[1].hands[0].landmarks.length,0);
 assert.equal(hidden.actors[1].limbs.filter(l=>l.presence==='visible').length,0);
 assert.equal(hidden.actors[0].limbs.filter(l=>l.presence==='visible').length,4);
});

test('S6.8.8.4 360 frame window bounded and reset clears previous details',()=>{
 const engine=new HandLimbDetailAnalyzer(),temporal=new TemporalJointAnalyzer();
 for(let i=0;i<HAND_LIMB_MAX_FRAMES+5;i++)
  observe(engine,temporal,[actor('A',pose(.3))],status(false),i*100,null);
 assert.equal(engine.frameCount,HAND_LIMB_MAX_FRAMES);
 const saved=engine.window;
 assert.equal(saved[0].atMs,500);
 saved[0].actors[0].limbs[0].visibleJoints=99;
 assert.notEqual(engine.window[0].actors[0].limbs[0].visibleJoints,99);
 engine.reset();temporal.reset();
 assert.equal(engine.frameCount,0);
 assert.equal(engine.latest,null);
});

test('S6.8.8.4 hand overlay draws observed joints only and skips stale frames',()=>{
 const engine=new HandLimbDetailAnalyzer(),temporal=new TemporalJointAnalyzer();
 const person=[actor('A',pose(.3))],slot=findActorHandSlots(person)[0];
 const frame=observe(engine,temporal,person,status(false),0,[hand(slot.wristX,slot.wristY)]);
 const calls={save:0,restore:0,stroke:0,arc:0};
 const ctx={
  save:()=>calls.save++,restore:()=>calls.restore++,
  beginPath:()=>{},moveTo:()=>{},lineTo:()=>{},stroke:()=>calls.stroke++,
  arc:()=>calls.arc++,fill:()=>{},setLineDash:()=>{},fillText:()=>{},
  fillStyle:'',strokeStyle:'',font:'',lineWidth:1,globalAlpha:1,textBaseline:'',lineCap:'',lineJoin:''
 } as unknown as CanvasRenderingContext2D;
 assert.equal(drawHandDetailOverlay(ctx,frame,{x:0,y:0,width:600,height:400},0),1);
 assert.equal(calls.stroke,HAND_CONNECTIONS.length);
 assert.equal(calls.arc,21);
 assert.equal(calls.save,calls.restore);
 assert.equal(drawHandDetailOverlay(ctx,frame,{x:0,y:0,width:600,height:400},500),0);
});
