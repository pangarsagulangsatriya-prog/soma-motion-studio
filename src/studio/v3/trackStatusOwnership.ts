import type {FootprintsInputChoice,FootprintsInputPhase} from './sourceSwitchModel.ts';
import type {SourceScreenMode} from './sourceScreenModel.ts';
import type {TrackFeedback} from './trackFeedbackModel.ts';

/** TRK-06A: Track owns just one actionable recovery at a time.
 * The SOURCE rail owns connection and errors; the INPUT monitor owns
 * pixels/framing; Compose keeps its guided setup independently.
 * Presentation only: never modifies camera, WebRTC or projector state.
 */
export type TrackStatusOwnership={
 sourceStatusVisible:boolean;
 sourceStatusError:boolean;
 webcamAction:'activate'|'retry'|'connecting'|null;
 showBodyAction:boolean;
 showPreviewWarming:boolean;
 showTrackingFeedback:boolean;
 showInlineAssistant:boolean;
};
export function trackStatusOwnership(input:{
 selection:FootprintsInputChoice|null;
 phase:FootprintsInputPhase;
 cameraOn:boolean;
 cameraBusy:boolean;
 cameraError:string;
 phonePanelOpen:boolean;
 experimentalKind:'video'|'simulator'|null;
 sourceMode:SourceScreenMode;
 feedbackState:TrackFeedback['state'];
 composerOpen:boolean;
 operatorMode:boolean;
}):TrackStatusOwnership{
 const {selection,phase,cameraOn,cameraBusy,cameraError,
  phonePanelOpen,experimentalKind,sourceMode,feedbackState,
  composerOpen,operatorMode}=input;
 // A Compose-specific assistant may still cover its separate workflow.
 if(composerOpen||operatorMode)return {
  sourceStatusVisible:false,sourceStatusError:false,webcamAction:null,
  showBodyAction:false,showPreviewWarming:false,
  showTrackingFeedback:false,showInlineAssistant:composerOpen&&!operatorMode
 };
 const sourceStatusError=phase==='error'||
  (selection==='webcam'&&!!cameraError.trim());
 const webcamAction=selection!=='webcam'||cameraOn?null:
  cameraBusy||phase==='connecting'?'connecting':
  sourceStatusError?'retry':'activate';
 return {
  // Pairing and experimental controls own their status. Errors are displayed
  // once in the source rail, unless the phone pairing panel is already open.
  sourceStatusVisible:sourceStatusError&&
   !(selection==='phone'&&phonePanelOpen),
  sourceStatusError,
  webcamAction,
  // The current Body recovery handler selects the laptop camera. Never
  // advertise it for HP: that would silently replace the paired source.
  showBodyAction:selection==='webcam'&&cameraOn&&sourceMode==='switch-body',
  showPreviewWarming:!!selection&&!experimentalKind&&
   cameraOn&&sourceMode==='warming',
  showTrackingFeedback:feedbackState!=='idle'&&feedbackState!=='waiting',
  // No generic warning card in Track: it duplicates primary rail actions.
  showInlineAssistant:false
 };
}
