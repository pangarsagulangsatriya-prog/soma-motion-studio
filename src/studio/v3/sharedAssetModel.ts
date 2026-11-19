import {COMPOSE_STAGE_INPUT} from './composeLayerPlan.ts';

/** CP-06 metadata contract. Binary media stays local to this browser session.
 * Track owns MP4 playback/decoding; Composer only reuses its existing input canvas.
 */
export type SharedAssetOrigin='track'|'import';
export type SharedAssetKind='image'|'video';
export type SharedAsset={
 id:string;name:string;kind:SharedAssetKind;origin:SharedAssetOrigin;
 mime:string;url?:string;bytes:number;
};
export const SHARED_TRACK_MP4_ID=COMPOSE_STAGE_INPUT;
export const MAX_COMPOSE_IMPORTS=48;
export const MAX_COMPOSE_IMPORT_SIZE=512*1024*1024;
export function sharedAssetKind(type:string,name:string):SharedAssetKind|null{
 const mime=type.toLowerCase(),extension=name.toLowerCase();
 if(mime.startsWith('image/')||/\.(png|jpe?g|gif|webp|avif)$/i.test(extension))return 'image';
 if(mime.startsWith('video/')||/\.(mp4|webm|mov|m4v)$/i.test(extension))return 'video';
 return null;
}
export function normalizeSharedAssetName(value:string):string{
 return (value.trim().replace(/[\x00-\x1f]/g,' ').slice(0,90)||'Untitled media');
}
export function trackAssetFromClip(clip:Pick<File,'name'|'size'|'type'>|null):SharedAsset|null{
 if(!clip)return null;
 return {id:SHARED_TRACK_MP4_ID,name:normalizeSharedAssetName(clip.name),
  kind:'video',origin:'track',mime:clip.type||'video/mp4',bytes:clip.size};
}
export function importedAssetFromFile(file:Pick<File,'name'|'size'|'type'>,
 id:string,url:string):SharedAsset|null{
 const kind=sharedAssetKind(file.type,file.name);
 if(!kind||file.size<=0||file.size>MAX_COMPOSE_IMPORT_SIZE||!id||!url)return null;
 return {id,name:normalizeSharedAssetName(file.name),kind,origin:'import',
  mime:file.type|| (kind==='image'?'image/unknown':'video/unknown'),url,bytes:file.size};
}
export function sharedAssetChoices(assets:readonly SharedAsset[]){
 return assets.map(asset=>({id:asset.id,label:asset.origin==='track'?
  'Track MP4 · '+asset.name:asset.name}));
}
