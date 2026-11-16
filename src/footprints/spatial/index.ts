export {
 defaultFloorSpace,validateFloorSpace,validFloorPoint,insideFloor,
 floorToUV,uvToFloor,floorToProjectorUV,projectorUVToFloor,
 validateCameraFloorCalibration,cameraGroundToFloor,stageUVToRawCamera
} from './coordinates.ts';
export type {FloorPoint,FloorSpace,CameraFloorCalibration} from './coordinates.ts';
export {
 validateFootstepEvent,validateFloorSession,createFloorSession,
 canProjectMetric,requireProjectable,isContactStamp,FootstepEventEngine
} from './events.ts';
export type {
 FootstepEvent,FootEventKind,FootSide,FootSource,FootObservation,
 PositionBasis,FloorSession
} from './events.ts';
export {
 calibratedGaitContact,legacyV2ToIllustrativeSession,floorSessionToPreviewSamples
} from './adapters.ts';
