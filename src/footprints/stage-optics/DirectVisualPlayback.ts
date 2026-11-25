/** Pure visual-playback gate; no permission is inferred from camera QA. */
export function canPlayDirectVisual(input:{
 hardwareEnabled:boolean;experiment:boolean;direct:boolean;connected:boolean;
 fresh:boolean;sourceReady:boolean;visualReady:boolean;canvasReady:boolean;
 signature:string|null;authorizedSignature:string|null;
}):boolean{
 return input.hardwareEnabled&&input.experiment&&input.direct&&input.connected&&
  input.fresh&&input.sourceReady&&input.visualReady&&input.canvasReady&&
  !!input.signature&&input.signature===input.authorizedSignature;
}
// Separate two File objects (including identically named clips) for playback authorization.
const fileKeys=new WeakMap<object,number>();
let serial=0;
export function directPlaybackFileKey(file:object|null|undefined):string{
 if(!file)return 'none';
 let id=fileKeys.get(file);
 if(id===undefined){id=++serial;fileKeys.set(file,id);}
 return String(id);
}
