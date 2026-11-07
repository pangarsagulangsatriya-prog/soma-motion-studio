export type OrganicMode='normal'|'stretch'|'shrink'|'split'|'merge';
export type OrganicConfig={enabled:boolean;mode:OrganicMode;control:'manual'|'motion';intensity:number;shrink:number;axis:'horizontal'|'vertical'|'motion';anchor:'center'|'head'|'shoulder'|'hip'|'hand';falloff:'local'|'global';recoveryMs:number;splitMode:'horizontal'|'vertical'|'anatomical';slices:number;separation:number;offsetAxis:'horizontal'|'vertical';sliceDelayMs:number;rejoinMs:number;delayMs:number;echo:boolean;echoCount:number;echoSpacingMs:number;echoFade:number;mergeSource:'delay'|'frozen';mergeBlend:number;mergePull:number;mergeMethod:'union'|'interpolate';residue:boolean;residueMs:number;residueSpace:'screen'|'body';residueFade:boolean;transitionMs:number};
export const organicDefaults=():OrganicConfig=>({enabled:false,mode:'normal',control:'manual',intensity:1.6,shrink:.6,axis:'vertical',anchor:'shoulder',falloff:'local',recoveryMs:450,splitMode:'horizontal',slices:3,separation:.12,offsetAxis:'horizontal',sliceDelayMs:120,rejoinMs:650,delayMs:0,echo:false,echoCount:3,echoSpacingMs:450,echoFade:.6,mergeSource:'delay',mergeBlend:.65,mergePull:0,mergeMethod:'union',residue:false,residueMs:4500,residueSpace:'screen',residueFade:true,transitionMs:600});
export const organicNames:Record<OrganicMode,string>={normal:'Utuh',stretch:'Melar',shrink:'Mengerut',split:'Terbelah',merge:'Bergabung'};
export function validateOrganic(value:unknown):OrganicConfig{
 if(!value||typeof value!=='object')throw Error('Konfigurasi Organic tidak valid.');
 const c=value as OrganicConfig;
 for(const [key,options] of Object.entries({mode:Object.keys(organicNames),control:['manual','motion'],axis:['horizontal','vertical','motion'],anchor:['center','head','shoulder','hip','hand'],falloff:['local','global'],splitMode:['horizontal','vertical','anatomical'],offsetAxis:['horizontal','vertical'],mergeSource:['delay','frozen'],mergeMethod:['union','interpolate'],residueSpace:['screen','body']}))if(!options.includes(String(c[key as keyof OrganicConfig])))throw Error(`Pilihan ${key} tidak valid.`);
 for(const key of ['enabled','echo','residue','residueFade'] as const)if(typeof c[key]!=='boolean')throw Error(`Pilihan ${key} tidak valid.`);
 const limits={intensity:[1,3],shrink:[.25,1],recoveryMs:[50,2000],slices:[2,8],separation:[0,.5],sliceDelayMs:[0,500],rejoinMs:[50,2000],delayMs:[0,5000],echoCount:[1,6],echoSpacingMs:[100,1000],echoFade:[0,1],mergeBlend:[0,1],mergePull:[0,1],residueMs:[200,12000],transitionMs:[0,3000]};
 for(const [key,[min,max]] of Object.entries(limits)){const v=c[key as keyof OrganicConfig];if(typeof v!=='number'||!Number.isFinite(v)||v<min||v>max)throw Error(`Nilai ${key} di luar jangkauan.`);}
 if(!Number.isInteger(c.slices)||!Number.isInteger(c.echoCount))throw Error('Jumlah slice dan echo harus bulat.');
 // Copy only known fields. Imported files never carry physical calibration or pixels.
 return Object.fromEntries(Object.keys(organicDefaults()).map(k=>[k,c[k as keyof OrganicConfig]])) as OrganicConfig;
}
export type PerformancePreset={id:string;name:string;config:OrganicConfig;calibrationReference:string};
export function readPerformance(value:unknown):PerformancePreset[]{
 const v=value as {format?:string;version?:number;cues?:PerformancePreset[]};
 if(v?.format!=='soma-organic'||v.version!==1||!Array.isArray(v.cues)||v.cues.length>32)throw Error('Gunakan pustaka cue SOMA Organic v1, maksimal 32 cue.');
 const ids=new Set<string>();return v.cues.map(c=>{if(!c||typeof c.id!=='string'||!c.id||c.id.length>80||ids.has(c.id)||typeof c.name!=='string'||!c.name.trim()||c.name.length>60||typeof c.calibrationReference!=='string'||c.calibrationReference.length>60)throw Error('Nama atau identitas cue tidak valid.');ids.add(c.id);return {id:c.id,name:c.name.trim(),calibrationReference:c.calibrationReference,config:validateOrganic(c.config)};});
}
