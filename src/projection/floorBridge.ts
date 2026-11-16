import {validQuad} from './geometry.ts';
import {placementDefaults,type ProjectionConfig,type ProjectionState,type Transport} from './model.ts';

/**
 * The physical floor is represented by an UNWARPED 0..1 raster with origin
 * at the upstage-left floor corner (top-left in the floor preview).
 * SOMA's existing artworkTransform applies exactly one quad warp at output.
 *
 * Important: the screen quad MUST have been measured on the physical floor.
 * A valid quadrilateral alone does not prove physical registration.
 */
export function floorArtworkProjectionConfig(original:ProjectionConfig):ProjectionConfig{
 if(!validQuad(original.quad))throw Error('Kalibrasi Projection membutuhkan empat sudut lantai yang valid.');
 return {...original,
  mode:'screen',mirror:false,
  registration:{...original.registration,enabled:false},
  placement:placementDefaults(),motion:'fixed'
 };
}
/** Ties the operator's explicit floor check to the configured four corners and output size. */
export function floorCalibrationSignature(config:ProjectionConfig):string{
 if(!validQuad(config.quad))throw Error('Kalibrasi Projection belum valid.');
 return JSON.stringify([config.quad,config.resolution]);
}
export type FloorArtworkSource='simulator'|'live-floor'|'live-footprints'|'none';
export function chooseFloorArtworkSource(simulatorVisible:boolean,simulatorReady:boolean,
 simulatorCanvasPresent:boolean,liveFootprintsActive:boolean,liveCanvasPresent:boolean,
 liveFloorVisible=false,liveFloorReady=false,liveFloorCanvasPresent=false):
 {source:FloorArtworkSource;canStream:boolean}{
 // Never fall back to live camera artwork while the simulator is open:
 // it could reveal body footage or stale performance content unexpectedly.
 if(simulatorVisible)return {source:'simulator',canStream:simulatorReady&&simulatorCanvasPresent};
 if(liveFloorVisible)return {source:'live-floor',canStream:liveFloorReady&&liveFloorCanvasPresent};
 if(liveFootprintsActive)return {source:'live-footprints',canStream:liveCanvasPresent};
 return {source:'none',canStream:false};
}
/**
 * Camera frame quality does not control the SIMULATOR output. The same
 * calibration, Live/Hold/Blackout and blackout fail-safe still apply.
 */
export function simulatorArtworkState(state:ProjectionState,verified:boolean,testing=false):ProjectionState{
 const config=floorArtworkProjectionConfig(state.config);
 return {...state,config,image:null,
  blank:!verified||state.transport==='blackout'||state.pattern,
  tracking:verified,quality:verified?1:0,sampleAge:0,opacity:1,
  reason:testing?'Tanda empat sudut lantai · uji, belum terkalibrasi':
   verified?'Simulasi Footprints · kalibrasi telah dikonfirmasi operator':
   'Lantai belum dikonfirmasi. Output dipadamkan.'};
}
/** Direct visual output is permitted only with explicit floor verification and live transport. */
export function canShowFloorArtwork(verified:boolean,transport:Transport,pattern:boolean):boolean{
 return verified&&transport!=='blackout'&&!pattern;
}

/** Identical floor-only mapping for camera-based contacts; no body mask layer. */
export function liveFloorArtworkState(state:ProjectionState,approved:boolean,testing=false):ProjectionState{
 const prepared=simulatorArtworkState(state,approved,testing);
 return {...prepared,reason:testing?'Tanda empat sudut kamera/lantai · mode uji':
  approved?'Live Footprints · kontak kaki diperkirakan kamera':
   'Kalibrasi kamera dan lantai belum dikonfirmasi. Output padam.'};
}

/** QA fault transport can only RESTRICT an already-selected real projector state.
 * A scripted Live state never activates output when the operator selected Hold
 * or Blackout. Existing floor calibration approval still gates everything. */
export function effectiveFloorTransport(actual:Transport,qa:Transport|null):Transport{
 if(actual==='blackout'||qa==='blackout')return 'blackout';
 if(actual==='hold'||qa==='hold')return 'hold';
 return 'live';
}
