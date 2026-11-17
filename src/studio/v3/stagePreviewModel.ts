/** S6.8.2: local preview layout only; never controls projector transport.
 * Both renderer canvases remain mounted when a surface is selected. */
export type StagePreviewMode='split'|'body'|'floor';
export const STAGE_PREVIEW_MODES:ReadonlyArray<{id:StagePreviewMode;label:string;description:string}>=[
 {id:'split',label:'Split',description:'BODY dan FLOOR ditampilkan bersamaan'},
 {id:'body',label:'BODY',description:'Periksa mask tubuh bagian bawah'},
 {id:'floor',label:'FLOOR',description:'Periksa lintasan dan kontak kaki'}
];
export function parseStagePreviewMode(value:unknown):StagePreviewMode{
 return value==='body'||value==='floor'||value==='split'?value:'split';
}
export function visiblePreviewSurfaces(mode:StagePreviewMode):ReadonlyArray<'body'|'floor'>{
 return mode==='split'?['body','floor']:[mode];
}
export function previewLabel(mode:StagePreviewMode):string{
 return mode==='body'?'BODY · MASK':mode==='floor'?'FLOOR · PATH':'BODY + FLOOR';
}
