/** UX-03/04: software composition may be inspected before physical calibration.
 * This gate never grants projector authorization; output routing retains separate QA.
 */
export function canRenderComposeSurface(input:{
 surface:'BODY A'|'BODY B'|'FLOOR';
 physical:boolean;
 floorReady:boolean;
 bodyMaskSafe:boolean;
 bodyMaskPresent:boolean;
}):boolean{
 if(input.surface==='FLOOR')return !input.physical||input.floorReady;
 return input.bodyMaskSafe&&input.bodyMaskPresent;
}
