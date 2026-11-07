import {clamp} from '../engine/motion.ts';
import type {ArchiveRule,FeatureSnapshot,RuleEffect} from './types.ts';
type Memory={smooth:number;at:number;pending:number|null;active:boolean;firedAt:number;releasedAt:number;amount:number;lastValid:number;direction:number;manualRequired:boolean};
export class ArchiveRules{
 private memory=new Map<string,Memory>();private forced=new Map<string,number>();
 reset(){this.memory.clear();this.forced.clear();}
 trigger(id:string,now:number){this.forced.set(id,now+500);}
 step(rules:ArchiveRule[],snapshot:FeatureSnapshot,now:number,holdMs:number):RuleEffect[]{
  const ids=new Set(rules.map(r=>r.id));for(const id of this.memory.keys())if(!ids.has(id))this.memory.delete(id);
  for(const [id,until]of this.forced)if(until<now)this.forced.delete(id);
  return rules.filter(r=>r.enabled).map(r=>{
   let m=this.memory.get(r.id);if(!m){m={smooth:0,at:now,pending:null,active:false,firedAt:-Infinity,releasedAt:-Infinity,amount:0,lastValid:-Infinity,direction:1,manualRequired:false};this.memory.set(r.id,m);}
   const dt=Math.max(0,now-m.at);m.at=now;
   const actors=r.actor==='both'?snapshot.actors:snapshot.actors.filter(a=>a.id===(r.actor==='manual'?'A':r.actor));
   const forced=(this.forced.get(r.id)??0)>now;
   const detected=actors.length>0&&actors.every(a=>a.visible&&!a.uncertain)&&now-snapshot.timestampMs<450&&(r.feature!=='distance'||snapshot.distance!==null);
   if(r.lost==='manual-only'&&!detected&&Number.isFinite(m.lastValid))m.manualRequired=true;
   if(forced||snapshot.source==='manual')m.manualRequired=false;
   const valid=forced||(detected&&!m.manualRequired&&(r.actor!=='manual'||snapshot.source==='manual'));
   let value=0;
   if(valid){
    m.lastValid=now;
    if(r.feature==='low-still')value=actors.every(a=>a.hipHeight<=r.lowHeight&&a.horizontal>=r.horizontal&&a.stillMs>=r.stillMs)?1:0;
    else if(r.feature==='still')value=clamp(Math.min(...actors.map(a=>a.stillMs))/Math.max(1,r.stillMs));
    else if(r.feature==='swipe')value=Math.max(...actors.map(a=>a.speed));
    else if(r.feature==='distance')value=snapshot.distance??0;
    else if(r.feature==='height')value=Math.min(...actors.map(a=>a.hipHeight));
    if(r.invert)value=1-value;
    if(forced)value=1;
    m.smooth+=(value-m.smooth)*(r.smoothingMs?1-Math.exp(-Math.max(dt,1)/r.smoothingMs):1);
   }
   const candidate=valid&&(forced||r.feature!=='manual'&&m.smooth>=(m.active?Math.max(0,r.threshold-r.hysteresis):r.threshold));
   let triggered=false;
   if(candidate){if(m.pending===null)m.pending=now;if(!m.active&&(forced||now-m.pending>=r.dwellMs)&&now-m.firedAt>=r.cooldownMs){m.active=true;m.firedAt=now;triggered=true;}}
   else{m.pending=null;if(m.active){m.active=false;m.releasedAt=now;}}
   const actor=actors.find(a=>a.visible)??actors[0];if(valid&&actor&&Math.abs(actor.vx)>.03)m.direction=Math.sign(actor.vx);
   let target=m.active?r.intensity:!r.resetOnRelease&&now-m.firedAt<r.durationMs?r.intensity:0;
   if(!valid){m.pending=null;m.active=false;if(r.lost==='release'||r.lost==='manual-only'||now-m.lastValid>holdMs)target=0;else target=m.amount;}
   m.amount+=(target-m.amount)*(1-Math.exp(-Math.max(1,dt)/(target>m.amount?120:r.returnMs/3)));
   if(m.amount<.001)m.amount=0;
   return {id:r.id,type:r.textAction,amount:m.amount,value:m.smooth,triggered,live:valid&&m.active,direction:m.direction,x:actor?.wristX??.5,y:actor?.wristY??.5,targetWords:r.targetWords,ageMs:Number.isFinite(m.firedAt)?now-m.firedAt:0};
  });
 }
}
