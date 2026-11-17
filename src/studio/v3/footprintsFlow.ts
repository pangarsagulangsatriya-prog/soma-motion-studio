/** Local tasks inside Footprints. Physical Output is handled in Projector. */
export type FootprintsStep='input'|'process'|'compose'|'output';
export const footprintsSteps=[
 {id:'input',number:'01',title:'Source',hint:'Webcam, HP, MP4 atau simulasi'},
 {id:'process',number:'02',title:'Tracking',hint:'Performer, kontak dan kalibrasi'},
 {id:'compose',number:'03',title:'Visual & Archive',hint:'Jejak, media dan arsip'}
] as const;
