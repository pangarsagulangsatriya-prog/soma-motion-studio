import {getDualSurfaceState,STAGE_HARDWARE_ENABLED,urgentBlackoutDualSurface} from '../footprints/stage-optics/DualSurfaceSessionStore.ts';
import {drawF3Stage} from './F3StageRenderer.ts';
import type {F3StageFrame} from './F3Types.ts';
/** Projector 1 is deliberately fail-closed until BODY output is explicitly verified.
 * Stage 1 FLOOR channel remains untouched. This prototype does NOT open a physical
 * output window or bypass the existing Perform authorization.
 */
export function f3ProjectorGate(){
 const route=getDualSurfaceState();
 const plan=route.plans.body,proof=route.proofs.body;
 return {ready:STAGE_HARDWARE_ENABLED&&route.armed.body&&route.requested.body==='live'&&
  route.devices.body.connected&&!!proof&&!!plan,
  reason:!STAGE_HARDWARE_ENABLED?'Output fisik belum diaktifkan.':!route.devices.body.connected?
   'Output BODY belum tersambung.':'Otorisasi Perform / QA BODY belum lengkap.'};
}
export function f3Blackout(){urgentBlackoutDualSurface('body');}
export function renderF3ProjectorFrame(canvas:HTMLCanvasElement,frame:F3StageFrame,video:HTMLVideoElement|null){
 const gate=f3ProjectorGate(),ctx=canvas.getContext('2d');
 if(!ctx)return false;
 if(!gate.ready){ctx.fillStyle='#000';ctx.fillRect(0,0,canvas.width,canvas.height);return false;}
 drawF3Stage(ctx,frame,video);return true;
}
