import {useEffect,useRef,useState} from 'react';
import {uid,type MotionFrame} from '../../engine/types';
import {download} from '../../engine/recording';
import type {ProjectionImage,ProjectionState} from '../model';
import {organicDefaults,validateOrganic,readPerformance,type OrganicConfig,type PerformancePreset} from './config';
import {OrganicBodyEngine,emptyOrganicStatus} from './engine';
import {OrganicCompositor,CPUCompositor} from './compositor';
const KEY='soma-organic-cues-v1';
const initialCues=():PerformancePreset[]=>[
 ['Utuh',{mode:'normal'}],['Lengan memanjang',{mode:'stretch',anchor:'hand',control:'motion',intensity:2.2}],['Tubuh terbelah',{mode:'split',separation:.13,sliceDelayMs:150}],['Tubuh berulang',{mode:'normal',echo:true,echoCount:4,echoSpacingMs:600}],['Tubuh dan bekas',{mode:'merge',delayMs:1500,residue:true,mergeBlend:.6}]
].map(([name,patch],i)=>({id:`soma-organic-${i}`,name:String(name),calibrationReference:'',config:{...organicDefaults(),enabled:true,...patch as Partial<OrganicConfig>}}));
export function useOrganic(active:boolean,calibrationName:string,notify:(s:string)=>void){
 const [config,setConfig]=useState(organicDefaults),configRef=useRef(config);configRef.current=config;
 const engine=useRef<OrganicBodyEngine|null>(null),[status,setStatus]=useState(emptyOrganicStatus),[cues,setCues]=useState<PerformancePreset[]>(initialCues),[selected,setSelected]=useState('soma-organic-0'),[name,setName]=useState('Utuh'),[error,setError]=useState('');
 const latest=useRef({config,selected,cues,name,calibrationName});latest.current={config,selected,cues,name,calibrationName};const lastUI=useRef(0);
 useEffect(()=>{try{const saved=localStorage.getItem(KEY);if(saved){const list=readPerformance(JSON.parse(saved));setCues(list);setSelected(list[0]?.id??'');setName(list[0]?.name??'Adegan 01');}}catch{notify('Pustaka Organic tidak dapat dibaca; cue awal dipakai.');}return()=>{engine.current?.dispose();engine.current=null;};},[]);
 const ensure=()=>{if(!engine.current){let compositor;try{compositor=new OrganicCompositor();}catch{compositor=new CPUCompositor();notify('GPU Organic belum tersedia. Komposisi memakai CPU 128².');}engine.current=new OrganicBodyEngine(compositor);engine.current.configure(configRef.current,performance.now());}return engine.current;};
 const update=(patch:Partial<OrganicConfig>,transition=false)=>{try{const next=validateOrganic({...configRef.current,...patch});configRef.current=next;setConfig(next);engine.current?.configure(next,performance.now(),transition);setError('');}catch(e){notify((e as Error).message);}};
 const process=(s:ProjectionState,frame:MotionFrame,now:number,live:ProjectionImage|null)=>{const e=ensure(),start=performance.now();try{if(s.tracking)e.ingest(live,frame);const output=e.process(s,now);if(now-lastUI.current>250){lastUI.current=now;setStatus(e.status(performance.now()-start));}return output;}catch(err){const message=(err as Error).message;if(now-lastUI.current>250){lastUI.current=now;setError(message);}return {...s,blank:true};}};
 const clearMemory=()=>{engine.current?.dispose();engine.current=null;setStatus(emptyOrganicStatus());};
 const reset=()=>{clearMemory();const next=organicDefaults();configRef.current=next;setConfig(next);setError('');notify('Organic kembali utuh. Riwayat, freeze dan bekas dilepas; kalibrasi tetap.');};
 const freeze=()=>{const e=ensure();if(e.status().frozen){e.release();notify('Freeze dilepas. Kembali ke komposisi live.');}else if(e.freeze()){update({enabled:true});notify('Komposisi dibekukan. Kamera tetap membaca gerak.');}else notify('Tunggu siluet tampil sebelum Freeze.');setStatus(e.status());};
 const partner=()=>{const e=ensure();notify(e.capturePartner()?'Tubuh pasangan tersimpan. Pilih Pasangan tersimpan pada Merge.':'Tunggu tubuh terdeteksi untuk menyimpan pasangan.');setStatus(e.status());};
 const clearResidue=()=>{engine.current?.clearResidue();if(engine.current)setStatus(engine.current.status());notify('Semua bekas gerak dilepas.');};
 const persist=(list:PerformancePreset[])=>{try{localStorage.setItem(KEY,JSON.stringify({format:'soma-organic',version:1,cues:list}));setCues(list);return true;}catch{notify('Penyimpanan cue belum tersedia. Ekspor JSON untuk salinan.');return false;}};
 const recall=(id:string)=>{const cue=latest.current.cues.find(c=>c.id===id);if(!cue)return;engine.current?.release();update(cue.config,true);setSelected(id);setName(cue.name);notify(`Cue: ${cue.name}. Kalibrasi aktif tetap.`);};
 const go=(direction:number)=>{const list=latest.current.cues;if(!list.length)return;const i=Math.max(0,list.findIndex(c=>c.id===latest.current.selected));recall(list[(i+direction+list.length)%list.length].id);};
 const save=()=>{const label=latest.current.name.trim();if(!label){notify('Isi nama cue.');return;}const list=latest.current.cues,cue={id:latest.current.selected||uid(),name:label,config:structuredClone(configRef.current),calibrationReference:latest.current.calibrationName.slice(0,60)};if(!list.some(c=>c.id===cue.id)&&list.length>=32){notify('Pustaka sudah memuat 32 cue.');return;}if(persist(list.some(c=>c.id===cue.id)?list.map(c=>c.id===cue.id?cue:c):[...list,cue])){setSelected(cue.id);notify('Cue artistik tersimpan.');}};
 const duplicate=()=>{if(latest.current.cues.length>=32){notify('Pustaka sudah memuat 32 cue.');return;}const cue={id:uid(),name:`${latest.current.name||'Adegan'} salinan`.slice(0,60),config:structuredClone(configRef.current),calibrationReference:latest.current.calibrationName.slice(0,60)};if(persist([...latest.current.cues,cue])){setSelected(cue.id);setName(cue.name);notify('Cue diduplikasi.');}};
 const rename=()=>{const label=latest.current.name.trim();if(!label){notify('Isi nama cue.');return;}if(persist(latest.current.cues.map(c=>c.id===latest.current.selected?{...c,name:label}:c)))notify('Nama cue diperbarui.');};
 const exportCues=()=>download(new Blob([JSON.stringify({format:'soma-organic',version:1,cues:latest.current.cues},null,2)],{type:'application/json'}),'SOMA-Organic-cues-v1.json');
 const importCues=async(file?:File)=>{if(!file)return;try{if(file.size>100000)throw Error('Pustaka terlalu besar. Maksimal 100 KB.');const list=readPerformance(JSON.parse(await file.text()));if(persist(list)){setSelected(list[0]?.id??'');setName(list[0]?.name??'Adegan 01');notify('Pustaka diimpor. Tekan GO untuk memainkan cue.');}}catch(e){notify((e as Error).message);}};
 const actions=useRef({freeze,go});actions.current={freeze,go};
 useEffect(()=>{if(!active)return;const key=(e:KeyboardEvent)=>{if(e.repeat||e.ctrlKey||e.metaKey||e.altKey||(e.target as HTMLElement).closest('input,textarea,select,[contenteditable=true]')||document.querySelector('dialog[open]'))return;if(['BracketLeft','BracketRight','KeyZ'].includes(e.code)){e.preventDefault();e.stopImmediatePropagation();if(e.code==='KeyZ')actions.current.freeze();else actions.current.go(e.code==='BracketRight'?1:-1);}};document.addEventListener('keydown',key,true);return()=>document.removeEventListener('keydown',key,true);},[active]);
 return {config,update,process,status,error,reset,freeze,partner,clearResidue,clearMemory,cues,selected,setSelected,name,setName,save,duplicate,rename,recall,go,exportCues,importCues};
}
export type OrganicControls=ReturnType<typeof useOrganic>;
