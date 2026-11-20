/** FV-01 — three curated visual identities.
 * Preserves 14 canonical scenes and historical Hydra style keys for saved presets.
 * A flagship owns its artwork/input treatment and selected Hydra graph explicitly.
 * Sophisticated GPU material/UV shaders belong to subsequent FV-02/FV-03.
 */
import type {HydraFootprintSettings,HydraFootprintStyle} from '../../footprints/scenes/hydraFootprintModel.ts';

export type FlagshipId='trace'|'echo'|'rift';
export type FlagshipRecipe={
 id:FlagshipId;title:string;subtitle:string;description:string;
 graph:HydraFootprintStyle;
 artwork:HydraFootprintSettings['artwork'];
 mix:number;distortion:number;feedback:number;motion:number;
};
export const FLAGSHIP_RECIPES:readonly FlagshipRecipe[]=[
 {id:'trace',title:'TRACE',subtitle:'Material Memory',
  description:'Kontak membuka material. Slide mengikis. Pivot mengubah arah jejak.',
  graph:'grain',artwork:'trace',mix:.78,distortion:.27,feedback:.05,motion:.72},
 {id:'echo',title:'ECHO',subtitle:'Temporal Body',
  description:'Gerak membentuk lapisan waktu, feedback, dan jejak yang perlahan menipis.',
  graph:'echo',artwork:'wave-record',mix:.85,distortion:.09,feedback:.58,motion:.84},
 {id:'rift',title:'RIFT',subtitle:'Archive Displacement',
  description:'Gerakan kaki mengganggu dan menggeser tekstur visual. Shader arsip lokal menyusul.',
  graph:'flow',artwork:'negative-memory',mix:.8,distortion:.36,feedback:.24,motion:.95}
] as const;
export function flagshipRecipe(id:FlagshipId):FlagshipRecipe{
 const recipe=FLAGSHIP_RECIPES.find(x=>x.id===id);
 if(!recipe)throw Error('Flagship visual tidak dikenal.');
 return recipe;
}
export function flagshipHydraPatch(id:FlagshipId):Partial<HydraFootprintSettings>{
 const p=flagshipRecipe(id);
 return {enabled:true,style:p.graph,artwork:p.artwork,catalogVisual:false,
  mix:p.mix,distortion:p.distortion,feedback:p.feedback,motion:p.motion};
}
export function isFlagshipId(id:string):id is FlagshipId{
 return FLAGSHIP_RECIPES.some(p=>p.id===id);
}
