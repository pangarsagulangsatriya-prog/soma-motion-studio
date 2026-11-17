/** S6.6 — single source of truth for Footprints navigation requests. */
export type StageNavigationTool='live'|'setup'|'archival-mapping'|'composer'|
 'video'|'rehearsal'|'simulator'|'calibration';
export type StageNavigationRequest={id:number;tool:StageNavigationTool};
export const stageToolLabels:Record<StageNavigationTool,string>={
 live:'Live Stage',setup:'Kalibrasi 4 Titik','archival-mapping':'Archival Mapping',
 composer:'Surface Composer',video:'Video Motion Lab',rehearsal:'Rehearsal Lab',
 simulator:'Simulasi 3D',calibration:'Kalibrasi & QA'
};
