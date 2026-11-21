/** SOMA Labs groups. Primary navigation remains Footprints + Projector. */
export const LABS_GROUPS=[
 {id:'visual',label:'Visual experiments',description:'Scene gambar dan tipografi',items:[
  {id:'liquid',title:'Textaire · Teks Cair',detail:'Huruf mengikuti gerak',kind:'Legacy'},
  {id:'echo',title:'Jejak Berulang',detail:'Lapisan gambar yang kembali',kind:'Legacy'},
  {id:'cut',title:'Potongan',detail:'Pecahan ritmis',kind:'Legacy'},
  {id:'body',title:'Siluet × Teks',detail:'Tubuh dan tipografi',kind:'Legacy'},
  {id:'hydra',title:'Hydra / Generatif',detail:'Feedback, material dan teks',kind:'Eksperimen'}
 ]},
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
 liquid:'textaire textair teks huruf letter liquid',echo:'jejak ulang repeat echo',
 cut:'potong cut rhythm',body:'siluet tubuh body text',
 hydra:'generatif visual graphic synth',sound:'suara audio musik synth theremin',
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
