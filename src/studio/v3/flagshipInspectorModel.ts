import type {HydraFootprintSettings} from '../../footprints/scenes/hydraFootprintModel.ts';
import {FLAGSHIP_RECIPES,type FlagshipId} from './flagshipVisualModel.ts';

/** FV-04: every exposed flagship slider maps to an existing live shader uniform. */
export type FlagshipControlKey='mix'|'distortion'|'feedback';
export type FlagshipControl={key:FlagshipControlKey;label:string;description:string;max:number};
const COMMON={max:1} as const;
export const FLAGSHIP_CONTROLS:Record<FlagshipId,readonly FlagshipControl[]>={
 trace:[
  {key:'mix',label:'Material density',description:'Tingkat keterlihatan lapisan material',...COMMON},
  {key:'distortion',label:'Fracture',description:'Gangguan kontur di sekitar tapak',max:.4},
  {key:'feedback',label:'Residual feedback',description:'Retensi Hydra yang terbatas',max:.65}
 ],
 echo:[
  {key:'feedback',label:'Memory',description:'Retensi gambar di framebuffer sebelumnya',max:.65},
  {key:'distortion',label:'Advection',description:'Arah tarikan saat kaki bergerak',max:.4},
  {key:'mix',label:'Ghost intensity',description:'Kekuatan gambar jejak yang berulang',...COMMON}
 ],
 rift:[
  {key:'distortion',label:'Archive displacement',description:'Jarak pergeseran piksel di sekitar kaki',max:.4},
  {key:'mix',label:'Rupture strength',description:'Seberapa kuat arsip terbelah pada area kontak',...COMMON},
  {key:'feedback',label:'Texture feedback',description:'Pengaturan global Hydra; RIFT lokal menjaga area arsip di luar kontak',max:.65}
 ]
};
export function activeFlagshipForSettings(settings:HydraFootprintSettings|null|undefined):FlagshipId|null{
 if(!settings?.enabled||settings.catalogVisual)return null;
 return FLAGSHIP_RECIPES.find(p=>p.graph===settings.style&&p.artwork===settings.artwork)?.id??null;
}
export function flagshipControlPatch(
 key:FlagshipControlKey,value:number
):Partial<HydraFootprintSettings>{
 const limits:Record<FlagshipControlKey,number>={mix:1,distortion:.4,feedback:.65};
 return {[key]:Math.max(0,Math.min(limits[key],Number.isFinite(value)?value:0))};
}
