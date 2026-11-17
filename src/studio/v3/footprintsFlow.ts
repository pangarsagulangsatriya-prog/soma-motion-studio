/** Single in-workspace progression for the Footprints → Projector pipeline. */
export type FootprintsStep='input'|'process'|'compose'|'output';
export const footprintsSteps=[
 {id:'input',number:'01',title:'Input',hint:'Pilih sumber gerak'},
 {id:'process',number:'02',title:'Process',hint:'Baca kaki & kalibrasi'},
 {id:'compose',number:'03',title:'Compose',hint:'Atur arsip & respons'},
 {id:'output',number:'04',title:'Output',hint:'Kirim ke Projector'}
] as const;
