/**
 * User-facing Studio Blackout request.
 * The legacy projection route is cleared by the supplied function; each
 * physically opened stage window independently listens for the same signal.
 * Hardware power cutoff is still required in an actual optical emergency.
 */
export const STAGE_BLACKOUT_EVENT='soma:stage-blackout' as const;
export function requestStageBlackout(legacyBlackout:()=>void){
 legacyBlackout();
 if(typeof window!=='undefined')window.dispatchEvent(new Event(STAGE_BLACKOUT_EVENT));
}
