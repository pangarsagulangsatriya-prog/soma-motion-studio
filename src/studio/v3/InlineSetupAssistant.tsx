import {Activity,AlertTriangle,Camera,CheckCircle2,ChevronRight,
 CircleHelp,LoaderCircle,Monitor,SlidersHorizontal,Smartphone} from 'lucide-react';
import type {InlineSetupHint,InlineSetupAction} from './inlineSetupModel.ts';
import './inline-setup-assistant.css';
const actionIcons={
 source:Camera,webcam:Camera,phone:Smartphone,experiment:Activity,body:Activity,
 tracking:Activity,calibrate:SlidersHorizontal,projector:Monitor
} as const;
/** Always one next step, inside the same workspace. No wizard, countdown, or step gating. */
export function InlineSetupAssistant({hint,onAction}:{
 hint:InlineSetupHint;onAction:(action:InlineSetupAction)=>void;
}){
 const Icon=hint.severity==='ok'?CheckCircle2:
  hint.severity==='warning'?AlertTriangle:hint.severity==='busy'?LoaderCircle:CircleHelp;
 const ActionIcon=hint.action?actionIcons[hint.action]:null;
 return <section className="fp-inline-assistant" aria-label="Panduan kondisi Footprints"
  data-condition={hint.id} data-severity={hint.severity}>
  <div className="fp-inline-assistant-identity"><span className="fp-inline-assistant-symbol">
   <Icon size={17} aria-hidden="true"/></span>
   <div className="fp-inline-assistant-content">
    <span className="fp-inline-assistant-eyebrow">BANTUAN KONTEKSTUAL</span>
    <h2>{hint.title}</h2>
    <p>{hint.description}</p>
   </div>
  </div>
  {hint.action&&hint.actionLabel&&<button type="button" className="fp-inline-assistant-action"
   onClick={()=>onAction(hint.action)}>
   {ActionIcon&&<ActionIcon size={15} aria-hidden="true"/>}
   {hint.actionLabel}<ChevronRight size={14} aria-hidden="true"/>
  </button>}
 </section>;
}
