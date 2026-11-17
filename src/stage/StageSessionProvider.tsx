import type {ReactNode} from 'react';
import {StageSessionContext,useStageSessionState} from './useStageSession.ts';

/** Single project state across Footprints Stage, Stage Optics, Build and Perform. */
export function StageSessionProvider({children}:{children:ReactNode}){
 const state=useStageSessionState();
 return <StageSessionContext.Provider value={state}>{children}</StageSessionContext.Provider>;
}
