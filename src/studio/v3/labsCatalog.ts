/** SOMA Labs groups. Primary navigation remains Footprints + Projector. */
export const LABS_GROUPS=[
 {id:'motion',label:'Motion & capture',description:'Instrumen dan arsip lama',items:[
  {id:'sound',title:'Motion & Sound',detail:'Sintesis dan instrumen gerak',kind:'Legacy'},
  {id:'capture',title:'Capture Experiments',detail:'Foto dan rekaman gestur',kind:'Legacy'},
  {id:'archive',title:'Archive Studio',detail:'Arsip performatif',kind:'Legacy'}
 ]},
 {id:'gait',label:'Gait experiments',description:'Alat uji Footprints',items:[
  {id:'video',title:'Video Motion Lab',detail:'MP4 ke pose dan gait',kind:'Eksperimen'},
  {id:'rehearsal',title:'Rehearsal Lab',detail:'Bandingkan video dan kamera',kind:'Eksperimen'},
  {id:'simulator',title:'Simulasi 3D',detail:'Gerakan virtual tanpa kamera',kind:'Eksperimen'}
 ]}
] as const;
export type LabsId=(typeof LABS_GROUPS)[number]['items'][number]['id'];
export type LabsGroupId=(typeof LABS_GROUPS)[number]['id'];
const canonical=(input:string)=>input.normalize('NFKD')
 .replace(/[\u0300-\u036f]/g,'').toLocaleLowerCase('id-ID').trim();
const extraTerms:Record<LabsId,string>={
 sound:'suara audio musik synth theremin',
 capture:'foto photo kamera gestur',archive:'arsip pustaka',
 video:'video footage mp4',rehearsal:'latihan perbandingan',
 simulator:'3d puppet virtual'
};
export function searchLabs(query:string){
 const needle=canonical(query).slice(0,90);
 return LABS_GROUPS.map(group=>({
  ...group,items:group.items.filter(item=>!needle||
   canonical([group.label,item.title,item.detail,item.kind,extraTerms[item.id]].join(' ')).includes(needle))
 })).filter(group=>group.items.length>0);
}
export const LABS_ITEM_COUNT=LABS_GROUPS.reduce((count,group)=>count+group.items.length,0);
