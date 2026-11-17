import {useEffect,useRef,useState} from 'react';
import {AlertTriangle,Camera,Check,ChevronDown,Film,FlaskConical,
 LoaderCircle,Smartphone,Box,X} from 'lucide-react';
import {SOURCE_CHOICES,SOURCE_LABELS,type FootprintsInputChoice,
 type FootprintsInputStatus} from './sourceSwitchModel.ts';
import './source-switcher.css';
const icons={webcam:Camera,phone:Smartphone,video:Film,simulator:Box} as const;
export function FootprintsSourceSwitcher({status,onChoose,onPhoneManager}:{
 status:FootprintsInputStatus;onChoose:(choice:FootprintsInputChoice)=>Promise<boolean>|boolean;
 onPhoneManager:()=>void;
}){
 const [open,setOpen]=useState(false),[busy,setBusy]=useState(false);
 const trigger=useRef<HTMLButtonElement>(null),panel=useRef<HTMLDivElement>(null);
 useEffect(()=>{
  if(!open)return;
  const raf=requestAnimationFrame(()=>{
   const preferred=panel.current?.querySelector<HTMLButtonElement>('[aria-current="true"]');
   (preferred??panel.current?.querySelector<HTMLButtonElement>('.fp-source-switch-option'))
    ?.focus({preventScroll:true});
  });
  const key=(e:KeyboardEvent)=>{
   if(e.key==='Escape'&&!e.shiftKey){
    e.preventDefault();e.stopPropagation();setOpen(false);
    trigger.current?.focus({preventScroll:true});
   }
  };
  const outside=(e:PointerEvent)=>{
   if(e.target instanceof Node&&!panel.current?.contains(e.target)&&
      !trigger.current?.contains(e.target))setOpen(false);
  };
  document.addEventListener('keydown',key);document.addEventListener('pointerdown',outside);
  return()=>{cancelAnimationFrame(raf);document.removeEventListener('keydown',key);
   document.removeEventListener('pointerdown',outside);};
 },[open]);
 const choose=async(choice:FootprintsInputChoice)=>{
  if(busy)return;
  if(choice===status.selection&&(status.phase==='ready'||choice==='phone')){
   setOpen(false);trigger.current?.focus({preventScroll:true});
   if(choice==='phone')onPhoneManager();
   return;
  }
  setBusy(true);
  try{
   const accepted=await onChoose(choice);
   if(accepted){setOpen(false);trigger.current?.focus({preventScroll:true});}
  }finally{setBusy(false);}
 };
 const selection=status.selection;
 const Icon=selection?icons[selection]:Camera;
 return <div className="fp-source-switcher">
  <button ref={trigger} type="button" className="fp-source-switch-trigger"
   aria-label={`Sumber gerak: ${selection?SOURCE_LABELS[selection]:'belum dipilih'}. Ganti sumber.`}
   aria-haspopup="dialog" aria-expanded={open} aria-controls="fp-source-switch-menu"
   data-phase={status.phase} onClick={()=>setOpen(v=>!v)}>
   {status.phase==='connecting'?<LoaderCircle className="fp-switch-spin" size={15}/>:<Icon size={15}/>}
   <span className="fp-source-switch-text"><small>INPUT</small>
    <strong>{selection?SOURCE_LABELS[selection]:'Pilih sumber'}</strong></span>
   <span className="fp-source-switch-dot" data-phase={status.phase} aria-hidden="true"/>
   <ChevronDown size={15} className="fp-switch-chevron" aria-hidden="true"/>
  </button>
  {open&&<div id="fp-source-switch-menu" ref={panel} role="dialog"
   aria-label="Ganti sumber Footprints" className="fp-source-switch-menu">
   <header><span>SUMBER GERAK</span><button type="button" aria-label="Tutup pilihan sumber"
    onClick={()=>{setOpen(false);trigger.current?.focus({preventScroll:true});}}><X size={16}/></button></header>
   <p>Pengaturan jejak dan arsip tetap tersimpan. Penggantian kamera memerlukan pemeriksaan ulang.</p>
   {SOURCE_CHOICES.map(item=>{
    const ItemIcon=icons[item.id],selected=selection===item.id;
    return <button type="button" key={item.id} aria-current={selected?'true':undefined}
     disabled={busy}
     className="fp-source-switch-option" onClick={()=>void choose(item.id)}>
     <span className="fp-switch-option-icon"><ItemIcon size={18}/></span>
     <span><strong>{item.label}</strong><small>{item.description}</small></span>
     {selected?<Check size={16} className="fp-switch-option-end"/>:item.kind==='lab'?
      <FlaskConical size={15} className="fp-switch-option-end"/>:null}
    </button>;
   })}
   <footer>MP4 dan Simulasi masih membuka Lab. Output fisik tetap membutuhkan QA.</footer>
  </div>}
  {status.phase==='error'&&<span className="fp-source-switch-error" role="alert">
    <AlertTriangle size={13}/>{status.message}</span>}
 </div>;
}
