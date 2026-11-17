import type {FootprintsInputChoice} from './sourceSwitchModel.ts';

/**
 * Fail-closed source routing for S6.8.5. Preview experiments keep their own
 * canvas pipeline, but they can never arm any physical ProjectionLink output.
 * Camera and projector QA remain independently guarded elsewhere.
 */
export type SourceOutputTransport='live'|'hold'|'blackout';
export function physicalOutputPermitted(source:FootprintsInputChoice|null):boolean{
 return source!=='video'&&source!=='simulator';
}
export function sourceSafeTransport(
 source:FootprintsInputChoice|null,requested:SourceOutputTransport
):SourceOutputTransport{
 return physicalOutputPermitted(source)?requested:'blackout';
}
export function preserveCurrentSource(input:{
 current:FootprintsInputChoice|null;next:FootprintsInputChoice;
 cameraOn:boolean;cameraBusy:boolean
}):boolean{
 if(input.current!==input.next)return false;
 return input.next==='phone'||input.next==='video'||input.next==='simulator'||
  (input.next==='webcam'&&input.cameraOn&&!input.cameraBusy);
}
