/** Software UI preview commands. Physical output blackout is a separate safety signal. */
export const SOFTWARE_PREVIEW_BLACKOUT_EVENT='soma:software-preview-blackout' as const;
export function requestSoftwarePreviewBlackout(){
 if(typeof window!=='undefined')window.dispatchEvent(new Event(SOFTWARE_PREVIEW_BLACKOUT_EVENT));
}
