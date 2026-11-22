import {getDualSurfaceState,STAGE_HARDWARE_ENABLED,urgentBlackoutDualSurface} from '../footprints/stage-optics/DualSurfaceSessionStore.ts';
import {drawF3Stage} from './F3StageRenderer.ts';
import type {F3StageFrame} from './F3Types.ts';
/** Projector 1 is deliberately fail-closed until BODY output is explicitly verified.
 * Stage 1 FLOOR channel remains untouched. This prototype does NOT open a physical
 * output window or bypass the existing Perform authorization.
 */
/** A Stage 1 BODY authorization cannot authorize a different F3 pixel source.
 * Until the F3 source binding + acknowledgement + physical calibration are
 * implemented and checked, the projection adapter must never claim READY.
 */
export function f3ProjectorGate(){
 const route=getDualSurfaceState();
 const bodyAuthorized=STAGE_HARDWARE_ENABLED&&route.armed.body&&
  route.requested.body==='live'&&route.devices.body.connected&&
  !!route.proofs.body&&!!route.plans.body;
 return {
  ready:false,
  bodyAuthorized,
  reason:'F3 belum memiliki binding dan QA fisik BODY tersendiri. Output proyektor F3 tetap BLACKOUT.'
 };
}
export function f3Blackout(){urgentBlackoutDualSurface('body');}
export function renderF3ProjectorFrame(canvas:HTMLCanvasElement,frame:F3StageFrame,video:HTMLVideoElement|null){
 const gate=f3ProjectorGate(),ctx=canvas.getContext('2d');
 if(!ctx)return false;
 if(!gate.ready){ctx.fillStyle='#000';ctx.fillRect(0,0,canvas.width,canvas.height);return false;}
 drawF3Stage(ctx,frame,null,video);return true;
}
