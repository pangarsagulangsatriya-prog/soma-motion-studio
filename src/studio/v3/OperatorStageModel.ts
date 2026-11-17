/** UX04/05: operator cues alter LOCAL preview layout only, never stage-light routing. */
export type StageInspectorTab='tracking'|'visual'|'archive'|'projection'|'qa';
export type OperatorCueId='overview'|'body'|'floor'|'split';
export type OperatorCue={id:OperatorCueId;name:string;description:string};
export const STAGE_INSPECTOR_TABS:{id:StageInspectorTab;label:string;description:string}[]=[
 {id:'tracking',label:'Tracking',description:'Kamera, performer dan floor calibration'},
 {id:'visual',label:'Visual',description:'Bentuk jejak dan palet'},
 {id:'archive',label:'Archive',description:'Arsip A/B dan contact-to-archive'},
 {id:'projection',label:'Projection',description:'Output BODY/FLOOR dan pengaman'},
 {id:'qa',label:'QA',description:'Simulasi, validasi dan diagnostik'}
];
export const OPERATOR_CUES:readonly OperatorCue[]=[
 {id:'overview',name:'01 · Overview',description:'Kamera, BODY dan FLOOR'},
 {id:'body',name:'02 · BODY',description:'Fokus pratinjau mask kaki'},
 {id:'floor',name:'03 · FLOOR',description:'Fokus pratinjau pijakan'},
 {id:'split',name:'04 · Split',description:'BODY dan FLOOR berdampingan'}
];
export function operatorCueAt(index:number):OperatorCue{
 if(!Number.isInteger(index))throw Error('Indeks cue harus bilangan bulat.');
 return OPERATOR_CUES[Math.min(OPERATOR_CUES.length-1,Math.max(0,index))];
}
export function moveOperatorCue(index:number,delta:-1|1):number{
 return Math.min(OPERATOR_CUES.length-1,Math.max(0,index+delta));
}
/** Ignore shortcuts while form, menu, dialog or composition has focus. */
export function operatorShortcut(code:string,editing:boolean,ctrl=false,alt=false,meta=false):
 'next'|'previous'|'blackout'|null{
 if(editing||ctrl||alt||meta)return null;
 if(code==='Escape'||code==='KeyB')return 'blackout';
 if(code==='ArrowRight'||code==='Space')return 'next';
 if(code==='ArrowLeft')return 'previous';
 return null;
}
