import type {FootLineSample} from './FootLineSampleAdapter.ts';

type Side='left'|'right';
type Position={x:number;y:number;atMs:number};
type ActorLock={foot:Side;previous:Partial<Record<Side,Position>>;candidate:Side|null;frames:number;lastAt:number};
const valid=(s:FootLineSample)=>Number.isFinite(s.x)&&Number.isFinite(s.y)&&
 s.x>=0&&s.x<=1&&s.y>=0&&s.y<=1&&s.confidence>=.45;
const displacement=(s:FootLineSample,previous?:Position)=>{
 if(!previous||s.atMs<=previous.atMs||s.atMs-previous.atMs>390)return 0;
 // Measure motion in DISPLAY pixels, independent of source frame rate.
 return Math.hypot((s.x-previous.x)*1600,(s.y-previous.y)*900)*
  Math.min(2,33/Math.max(12,s.atMs-previous.atMs));
};
/** ONE active brush path per performer. Two feet are observations, not two paintbrushes.
 * Locks to the observed moving foot, switching after sustained alternate movement.
 * Disconnection or a fresh camera/clip session never joins unrelated positions. */
export class ActiveFootSelector{
 private actors=new Map<string,ActorLock>();
 reset(){this.actors.clear();}
 select(samples:readonly FootLineSample[]):FootLineSample[]{
  const groups=new Map<string,FootLineSample[]>();
  for(const s of samples){
   if(!valid(s))continue;
   const group=groups.get(s.actorId)??[];
   group.push(s);groups.set(s.actorId,group);
  }
  const visible=new Set(groups.keys());
  for(const actor of this.actors.keys())if(!visible.has(actor))this.actors.delete(actor);
  const output:FootLineSample[]=[];
  for(const [actorId,group] of groups){
   const bySide=new Map<Side,FootLineSample>();
   for(const s of group){
    const old=bySide.get(s.foot);
    if(!old||s.confidence>old.confidence)bySide.set(s.foot,s);
   }
   const latest=Math.max(...group.map(s=>s.atMs));
   let lock=this.actors.get(actorId);
   if(lock&&(latest<=lock.lastAt||latest-lock.lastAt>390)){
    // Duplicate frames carry no new movement. Rewinds/stale clips reset the lock.
    if(latest===lock.lastAt)continue;
    lock=undefined;
   }
   const left=bySide.get('left'),right=bySide.get('right');
   if(!lock){
    const foot:Side=left&&right?(right.confidence>left.confidence+.12?'right':'left'):
     left?'left':'right';
    lock={foot,previous:{},candidate:null,frames:0,lastAt:latest};
   }else{
    const current=bySide.get(lock.foot),alternate:Side=lock.foot==='left'?'right':'left';
    const other=bySide.get(alternate);
    if(!current&&other){
     lock.foot=alternate;lock.candidate=null;lock.frames=0;
    }else if(current&&other){
     const movement=displacement(current,lock.previous[lock.foot]);
     const altMovement=displacement(other,lock.previous[alternate]);
     // Hold the active foot until it is visibly resting and the other moves.
     const takeOver=altMovement>3.2&&altMovement>Math.max(3.2,movement*2.3)
      &&movement<2.2;
     if(takeOver){
      lock.frames=lock.candidate===alternate?lock.frames+1:1;
      lock.candidate=alternate;
      if(lock.frames>=5){
       lock.foot=alternate;lock.candidate=null;lock.frames=0;
      }
     }else{lock.candidate=null;lock.frames=0;}
    }
   }
   for(const s of group)lock.previous[s.foot]={x:s.x,y:s.y,atMs:s.atMs};
   lock.lastAt=latest;this.actors.set(actorId,lock);
   const chosen=bySide.get(lock.foot);
   if(chosen)output.push(chosen);
  }
  return output;
 }
}
