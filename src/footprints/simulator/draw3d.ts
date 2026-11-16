import type {FloorSpace,FloorPoint} from '../spatial/coordinates.ts';
import type {FootstepEvent,FootSide} from '../spatial/events.ts';
import {
 buildLimb,project3D,type OrbitCamera,type PuppetPerformer,type Vector3,type ScreenPoint
} from './scene3d.ts';

const colorOf=(person:string,foot:FootSide)=>person==='B'
 ?(foot==='left'?'#A5D4D1':'#80AEC8')
 :(foot==='left'?'#E4EDC5':'#C4D98A');
const dot=(ctx:CanvasRenderingContext2D,p:ScreenPoint|null,r:number,color:string)=>{
 if(!p)return;ctx.beginPath();ctx.arc(p.x,p.y,r,0,Math.PI*2);ctx.fillStyle=color;ctx.fill();
};
const line=(ctx:CanvasRenderingContext2D,a:ScreenPoint|null,b:ScreenPoint|null,
 color:string,width=1.5,dashed=false)=>{
 if(!a||!b)return;ctx.beginPath();ctx.moveTo(a.x,a.y);ctx.lineTo(b.x,b.y);
 ctx.strokeStyle=color;ctx.lineWidth=width;ctx.setLineDash(dashed?[5,6]:[]);ctx.stroke();ctx.setLineDash([]);
};
const footVector=(p:FloorPoint,angle:number,forwardM:number,sideM=0,z=.014):Vector3=>({
 x:p.xM+Math.cos(angle)*forwardM-Math.sin(angle)*sideM,
 y:p.yM+Math.sin(angle)*forwardM+Math.cos(angle)*sideM,z
});
function drawProjectedSole(ctx:CanvasRenderingContext2D,point:FloorPoint,heading:number,
 z:number,person:string,foot:FootSide,camera:OrbitCamera,floor:FloorSpace,w:number,h:number,
 opacity=1){
 const render=(m:number,s:number)=>project3D(footVector(point,heading,m,s,z),camera,floor,w,h);
 const outline=[
  render(-.13,0),render(-.10,-.075),render(.06,-.075),
  render(.18,-.095),render(.24,-.05),render(.25,.055),
  render(.17,.1),render(.04,.078),render(-.08,.07)
 ];
 if(outline.some(p=>!p))return;
 ctx.save();ctx.globalAlpha=opacity;ctx.beginPath();
 outline.forEach((p,i)=>i?ctx.lineTo(p!.x,p!.y):ctx.moveTo(p!.x,p!.y));ctx.closePath();
 ctx.fillStyle=colorOf(person,foot);ctx.fill();
 for(let i=0;i<5;i++){
  const p=render(.27+Math.max(0,2-i)*.014,(i-2)*.041);
  dot(ctx,p,Math.max(1.6,3.2-i*.23),colorOf(person,foot));
 }
 ctx.restore();
}
export function drawPuppetScene(ctx:CanvasRenderingContext2D,w:number,h:number,floor:FloorSpace,
 camera:OrbitCamera,performers:PuppetPerformer[],performerCount:number,
 events:FootstepEvent[],selected:{performerId:string;foot:FootSide}|null,showGrid=true){
 ctx.clearRect(0,0,w,h);
 const bg=ctx.createLinearGradient(0,0,w,h);bg.addColorStop(0,'#121B17');bg.addColorStop(1,'#07100D');
 ctx.fillStyle=bg;ctx.fillRect(0,0,w,h);
 const p=(x:number,y:number,z=0)=>project3D({x,y,z},camera,floor,w,h);
 const corners=[p(0,0),p(floor.widthM,0),p(floor.widthM,floor.depthM),p(0,floor.depthM)];
 if(corners.every(Boolean)){
  ctx.beginPath();corners.forEach((q,i)=>i?ctx.lineTo(q!.x,q!.y):ctx.moveTo(q!.x,q!.y));ctx.closePath();
  ctx.fillStyle='#151F1A';ctx.fill();ctx.strokeStyle='#4B6150';ctx.lineWidth=1.5;ctx.stroke();
 }
 if(showGrid){
  for(let x=0;x<=Math.floor(floor.widthM);x++)
   line(ctx,p(x,0,.005),p(x,floor.depthM,.005),'#314339',.85);
  for(let y=0;y<=Math.floor(floor.depthM);y++)
   line(ctx,p(0,y,.005),p(floor.widthM,y,.005),'#314339',.85);
 }
 const confirmed=events.filter(e=>e.kind==='contact');
 for(const e of confirmed)drawProjectedSole(ctx,e.positionM,e.headingRad,.013,e.performerId,e.foot,camera,floor,w,h,.72);
 // Each rig is made of real 3D positions, projected with the same orbit camera.
 // Draw far rigs first so nearer joints overlap naturally.
 const sorted=performers.slice(0,performerCount).sort((a,b)=>{
  const ay=(a.left.positionM.yM+a.right.positionM.yM)/2;
  const by=(b.left.positionM.yM+b.right.positionM.yM)/2;
  return by-ay;
 });
 for(const performer of sorted){
  const L=buildLimb(performer,'left'),R=buildLimb(performer,'right');
  const pa=p(L.hip.x,L.hip.y,L.hip.z),pb=p(R.hip.x,R.hip.y,R.hip.z);
  line(ctx,pa,pb,'#C2D0C7',13);
  for(const side of ['left','right'] as const){
   const limb=side==='left'?L:R,sel=selected?.performerId===performer.id&&selected.foot===side;
   const hi=p(limb.hip.x,limb.hip.y,limb.hip.z),kn=p(limb.knee.x,limb.knee.y,limb.knee.z);
   const an=p(limb.ankle.x,limb.ankle.y,limb.ankle.z);
   const color=colorOf(performer.id,side);
   line(ctx,hi,kn,'#A7BCB1',12);
   line(ctx,kn,an,'#849E93',9);
   dot(ctx,hi,6,'#DCE9D9');dot(ctx,kn,6,'#C0D7BF');dot(ctx,an,7,color);
   const foot=performer[side];
   drawProjectedSole(ctx,foot.positionM,foot.headingRad,foot.heightM+.02,performer.id,side,camera,floor,w,h,1);
   if(foot.heightM>.02){
    line(ctx,p(foot.positionM.xM,foot.positionM.yM,foot.heightM),
     p(foot.positionM.xM,foot.positionM.yM,0),color,1.2,true);
    const shadow=p(foot.positionM.xM,foot.positionM.yM,0);
    if(shadow){ctx.beginPath();ctx.ellipse(shadow.x,shadow.y,13,6,0,0,Math.PI*2);ctx.fillStyle='#64766550';ctx.fill();}
   }
   if(sel&&an){
    ctx.beginPath();ctx.arc(an.x,an.y,23,0,Math.PI*2);ctx.strokeStyle='#DAEEA0';
    ctx.lineWidth=1.8;ctx.setLineDash([5,4]);ctx.stroke();ctx.setLineDash([]);
   }
  }
  const head=p((L.hip.x+R.hip.x)/2,(L.hip.y+R.hip.y)/2,1.21);
  if(head){ctx.fillStyle='#E4F0DE';ctx.font='bold 13px sans-serif';ctx.textAlign='center';ctx.fillText('PERFORMER '+performer.id,head.x,head.y-13);}
 }
 ctx.fillStyle='#A7BDB0';ctx.font='12px monospace';ctx.textAlign='left';
 ctx.fillText('3D / FLOOR SPACE · '+floor.widthM+' × '+floor.depthM+' m',16,24);
 ctx.fillStyle='#789584';ctx.font='11px monospace';
 ctx.fillText('DRAG FOOT TO STEP  ·  DRAG EMPTY SPACE TO ORBIT',16,h-15);
}
