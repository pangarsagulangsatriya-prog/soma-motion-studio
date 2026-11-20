/** SOMA RESET-00: remove obsolete visual assets without touching user media or tracking.
 * One-way V5 migration. Older visual presets are deliberately retired.
 */
export const V5_COMPOSER_KEY='soma-s64-composer-v5';
export const V5_PRESET_KEY='soma-s64-presets-v5';
export const LEGACY_VISUAL_STORAGE_KEYS=[
 'soma-floor-scene-v1',
 'soma-floor-scene-presets-v1',
 'soma-floor-hydra-v1',
 'soma-s64-presets-v1',
 'soma-s64-composer-v1'
] as const;
export function isRetiredVisualSource(mediaId:string):boolean{
 return mediaId==='@stage:hydra'||mediaId.startsWith('@scene:');
}
/** Keep Track MP4, user media, base FLOOR and BODY layer IDs. */
export function stripRetiredVisualLayers<T extends {mediaId:string}>(
 composition:Record<string,T[]>
):Record<string,T[]>{
 return Object.fromEntries(Object.entries(composition).map(([surface,layers])=>[
  surface,layers.filter(layer=>!isRetiredVisualSource(layer.mediaId))
 ]));
}
export function resetOldVisualStorage(storage:Pick<Storage,'removeItem'>):void{
 for(const key of LEGACY_VISUAL_STORAGE_KEYS)storage.removeItem(key);
}
