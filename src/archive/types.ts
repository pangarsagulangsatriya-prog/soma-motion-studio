import type {Landmark} from '../engine/types.ts';

export type Language = 'nl'|'id'|'other';
export type ArchiveKind = 'text'|'image'|'video';
export type ActorId = 'A'|'B';
export type ArchiveSource = {
 id:string; kind:ArchiveKind; title:string; author:string; year:string; citation:string;
 language:Language; readonly originalText:string; workingTranslation:string;
 provenance:'transcribed-from-user-image'|'working-transcription-secondary'|'user-supplied'|'primary-verified';
 rights:string; notes:string; assetId?:string; createdAt:string; revisionOf?:string;
};
export type VoiceTrack = {id:string;sourceId:string;language:'nl'|'id';assetId:string;reader:string;recordedAt:string;method:string;gain:number;durationMs:number;cutoff?:number;texture?:number};
export type VoiceSegment = {id:string;trackId:string;text:string;startMs:number;endMs:number};
export type Asset = {id:string;name:string;mime:string;size:number;kind:'audio'|'image'|'video';createdAt:string;blob:Blob};
export type Calibration = {floorY:number;standingHipY:number;left:number;right:number;top:number;bottom:number;stillSpeed:number;confidence:number;lostHoldMs:number};
export type Actor = {
 id:ActorId; visible:boolean; confidence:number; uncertain:boolean; lastSeen:number;
 x:number;y:number;hipHeight:number;horizontal:number;stillMs:number;speed:number;vx:number;vy:number;
 wristX:number;wristY:number;landmarks:Landmark[];
};
export type FeatureSnapshot = {sequence:number;timestampMs:number;source:'camera'|'mouse'|'manual';actors:Actor[];distance:number|null;uncertain:boolean};
export type ManualActor = {visible:boolean;x:number;y:number;hipHeight:number;horizontal:number;stillMs:number;vx:number;vy:number};
export type RuleFeature = 'low-still'|'swipe'|'still'|'distance'|'height'|'manual';
export type TextAction = 'accumulate'|'compress'|'scatter'|'displace'|'swarm'|'reveal'|'judgment';
export type AudioAction = 'none'|'once'|'loop'|'scrub'|'crossfade';
export type ArchiveRule = {
 id:string;name:string;enabled:boolean;actor:ActorId|'both'|'manual';feature:RuleFeature;
 threshold:number;hysteresis:number;dwellMs:number;cooldownMs:number;smoothingMs:number;
 durationMs:number;returnMs:number;intensity:number;invert:boolean;resetOnRelease:boolean;
 targetWords:string;textAction:TextAction;audioAction:AudioAction;segmentIds:string[];
 lowHeight:number;horizontal:number;stillMs:number;lost:'hold-then-fade'|'release'|'manual-only';
};
export type RuleEffect = {id:string;type:TextAction;amount:number;value:number;triggered:boolean;live:boolean;direction:number;x:number;y:number;targetWords:string;ageMs:number};
export type Cue = {
 id:string;label:string;sourceId:string;ruleIds:string[];language:'nl'|'id'|'both';
 layout:'text'|'split'|'media'|'live-photo';durationMs:number;autoNext:boolean;
 onGo:'none'|'read'|'judgment'|'capture'|'restore';resetOnEnter:boolean;skeleton:'off'|'detected'|'cue';
 mediaId?:string;mediaAction:'original'|'reveal'|'overlay'|'pan';mediaStartMs:number;
 showCitation:boolean;
};
export type StageAction = 'go'|'next'|'back'|'hold'|'restore'|'freeze'|'blank'|'mute';
export type ArchiveProject = {
 archiveProjectVersion:1;id:string;title:string;sources:ArchiveSource[];tracks:VoiceTrack[];segments:VoiceSegment[];
 rules:ArchiveRule[];cues:Cue[];calibration:Calibration;
 output:{ratio:number;safeArea:number;fontSize:number;lineHeight:number;scale:number;ink:string;showComposition:boolean};
 shortcuts:Record<StageAction,string>;
};
export type StageState = {index:number;phase:'ready'|'running'|'hold';enteredAt:number;elapsedMs:number;freeze:boolean;blank:boolean;generation:number};
export type RenderState = {
 sessionId:string;sequence:number;cueId:string;cueLabel:string;stage:StageState;timestampMs:number;
 source:ArchiveSource|null;language:Cue['language'];layout:Cue['layout'];effects:RuleEffect[];
 snapshot:FeatureSnapshot;output:ArchiveProject['output'];skeleton:Cue['skeleton'];trackingOn:boolean;
 showCitation:boolean;mediaId?:string;mediaRevision?:number;mediaAction:Cue['mediaAction'];mediaTimeMs:number;
};
export const emptyActor=(id:ActorId):Actor=>({id,visible:false,confidence:0,uncertain:false,lastSeen:0,x:.5,y:.5,hipHeight:1,horizontal:0,stillMs:0,speed:0,vx:0,vy:0,wristX:.5,wristY:.5,landmarks:[]});
export const emptySnapshot=():FeatureSnapshot=>({sequence:0,timestampMs:0,source:'manual',actors:[emptyActor('A'),emptyActor('B')],distance:null,uncertain:false});
export const manualActor=():ManualActor=>({visible:true,x:.35,y:.55,hipHeight:1,horizontal:0,stillMs:0,vx:0,vy:0});
export const FEATURE_LABELS:Record<RuleFeature,string>={'low-still':'Rendah + horizontal + diam',swipe:'Sapuan pergelangan',still:'Durasi diam',distance:'Jarak dua aktor',height:'Tinggi pinggul',manual:'Pemicu operator'};
export const ACTION_LABELS:Record<TextAction,string>={accumulate:'Rapat + ulang kata',compress:'Rapatkan baris',scatter:'Tepis kata',displace:'Geser kata',swarm:'Kumpulkan di tubuh',reveal:'Buka / sembunyikan',judgment:'Tampilkan penilaian'};
export const AUDIO_LABELS:Record<AudioAction,string>={none:'Diam',once:'Putar sekali',loop:'Ulang potongan',scrub:'Geser posisi potongan',crossfade:'Silang Belanda–Indonesia'};
