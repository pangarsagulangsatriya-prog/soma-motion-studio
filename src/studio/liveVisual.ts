import {hydraDefaults,type HydraConfig} from './hydraConfig.ts';
import type {Settings} from '../engine/types.ts';
export const LIVE_MODES=[['liquid','Teks cair'],['echo','Jejak berulang'],['cut','Potongan'],['body','Siluet × teks']] as const;
export const PALETTES={sage:{label:'Lumut',colors:['#cedf89','#70dbc5','#f0edd4'],hue:0},ember:{label:'Bara',colors:['#ff9866','#e6538c','#ffe3a1'],hue:.06},violet:{label:'Senja',colors:['#c4a0ff','#78dce8','#f99cd1'],hue:.14},spectrum:{label:'Spektrum',colors:['#80f0c5','#b1a0ff','#ff8ea5','#ffdc79'],hue:.3}} as const;
export type Palette=keyof typeof PALETTES;
export function switchLiveMode(s:Settings,preset:HydraConfig['preset']):Partial<Settings>{
 const h={...hydraDefaults(),...s.hydra};
 return {hydra:{...h,preset,enabled:true,...(preset==='body'?{silhouette:true}:{})},visual:{...s.visual,enabled:true},output:s.output==='sound'?'both':s.output};
}

export const TEXT_STYLES=[['classic','Gerak kata lama'],['elastic','Huruf elastis'],['fragments','Huruf pecah'],['flow','Arus huruf'],['photo','Foto dalam kata']] as const;
export const COLOR_STYLES=[['fixed','Tetap'],['speed','Kecepatan'],['hands','Tangan kiri / kanan'],['age','Umur jejak']] as const;
