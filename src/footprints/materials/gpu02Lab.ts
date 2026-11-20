/** Dev-only GPU-02 gallery. Never imported by Stage, Compose or Perform.
 * Fixed timeline allows identical Chromium QA captures and reproducible review.
 */
import {LiquidImprintGpuEngine} from './LiquidImprintGpuEngine.ts';
import {PixiLiquidImprintCompositor} from './PixiLiquidImprintCompositor.ts';
import type {FloorInteractionEvent} from '../scenes/FloorInteractionEngine.ts';

export type LiquidLabScenario='one'|'two'|'six'|'slide'|'pivot'|'release'|'idle'|'crossing';
const scenarios:LiquidLabScenario[]=[
 'one','two','six','slide','pivot','release','idle','crossing'
];
const canvas=document.querySelector<HTMLCanvasElement>('#gpu02-stage');
const status=document.querySelector<HTMLElement>('#status');
if(!canvas||!status)throw Error('GPU02 lab element missing');
const label=status;
// Exactly one active renderer. The Pixi mode does not construct the native
// WebGL reference engine; neither Stage nor a second canvas is initialized.
const usePixi=new URLSearchParams(location.search).get('engine')==='pixi';
const engine=usePixi?await PixiLiquidImprintCompositor.create(canvas):
 new LiquidImprintGpuEngine(canvas);
let lastEvents:FloorInteractionEvent[]=[];
let active:LiquidLabScenario='six';
let clock=10450;
let anim=0;
const readOnlyBase={
 source:'simulator' as const,basis:'simulated' as const,
 confidence:1,speed:0,radius:.03,verified:true
};
function contact(id:number,actorId:string,foot:'left'|'right',
 x:number,y:number,atMs:number,headingRad=1.57):FloorInteractionEvent{
 return {...readOnlyBase,id:'qa-contact-'+id,originEventId:'qa-landing-'+id,
  kind:'contact',actorId,foot,x,y,headingRad,atMs};
}
function move(kind:'slide'|'pivot'|'release',footprint:FloorInteractionEvent,
 atMs:number,x:number,y:number,headingRad=1.57):FloorInteractionEvent{
 return {...readOnlyBase,verified:false,id:'qa-'+kind+'-'+footprint.id,
  kind,actorId:footprint.actorId,foot:footprint.foot,
  x,y,headingRad,atMs};
}
function makeEvents(name:LiquidLabScenario):FloorInteractionEvent[]{
 const a=contact(1,'A','left',.47,.50,10000);
 const b=contact(2,'B','right',.57,.50,10030);
 if(name==='one')return [a];
 if(name==='two')return [a,b];
 if(name==='slide')return [a,move('slide',a,10320,.51,.505)];
 if(name==='pivot')return [a,move('pivot',a,10320,.47,.50,1.57+.68)];
 if(name==='release')return [a,move('release',a,10320,.47,.50)];
 if(name==='idle')return [contact(1,'A','left',.47,.50,1000)];
 if(name==='crossing')return [
  contact(1,'A','left',.40,.37,10000),
  contact(2,'B','right',.60,.37,10025),
  contact(3,'A','right',.53,.56,10050),
  contact(4,'B','left',.46,.56,10075)
 ];
 return [
  contact(1,'A','left',.16,.38,10000),
  contact(2,'A','right',.30,.59,10035),
  contact(3,'B','left',.44,.38,10070),
  contact(4,'B','right',.58,.59,10105),
  contact(5,'A','left',.72,.38,10140),
  contact(6,'B','right',.85,.59,10175)
 ];
}
function updateControls(){
 for(const button of document.querySelectorAll<HTMLButtonElement>('[data-scenario]')){
  button.setAttribute('aria-pressed',String(button.dataset.scenario===active));
 }
}
function runScenario(scenario:LiquidLabScenario,timeMs=10450){
 if(!scenarios.includes(scenario))throw Error('Unknown GPU02 QA scenario');
 active=scenario;clock=timeMs;lastEvents=makeEvents(scenario);
 updateControls();
 const stats=engine.render(lastEvents,clock,{flow:.76,lifeMs:9000});
 label.textContent=active.toUpperCase()+' · '+stats.activeImprints+
  ' tapak · '+stats.contexts+' '+stats.renderer+' · texture '+stats.allocatedTextures+
  ' · arah belum terbaca '+stats.orientationUncertain;
 return stats;
}
for(const button of document.querySelectorAll<HTMLButtonElement>('[data-scenario]')){
 button.addEventListener('click',()=>{
  const value=button.dataset.scenario as LiquidLabScenario;
  runScenario(value);
 });
}
/** Accelerated 10-minute timeline sweep for GPU resource checks.
 * This samples the time domain, not wall-clock 10-minute FPS performance. */
function runAcceleratedSweep(){
 const events:FloorInteractionEvent[]=[];
 let peak=0,frames=0,created=0;
 for(let seconds=0;seconds<600;seconds+=5){
  const n=Math.floor(seconds/5);
  const atMs=seconds*1000;
  events.push(contact(10000+n,n%2?'B':'A',n%2?'right':'left',
   .18+(n%5)*.16,.35+(n%3)*.14,atMs));
  const stats=engine.render(events,atMs+100,{
   flow:.76,lifeMs:9000
  });
  frames++;
  peak=Math.max(peak,stats.allocatedTextures);
  created++;
  if(stats.allocatedTextures>stats.maxTextures)
   throw Error('GPU02 texture budget exceeded');
 }
 const cleared=engine.render(events,610000,{flow:.76,lifeMs:9000});
 return {sampledMinutes:10,frames,syntheticContacts:created,peakTextures:peak,
  finalTextures:cleared.allocatedTextures,contexts:cleared.contexts};
}
declare global{
 interface Window{
  __gpu02QA?:{
   runScenario:(scenario:LiquidLabScenario,timeMs?:number)=>ReturnType<typeof engine.render>;
   stats:()=>ReturnType<typeof engine.render>;
   events:()=>readonly FloorInteractionEvent[];
   acceleratedSweep:()=>ReturnType<typeof runAcceleratedSweep>;
   destroy:()=>void;
  };
 }
}
window.__gpu02QA={
 runScenario,
 stats:()=>engine.stats,
 events:()=>lastEvents,
 acceleratedSweep:runAcceleratedSweep,
 destroy:()=>{cancelAnimationFrame(anim);engine.destroy();}
};
runScenario(active);
if(!new URLSearchParams(location.search).has('qa')){
 let previous=performance.now();
 const animate=(now:number)=>{
  anim=requestAnimationFrame(animate);
  if(now-previous<1000/30)return;
  const dt=Math.min(100,now-previous);previous=now;
  clock+=dt;
  engine.render(lastEvents,clock,{flow:.76});
 };
 anim=requestAnimationFrame(animate);
}
window.addEventListener('pagehide',()=>window.__gpu02QA?.destroy(),{once:true});
