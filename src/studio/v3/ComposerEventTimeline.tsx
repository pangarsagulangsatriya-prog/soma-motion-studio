import {useMemo} from 'react';
import type {TimelineCapture,TimelineKind} from './composerEventTimelineModel.ts';
import {timelineDuration} from './composerEventTimelineModel.ts';
export type TimelineMode='live'|'replay';
const kinds:TimelineKind[]=['contact','slide','pivot','release'];
const format=(ms:number)=>{const total=Math.floor(Math.max(0,ms)/1000);return String(Math.floor(total/60)).padStart(2,'0')+':'+String(total%60).padStart(2,'0');};
export function ComposerEventTimeline({capture,positionMs,onSeek,mode,onModeChange,playing,onPlayingChange,onClear,speed,onSpeedChange}:{
 capture:TimelineCapture;positionMs:number;onSeek:(ms:number)=>void;
 mode:TimelineMode;onModeChange:(mode:TimelineMode)=>void;
 playing:boolean;onPlayingChange:(value:boolean)=>void;
 onClear:()=>void;speed:number;onSpeedChange:(value:number)=>void;
}){
 const duration=timelineDuration(capture);
 const visible=useMemo(()=>capture.events.filter(e=>kinds.includes(e.kind)),[capture.events]);
 return <section className="cp09-timeline" aria-label="Event Timeline dan Playback">
  <div className="cp09-timeline-head">
   <strong>EVENT TIMELINE</strong>
   <span>{capture.events.length} events · {mode==='replay'?'REPLAY / SOFTWARE':'LIVE CAPTURE'}</span>
  </div>
  <div className="cp09-transport" role="group" aria-label="Kontrol playback event">
   <button type="button" onClick={()=>{onModeChange('live');onPlayingChange(false);}}
    aria-pressed={mode==='live'}>Live</button>
   <button type="button" onClick={()=>{onModeChange('replay');onSeek(0);onPlayingChange(true);}}
    disabled={!capture.events.length}>Replay</button>
   <button type="button" disabled={mode!=='replay'||!capture.events.length}
    onClick={()=>onPlayingChange(!playing)}>{playing?'Pause':'Play'}</button>
   <button type="button" disabled={mode!=='replay'} onClick={()=>{onSeek(0);onPlayingChange(false);}}>Reset</button>
   <label>Speed <select value={speed} onChange={e=>onSpeedChange(Number(e.currentTarget.value))}>
    <option value=".5">0.5×</option><option value="1">1×</option><option value="2">2×</option>
   </select></label>
   <button type="button" onClick={onClear} disabled={!capture.events.length}>Clear</button>
  </div>
  <div className="cp09-time-markers"><span>{format(mode==='replay'?positionMs:duration)}</span><span>{format(duration)}</span></div>
  <input aria-label="Scrub event timeline" className="cp09-scrubber" type="range" min="0" max={duration}
   step="20" value={mode==='replay'?Math.min(positionMs,duration):duration}
   disabled={!capture.events.length} onChange={e=>{onModeChange('replay');onPlayingChange(false);onSeek(Number(e.currentTarget.value));}}/>
  <div className="cp09-lanes" role="group" aria-label="Recorded event lanes">
   {kinds.map(kind=><div key={kind} className="cp09-lane">
    <span>{kind.toUpperCase()}</span>
    <div className="cp09-lane-track">
     {visible.filter(e=>e.kind===kind).map(e=><button type="button" key={e.id} className="cp09-event-dot"
      aria-label={kind+' '+e.actorId+' '+format(e.atMs)} title={kind+' · '+e.actorId+' · '+format(e.atMs)}
      style={{left:Math.min(99.5,100*e.atMs/duration)+'%'}}
      onClick={()=>{onModeChange('replay');onPlayingChange(false);onSeek(e.atMs);}}/>)}
    </div>
   </div>)}
  </div>
  <small className="cp09-timeline-note">Replay memakai event yang terekam selama Compose terbuka. Scrub mengulang jejak/scene pada preview software; posisi video MP4 tidak diubah dan event lama dari sebelum perekaman tidak dapat dipulihkan.</small>
 </section>;
}