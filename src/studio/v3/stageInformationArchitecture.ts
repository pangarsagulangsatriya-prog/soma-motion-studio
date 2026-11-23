/** UI-facing readiness only. Physical approval remains solely in output transport gates. */
export type StageNavigationInput={
 sourceReady:boolean;composeRasterReady:boolean;outputQuadSaved:boolean;
 outputQaValid:boolean;physicalLiveCommanded:boolean;
};
export type StageNavigationReadiness={
 trackReady:boolean;composeReady:boolean;mapReady:boolean;outputLive:boolean;
};
export function stageNavigationReadiness(s:StageNavigationInput):StageNavigationReadiness{
 const trackReady=s.sourceReady;
 const composeReady=trackReady&&s.composeRasterReady;
 const mapReady=composeReady&&s.outputQuadSaved;
 return {
  trackReady,composeReady,mapReady,
  outputLive:mapReady&&s.outputQaValid&&s.physicalLiveCommanded
 };
}
/** Stage IA owns the order. Tabs are free navigation; the main CTA never skips Compose. */
export const STAGE_NEXT={
 track:{target:'compose',label:'Lanjut Compose'},
 compose:{target:'map',label:'Lanjut Map'},
 map:{target:'perform',label:'Lanjut Perform'},
 perform:{target:'map',label:'Kembali ke Map'}
} as const;
