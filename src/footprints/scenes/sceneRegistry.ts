/** F5 catalogue follows the 13 named rows in the SOMA FLOOR parity PRD.
 * These IDs are independent of the global SOMA scene/voice selector. */
export const FLOOR_SCENE_IDS=[
 'snowfall','christmas','hanukkah','spring-garden','fall-leaves',
 'the-swarm','ectoplasmic-fog','ground-smoke','cursed-fluid',
 'living-water','fireworks','pool-splash','fireflies'
] as const;
export type FloorSceneId=typeof FLOOR_SCENE_IDS[number];
export type FloorPrimitive='snow'|'growth'|'leaves'|'swarm'|'fog'|'smoke'|'fluid'|'water'|'burst'|'splash'|'fireflies';
export type FloorSceneDescription={
 id:FloorSceneId;name:string;family:FloorPrimitive;
 trigger:'contact'|'movement'|'presence'|'mixed';
 description:string;defaultColor:string;
};
export const FLOOR_SCENES:readonly FloorSceneDescription[]=[
 {id:'snowfall',name:'Snowfall',family:'snow',trigger:'contact',description:'Jejak telapak menekan salju lalu tertutup kembali',defaultColor:'#e5f1f3'},
 {id:'christmas',name:'Christmas',family:'snow',trigger:'contact',description:'Salju, cahaya hijau dan lampu hangat mengikuti pijakan',defaultColor:'#e2c381'},
 {id:'hanukkah',name:'Hanukkah',family:'snow',trigger:'contact',description:'Salju malam biru dengan delapan titik cahaya',defaultColor:'#a7d9ee'},
 {id:'spring-garden',name:'Spring Garden',family:'growth',trigger:'mixed',description:'Tumbuhan dan bunga tumbuh dari pijakan dan gerak',defaultColor:'#9dca83'},
 {id:'fall-leaves',name:'Fall Leaves',family:'leaves',trigger:'movement',description:'Daun berputar dan tersibak saat dilintasi',defaultColor:'#d1a568'},
 {id:'the-swarm',name:'The Swarm',family:'swarm',trigger:'mixed',description:'Partikel menghindari area keberadaan tubuh',defaultColor:'#b9c6a4'},
 {id:'ectoplasmic-fog',name:'Ectoplasmic Fog',family:'fog',trigger:'mixed',description:'Lapisan kabut transparan membuka ruang di sekitar tubuh',defaultColor:'#98d3c3'},
 {id:'ground-smoke',name:'Ground Smoke',family:'smoke',trigger:'mixed',description:'Asap rendah bergulung mengikuti aliran langkah',defaultColor:'#bdc9cf'},
 {id:'cursed-fluid',name:'Cursed Fluid',family:'fluid',trigger:'mixed',description:'Cairan gelap beriak saat permukaannya terganggu',defaultColor:'#ae83c2'},
 {id:'living-water',name:'Living Water',family:'water',trigger:'mixed',description:'Permukaan air hidup dan riak menyebar dari gerak',defaultColor:'#78c5c9'},
 {id:'fireworks',name:'Fireworks',family:'burst',trigger:'contact',description:'Satu semburan cahaya tiap kontak kaki terverifikasi',defaultColor:'#f7ce87'},
 {id:'pool-splash',name:'Pool Splash',family:'splash',trigger:'mixed',description:'Cipratan dan riak saat pijakan atau gerak menyentuh bidang',defaultColor:'#7cc5ed'},
 {id:'fireflies',name:'Fireflies',family:'fireflies',trigger:'mixed',description:'Kunang-kunang tertarik dan menjauh dari kehadiran tubuh',defaultColor:'#d2e79a'}
];
export const floorSceneById=(id:FloorSceneId):FloorSceneDescription=>
 FLOOR_SCENES.find(scene=>scene.id===id)??FLOOR_SCENES[0];
export function isFloorSceneId(value:unknown):value is FloorSceneId{
 return typeof value==='string'&&(FLOOR_SCENE_IDS as readonly string[]).includes(value);
}
export type FloorScenePreset={
 schema:'soma.floor-scene-preset';version:1;name:string;
 sceneId:FloorSceneId;intensity:number;radius:number;persistence:number;
 audioMix:number;quality:'low'|'medium'|'high';
};
export const FLOOR_SCENE_PRESETS:readonly FloorScenePreset[]=[
 {schema:'soma.floor-scene-preset',version:1,name:'Default · Soft Floor',
  sceneId:'snowfall',intensity:.6,radius:.45,persistence:.65,audioMix:0,quality:'medium'},
 {schema:'soma.floor-scene-preset',version:1,name:'Night · Fireflies',
  sceneId:'fireflies',intensity:.48,radius:.65,persistence:.8,audioMix:.4,quality:'medium'},
 {schema:'soma.floor-scene-preset',version:1,name:'Flow · Water',
  sceneId:'living-water',intensity:.7,radius:.6,persistence:.5,audioMix:.35,quality:'medium'},
 {schema:'soma.floor-scene-preset',version:1,name:'Responsive · Fog',
  sceneId:'ectoplasmic-fog',intensity:.6,radius:.7,persistence:.7,audioMix:.25,quality:'medium'}
];
const finite=(v:unknown):v is number=>typeof v==='number'&&Number.isFinite(v);
const unit=(v:unknown):v is number=>finite(v)&&v>=0&&v<=1;
export function validateFloorScenePreset(raw:unknown):FloorScenePreset{
 const p=raw as Partial<FloorScenePreset>|null;
 if(!p||p.schema!=='soma.floor-scene-preset'||p.version!==1||
  typeof p.name!=='string'||p.name.trim().length===0||p.name.length>64||
  !isFloorSceneId(p.sceneId)||!unit(p.intensity)||!unit(p.radius)||
  !unit(p.persistence)||!unit(p.audioMix)||
  (p.quality!=='low'&&p.quality!=='medium'&&p.quality!=='high'))
  throw Error('Preset scene FLOOR tidak valid.');
 return {schema:'soma.floor-scene-preset',version:1,name:p.name.trim(),
  sceneId:p.sceneId,intensity:p.intensity!,radius:p.radius!,
  persistence:p.persistence!,audioMix:p.audioMix!,quality:p.quality};
}
export const FLOOR_PRESETS_STORAGE_KEY='soma-floor-scene-presets-v1';
type ReadStore=Pick<Storage,'getItem'>;type WriteStore=Pick<Storage,'getItem'|'setItem'>;
export function loadFloorPresets(storage:ReadStore):FloorScenePreset[]{
 try{
  const parsed=JSON.parse(storage.getItem(FLOOR_PRESETS_STORAGE_KEY)??'[]');
  if(!Array.isArray(parsed))return [];
  return parsed.slice(0,30).flatMap(p=>{try{return [validateFloorScenePreset(p)];}catch{return [];}}).slice(0,12);
 }catch{return [];}
}
export function saveFloorPreset(storage:WriteStore,preset:FloorScenePreset):FloorScenePreset[]{
 const clean=validateFloorScenePreset(preset);
 const next=[clean,...loadFloorPresets(storage).filter(p=>p.name!==clean.name)].slice(0,12);
 storage.setItem(FLOOR_PRESETS_STORAGE_KEY,JSON.stringify(next));return next;
}
