import {artworkMatrix} from '../../projection/artwork.ts';
import {stageSurfaceState,type StageSurfacePlan} from './DualSurfaceCalibration.ts';

export type PreviewView='draft'|'sent';
export type PreviewSignal='artwork'|'test'|'blackout';
export type SurfaceTransport='live'|'test'|'blackout';
/** Every source needs build opt-in, measured Map QA, and deliberate LIVE. */
export function dualPhysicalOutputAllowed(
 hardwareEnabled:boolean,_experimentLocked:boolean,operatorConfirm:boolean
):boolean{
 return hardwareEnabled&&operatorConfirm;
}

/**
 * A digital operator preview. "Sent" mirrors the latest software transport,
 * never promises that the physical projector matches the screen.
 */
export function previewSignal(view:PreviewView,mode:string):PreviewSignal{
 if(view==='draft')return 'artwork';
 return mode==='live'?'artwork':mode==='test'?'test':'blackout';
}
export function previewCaption(view:PreviewView,mode:string):string{
 if(view==='draft')return 'DRAF LOKAL · tidak dikirim ke proyektor';
 if(mode==='live')return 'LIVE diperintahkan · verifikasi cahaya fisik';
 if(mode==='test')return 'TARGET UJI diperintahkan · verifikasi cahaya fisik';
 return 'BLACKOUT diperintahkan · periksa cahaya fisik';
}
/** Reuse the same artworkMatrix and StageSurfaceState config as the remote output. */
export function previewArtworkMatrix(plan:StageSurfacePlan,w:number,h:number){
 const state=stageSurfaceState(plan,'live',true);
 return artworkMatrix(state.config,w,h);
}
export function previewBrightness(plan:StageSurfacePlan){
 return stageSurfaceState(plan,'live',true).config.brightness;
}
