import type {MotionFrame,Landmark} from '../engine/types.ts';
import {clamp} from '../engine/motion.ts';
import {emptyActor,type Actor,type ActorId,type Calibration,type FeatureSnapshot,type ManualActor} from './types.ts';

const validPoint=(p:Landmark|undefined,confidence:number)=>!!p&&Number.isFinite(p.x)&&Number.isFinite(p.y)&&(p.visibility??1)>=confidence;
type History={actor:Actor;at:number;stillSince:number;points:Landmark[]};
export class ArchiveMotion {
 private history:Partial<Record<ActorId,History>>={};private sequence=0;private frameTime=-1;private last:FeatureSnapshot|null=null;private locked=false;private reversed=false;
 reset(){this.history={};this.frameTime=-1;this.last=null;this.locked=false;}
 reassign(){this.reset();this.reversed=false;}
 swap(){const a=this.history.A,b=this.history.B;this.history={A:b?{...b,actor:{...b.actor,id:'A'}}:undefined,B:a?{...a,actor:{...a.actor,id:'B'}}:undefined};this.reversed=!this.reversed;this.locked=false;this.frameTime=-1;}
 manual(a:ManualActor,b:ManualActor,t:number):FeatureSnapshot{
  const actors=([['A',a],['B',b]] as const).map(([id,m]):Actor=>({...emptyActor(id),...m,confidence:m.visible?1:0,lastSeen:m.visible?t:0,speed:clamp(Math.hypot(m.vx,m.vy)),wristX:m.x,wristY:m.y,landmarks:[]}));
  return {sequence:++this.sequence,timestampMs:t,source:'manual',actors,distance:a.visible&&b.visible?clamp(Math.hypot(a.x-b.x,a.y-b.y)):null,uncertain:false};
 }
 process(frame:MotionFrame,c:Calibration,now:number,mirror:boolean):FeatureSnapshot{
  if(now-frame.time>450||!Number.isFinite(frame.time))return this.lost(now,c);
  if(frame.time===this.frameTime&&this.last)return this.last;
  this.frameTime=frame.time;
  if(!frame.tracked&&!frame.pose.length)return this.lost(now,c);
  if(frame.source==='mouse'||!frame.pose.length){
   const a={...emptyActor('A'),visible:frame.tracked,confidence:frame.quality,lastSeen:frame.tracked?frame.time:0,x:frame.features.x,y:1-frame.features.y,wristX:frame.features.x,wristY:1-frame.features.y,speed:frame.features.speed,vx:Math.cos(frame.features.direction*2*Math.PI-Math.PI)*frame.features.speed,vy:Math.sin(frame.features.direction*2*Math.PI-Math.PI)*frame.features.speed};
   // Hand/face input provides position and sweep only; it never invents a lying pose.
   this.last={sequence:++this.sequence,timestampMs:frame.time,source:frame.source==='mouse'?'mouse':'camera',actors:[a,emptyActor('B')],distance:null,uncertain:false};return this.last;
  }
  const poses=(frame.poses??[frame.pose]).slice(0,2).filter(points=>[11,12,23,24].every(i=>validPoint(points[i],c.confidence))).map(points=>{
   const mapped=points.map(p=>({...p,x:mirror?1-p.x:p.x}));const sh={x:(mapped[11].x+mapped[12].x)/2,y:(mapped[11].y+mapped[12].y)/2},hip={x:(mapped[23].x+mapped[24].x)/2,y:(mapped[23].y+mapped[24].y)/2};return {points:mapped,sh,hip,x:(sh.x+hip.x)/2,y:(sh.y+hip.y)/2};
  }).filter(p=>p.x>=c.left&&p.x<=c.right&&p.y>=c.top&&p.y<=c.bottom);
  if(!poses.length)return this.lost(now,c);
  const cost=(id:ActorId,p:typeof poses[number])=>{const h=this.history[id];return h?Math.hypot(h.actor.x-p.x,h.actor.y-p.y):1;};
  let assigned:Partial<Record<ActorId,typeof poses[number]>>={};
  if(!this.history.A&&!this.history.B){poses.sort((a,b)=>a.x-b.x);if(this.reversed)poses.reverse();assigned={A:poses[0],B:poses[1]};}
  else if(poses.length===2){
   const straight=cost('A',poses[0])+cost('B',poses[1]),crossed=cost('A',poses[1])+cost('B',poses[0]);
   if(this.history.A&&this.history.B&&(Math.abs(straight-crossed)<.045||Math.hypot(poses[0].x-poses[1].x,poses[0].y-poses[1].y)<.09))this.locked=true;
   assigned=straight<=crossed?{A:poses[0],B:poses[1]}:{A:poses[1],B:poses[0]};
  }else{
   const a=cost('A',poses[0]),b=cost('B',poses[0]);if(this.history.A&&this.history.B&&Math.abs(a-b)<.04)this.locked=true;
   assigned[a<=b?'A':'B']=poses[0];
  }
  const actors=(['A','B'] as ActorId[]).map(id=>{
   const p=assigned[id],old=this.history[id];
   if(!p||this.locked){if(old){old.actor={...old.actor,visible:false,stillMs:0,uncertain:this.locked};old.stillSince=frame.time;}return {...(old?.actor??emptyActor(id)),visible:false,uncertain:this.locked,stillMs:0};}
   if(old&&Math.hypot(p.x-old.actor.x,p.y-old.actor.y)>.38){this.locked=true;return {...old.actor,visible:false,uncertain:true,stillMs:0};}
   const dt=old?(frame.time-old.at)/1000:0;const continuity=!!old&&dt>0&&dt<.4&&old.actor.visible;
   const ids=[11,12,13,14,15,16,23,24,25,26,27,28].filter(i=>validPoint(p.points[i],c.confidence)&&(!old||validPoint(old.points[i],c.confidence)));
   const speed=continuity&&ids.length?Math.sqrt(ids.reduce((sum,i)=>sum+(p.points[i].x-old!.points[i].x)**2+(p.points[i].y-old!.points[i].y)**2,0)/ids.length)/dt:0;
   const stillSince=continuity&&speed<c.stillSpeed?old!.stillSince:frame.time;
   const wrists=[15,16].filter(i=>validPoint(p.points[i],c.confidence));let wristIndex=wrists[0];let vx=0,vy=0;
   for(const i of wrists){if(!continuity||!validPoint(old!.points[i],c.confidence))continue;const x=(p.points[i].x-old!.points[i].x)/dt,y=(p.points[i].y-old!.points[i].y)/dt;if(Math.hypot(x,y)>Math.hypot(vx,vy)){vx=x;vy=y;wristIndex=i;}}
   const angle=Math.atan2(Math.abs(p.hip.y-p.sh.y),Math.abs(p.hip.x-p.sh.x)*4/3)*180/Math.PI;
   const actor:Actor={id,visible:true,uncertain:false,confidence:[11,12,23,24].reduce((sum,i)=>sum+(p.points[i].visibility??1),0)/4,lastSeen:frame.time,x:p.x,y:p.y,hipHeight:clamp((c.floorY-p.hip.y)/(c.floorY-c.standingHipY)),horizontal:clamp(1-angle/90),stillMs:frame.time-stillSince,speed:clamp(Math.hypot(vx,vy)/2),vx:clamp(vx/2,-1,1),vy:clamp(vy/2,-1,1),wristX:wristIndex===undefined?p.x:p.points[wristIndex].x,wristY:wristIndex===undefined?p.y:p.points[wristIndex].y,landmarks:p.points};
   this.history[id]={actor,at:frame.time,stillSince,points:p.points};return actor;
  });
  if(this.locked)actors.forEach(a=>{a.visible=false;a.uncertain=true;a.stillMs=0;});
  this.last={sequence:++this.sequence,timestampMs:frame.time,source:'camera',actors,distance:actors.every(a=>a.visible)?clamp(Math.hypot(actors[0].x-actors[1].x,actors[0].y-actors[1].y)):null,uncertain:this.locked};return this.last;
 }
 private lost(t:number,c:Calibration):FeatureSnapshot{
  const actors=(['A','B'] as ActorId[]).map(id=>{const h=this.history[id];if(h){h.stillSince=t;h.actor={...h.actor,visible:false,stillMs:0};}return {...(h?.actor??emptyActor(id)),visible:false,stillMs:0,landmarks:h&&t-h.at<c.lostHoldMs+500?h.points:[],uncertain:this.locked};});
  return {sequence:++this.sequence,timestampMs:t,source:'camera',actors,distance:null,uncertain:this.locked};
 }
}
