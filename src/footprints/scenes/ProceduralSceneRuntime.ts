import {floorEventCanStamp,type FloorInteractionEvent} from './FloorInteractionEngine.ts';
import {SnowfallScene} from './SnowfallScene.ts';
import {floorSceneById,type FloorSceneId,type FloorPrimitive} from './sceneRegistry.ts';

type Anchor={x:number;y:number;speed:number;atMs:number};
type Pulse={id:string;x:number;y:number;atMs:number;age:number;kind:'contact'|'movement';actorId:string};
type Particle={x:number;y:number;vx:number;vy:number;phase:number;size:number};
export type ProceduralParams={
 intensity:number;radius:number;persistence:number;quality:'low'|'medium'|'high';
 audioMix:number;audioLevel:number;paused:boolean;
};
const TWO_PI=Math.PI*2;
const clamp=(v:number,a=0,b=1)=>Math.min(b,Math.max(a,v));
const defaults:ProceduralParams={intensity:.6,radius:.5,persistence:.65,quality:'medium',audioMix:0,audioLevel:0,paused:false};
function sceneColor(scene:FloorSceneId){
 return floorSceneById(scene).defaultColor;
}
const backgrounds:Record<FloorPrimitive,[string,string]>={
 snow:['#18252c','#a2b8be'],growth:['#071710','#163322'],
 leaves:['#21130d','#493522'],swarm:['#060c0d','#142323'],
 fog:['#0a1217','#31535a'],smoke:['#070d10','#313d45'],
 fluid:['#0d0712','#3b1b4d'],water:['#03151e','#075467'],
 burst:['#070914','#20233d'],splash:['#041822','#076083'],
 fireflies:['#030e0d','#0d3223']
};
/** Shared, deterministic 2D procedural primitives for 12 non-Snowfall
 * catalogue scenes. Snowfall proper retains its existing WebGL2 renderer.
 * A single runtime is updated and painted without restarting source tracking. */
export class ProceduralSceneRuntime{
 private id:FloorSceneId='spring-garden';
 private generation=-1;
 private seen=new Set<string>();
 private anchors=new Map<string,Anchor>();
 private pulses:Pulse[]=[];
 private particles:Particle[]=[];
 private snow=new SnowfallScene();
 private rng=0x1682b3;
 private clockMs=0;
 private lastAt:number|null=null;
 private contactTotal=0;
 private eventTotal=0;
 get sceneId(){return this.id;}
 get contactCount(){return this.contactTotal;}
 get interactionCount(){return this.eventTotal;}
 get actorCount(){return this.anchors.size;}
 get clock(){return this.clockMs;}
 private random(){
  this.rng=(1664525*this.rng+1013904223)>>>0;
  return this.rng/4294967296;
 }
 setScene(id:FloorSceneId,generation=-1){
  if(this.id===id&&this.generation===generation)return;
  this.id=id;this.reset(generation);
 }
 reset(generation=-1){
  this.generation=generation;this.seen.clear();
  this.anchors.clear();this.pulses=[];this.particles=[];
  this.snow.reset(generation);
  this.rng=0x1682b3;this.lastAt=null;this.clockMs=0;
  this.contactTotal=0;this.eventTotal=0;
 }
 /** Ignore old history after switching scenes; future F0 events still flow. */
 skipExisting(events:readonly FloorInteractionEvent[],generation:number){
  if(this.generation!==generation)this.reset(generation);
  for(const event of events)this.seen.add(generation+':'+event.id);
 }
 ingest(events:readonly FloorInteractionEvent[],generation:number,enabled=true){
  if(this.generation!==generation)this.reset(generation);
  this.snow.consume(events,generation,enabled);
  for(const e of events){
   const key=generation+':'+e.id;
   if(this.seen.has(key))continue;
   this.seen.add(key);
   if(!enabled)continue;
   if(!Number.isFinite(e.x)||!Number.isFinite(e.y)||
    e.x<0||e.x>1||e.y<0||e.y>1)continue;
   if(e.kind==='release'){this.anchors.delete(e.actorId);continue;}
   if(e.kind==='presence'||e.kind==='movement'){
    this.anchors.set(e.actorId,{
     x:e.x,y:e.y,speed:e.kind==='movement'?e.speed:0,atMs:e.atMs
    });
    this.eventTotal++;
    // Only movement may create non-contact disturbance, not a footprint.
    if(e.kind==='movement'&&e.speed>.02){
     const old=this.pulses.at(-1);
     if(!old||old.actorId!==e.actorId||e.atMs-old.atMs>100){
      this.pulses.push({id:key,x:e.x,y:e.y,atMs:e.atMs,
       age:0,kind:'movement',actorId:e.actorId});
     }
    }
   }else if(floorEventCanStamp(e)){
    this.contactTotal++;
    this.eventTotal++;
    this.pulses.push({id:key,x:e.x,y:e.y,atMs:e.atMs,
     age:0,kind:'contact',actorId:e.actorId});
   }
  }
  // Maintain bounded memory independently of an infinite performance run.
  const buffered=new Set(events.map(e=>generation+':'+e.id));
  if(this.seen.size>1000)this.seen=new Set([...this.seen].filter(id=>buffered.has(id)));
  if(this.pulses.length>150)this.pulses.splice(0,this.pulses.length-150);
 }
 step(nowMs:number,params:Partial<ProceduralParams>={}){
  if(!Number.isFinite(nowMs)||nowMs<0)return;
  const p={...defaults,...params};
  if(p.paused){this.lastAt=nowMs;return;}
  if(this.lastAt===null){this.lastAt=nowMs;return;}
  const dt=Math.min(.065,Math.max(0,(nowMs-this.lastAt)/1000));
  this.lastAt=nowMs;
  if(!dt)return;
  this.clockMs+=dt*1000;
  const family=floorSceneById(this.id).family;
  this.snow.step(nowMs,{
   snowfall:clamp(p.intensity),recoverySeconds:18+(1-clamp(p.persistence))*160
  });
  const count=p.quality==='low'?75:p.quality==='high'?260:150;
  while(this.particles.length<count){
   this.particles.push({x:this.random(),y:this.random(),
    vx:(this.random()-.5)*.055,vy:(this.random()-.5)*.04,
    phase:this.random()*TWO_PI,size:.5+this.random()*2});
  }
  if(this.particles.length>count)this.particles.length=count;
  const anchors=[...this.anchors.values()];
  const stimulation=clamp(p.intensity+p.audioLevel*p.audioMix*.45,.05,1.6);
  for(const m of this.particles){
   m.phase+=dt*(.25+stimulation);
   const fx=Math.cos(m.phase)*.008,fy=Math.sin(m.phase*.67)*.006;
   m.vx+=(fx-m.vx*.24)*dt;m.vy+=(fy-m.vy*.2)*dt;
   for(const a of anchors){
    const dx=m.x-a.x,dy=m.y-a.y,d=Math.max(.005,Math.hypot(dx,dy));
    const range=.09+clamp(p.radius)*.18;
    if(d>range)continue;
    const v=(1-d/range)*stimulation*dt;
    const sign=family==='fireflies'?-1:1;
    m.vx+=sign*dx/d*v*.09;
    m.vy+=sign*dy/d*v*.09;
    if(family==='leaves'||family==='smoke')m.vx+=a.speed*dt*.02;
   }
   const drift=family==='leaves'?1.9:family==='smoke'?.9:family==='fireflies'?.4:1;
   m.x+=m.vx*dt*drift;m.y+=m.vy*dt*drift;
   if(m.x<-.05)m.x=1.05;if(m.x>1.05)m.x=-.05;
   if(m.y<-.05)m.y=1.05;if(m.y>1.05)m.y=-.05;
  }
  const expiry=3+clamp(p.persistence)*17;
  this.pulses=this.pulses.filter(pulse=>{
   pulse.age+=dt;
   return pulse.age<expiry;
  });
  // Presence snapshots naturally expire if source stops reporting.
  for(const [key,a] of this.anchors){
   if(nowMs-a.atMs>1400)this.anchors.delete(key);
  }
 }
 private drawBackground(ctx:CanvasRenderingContext2D,w:number,h:number,
  family:FloorPrimitive,audio:number){
  const [dark,light]=backgrounds[family];
  const bg=ctx.createLinearGradient(0,0,w,h);
  bg.addColorStop(0,dark);bg.addColorStop(1,light);
  ctx.fillStyle=bg;ctx.fillRect(0,0,w,h);
  ctx.save();
  ctx.globalAlpha=.1+audio*.11;ctx.strokeStyle=sceneColor(this.id);ctx.lineWidth=1;
  for(let i=0;i<17;i++){
   const y=(i+.35)*h/17,offset=Math.sin(this.clockMs*.0002+i*.8)*15;
   ctx.beginPath();ctx.moveTo(0,y);
   ctx.bezierCurveTo(w*.3,y+offset,w*.6,y-offset,w,y);ctx.stroke();
  }
  ctx.restore();
 }
 private drawWinter(ctx:CanvasRenderingContext2D,w:number,h:number,p:ProceduralParams){
  // The winter scenes share the same physically persistent Snowfall heightfield.
  const snow=this.snow;
  const gw=snow.width,gh=snow.height;
  const thumb=document.createElement('canvas');thumb.width=gw;thumb.height=gh;
  const c=thumb.getContext('2d');if(!c)return;
  const img=c.createImageData(gw,gh);
  const warm=this.id==='christmas',blue=this.id==='hanukkah';
  for(let i=0;i<snow.density.length;i++){
   const value=snow.density[i],n=(((i*47)^(i*31+19))%23)/23-.5;
   const snowLevel=clamp((value-.08)*1.1);
   const base=(.15+snowLevel*.71+n*.04)*255;
   const k=i*4;
   img.data[k]=base*(warm?.98:blue?.68:.88);
   img.data[k+1]=base*(warm?.97:blue?.87:.96);
   img.data[k+2]=base*(warm?.8:1.08);
   img.data[k+3]=255;
  }
  c.putImageData(img,0,0);ctx.imageSmoothingEnabled=true;
  ctx.drawImage(thumb,0,0,w,h);
  ctx.save();
  if(warm||blue){
   const n=blue?8:18;
   for(let i=0;i<n;i++){
    const x=(i+.5)*w/n,y=h*(.085+.018*Math.sin(i*.6));
    const glow=ctx.createRadialGradient(x,y,0,x,y,h*.085);
    const color=blue?'117,193,255':'253,206,111';
    glow.addColorStop(0,'rgba('+color+',.48)');
    glow.addColorStop(1,'rgba('+color+',0)');
    ctx.fillStyle=glow;ctx.fillRect(x-h*.085,y-h*.085,h*.17,h*.17);
    ctx.fillStyle=blue?'#a8d7ff':'#ffe2a3';
    ctx.beginPath();ctx.arc(x,y,Math.max(2,w*.0035),0,TWO_PI);ctx.fill();
   }
  }
  ctx.restore();
 }
 private drawPulse(ctx:CanvasRenderingContext2D,pulse:Pulse,w:number,h:number,
  p:ProceduralParams,energy:number){
  const x=pulse.x*w,y=pulse.y*h;
  const age=pulse.age,scale=.6+clamp(p.radius)*1.7;
  const contact=pulse.kind==='contact',family=floorSceneById(this.id).family;
  if(family==='burst'&&!contact)return;
  if(family==='growth'){
   const growth=clamp(age/3);
   ctx.strokeStyle='rgba(153,199,106,'+(1-age/15)*.7+')';
   ctx.lineWidth=2.5*energy;
   for(let k=0;k<5;k++){
    const theta=TWO_PI*k/5+Math.sin(k*17)*.2;
    const dx=Math.cos(theta)*h*.075*growth,dy=Math.sin(theta)*h*.075*growth;
    ctx.beginPath();ctx.moveTo(x,y);
    ctx.quadraticCurveTo(x+dx*.8,y+dy*.2,x+dx,y+dy);ctx.stroke();
    if(contact&&growth>.5){
     ctx.fillStyle=k%2?'#dfe9ad':'#dfb4ab';
     ctx.beginPath();ctx.arc(x+dx,y+dy,3+energy*3,0,TWO_PI);ctx.fill();
    }
   }
   return;
  }
  if(family==='burst'){
   if(age>2.6)return;
   const fade=Math.max(0,1-age/2.6);
   for(let i=0;i<25;i++){
    const a=i*TWO_PI/25,dist=(16+age*h*.15)*(0.7+(i%4)*.13)*scale;
    ctx.strokeStyle=i%3===0?'#ffb676':i%3===1?'#c4e4dd':'#f8eec9';
    ctx.globalAlpha=fade*.87;
    ctx.lineWidth=(1.4+i%3)*energy;
    ctx.beginPath();ctx.moveTo(x+Math.cos(a)*dist*.55,y+Math.sin(a)*dist*.55);
    ctx.lineTo(x+Math.cos(a)*dist,y+Math.sin(a)*dist);ctx.stroke();
   }
   ctx.globalAlpha=1;return;
  }
  const duration=family==='splash'?3:family==='water'?7:family==='fluid'?10:5;
  if(age>duration)return;
  const alpha=Math.max(0,1-age/duration)*(.45+energy*.25);
  const radius=(5+age*h*.038)*(contact?1:.65)*scale;
  if(family==='fluid'){
   const grad=ctx.createRadialGradient(x,y,2,x,y,radius*1.5);
   grad.addColorStop(0,'rgba(130,46,148,'+alpha*.6+')');
   grad.addColorStop(1,'rgba(54,16,81,0)');
   ctx.fillStyle=grad;ctx.beginPath();ctx.arc(x,y,radius*1.5,0,TWO_PI);ctx.fill();
  }
  ctx.save();ctx.lineWidth=(family==='splash'?3:1.4)*energy;
  ctx.strokeStyle=family==='splash'?'rgba(146,230,255,'+alpha+')':
   family==='water'?'rgba(131,231,223,'+alpha+')':
   family==='fluid'?'rgba(212,151,236,'+alpha+')':
   family==='smoke'?'rgba(203,225,228,'+alpha*.33+')':
   'rgba(174,211,198,'+alpha*.3+')';
  for(let i=0;i<(family==='water'||family==='splash'?3:1);i++){
   ctx.beginPath();ctx.ellipse(x,y,(radius+i*22),(.58+Math.sin(age*.9)*.08)*(radius+i*20),0,0,TWO_PI);
   ctx.stroke();
  }
  if(family==='splash'&&contact){
   for(let i=0;i<9;i++){
    const a=i*TWO_PI/9,dist=Math.max(0,Math.sin(Math.min(1,age/1.3)*Math.PI))*h*.1*scale;
    ctx.fillStyle='rgba(155,233,255,'+alpha+')';
    ctx.beginPath();ctx.arc(x+Math.cos(a)*dist,y+Math.sin(a)*dist,2+2*energy,0,TWO_PI);ctx.fill();
   }
  }
  ctx.restore();
 }
 paint(canvas:HTMLCanvasElement,params:Partial<ProceduralParams>={}){
  const p={...defaults,...params};
  const ctx=canvas.getContext('2d',{alpha:false});if(!ctx)return;
  const w=1280,h=720;
  if(canvas.width!==w)canvas.width=w;
  if(canvas.height!==h)canvas.height=h;
  ctx.setTransform(1,0,0,1,0,0);
  const family=floorSceneById(this.id).family;
  const audio=clamp(p.audioLevel*p.audioMix),energy=clamp(p.intensity+audio*.7,.08,1.6);
  if(family==='snow')this.drawWinter(ctx,w,h,p);
  else this.drawBackground(ctx,w,h,family,audio);
  const anchors=[...this.anchors.values()];
  // Fog is a present layer with measured, continuously clearing voids.
  if(family==='fog'||family==='smoke'){
   ctx.save();ctx.globalAlpha=.18+energy*.12;
   for(let i=0;i<22;i++){
    const x=w*(i/21),y=h*(.24+.4*Math.sin(i*.33+this.clockMs*.00014));
    const grad=ctx.createRadialGradient(x,y,0,x,y,h*.28);
    grad.addColorStop(0,family==='fog'?'rgba(159,214,202,.65)':'rgba(190,206,216,.5)');
    grad.addColorStop(1,'rgba(145,185,190,0)');
    ctx.fillStyle=grad;ctx.beginPath();ctx.arc(x,y,h*.28,0,TWO_PI);ctx.fill();
   }
   ctx.restore();
   for(const a of anchors){
    const x=a.x*w,y=a.y*h,r=h*(.1+.17*p.radius);
    const grad=ctx.createRadialGradient(x,y,0,x,y,r);
    grad.addColorStop(0,'rgba(5,20,23,.96)');
    grad.addColorStop(.62,'rgba(8,21,25,.5)');
    grad.addColorStop(1,'rgba(8,20,22,0)');
    ctx.fillStyle=grad;ctx.beginPath();ctx.arc(x,y,r,0,TWO_PI);ctx.fill();
   }
  }
  for(const m of this.particles){
   const x=m.x*w,y=m.y*h,phase=m.phase;
   const visibility=.25+.75*Math.sin(phase*.7)**2;
   if(family==='leaves'||family==='growth'){
    ctx.save();ctx.translate(x,y);ctx.rotate(phase);
    ctx.fillStyle=family==='leaves'?(m.phase%3<1?'#a65c36':m.phase%3<2?'#b89455':'#6b8050'):'#91c798';
    ctx.globalAlpha=.25+.55*visibility;
    ctx.beginPath();ctx.ellipse(0,0,(4+m.size*2)*energy,2+m.size*1.6,-.5,0,TWO_PI);ctx.fill();ctx.restore();
   }else if(family==='swarm'){
    ctx.fillStyle='#b5d7c2';ctx.globalAlpha=.2+visibility*.8;
    ctx.fillRect(x,y,1.1+m.size*energy,1.1+m.size*energy);
   }else if(family==='fireflies'||family==='snow'){
    const r=(family==='snow'?1.4:2)+m.size*(family==='snow'?1:2.6)*energy;
    const g=ctx.createRadialGradient(x,y,0,x,y,r*5);
    const col=family==='fireflies'?'191,239,125':'223,241,241';
    g.addColorStop(0,'rgba('+col+','+visibility*.85+')');
    g.addColorStop(1,'rgba('+col+',0)');
    ctx.fillStyle=g;ctx.globalAlpha=.8;
    ctx.beginPath();ctx.arc(x,y,r*5,0,TWO_PI);ctx.fill();
   }else if(family==='fluid'||family==='water'||family==='splash'){
    ctx.fillStyle=family==='fluid'?'#9460af':'#89d2e5';
    ctx.globalAlpha=.06+visibility*.18;
    ctx.beginPath();ctx.ellipse(x,y,m.size*7+2,m.size*2+1,phase,0,TWO_PI);ctx.fill();
   }else if(family==='smoke'||family==='fog'){
    ctx.fillStyle='#adcdd1';ctx.globalAlpha=.02+visibility*.13;
    ctx.beginPath();ctx.arc(x,y,5+m.size*7,0,TWO_PI);ctx.fill();
   }
   ctx.globalAlpha=1;
  }
  if(family==='swarm'||family==='fireflies'){
   for(const a of anchors){
    const x=a.x*w,y=a.y*h,r=h*(.045+p.radius*.06);
    const halo=ctx.createRadialGradient(x,y,0,x,y,r);
    halo.addColorStop(0,family==='swarm'?'rgba(6,20,20,.95)':'rgba(190,232,132,.16)');
    halo.addColorStop(1,'rgba(6,20,20,0)');
    ctx.fillStyle=halo;ctx.beginPath();ctx.arc(x,y,r,0,TWO_PI);ctx.fill();
   }
  }
  if(family==='snow'){
   const warm=this.id==='christmas',blue=this.id==='hanukkah';
   if(warm||blue){
    for(let i=0;i<(blue?8:18);i++){
     const x=(i+.5)*w/(blue?8:18),y=h*(.09+.017*Math.sin(i*.8));
     const glow=ctx.createRadialGradient(x,y,0,x,y,45);
     const col=blue?'118,190,255':'250,207,122';
     glow.addColorStop(0,'rgba('+col+',.54)');
     glow.addColorStop(1,'rgba('+col+',0)');
     ctx.fillStyle=glow;ctx.fillRect(x-45,y-45,90,90);
    }
   }
  }
  for(const pulse of this.pulses)this.drawPulse(ctx,pulse,w,h,p,energy);
  ctx.globalAlpha=1;
 }
}
