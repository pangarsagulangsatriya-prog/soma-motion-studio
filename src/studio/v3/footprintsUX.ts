/** UI-only decisions. Footprints is always the first Studio entry. */
export const LEGACY_INSTRUMENTS=[
 {id:'liquid',name:'Teks Cair',description:'Huruf dan gerakan'},
 {id:'echo',name:'Jejak Berulang',description:'Lapisan yang kembali'},
 {id:'cut',name:'Potongan',description:'Fragmen ritmis'},
 {id:'body',name:'Siluet × Teks',description:'Siluet dan teks'}
] as const;
export const DEFAULT_STUDIO_WORKSPACE='footprints' as const;
export const defaultFootprintsWorkspace=()=>DEFAULT_STUDIO_WORKSPACE==='footprints';
export type StageBodyGate='ready'|'camera-off'|'stale'|'identity-unsafe';
export function stageBodyPreviewGate(input:{
 cameraOn:boolean;tracked:boolean;source:string;ageMs:number;
 performerCount:1|2;visibleCount:number;identityAmbiguous:boolean;
 matchedFrame:boolean;
}):StageBodyGate{
 if(!input.cameraOn||input.source!=='camera')return 'camera-off';
 if(!input.tracked||!Number.isFinite(input.ageMs)||
  input.ageMs< -80||input.ageMs>450)return 'stale';
 if(input.performerCount===2&&
  (input.visibleCount!==2||input.identityAmbiguous||!input.matchedFrame))
  return 'identity-unsafe';
 return 'ready';
}
