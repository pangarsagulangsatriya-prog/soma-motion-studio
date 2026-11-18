/** Stage Studio owns these workspaces. Other SOMA modules can own different local navigation. */
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
 return <nav className="soma-stage-module-nav" aria-label="Stage Studio — workspace" data-module="stage-studio">
  <span className="soma-stage-module-name">STAGE STUDIO</span>
  <div className="soma-stage-module-tabs" role="group" aria-label="Navigasi Stage Studio">
   {workspaces.map(item=><button key={item.id} type="button"
    className="soma-stage-module-tab" aria-current={active===item.id?'page':undefined}
    onClick={()=>{if(active!==item.id)onNavigate(item.id);}}>
    {item.label}
   </button>)}
  </div>
 </nav>;
}
