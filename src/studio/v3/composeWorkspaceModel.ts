import {FLOOR_SCENES,type FloorSceneId} from '../../footprints/scenes/sceneRegistry.ts';

/** UX-R3: one scene list shared by the original FLOOR renderer and Compose.
 * Names remain the canonical legacy names until VIS-R3 provides artistic presets.
 */
export type ComposeSceneId='footprints'|FloorSceneId;
export type ComposePreview='BODY A'|'BODY B'|'FLOOR'|'SPLIT';
export const COMPOSE_SCENES:readonly {id:ComposeSceneId;name:string;defaultColor:string}[]=[
 {id:'footprints',name:'Footprints',defaultColor:'#dce5cc'},
 ...FLOOR_SCENES.map(({id,name,defaultColor})=>({id,name,defaultColor}))
];
export const COMPOSE_PREVIEWS=['BODY A','BODY B','FLOOR','SPLIT'] as const;
export function isComposeSceneId(value:unknown):value is ComposeSceneId{
 return typeof value==='string'&&COMPOSE_SCENES.some(item=>item.id===value);
}
export function composePreviewSelection(previous:ComposePreview,next:ComposePreview):ComposePreview{
 return COMPOSE_PREVIEWS.includes(next)?next:previous;
}
