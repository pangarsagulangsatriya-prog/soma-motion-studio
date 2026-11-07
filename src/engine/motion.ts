import {emptyFrame,type Landmark,type MotionFrame,type Settings,type Feature} from './types.ts';
export const clamp=(v:number,min=0,max=1)=>Math.max(min,Math.min(max,Number.isFinite(v)?v:0));
export const distance=(a:Landmark,b:Landmark)=>Math.hypot(a.x-b.x,a.y-b.y);
export function angle(a:Landmark,b:Landmark,c:Landmark){const ab=[a.x-b.x,a.y-b.y,(a.z||0)-(b.z||0)],cb=[c.x-b.x,c.y-b.y,(c.z||0)-(b.z||0)];return Math.acos(clamp(ab.reduce((s,v,i)=>s+v*cb[i],0)/(Math.hypot(...ab)*Math.hypot(...cb)||1),-1,1))*180/Math.PI;}
export function handFeatures(l:Landmark[]){
 const size=Math.max(distance(l[0],l[9]),.025);
 const extended=[8,12,16,20].map(i=>angle(l[i-3],l[i-2],l[i])>145&&distance(l[i],l[0])>distance(l[i-2],l[0])*1.12);
 const open=extended.filter(Boolean).length/4;
 const pinch=1-clamp((distance(l[4],l[8])/size-.12)/.75);
 return {open,pinch,point:extended[0]&&!extended[1]&&!extended[2]&&!extended[3],rotation:(Math.atan2(l[9].y-l[0].y,l[9].x-l[0].x)+Math.PI)/(2*Math.PI)};
}
type RawHands={landmarks:Landmark[][];handedness:{categoryName:string;score:number}[][]};
type RawPose={landmarks:Landmark[][];worldLandmarks?:Landmark[][]};
export type RawFace={faceLandmarks:Landmark[][];faceBlendshapes?:{categories:{categoryName:string;score:number}[]}[]};
export class MotionProcessor {
 private previous:MotionFrame|null=null; private lastTimes:Record<string,number>={};private armed:Record<string,boolean>={};private openState=false;private pendingOpen=false;private openSince=0;private prevSpeed=0;private poseCenter:Landmark|null=null;
 reset(){this.previous=null;this.lastTimes={};this.armed={};this.openState=false;this.pendingOpen=false;this.openSince=0;this.prevSpeed=0;this.poseCenter=null;}
 process(h:RawHands|null,p:RawPose|null,time:number,s:Settings,fps:number,face:RawFace|null=null):MotionFrame{
  const f=emptyFrame();f.time=time;f.fps=fps;f.hands=h?.landmarks??[];f.pose=p?.landmarks[0]??[];f.poses=p?.landmarks??[];f.handCount=f.hands.length;f.face=face?.faceLandmarks[0]??[];
  const dt=this.previous?clamp((time-this.previous.time)/1000,.008,.25):.033;
  const screenX=(x:number)=>s.mirror?1-x:x;
  const assign=(side:string)=>h?.handedness.findIndex(a=>a[0]?.categoryName===(s.swapHands?(side==='Right'?'Left':'Right'):side))??-1;
  const ri=assign('Right'),li=assign('Left');const r=f.hands[ri>=0?ri:0],l=li>=0&&li!==(ri>=0?ri:0)?f.hands[li]:undefined;
  let rawX=.5,rawY=.5;
  if(r){
   f.tracked=true;const hf=handFeatures(r);rawX=screenX(r[9].x);rawY=1-r[9].y;Object.assign(f.features,{open:hf.open,pinch:hf.pinch,rotation:hf.rotation,point:hf.point?1:0});
   f.quality=h?.handedness[ri>=0?ri:0]?.[0]?.score??0;
   const next=hf.open>=.75?true:hf.open<=.25?false:this.openState;
   if(next!==this.pendingOpen){this.pendingOpen=next;this.openSince=time;}
   if(time-this.openSince>70)this.openState=next;
   f.features.open=this.openState?1:0;
   f.gesture=hf.pinch>.72?'Jepit jari':hf.point?'Menunjuk':this.openState?'Telapak terbuka':'Genggam';
   f.features.leftX=l?screenX(l[9].x):.5;f.features.leftY=l?1-l[9].y:.5;
   if(l) f.features.spread=clamp(distance(r[9],l[9])/.8);
  }
  const body=f.pose;const useBody=s.input==='body';
  if(body.length&&[11,12,23,24].every(i=>(body[i].visibility??1)>.55)){
   const midpoint=(a:number,b:number):Landmark=>({x:(body[a].x+body[b].x)/2,y:(body[a].y+body[b].y)/2,z:(body[a].z+body[b].z)/2});
   const sh=midpoint(11,12),hip=midpoint(23,24);const torso=Math.max(distance(sh,hip),.08);
   const visible=(i:number)=>(body[i].visibility??1)>.5;
   f.quality=[11,12,23,24].reduce((a,i)=>a+(body[i].visibility??1),0)/4;
   f.features.lean=clamp(.5+(s.mirror?-1:1)*(sh.x-hip.x)/torso);
   f.features.armRaise=(visible(15)&&visible(16))?clamp(((sh.y-body[15].y)+(sh.y-body[16].y))/(2*torso)+.25):0;
   const world=p?.worldLandmarks?.[0];
   f.features.bend=world?clamp(Math.abs((world[11].z+world[12].z-world[23].z-world[24].z)/2)/.45):clamp(1-(hip.y-sh.y)/torso);
   f.features.leftElbow=visible(13)&&visible(15)?angle(body[11],body[13],body[15])/180:0;f.features.rightElbow=visible(14)&&visible(16)?angle(body[12],body[14],body[16])/180:0;f.features.leftKnee=visible(25)&&visible(27)?angle(body[23],body[25],body[27])/180:0;f.features.rightKnee=visible(26)&&visible(28)?angle(body[24],body[26],body[28])/180:0;
   f.features.squat=[25,26,27,28].every(visible)?clamp((170-(angle(body[23],body[25],body[27])+angle(body[24],body[26],body[28]))/2)/85):0;
   f.features.spread=visible(15)&&visible(16)?clamp(distance(body[15],body[16])/.8):0;
   f.features.leftX=screenX(body[15].x);f.features.leftY=1-body[15].y;
   f.posture=f.features.squat>.45?'Jongkok':f.features.armRaise>.85?'Kedua lengan naik':f.features.bend>.65?'Membungkuk (perkiraan)':(visible(15)&&visible(16)&&Math.abs(body[15].y-sh.y)<torso*.2&&Math.abs(body[16].y-sh.y)<torso*.2)?'Lengan horizontal':f.features.lean<.25?'Condong kiri':f.features.lean>.75?'Condong kanan':'Berdiri';
   f.framing=[11,12,15,16,23,24,25,26,27,28].every(i=>visible(i)&&body[i].x>.02&&body[i].x<.98&&body[i].y>.02&&body[i].y<.98);
   if(useBody){f.tracked=true;rawX=visible(16)?screenX(body[16].x):screenX(sh.x);rawY=visible(16)?1-body[16].y:1-sh.y;f.features.open=1;f.gesture=f.posture;}
   if(useBody&&this.poseCenter&&this.previous?.tracked){f.features.speed=clamp(distance(sh,this.poseCenter)/dt/1.5);}
   this.poseCenter=sh;
  }else if(useBody){f.tracked=false;f.framing=false;}
  if(s.input==='face'){
   const points=f.face;
   f.tracked=points.length>=468;
   if(f.tracked){
    const scores=Object.fromEntries((face?.faceBlendshapes?.[0]?.categories??[]).map(c=>[c.categoryName,c.score]));
    rawX=screenX(points[1].x);rawY=1-points[1].y;
    const mouth=clamp(scores.jawOpen??distance(points[13],points[14])/Math.max(.02,distance(points[61],points[291])));
    const blink=clamp(((scores.eyeBlinkLeft??0)+(scores.eyeBlinkRight??0))/2);
    const eyeA=points[33],eyeB=points[263];
    const roll=Math.atan2(eyeB.y-eyeA.y,eyeB.x-eyeA.x);
    const headTilt=clamp(.5+(s.mirror?-1:1)*roll/(Math.PI/2));
    if(mouth>.12)this.openState=true;else if(mouth<.06)this.openState=false;
    Object.assign(f.features,{mouth,blink,headTilt,open:this.openState?1:0});
    f.gesture=blink>.6?'Mata berkedip':mouth>.2?'Mulut terbuka':headTilt<.35?'Kepala miring kiri':headTilt>.65?'Kepala miring kanan':'Wajah terdeteksi';
    f.framing=[10,152,234,454].every(i=>points[i].x>.02&&points[i].x<.98&&points[i].y>.02&&points[i].y<.98);
   }
  }
  const c=s.calibration;
  f.features.x=c?clamp((rawX-c.minX)/(c.maxX-c.minX||1)):rawX;f.features.y=c?clamp((rawY-c.minY)/(c.maxY-c.minY||1)):rawY;
  if(this.previous?.tracked&&f.tracked){
   const vx=(rawX-(this.previous as MotionFrame & {rawX:number}).rawX)/dt,vy=(rawY-(this.previous as MotionFrame & {rawY:number}).rawY)/dt;
   f.features.direction=(Math.atan2(vy,vx)+Math.PI)/(2*Math.PI);
   const speed=clamp(Math.hypot(vx,vy)/2.5);f.features.speed=Math.max(f.features.speed,speed);
   f.features.acceleration=clamp(Math.abs(speed-this.prevSpeed)/dt/12);this.prevSpeed=speed;
   const threshold=.62/s.sensitivity;
   this.event('snare',speed,threshold,time,f,s.cooldown);
   if(l){const leftSpeed=clamp(Math.hypot(f.features.leftX-this.previous.features.leftX,f.features.leftY-this.previous.features.leftY)/dt/2.5);this.event('kick',leftSpeed,threshold,time,f,s.cooldown);}
   if((l||useBody)&&f.features.spread<.17&&this.previous.features.spread>=.17&&speed>.2&&(time-(this.lastTimes.clap??-1000)>Math.max(200,s.cooldown))){f.events=['clap'];this.lastTimes.clap=time;}
  }
  f.features.stillness=1-clamp(f.features.speed*6);
  if(!f.tracked){this.openState=false;this.pendingOpen=false;f.gesture='Tracking terputus';}
  const alpha=1-Math.exp(-dt/Math.max(.005,s.smoothing));
  if(this.previous?.tracked&&f.tracked)for(const k of Object.keys(f.features) as Feature[]){if(k==='open')continue;const old=this.previous.features[k],v=f.features[k];f.features[k]=Math.abs(v-old)<s.deadZone?old:old+(v-old)*alpha;}
  this.previous=Object.assign(f,{rawX,rawY});return f;
 }
 private event(key:'kick'|'snare',value:number,threshold:number,t:number,f:MotionFrame,cooldown:number){if(value<threshold*.5)this.armed[key]=true;if(value>threshold&&this.armed[key]!==false&&t-(this.lastTimes[key]??-1000)>cooldown){f.events.push(key);this.lastTimes[key]=t;this.armed[key]=false;}}
}
