import type {AudioEngine} from '../engine/audio.ts';
import {clamp} from '../engine/motion.ts';
import type {Asset,VoiceTrack,VoiceSegment,ArchiveRule,RuleEffect} from './types.ts';
type Clip={source:AudioBufferSourceNode;gain:GainNode;filter:BiquadFilterNode;shape:WaveShaperNode;trackId:string;end:number};
export class ArchiveVoice {
 readonly limit=6;private buffers=new Map<string,AudioBuffer>();private reversed=new Map<string,AudioBuffer>();private clips:Clip[]=[];
 private loadGeneration=0;private channel:Partial<Record<'nl'|'id',GainNode>>={};private context:AudioContext|null=null;private nextLoop=new Map<string,number>();private lastSchedule=new Map<string,number>();private once=new Set<string>();
 statuses=new Map<string,'loading'|'ready'|'error'>();error='';scheduled=0;maxObserved=0;lastScheduleDelayMs=0;
 constructor(privateEngine:AudioEngine){this.engine=privateEngine;}private engine:AudioEngine;
 get active(){return this.clips.length;}
 isPlaying(id:string){return this.clips.some(c=>c.trackId===id);}
 get decodedBytes(){return [...this.buffers.values(),...this.reversed.values()].reduce((n,b)=>n+b.length*b.numberOfChannels*4,0);}
 private connect(){const c=this.engine.context;if(!c||!this.engine.archiveInput)throw new Error('Aktifkan audio dahulu.');if(this.context!==c){this.dispose();this.context=c;for(const language of ['nl','id'] as const){const gain=c.createGain();gain.gain.value=.7;gain.connect(this.engine.archiveInput);this.channel[language]=gain;}}return c;}
 async load(track:VoiceTrack,asset:Asset){const c=this.connect(),generation=this.loadGeneration;this.statuses.set(track.id,'loading');try{const buffer=await c.decodeAudioData(await asset.blob.arrayBuffer());if(generation!==this.loadGeneration)return 0;if(buffer.duration>1800||this.decodedBytes+buffer.length*buffer.numberOfChannels*4>240*1024*1024)throw new Error('Rekaman terlalu besar untuk memori. Gunakan potongan lebih pendek.');this.buffers.set(track.id,buffer);this.reversed.delete(track.id);this.statuses.set(track.id,'ready');return buffer.duration*1000;}catch(e){this.statuses.set(track.id,'error');this.error=(e as Error).message;throw e;}}
 clearRecordings(){this.loadGeneration++;this.release();this.buffers.clear();this.reversed.clear();this.statuses.clear();this.lastSchedule.clear();this.once.clear();}
 forget(id:string){this.loadGeneration++;this.clips.filter(c=>c.trackId===id).forEach(c=>this.stopClip(c,0));this.buffers.delete(id);this.reversed.delete(id);this.statuses.delete(id);}
 duration(id:string){return (this.buffers.get(id)?.duration??0)*1000;}
 crossfade(value:number){if(!this.context)return;const t=this.context.currentTime;this.channel.nl?.gain.setTargetAtTime(Math.cos(clamp(value)*Math.PI/2)*.8,t,.06);this.channel.id?.gain.setTargetAtTime(Math.sin(clamp(value)*Math.PI/2)*.8,t,.06);}
 equalMix(){if(this.context)for(const g of Object.values(this.channel))g.gain.setTargetAtTime(.65,this.context.currentTime,.04);}
 play(track:VoiceTrack,segment?:VoiceSegment,options:{position?:number;reverse?:boolean;grainMs?:number;delay?:number;stamp?:number}={}){
  const c=this.engine.context,buffer=this.buffers.get(track.id);if(!c||c.state!=='running'||!buffer||this.engine.muted||!this.engine.enabled)return false;
  const now=c.currentTime;if(now-(this.lastSchedule.get(track.id)??-Infinity)<.018)return false;this.lastSchedule.set(track.id,now);
  // Absolute cap includes nodes awaiting their onended event. A rapid operator action cannot grow the graph.
  if(this.clips.length>=this.limit)return false;
  const start=clamp((segment?.startMs??0)/1000,0,buffer.duration),end=clamp((segment?.endMs??buffer.duration*1000)/1000,start,buffer.duration);if(end-start<.02)return false;
  let offset=start,duration=end-start;if(options.grainMs){duration=Math.min(duration,options.grainMs/1000);offset=start+clamp(options.position??0)*Math.max(0,end-start-duration);}else if(options.position!==undefined){offset=start+clamp(options.position,0,.99)*(end-start);duration=end-offset;}
  let sourceBuffer=buffer;
  if(options.reverse){let reverse=this.reversed.get(track.id);if(!reverse){if(this.decodedBytes+buffer.length*buffer.numberOfChannels*4>240*1024*1024)return false;reverse=c.createBuffer(buffer.numberOfChannels,buffer.length,buffer.sampleRate);for(let ch=0;ch<buffer.numberOfChannels;ch++)reverse.getChannelData(ch).set(buffer.getChannelData(ch).slice().reverse());this.reversed.set(track.id,reverse);}sourceBuffer=reverse;offset=buffer.duration-offset-duration;}
  const source=c.createBufferSource(),gain=c.createGain(),filter=c.createBiquadFilter(),shape=c.createWaveShaper();source.buffer=sourceBuffer;filter.type='lowpass';filter.frequency.value=Math.min(clamp(track.cutoff??18000,80,18000),c.sampleRate*.45);filter.Q.value=.7;
  const texture=clamp(track.texture??0);if(texture>.001){const curve=new Float32Array(1024),drive=1+texture*12;for(let i=0;i<curve.length;i++)curve[i]=Math.tanh((i*2/(curve.length-1)-1)*drive)/Math.tanh(drive);shape.curve=curve;shape.oversample='2x';}
  source.connect(filter).connect(shape).connect(gain).connect(this.channel[track.language]!);
  const at=now+Math.max(.005,options.delay??0),fade=Math.min(.012,duration/4);gain.gain.setValueAtTime(0,at);gain.gain.linearRampToValueAtTime(clamp(track.gain)*.65,at+fade);gain.gain.setValueAtTime(clamp(track.gain)*.65,at+duration-fade);gain.gain.linearRampToValueAtTime(0,at+duration);
  const clip={source,gain,filter,shape,trackId:track.id,end:at+duration};this.clips.push(clip);source.onended=()=>{source.disconnect();filter.disconnect();shape.disconnect();gain.disconnect();this.clips=this.clips.filter(c=>c!==clip);};source.start(at,Math.max(0,offset),duration);source.stop(at+duration+.02);this.scheduled++;this.maxObserved=Math.max(this.maxObserved,this.clips.length);this.lastScheduleDelayMs=options.stamp?performance.now()-options.stamp+(at-now)*1000:0;return true;
 }
 private stopClip(clip:Clip,fade=.035){const c=this.context;if(!c)return;const t=c.currentTime;clip.gain.gain.cancelScheduledValues(t);if(fade){clip.gain.gain.setTargetAtTime(0,t,fade/3);}else clip.gain.gain.setValueAtTime(0,t);try{clip.source.stop(t+fade);}catch{}}
 release(){this.clips.forEach(c=>this.stopClip(c));this.nextLoop.clear();}
 resetCue(){this.release();this.once.clear();this.equalMix();}
 heartbeat(){const c=this.engine.context,g=this.engine.archiveInput?.gain;if(!c||!g)return;const t=c.currentTime;g.cancelScheduledValues(t);g.setTargetAtTime(this.engine.muted?0:.7,t,.015);if(!this.engine.muted)g.setTargetAtTime(0,t+.65,.05);}
 tick(rules:ArchiveRule[],effects:RuleEffect[],tracks:VoiceTrack[],segments:VoiceSegment[],stamp:number){
  if(this.engine.muted)return;
  for(const effect of effects){const rule=rules.find(r=>r.id===effect.id);if(!rule||!effect.live||rule.audioAction==='none')continue;
   if(rule.audioAction==='crossfade'){this.crossfade(effect.value);continue;}
   const candidates=segments.filter(s=>rule.segmentIds.includes(s.id)),selected=candidates[0];
   // Never substitute a random recording for an unprepared word segment.
   const track=selected?tracks.find(t=>t.id===selected.trackId):undefined;if(!track)continue;
   const now=performance.now();const due=now>=(this.nextLoop.get(rule.id)??0);
   if(rule.audioAction==='once'&&effect.triggered&&!this.once.has(rule.id)){if(this.play(track,selected,{stamp}))this.once.add(rule.id);}
   else if(rule.audioAction==='loop'&&due){this.play(track,selected,{stamp});this.nextLoop.set(rule.id,now+Math.max(220,1500-effect.amount*1200));}
   else if(rule.audioAction==='scrub'&&(effect.triggered||due)){this.play(track,selected,{position:effect.x,reverse:effect.direction<0,grainMs:160,stamp});this.nextLoop.set(rule.id,now+Math.max(120,350-effect.value*220));}
  }
 }
 dispose(){this.loadGeneration++;for(const c of this.clips){c.source.onended=null;try{c.source.stop();}catch{}c.source.disconnect();c.filter.disconnect();c.shape.disconnect();c.gain.disconnect();}this.clips=[];Object.values(this.channel).forEach(g=>g.disconnect());this.channel={};this.context=null;this.buffers.clear();this.reversed.clear();this.statuses.clear();this.nextLoop.clear();this.lastSchedule.clear();this.once.clear();}
}
