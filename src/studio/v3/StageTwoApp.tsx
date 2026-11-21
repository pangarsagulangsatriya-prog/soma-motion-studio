import {useEffect} from 'react';
import App from '../../App.tsx';
import {StageSessionProvider} from '../../stage/StageSessionProvider.tsx';
import {requestStageBlackout} from '../../footprints/stage-optics/StageBlackout.ts';
import {requestSoftwarePreviewBlackout} from './stagePreviewCommands.ts';

/** Separate URL/root: Stage 2 opens the existing legacy instrument engine.
 * Stage 1's Footprints workspace is never mounted in this route. */
export function StageTwoApp(){
 useEffect(()=>{
  requestStageBlackout(()=>{});
  requestSoftwarePreviewBlackout();
 },[]);
 return <StageSessionProvider><App stageTwo/></StageSessionProvider>;
}
