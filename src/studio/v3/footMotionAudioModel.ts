import {footMotionCanStamp,validFootMotionEvent,type FootMotionEventV2} from '../../footprints/scenes/FootMotionEventV2.ts';
import {characterPatch,defaults,type AudioParams,type Character,type Settings} from '../../engine/types.ts';
const unit=(n:number)=>Number.isFinite(n)?Math.max(0,Math.min(1,n)):0;
export type FootAudioMode='step'|'trace';
export type FootAudioAction={kind:'contact'|'motion';event:FootMotionEventV2};
/** Poll the canonical recent-event bus, never replay accumulated footprints on enable.
 * Source timestamps use different clock domains (MP4, camera, simulator).
 * Session + event identity defines novelty; only live clock events get wall-age checks.
 * No pressure inference and no new contact generation. */
export class FootAudioCursor{
 private session='';private seen=new Set<string>();
 reset(session:string,events:readonly FootMotionEventV2[]){this.session=session;this.seen=new Set(events.filter(e=>e.sessionId===session&&validFootMotionEvent(e)).map(e=>e.eventId));}
 consume(session:string,events:readonly FootMotionEventV2[],mode:FootAudioMode,now:number):FootAudioAction[]{
  if(this.session!==session){this.reset(session,events);return [];}
  const out:FootAudioAction[]=[];
  for(const e of events){
   if(e.sessionId!==session||!validFootMotionEvent(e)||this.seen.has(e.eventId))continue;
   this.seen.add(e.eventId);
   if(e.actorId.startsWith('unassigned-')||e.confidence<.5)continue;
   if((e.source==='camera'||e.source==='phone'||e.source==='touch')&&(e.atMs>now+50||now-e.atMs>450))continue;
   if(footMotionCanStamp(e))out.push({kind:'contact',event:e});
   else if(mode==='trace'&&e.kind==='movement'&&e.speed>.018)out.push({kind:'motion',event:e});
  }
  // Bus is capped at 480 events; keep recent ids so long sessions remain bounded.
  if(this.seen.size>2000)this.seen=new Set(events.filter(e=>e.sessionId===session&&validFootMotionEvent(e)).map(e=>e.eventId));
  // No accumulated burst on a slow frame. Two contacts + latest movement.
  const contacts=out.filter(x=>x.kind==='contact').slice(-2),motion=out.filter(x=>x.kind==='motion').at(-1);
  return motion?[...contacts,motion]:contacts;
 }
}
export function footAudioSettings(character:Character,volume:number,mode:FootAudioMode):Settings{
 return {...defaults(),...characterPatch(character),input:'body',output:'both',mode:mode==='step'?'percussion':'theremin',master:unit(volume)*.5,maxVoices:4,instrument:character==='raw'?'pink':'sine'};
}
export function footAudioParams(s:Settings,event?:Pick<FootMotionEventV2,'x'|'y'|'speed'|'confidence'>):AudioParams{
 const x=unit(event?.x??.5),y=unit(event?.y??.5),speed=unit(event?.speed??0);
 return {frequency:65+195*(1-y),amplitude:event?.speed?Math.min(.65,.08+speed*.57):0,filter:500+speed*3500,pan:x*1.6-.8,reverb:s.reverb,modulation:s.modulation,delay:s.delay,resonance:s.resonance,attack:s.attack,release:s.release,modRate:s.modRate,...{roughness:s.macros.roughness,weight:s.macros.weight,brightness:s.macros.brightness}};
}
