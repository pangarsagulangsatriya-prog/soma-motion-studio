import {useEffect,useLayoutEffect,useRef,useState} from 'react';
import {Volume2,VolumeX} from 'lucide-react';
import {AudioEngine} from '../../engine/audio.ts';
import {CHARACTERS,type Character} from '../../engine/types.ts';
import type {FootMotionEventV2} from '../../footprints/scenes/FootMotionEventV2.ts';
import {FootAudioCursor,footAudioParams,footAudioSettings,type FootAudioMode} from './footMotionAudioModel.ts';
import {SOFTWARE_PREVIEW_BLACKOUT_EVENT} from './stagePreviewCommands.ts';
import './foot-motion-audio.css';
type Props={visible:boolean;allowed:boolean;sourceReady:boolean;trace:boolean;events?:()=>readonly FootMotionEventV2[];session?:()=>string;onTakeAudio?:()=>boolean};
export function FootMotionAudioPanel(props:Props){
 const current=useRef(props);current.current=props;
 const engine=useRef<AudioEngine|null>(null),cursor=useRef(new FootAudioCursor()),request=useRef(0),armed=useRef(false),lastMotion=useRef(0),lastEvent=useRef<FootMotionEventV2|undefined>(undefined),testingUntil=useRef(0),lastHit=useRef(0),hitEvent=useRef<FootMotionEventV2|undefined>(undefined);
 const [enabled,setEnabled]=useState(false),[starting,setStarting]=useState(false),[notice,setNotice]=useState('Nonaktif'),[character,setCharacter]=useState<Character>('clean'),[volume,setVolume]=useState(.35),[level,setLevel]=useState(0);
 const controls=useRef({character,volume});controls.current={character,volume};
 const baseline=()=>{const p=current.current;cursor.current.reset(p.session?.()??'',p.events?.()??[]);lastMotion.current=0;lastEvent.current=undefined;lastHit.current=0;hitEvent.current=undefined;};
 const stop=(message='Nonaktif')=>{request.current++;armed.current=false;testingUntil.current=0;const e=engine.current;engine.current=null;e?.mute();if(e)void e.dispose().catch(()=>{});setStarting(false);setEnabled(false);setLevel(0);setNotice(message);baseline();};
 const stopRef=useRef(stop);stopRef.current=stop;
 useLayoutEffect(()=>{if(!props.allowed)stopRef.current('Audio dijeda · preview tidak aktif');},[props.allowed]);
 useEffect(()=>{
  const blackout=()=>stopRef.current('Blackout · audio mati');
  const visibility=()=>{if(document.hidden)stopRef.current('Audio mati · tab tersembunyi');};
  window.addEventListener(SOFTWARE_PREVIEW_BLACKOUT_EVENT,blackout);document.addEventListener('visibilitychange',visibility);
  return()=>{window.removeEventListener(SOFTWARE_PREVIEW_BLACKOUT_EVENT,blackout);document.removeEventListener('visibilitychange',visibility);request.current++;armed.current=false;const e=engine.current;engine.current=null;e?.mute();if(e)void e.dispose().catch(()=>{});};
 },[]);
 // Source/mode changes discard the previous audio input; only newly observed events can sound.
 useLayoutEffect(()=>{testingUntil.current=0;baseline();const e=engine.current;if(e&&armed.current){const s=footAudioSettings(controls.current.character,controls.current.volume,'step');e.update(footAudioParams(s),s,false,false);}},[props.sourceReady,props.trace]);
 async function start(){
  if(!current.current.allowed||starting||engine.current)return;
  if(current.current.onTakeAudio?.()===false){setNotice('Hentikan rekaman lama sebelum menyalakan audio.');return;}
  const token=++request.current,e=new AudioEngine();engine.current=e;setStarting(true);setNotice('Menyiapkan audio…');
  try{
   await e.init();
   if(request.current!==token||engine.current!==e||!current.current.allowed){e.mute();if(engine.current===e)engine.current=null;void e.dispose().catch(()=>{});return;}
   baseline();armed.current=true;setEnabled(true);setStarting(false);setNotice('Menunggu event Track');
   const s=footAudioSettings(controls.current.character,controls.current.volume,'step');e.update(footAudioParams(s),s,false,false);
  }catch{if(request.current===token)stop('Audio belum bisa aktif. Coba lagi.');}
 }
 useEffect(()=>{
  if(!enabled)return;
  let previousReady=false,previousSession='',previousMode:FootAudioMode='step';
  let analyserData:Float32Array<ArrayBuffer>|null=null;
  const tick=()=>{
   const e=engine.current,p=current.current;if(!e||!armed.current)return;
   if(!p.allowed||document.hidden){stopRef.current('Audio dijeda');return;}
   const now=performance.now(),mode:FootAudioMode=p.trace?'trace':'step',s=footAudioSettings(controls.current.character,controls.current.volume,mode),session=p.session?.()??'',events=p.events?.()??[];
   e.setMaster(s.master);
   if(e.analyser){if(!analyserData||analyserData.length!==e.analyser.fftSize)analyserData=new Float32Array(e.analyser.fftSize);e.analyser.getFloatTimeDomainData(analyserData);let energy=0;for(const v of analyserData)energy+=v*v;setLevel(Math.min(1,Math.sqrt(energy/analyserData.length)*5));}
   if(now<testingUntil.current){cursor.current.reset(session,events);return;}
   if(!p.sourceReady||!previousReady||session!==previousSession||mode!==previousMode){cursor.current.reset(session,events);lastMotion.current=0;lastEvent.current=undefined;lastHit.current=0;hitEvent.current=undefined;e.update(footAudioParams(s),s,false,false);previousReady=p.sourceReady;previousSession=session;previousMode=mode;setNotice(p.sourceReady?'Menunggu event Track':'Menunggu sumber Track');return;}
   const actions=cursor.current.consume(session,events,mode,now),contacts=actions.filter(x=>x.kind==='contact'),motion=actions.find(x=>x.kind==='motion');
   if(motion){lastMotion.current=now;lastEvent.current=motion.event;}
   const moving=mode==='trace'&&now-lastMotion.current<190&&lastMotion.current>0;
   if(contacts.length){lastHit.current=now;hitEvent.current=contacts.at(-1)?.event;}
   const ringing=lastHit.current>0&&now-lastHit.current<500;
   if(moving||ringing){const params=footAudioParams(s,moving?lastEvent.current:hitEvent.current);e.update(params,s,moving,true);
    for(const c of contacts)e.percussion(c.event.foot==='left'?'kick':'snare',.45+c.event.confidence*.35,s.maxVoices);
    setNotice(moving?'Merespons gerak':'Merespons pijakan');
   }else if(now-lastMotion.current>=190){e.update(footAudioParams(s),s,false,false);setNotice('Menunggu event Track');}
  };
  const timer=window.setInterval(tick,40);return()=>clearInterval(timer);
 },[enabled]);
 const testSound=()=>{const e=engine.current;if(!e||!armed.current||!current.current.allowed)return;
  const s=footAudioSettings(character,volume,'step');testingUntil.current=performance.now()+450;baseline();e.update(footAudioParams(s),s,false,true);e.percussion('kick',.65,s.maxVoices);setNotice('Tes audio');
 };
 if(!props.visible)return null;
 return <section className="foot-motion-audio" aria-label="Audio gerak">
  <header><div>{enabled?<Volume2 size={15}/>:<VolumeX size={15}/>}<strong>Audio</strong><small>{props.trace?'Pijakan + gerak':'Pijakan'}</small></div>
   <button type="button" aria-pressed={enabled} disabled={!props.allowed||starting} onClick={()=>enabled?stop():void start()}>{starting?'Memuat…':enabled?'Matikan audio':'Aktifkan audio'}</button>
  </header>
  {enabled&&<div className="foot-motion-audio-settings">
   <label>Karakter suara<select aria-label="Karakter suara" value={character} onChange={e=>setCharacter(e.target.value as Character)}>{Object.entries(CHARACTERS).map(([id,c])=><option key={id} value={id}>{c.label}</option>)}</select></label>
   <label className="foot-motion-volume">Volume <output>{Math.round(volume*100)}%</output><input aria-label="Volume audio gerak" type="range" min="0" max="1" step=".01" value={volume} onChange={e=>{const value=Number(e.target.value);setVolume(value);engine.current?.setMaster(value*.5);}}/></label>
   <div className="foot-motion-meter"><meter aria-label="Level audio" min={0} max={1} value={level}/><button type="button" onClick={testSound} disabled={!props.allowed}>Tes audio</button></div>
  </div>}
  <small role="status" aria-label="Status audio gerak" className="foot-motion-audio-status">{notice}</small>
 </section>;
}
