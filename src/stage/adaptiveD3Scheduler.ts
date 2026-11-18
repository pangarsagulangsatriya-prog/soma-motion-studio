/**
 * S0.4 — quality- and load-aware D3 crop scheduling in the existing pose worker.
 * Never determines identity: candidates have already passed D2/guide matching.
 * One crop at a time, adaptive audit of otherwise stable ankles/heels/toes.
 */
import type {Landmark} from '../engine/types.ts';
import type {D3Match,D3Actor} from './duetPose33.ts';

export type D3ScheduleDecision={
 matches:D3Match[];intervalMs:number;
 mode:'quality'|'audit'|'deferred';
 reason:string;
};
const footIndices=[27,28,29,30,31,32];
export function d3FootQuality(pose:readonly Landmark[]|undefined){
 if(!pose||pose.length!==33)return 0;
 const measured=footIndices.map(i=>pose[i]).map(p=>
  p&&Number.isFinite(p.x)&&Number.isFinite(p.y)&&p.x>=0&&p.x<=1&&p.y>=0&&p.y<=1?
   Math.max(0,Math.min(1,p.visibility??0)):0);
 // Penalize an unreliable single foot even when the opposite leg looks clear.
 const left=Math.min(measured[0],measured[2],measured[4]);
 const right=Math.min(measured[1],measured[3],measured[5]);
 return Math.min(left,right)*.65+
  (measured.reduce((sum,v)=>sum+v,0)/measured.length)*.35;
}
export class AdaptiveD3Scheduler{
 private previousClock=-1;
 private startAt=-1;
 private lastFor=new Map<D3Actor,number>();
 private cropEwma=0;
 private lastAnyMs=-Infinity;
 reset(){
  this.previousClock=-1;this.startAt=-1;
  this.lastFor.clear();this.cropEwma=0;this.lastAnyMs=-Infinity;
 }
 choose(clock:number,primaryMs:number,matches:readonly D3Match[],
  poses:readonly (readonly Landmark[])[]):D3ScheduleDecision{
  const defer=(reason:string,intervalMs=0):D3ScheduleDecision=>
   ({matches:[],mode:'deferred',reason,intervalMs});
  if(!Number.isFinite(clock)||!Number.isFinite(primaryMs))
   return defer('Waktu inferensi tidak valid.');
  if(this.previousClock>=0&&(clock<this.previousClock||clock-this.previousClock>2800))
   this.reset();
  this.previousClock=clock;
  if(this.startAt<0)this.startAt=clock;
  if(!matches.length)return defer('D3 menunggu identitas A/B yang aman.');
  if(clock-this.lastAnyMs<260)return defer('D3 cooldown: menjaga FPS pose utama.',260);
  // Preserve the main body result when the CPU is saturated. No extra crop.
  if(primaryMs>105||this.cropEwma>125&&primaryMs>72)
   return defer('Beban worker tinggi, D3 dilewati.',900);
  const due=matches.map(match=>{
   const quality=d3FootQuality(poses[match.rawIndex]);
   const urgent=quality<.74;
   const base=urgent?340:1400;
   const load=primaryMs>65?1.65:primaryMs>42?1.30:1;
   const cropLoad=this.cropEwma>75?1.5:this.cropEwma>45?1.2:1;
   const intervalMs=Math.round(base*load*cropLoad);
   const previous=this.lastFor.get(match.id);
   const elapsed=clock-(previous??(urgent?-Infinity:this.startAt));
   return {match,urgent,quality,intervalMs,elapsed};
  }).filter(entry=>entry.elapsed>=entry.intervalMs);
  if(!due.length)return defer('Landmark stabil; crop D3 dijadwalkan lebih jarang.',1400);
  // Low-quality feet first; equal quality goes to the actor waiting longest.
  due.sort((a,b)=>Number(b.urgent)-Number(a.urgent)||
    a.quality-b.quality||b.elapsed-a.elapsed);
  const selected=due[0];
  return {matches:[selected.match],mode:selected.urgent?'quality':'audit',
   reason:selected.urgent?'Memulihkan detail kaki dengan crop terarah.':
    'Audit berkala pose yang sudah stabil.',intervalMs:selected.intervalMs};
 }
 observe(clock:number,id:D3Actor,elapsedMs:number){
  if(Number.isFinite(clock)){this.lastFor.set(id,clock);this.lastAnyMs=clock;}
  if(Number.isFinite(elapsedMs)&&elapsedMs>=0)
   this.cropEwma=this.cropEwma>0?
    this.cropEwma*.72+elapsedMs*.28:elapsedMs;
 }
 get estimatedCropMs(){return this.cropEwma;}
}
