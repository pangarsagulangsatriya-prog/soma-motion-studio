/** CP-05: renderer ownership and order.
 * Layer array is bottom-to-top. Never let a background raster short-circuit
 * imported layers; each source uses the same opacity/blend/mask pipeline.
 * No camera permission, projector authorization, or WebGL dependency here.
 */
export const COMPOSE_STAGE_FLOOR='@stage:floor' as const;
export const COMPOSE_STAGE_INPUT='@stage:input' as const;
export const COMPOSE_STAGE_BODY='@stage:body' as const;
export type ComposeStageSourceId=typeof COMPOSE_STAGE_FLOOR|typeof COMPOSE_STAGE_INPUT|
 typeof COMPOSE_STAGE_BODY;
export type ComposerSourceKind='floor'|'input'|'body'|'media'|'empty';
export type ComposerSurface='FLOOR'|'BODY A'|'BODY B';
export type ComposerSourceLayer={mediaId:string;name:string;visible:boolean;opacity:number;blend:string};
const validStageIds=new Set<string>([COMPOSE_STAGE_FLOOR,COMPOSE_STAGE_INPUT,
COMPOSE_STAGE_BODY]);
export function composerSourceKind(layer:Pick<ComposerSourceLayer,'mediaId'|'name'>,
 surface:ComposerSurface):ComposerSourceKind{
 if(layer.mediaId===COMPOSE_STAGE_FLOOR)return 'floor';
 if(layer.mediaId===COMPOSE_STAGE_INPUT)return 'input';
 if(layer.mediaId===COMPOSE_STAGE_BODY)return 'body';
 // Retired Hydra/scene sources never resolve to a live renderer in V5.
 if(layer.mediaId==='@stage:hydra'||layer.mediaId.startsWith('@scene:'))return 'empty';
 if(layer.mediaId.startsWith('@stage:'))return 'empty';
 if(layer.mediaId)return 'media';
 // Old saved compositions used an empty media ID for the base raster.
 if(surface==='FLOOR'&&layer.name==='Floor path')return 'floor';
 if(surface!=='FLOOR'&&layer.name===surface.replace('BODY','Body')+' archive')return 'body';
 return 'empty';
}
export function composerStageId(id:string):id is ComposeStageSourceId{
 return validStageIds.has(id);
}
export function composerLayerOrder<T extends ComposerSourceLayer>(
 layers:readonly T[],surface:ComposerSurface,physical:boolean,experiment:boolean
):{layer:T;kind:ComposerSourceKind}[]{
 return layers.flatMap(layer=>{
  if(!layer.visible||!Number.isFinite(layer.opacity)||layer.opacity<=0)return [];
  const kind=composerSourceKind(layer,surface);
  if(kind==='empty')return [];
  // The previous physical-output safety gate still owns stage authorisation.
  if(physical&&experiment)return [];
  if(physical&&(kind==='input'))return [];
  if(physical&&kind==='body'&&surface==='FLOOR')return [];
  return [{layer,kind}];
 });
}
export const COMPOSE_SOURCE_CHOICES=[
 {id:COMPOSE_STAGE_FLOOR,label:'Footprints / FLOOR tracking'},
 {id:COMPOSE_STAGE_INPUT,label:'MP4 / INPUT video'},
 {id:COMPOSE_STAGE_BODY,label:'BODY / lower-body preview'}
] as const;
