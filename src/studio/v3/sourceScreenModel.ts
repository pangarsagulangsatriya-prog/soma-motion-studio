/** S6.7.2.2 — presentation-only source state.
 * Live camera and physical projector approval remain governed by existing engines. */
export type SourceScreenMode=
 'select'|'connecting'|'recover'|'switch-body'|'warming'|'live';

export function deriveSourceScreenMode(input:{
 cameraOn:boolean;cameraBusy:boolean;cameraError:string;
 bodySelected:boolean;videoReady:boolean;
}):SourceScreenMode{
 if(input.cameraBusy)return 'connecting';
 if(input.cameraOn){
  if(!input.bodySelected)return 'switch-body';
  return input.videoReady?'live':'warming';
 }
 return input.cameraError.trim()?'recover':'select';
}
export function showsSourcePicker(mode:SourceScreenMode){
 return mode==='select'||mode==='connecting'||mode==='recover';
}
export function showsGaitPreviews(mode:SourceScreenMode){
 return mode==='live';
}
