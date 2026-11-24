import {useEffect,useLayoutEffect,useRef,useState} from 'react';
import {Volume2,VolumeX} from 'lucide-react';
import {AudioEngine} from '../../engine/audio.ts';
import {TEXTURES,isTexture,textureControls,texturePCM,textureInterval,type TextureId,type TextureControls,type TextureGesture} from './experimentalFootAudio.ts';
import {CHARACTERS,type Character} from '../../engine/types.ts';
import type {FootMotionEventV2} from '../../footprints/scenes/FootMotionEventV2.ts';
import {FootAudioCursor,footAudioParams,footAudioSettings,type FootAudioMode} from './footMotionAudioModel.ts';
import {SOFTWARE_PREVIEW_BLACKOUT_EVENT} from './stagePreviewCommands.ts';
import './foot-motion-audio.css';
type SoundPreset=Character|TextureId;
function settingsFor(preset:SoundPreset,volume:number,mode:FootAudioMode,fx:TextureControls){const s=footAudioSettings(isTexture(preset)?TEXTURES[preset].character:preset,volume,mode);if(!isTexture(preset))return s;return {...s,mode:'percussion' as const,master:s.master*.8,macros:{...s.macros,roughness:fx.drive*.75,brightness:.30+fx.texture*.55,space:fx.space},reverb:fx.space*.45,delay:fx.space*.20};}
function paramsFor(s:ReturnType<typeof settingsFor>,preset:SoundPreset,event?:FootMotionEventV2){const p=footAudioParams(s,event);return isTexture(preset)?{...p,filter:preset==='subPressure'?500:2500+(event?.speed??0)*6000,pan:0}:p;}
type Props={visible:boolean;allowed:boolean;sourceReady:boolean;contactReady?:boolean;trace:boolean;events?:()=>readonly FootMotionEventV2[];session?:()=>string;onTakeAudio?:()=>boolean};
export function FootMotionAudioPanel(props:Props){
 const current=useRef(props);current.current=props;
 const engine=useRef<AudioEngine|null>(null),cursor=useRef(new FootAudioCursor()),request=useRef(0),armed=useRef(false),lastMotion=useRef(0),lastEvent=useRef<FootMotionEventV2|undefined>(undefined),testingUntil=useRef(0),lastHit=useRef(0),hitEvent=useRef<FootMotionEventV2|undefined>(undefined);
 const [enabled,setEnabled]=useState(false),[starting,setStarting]=useState(false),[notice,setNotice]=useState('Nonaktif'),[character,setCharacter]=useState<SoundPreset>('grit'),[fx,setFx]=useState<TextureControls>(()=>textureControls('grit')),[volume,setVolume]=useState(.35),[level,setLevel]=useState(0);
 const controls=useRef({character,volume,fx});controls.current={character,volume,fx};
 const lastTexture=useRef(new Map<string,number>());
 const selectPreset=(id:SoundPreset)=>{setCharacter(id);if(isTexture(id))setFx(textureControls(id));};
 const baseline=()=>{const p=current.current;cursor.current.reset(p.session?.()??'',p.events?.()??[]);lastMotion.current=0;lastEvent.current=undefined;lastHit.current=0;hitEvent.current=undefined;lastTexture.current.clear();};
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
 useLayoutEffect(()=>{testingUntil.current=0;baseline();const e=engine.current;if(e&&armed.current){const v=controls.current,s=settingsFor(v.character,v.volume,'step',v.fx);e.update(paramsFor(s,v.character),s,false,false);}},[props.sourceReady,props.trace,character]);
 async function start(){
  if(!current.current.allowed||starting||engine.current)return;
  if(current.current.onTakeAudio?.()===false){setNotice('Hentikan rekaman lama sebelum menyalakan audio.');return;}
  const token=++request.current,e=new AudioEngine();engine.current=e;setStarting(true);setNotice('Menyiapkan audio…');
  try{
   await e.init();
   if(request.current!==token||engine.current!==e||!current.current.allowed){e.mute();if(engine.current===e)engine.current=null;void e.dispose().catch(()=>{});return;}
   baseline();armed.current=true;setEnabled(true);setStarting(false);setNotice('Menunggu event Track');
   const v=controls.current,s=settingsFor(v.character,v.volume,'step',v.fx);e.update(paramsFor(s,v.character),s,false,false);
  }catch{if(request.current===token)stop('Audio belum bisa aktif. Coba lagi.');}
 }
 useEffect(()=>{
  if(!enabled)return;
  let previousReady=false,previousSession='',previousMode:FootAudioMode='step';
  let analyserData:Float32Array<ArrayBuffer>|null=null;
  const tick=()=>{
   const e=engine.current,p=current.current;if(!e||!armed.current)return;
   if(!p.allowed||document.hidden){stopRef.current('Audio dijeda');return;}
   const now=performance.now(),mode:FootAudioMode=p.trace?'trace':'step',v=controls.current,s=settingsFor(v.character,v.volume,mode,v.fx),experimental=isTexture(v.character),session=p.session?.()??'',events=p.events?.()??[];
   e.setMaster(s.master);
   if(e.analyser){if(!analyserData||analyserData.length!==e.analyser.fftSize)analyserData=new Float32Array(e.analyser.fftSize);e.analyser.getFloatTimeDomainData(analyserData);let energy=0;for(const v of analyserData)energy+=v*v;setLevel(Math.min(1,Math.sqrt(energy/analyserData.length)*5));}
   if(now<testingUntil.current){cursor.current.reset(session,events);return;}
   if(!p.sourceReady||!previousReady||session!==previousSession||mode!==previousMode){cursor.current.reset(session,events);lastMotion.current=0;lastEvent.current=undefined;lastHit.current=0;hitEvent.current=undefined;lastTexture.current.clear();e.update(paramsFor(s,v.character),s,false,false);previousReady=p.sourceReady;previousSession=session;previousMode=mode;setNotice(p.sourceReady?(p.contactReady===false&&!p.trace?'Pijakan menunggu kalibrasi Map':'Menunggu event Track'):'Menunggu pose atau sumber Track');return;}
   const actions=cursor.current.consume(session,events,mode,now,experimental),contacts=actions.filter(x=>x.kind==='contact'),motion=actions.find(x=>x.kind==='motion');
   if(isTexture(v.character)){
    const preset=v.character;const playable=actions.filter(a=>a.kind==='contact'||now-(lastTexture.current.get(a.event.actorId)??-Infinity)>=textureInterval(a.event.speed,v.fx.texture));
    if(playable.length){lastHit.current=now;hitEvent.current=playable.at(-1)?.event;e.update(paramsFor(s,preset,hitEvent.current),s,false,true);
     for(const action of playable){const ev=action.event;if(action.kind==='motion')lastTexture.current.set(ev.actorId,now);if(e.context)e.playTexture(texturePCM(preset,v.fx,{...ev,kind:ev.kind as TextureGesture},e.context.sampleRate),ev.x*1.6-.8,s.maxVoices);}
     if(lastTexture.current.size>16){const oldest=lastTexture.current.keys().next().value;if(oldest!==undefined)lastTexture.current.delete(oldest);}
     setNotice(playable.some(a=>a.kind==='contact')?'Merespons pijakan':playable.some(a=>a.event.kind==='pivot')?'Resonansi putaran':'Merespons gesekan');
    }else if(lastHit.current>0&&now-lastHit.current<540){e.update(paramsFor(s,preset,hitEvent.current),s,false,true);}
    else{e.update(paramsFor(s,preset),s,false,false);setNotice(p.contactReady===false&&!p.trace?'Pijakan menunggu kalibrasi Map':'Menunggu event Track');}
    return;
   }
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
  const s=settingsFor(character,volume,'step',fx);testingUntil.current=performance.now()+550;baseline();e.update(paramsFor(s,character),s,false,true);if(isTexture(character)&&e.context)e.playTexture(texturePCM(character,fx,{kind:'contact',speed:.55,x:.5,y:.5,eventId:'preview-'+character},e.context.sampleRate),0,s.maxVoices);else e.percussion('kick',.65,s.maxVoices);setNotice('Tes audio');
 };
 if(!props.visible)return null;
 return <section className="foot-motion-audio" aria-label="Audio gerak">
  <header><div>{enabled?<Volume2 size={15}/>:<VolumeX size={15}/>}<strong>Audio V2</strong><small>{props.trace?'Pijakan + gerak':'Pijakan'}</small></div>
   <button type="button" aria-pressed={enabled} disabled={!props.allowed||starting} onClick={()=>enabled?stop():void start()}>{starting?'Memuat…':enabled?'Matikan audio':'Aktifkan audio'}</button>
  </header>
  {enabled&&<div className="foot-motion-audio-settings">
   <label>Karakter suara<select aria-label="Karakter suara" value={character} onChange={e=>selectPreset(e.target.value as SoundPreset)}><optgroup label="Experimental">{Object.entries(TEXTURES).map(([id,c])=><option key={id} value={id}>{c.label}</option>)}</optgroup><optgroup label="Legacy V1">{Object.entries(CHARACTERS).map(([id,c])=><option key={id} value={id}>{c.label}</option>)}</optgroup></select></label>
   {isTexture(character)&&<><small className="texture-description">{TEXTURES[character].description}</small>{([{key:'drive',label:'Distorsi'},{key:'texture',label:'Tekstur'},{key:'space',label:'Ruang'}] as const).map(c=><label key={c.key} className="foot-motion-volume">{c.label}<output>{Math.round(fx[c.key]*100)}%</output><input aria-label={c.label+' audio'} type="range" min="0" max="1" step=".01" value={fx[c.key]} onChange={e=>setFx(old=>({...old,[c.key]:Number(e.target.value)}))}/></label>)}</>}
   <label className="foot-motion-volume">Volume <output>{Math.round(volume*100)}%</output><input aria-label="Volume audio gerak" type="range" min="0" max="1" step=".01" value={volume} onChange={e=>{const value=Number(e.target.value);setVolume(value);engine.current?.setMaster(settingsFor(character,value,'step',fx).master);}}/></label>
   <div className="foot-motion-meter"><meter aria-label="Level audio" min={0} max={1} value={level}/><button type="button" onClick={testSound} disabled={!props.allowed}>Tes audio</button></div>
  </div>}
  <small role="status" aria-label="Status audio gerak" className="foot-motion-audio-status">{notice}</small>
 </section>;
}
