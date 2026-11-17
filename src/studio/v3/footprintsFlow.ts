/** Local tasks inside Footprints. Physical Output is handled in Projector. */
export type FootprintsStep='input'|'process'|'compose'|'output';
export const footprintsSteps=[
 {id:'process',number:'01',title:'Tracking',hint:'Performer, kontak dan kalibrasi'},
 {id:'compose',number:'02',title:'Visual',hint:'Jejak, media dan arsip'}
] as const;
