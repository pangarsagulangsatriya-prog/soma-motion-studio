import type {Material} from '../studio/material';
export type Mode = 'theremin' | 'drone' | 'percussion' | 'lab';
export type HitKind = 'kick' | 'snare' | 'clap';
export type InputKind = 'hands' | 'body' | 'face' | 'mouse';
export type Character = 'clean' | 'raw' | 'metal' | 'metallic' | 'dark';
export type VisualStyle = 'trail' | 'fiber' | 'particles' | 'planes';
export type Source = 'camera' | 'mouse';
export type Landmark = { x:number; y:number; z:number; visibility?:number };
export type Feature = 'x'|'y'|'leftX'|'leftY'|'open'|'pinch'|'speed'|'acceleration'|'rotation'|'spread'|'lean'|'armRaise'|'bend'|'squat'|'stillness'|'direction'|'point'|'leftElbow'|'rightElbow'|'leftKnee'|'rightKnee'|'mouth'|'blink'|'headTilt';
export type Target = 'frequency'|'amplitude'|'filter'|'reverb'|'pan'|'modulation'|'delay'|'resonance'|'attack'|'release'|'modRate'|'roughness'|'weight'|'brightness';
export type VisualTarget = 'size'|'spread'|'rotation'|'energy'|'tension'|'density';
export type Instrument = OscillatorType | 'fm' | 'white' | 'pink';
export type MotionFrame = {telemetry?:{inferenceMs:number;pipelineMs:number;skippedFrames:number;backend:"worker"|"main";capturedAt:number;completedAt:number};projectionMask?:import('../studio/bodyField').BodyMask;segmentation?:import('../studio/bodyField').BodyMask;time:number; tracked:boolean; source:Source; features:Record<Feature,number>; hands:Landmark[][]; pose:Landmark[]; poses?:Landmark[][]; face:Landmark[]; handCount:number; quality:number; gesture:string; posture:string; events:HitKind[]; framing:boolean; fps:number};
export type MappingBase = {id:string; input:Feature; min:number; max:number; invert:boolean; sensitivity:number; smoothing:number; threshold:number; curve:'linear'|'log'|'ease'; enabled:boolean};
export type Mapping = MappingBase & {output:Target};
export type VisualMapping = MappingBase & {output:VisualTarget};
export type Settings = {
 hydra?:import('../studio/hydraConfig').HydraConfig;
 material?:Material;
 mode:Mode; input:InputKind; instrument:Instrument; character:Character; output:'sound'|'visual'|'both';
 macros:{roughness:number;weight:number;brightness:number;space:number};
 layers:{camera:boolean;tracking:'off'|'detected'|'trigger';background:string;gestureTrigger:boolean};
 visual:{enabled:boolean;style:VisualStyle;color:string;density:number;size:number;life:number;mappings:VisualMapping[]};
 master:number; sensitivity:number; smoothing:number; deadZone:number; cooldown:number; eventMap:Record<HitKind,HitKind|'off'>;
 attack:number; decay:number; sustain:number; release:number; resonance:number; reverb:number; delay:number; modulation:number; modRate:number; maxVoices:number;
 mirror:boolean; swapHands:boolean; poseInLab:boolean; mappings:Mapping[]; calibration:{minX:number;maxX:number;minY:number;maxY:number}|null;
};
export type AudioParams = Record<Target,number>;
export type VisualParams = Record<VisualTarget,number>;
export const uid=()=>crypto.randomUUID?.()??`${Date.now().toString(36)}-${Math.random().toString(36).slice(2)}`;
export const INPUTS:Record<InputKind,string>={hands:'Hands',body:'Body',face:'Face',mouse:'Mouse'};
export const CHARACTERS:Record<Character,{label:string;description:string;tag:string}>={
 clean:{label:'Clean',description:'Nada jernih. Gerak mengalir.',tag:'SINE / AIR'},
 raw:{label:'Raw',description:'Desis dekat. Gesekan kering.',tag:'NOISE / GRAIN'},
 metal:{label:'Metal',description:'Nada rendah. Distorsi rapat.',tag:'DRIVE / WEIGHT'},
 metallic:{label:'Metallic',description:'Denting pelat. Resonansi panjang.',tag:'PARTIAL / RING'},
 dark:{label:'Dark Drone',description:'Dengung rendah yang menetap.',tag:'SUB / DRONE'}
};
export const VISUALS:Record<VisualStyle,{label:string;description:string;tag:string}>={
 trail:{label:'Jejak',description:'Goresan mengikuti ujung gerak.',tag:'01 / TRACE'},
 fiber:{label:'Serat',description:'Garis melengkung dan membentang.',tag:'02 / FIBER'},
 particles:{label:'Butiran',description:'Sapuan melempar butiran kecil.',tag:'03 / PARTICLES'},
 planes:{label:'Bidang',description:'Geometri berputar dan meregang.',tag:'04 / PLANES'}
};
export const FEATURES:Record<Feature,string>={x:'Posisi X',y:'Ketinggian',leftX:'Tangan kiri · X',leftY:'Tangan kiri · tinggi',open:'Telapak terbuka',pinch:'Jepitan jari',speed:'Kecepatan gerak',acceleration:'Percepatan',rotation:'Putaran telapak',spread:'Jarak dua tangan',lean:'Kemiringan tubuh',armRaise:'Ketinggian lengan',bend:'Bungkuk tubuh',squat:'Tekukan lutut',stillness:'Tubuh diam',direction:'Arah gerak',point:'Jari menunjuk',leftElbow:'Sudut siku kiri',rightElbow:'Sudut siku kanan',leftKnee:'Sudut lutut kiri',rightKnee:'Sudut lutut kanan',mouth:'Bukaan mulut',blink:'Kedipan',headTilt:'Kemiringan kepala'};
export const featureAvailable=(input:InputKind,f:Feature)=>{
 if(['x','y','speed','acceleration','stillness','direction'].includes(f))return true;
 if(input==='mouse')return ['open','pinch','rotation','spread','leftX','leftY'].includes(f);
 if(input==='hands')return ['leftX','leftY','open','pinch','rotation','spread','point'].includes(f);
 if(input==='body')return ['leftX','leftY','spread','lean','armRaise','bend','squat','leftElbow','rightElbow','leftKnee','rightKnee'].includes(f);
 return ['mouth','blink','headTilt'].includes(f);
};
export const TARGETS:Record<Target,{label:string;min:number;max:number;unit:string}>={frequency:{label:'Pitch',min:30,max:2000,unit:'Hz'},amplitude:{label:'Volume',min:0,max:1,unit:''},filter:{label:'Filter cutoff',min:80,max:12000,unit:'Hz'},reverb:{label:'Ruang / reverb',min:0,max:.85,unit:''},pan:{label:'Stereo pan',min:-1,max:1,unit:''},modulation:{label:'FM depth',min:0,max:600,unit:'Hz'},delay:{label:'Delay feedback',min:0,max:.65,unit:''},resonance:{label:'Resonance',min:.1,max:15,unit:''},attack:{label:'Attack',min:.005,max:2,unit:'s'},release:{label:'Release',min:.03,max:3,unit:'s'},modRate:{label:'FM ratio',min:.1,max:8,unit:'×'},roughness:{label:'Kekasaran',min:0,max:1,unit:''},weight:{label:'Berat',min:0,max:1,unit:''},brightness:{label:'Ketajaman',min:0,max:1,unit:''}};
export const VISUAL_TARGETS:Record<VisualTarget,{label:string;min:number;max:number;unit:string}>={size:{label:'Ukuran / tebal',min:0,max:1,unit:''},spread:{label:'Bentangan',min:0,max:1,unit:''},rotation:{label:'Putaran',min:-1,max:1,unit:''},energy:{label:'Sebaran gerak',min:0,max:1,unit:''},tension:{label:'Tarikan',min:0,max:1,unit:''},density:{label:'Kepadatan',min:0,max:1,unit:''}};
export const defaultEvents=(mode:Mode):Record<HitKind,HitKind|'off'>=>({kick:mode==='drone'?'off':'kick',snare:mode==='percussion'||mode==='lab'?'snare':'off',clap:mode==='percussion'||mode==='lab'?'clap':'off'});
const map=(id:string,input:Feature,output:Target,min:number,max:number,curve:MappingBase['curve']='linear'):Mapping=>({id,input,output,min,max,curve,invert:false,sensitivity:1,smoothing:.035,threshold:0,enabled:true});
export const defaultMappings=(mode:Mode,input?:InputKind):Mapping[]=>input==='face'?[map('pitch','y','frequency',110,440,'log'),map('level','mouth','amplitude',.03,.65),map('pan','headTilt','pan',-1,1),map('tone','blink','filter',6000,500,'log')]:input==='body'||(!input&&mode==='drone')?[map('pitch','armRaise','frequency',55,220,'log'),map('level','stillness','amplitude',.12,.4),map('pan','lean','pan',-1,1),map('tone','bend','filter',3200,220,'log')]:mode==='percussion'?[map('level','speed','amplitude',.25,.9),map('space','spread','reverb',.05,.5)]:[map('pitch','y','frequency',110,880,'log'),map('level','x','amplitude',.08,.55),map('tone','pinch','filter',6000,180,'log'),map('space','spread','reverb',.05,.65)];
export const defaultVisualMappings=(input:InputKind='hands'):VisualMapping[]=>{
 const v=(id:string,f:Feature,o:VisualTarget,min:number,max:number):VisualMapping=>({...map(id,f,'amplitude',min,max),output:o,smoothing:.07});
 return input==='face'?[v('v-size','mouth','size',.15,.85),v('v-rotate','headTilt','rotation',-1,1),v('v-energy','speed','energy',.05,.8)]:[
 v('v-size','speed','size',.12,.85),v('v-spread','spread','spread',.15,1),v('v-energy','speed','energy',.04,1),v('v-tension',input==='body'?'armRaise':'pinch','tension',0,1)];
};
export const characterPatch=(character:Character):Partial<Settings>=>{
 const values:Record<Character,[number,number,number,number,number,number]>={clean:[.05,.3,.72,.2,.07,.32],raw:[.65,.45,.55,.12,.025,.18],metal:[.8,.8,.6,.15,.008,.12],metallic:[.32,.35,.85,.5,.008,1.1],dark:[.4,.9,.25,.55,.4,1.8]};
 const [roughness,weight,brightness,space,attack,release]=values[character];
 return {character,macros:{roughness,weight,brightness,space},reverb:space*.85,attack,release};
};
export const defaults=():Settings=>({mode:'theremin',input:'hands',instrument:'sine',character:'clean',output:'both',macros:{roughness:.05,weight:.3,brightness:.72,space:.2},layers:{camera:false,tracking:'detected',background:'#090c0b',gestureTrigger:false},visual:{enabled:true,style:'fiber',color:'#cedf89',density:.5,size:.4,life:1.7,mappings:defaultVisualMappings()},master:.4,sensitivity:1,smoothing:.045,deadZone:.0025,cooldown:300,eventMap:defaultEvents('theremin'),attack:.07,decay:.22,sustain:.8,release:.32,resonance:1.2,reverb:.17,delay:0,modulation:80,modRate:2.01,maxVoices:6,mirror:true,swapHands:false,poseInLab:false,mappings:defaultMappings('theremin'),calibration:null});
export const emptyFrame=(source:Source='camera'):MotionFrame=>({time:0,tracked:false,source,features:{x:.5,y:.5,leftX:.5,leftY:.5,open:0,pinch:0,speed:0,acceleration:0,rotation:.5,spread:0,lean:.5,armRaise:0,bend:0,squat:0,stillness:1,direction:.5,point:0,leftElbow:0,rightElbow:0,leftKnee:0,rightKnee:0,mouth:0,blink:0,headTilt:.5},hands:[],pose:[],face:[],handCount:0,quality:0,gesture:'Menunggu gerak',posture:'',events:[],framing:true,fps:0});
