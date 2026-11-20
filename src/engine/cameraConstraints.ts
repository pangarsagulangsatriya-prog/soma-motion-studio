/** Canonical horizontal (16:9 wide landscape) camera constraints for SOMA.
 *  Prevents desktop webcams and mobile phones from defaulting to vertical/portrait framing. */
export type CameraCaptureSize='480p'|'720p';

export const DEFAULT_CAMERA_CAPTURE_SIZE:CameraCaptureSize='720p';
export const WIDE_CAMERA_ASPECT_RATIO=16/9;

export interface HorizontalCameraOptions{
 captureSize?:CameraCaptureSize;
 deviceId?:string;
 facingMode?:'user'|'environment';
 frameRateIdeal?:number;
 frameRateMax?:number;
}

export function buildHorizontalCameraConstraints(
 options:HorizontalCameraOptions={}
):MediaTrackConstraints{
 const size=options.captureSize??DEFAULT_CAMERA_CAPTURE_SIZE;
 const idealWidth=size==='720p'?1280:854;
 const idealHeight=size==='720p'?720:480;
 const minWidth=size==='720p'?960:640;
 const minHeight=size==='720p'?540:360;
 const base:MediaTrackConstraints={
  width:{ideal:idealWidth,min:minWidth},
  height:{ideal:idealHeight,min:minHeight},
  aspectRatio:{ideal:WIDE_CAMERA_ASPECT_RATIO},
  frameRate:{
   ideal:options.frameRateIdeal??30,
   max:options.frameRateMax??30
  }
 };
 if(options.deviceId){
  return {...base,deviceId:{exact:options.deviceId}};
 }
 return {
  ...base,
  facingMode:{ideal:options.facingMode??'user'}
 };
}

export function isPortraitStreamDimensions(width:number,height:number):boolean{
 return Number.isFinite(width)&&Number.isFinite(height)&&width>0&&height>0&&height>width;
}
