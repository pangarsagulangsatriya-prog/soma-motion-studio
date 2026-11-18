/** Stage 1 owns these workspaces. Other SOMA modules can own different local navigation. */
export type StageModuleWorkspace='track'|'compose'|'map'|'perform';
const workspaces:readonly {id:StageModuleWorkspace;label:string}[]=[
 {id:'track',label:'Track'},
 {id:'compose',label:'Compose'},
 {id:'map',label:'Map'},
 {id:'perform',label:'Perform'}
];
export function StageModuleNav({active,onNavigate}:{
 active:StageModuleWorkspace;
 onNavigate:(workspace:StageModuleWorkspace)=>void;
}){
 return <nav className="soma-stage-module-nav" aria-label="Stage 1 — workspace" data-module="stage-studio">
  <div className="soma-stage-module-tabs" role="group" aria-label="Pilih workspace">
   {workspaces.map(item=><button key={item.id} type="button"
    className="soma-stage-module-tab" aria-current={active===item.id?'page':undefined} aria-label={`${item.label} workspace` }
    onClick={()=>{if(active!==item.id)onNavigate(item.id);}}>
    {item.label}
   </button>)}
  </div>
 </nav>;
}
