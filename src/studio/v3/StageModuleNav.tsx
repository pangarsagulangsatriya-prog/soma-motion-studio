import {ArrowRight,Check} from 'lucide-react';

/** Stage 1 owns these workspaces. Other SOMA modules can own different local navigation. */
export type StageModuleWorkspace='track'|'compose'|'map'|'perform';
export type StagePipelineStatus={
 trackReady?:boolean;
 composeReady?:boolean;
 mapReady?:boolean;
 outputLive?:boolean;
};
const workspaces:readonly {id:StageModuleWorkspace;label:string;step:string}[]=[
 {id:'track',label:'Track',step:'01'},
 {id:'compose',label:'Compose',step:'02'},
 {id:'map',label:'Map',step:'03'},
 {id:'perform',label:'Perform',step:'04'}
];
const NEXT_STEP:Record<StageModuleWorkspace,{target:StageModuleWorkspace;label:string}>={
 track:{target:'map',label:'Lanjut Map'},
 compose:{target:'map',label:'Lanjut Map'},
 map:{target:'perform',label:'Lanjut Perform'},
 perform:{target:'map',label:'Kalibrasi Map'}
};
export function StageModuleNav({active,onNavigate,status}:{
 active:StageModuleWorkspace;
 onNavigate:(workspace:StageModuleWorkspace)=>void;
 status?:StagePipelineStatus;
}){
 const stepDone=(id:StageModuleWorkspace)=>
  id==='track'?!!status?.trackReady:
  id==='compose'?!!status?.composeReady:
  id==='map'?!!status?.mapReady:
  !!status?.outputLive;
 const next=NEXT_STEP[active];
 const nextPrimary=active==='track'?!!status?.trackReady:active!=='perform';
 return <nav className="soma-stage-module-nav" aria-label="Stage 1 — workspace" data-module="stage-studio">
  <div className="soma-stage-module-tabs" role="group" aria-label="Pilih workspace">
   {workspaces.map((item,idx)=>{
    const done=stepDone(item.id);
    const isActive=active===item.id;
    return <span key={item.id} className="soma-stage-step-wrap">
     {idx>0&&<span className="soma-stage-step-sep" aria-hidden="true">›</span>}
     <button type="button"
      className="soma-stage-module-tab"
      data-done={done||undefined}
      aria-current={isActive?'page':undefined}
      aria-label={`${item.label} workspace`}
      onClick={()=>{if(active!==item.id)onNavigate(item.id);}}>
      <span className="soma-stage-step-num" aria-hidden="true">
       {done&&!isActive?<Check size={12} strokeWidth={2.6}/>:item.step}
      </span>
      <span>{item.label}</span>
     </button>
    </span>;
   })}
  </div>
  {active!=='perform'&&<button type="button"
   className="soma-stage-next-cta"
   data-primary={nextPrimary||undefined}
   onClick={()=>onNavigate(next.target)}
   aria-label={next.label}>
   <span>{next.label}</span>
   <ArrowRight size={13} aria-hidden="true"/>
  </button>}
 </nav>;
}
