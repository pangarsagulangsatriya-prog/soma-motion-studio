export type F3Role='A'|'B';
export type F3InputKind='camera'|'fixture';
export type F3Connection='idle'|'connecting'|'live'|'stale'|'error';
export type F3PunchPreset='straight'|'uppercut';
export type F3Rect={x:number;y:number;width:number;height:number};
export type F3CameraStatus={role:F3Role;id:string;kind:F3InputKind;state:F3Connection;lastFrameAt:number;frameId:number;videoTime:number;message:string;};
export type F3Landmark={x:number;y:number;z:number;visibility?:number};
export type F3MotionFrame={frameId:number;timestamp:number;videoTime:number;pose:F3Landmark[];hands:F3Landmark[][];fresh:boolean;confidence:number;};
export type F3Photo={id:string;slot:number;blob:Blob;url:string;createdAt:string;cameraId:string;frameId:number;sourceTimestamp:number;crop:F3Rect;preset:F3PunchPreset|'manual';consent:true;};
export type F3StageFrame={
 layout:{ratio:2;gridFraction:number;gapFraction:number};
 cameraB:{sourceId:string;frameId:number;timestamp:number;crop:F3Rect;mirror:boolean};
 photoSlots:[F3Photo|null,F3Photo|null,F3Photo|null,F3Photo|null];
 overlay:{liveIndicator:boolean;corners:boolean;zoomIndicator:boolean;flashUntil?:number};
 state:'LIVE'|'FREEZE'|'BLACKOUT'|'SIMULATION';
};
export const F3_EMPTY_SLOTS=():F3StageFrame['photoSlots']=>[null,null,null,null];
