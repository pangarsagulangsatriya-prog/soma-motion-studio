import type {VideoActorId} from './videoAutoActorTracker.ts';
import type {ReplayGaitEvent} from './videoGaitAnalysis.ts';
import type {ReplayOverlayPerson} from './VideoPoseGaitEngine.ts';
import type {TemporalActorSample,TemporalFrame,TemporalJoint} from './temporalJointIntelligence.ts';

/**
 * S6.8.8.6 — event hypotheses from measured changes in locally observed
 * 2D image coordinates. No contact force, calibrated distance, or true
 * 3D rotation is inferred. Existing gait event hypotheses are reused.
 */
export type MotionSemanticKind='contact'|'swing'|'pivot'|'reach'|'bend'|'turn'|'hold';
export type MotionSemanticSource='gait-2d-estimate'|'joint-2d-estimate';
export type SemanticSide='left'|'right'|'body'|'left-arm'|'right-arm'|'left-leg'|'right-leg';
export type MotionSemanticEvent={
 id:string;segment:number;atMs:number;actor:VideoActorId;kind:MotionSemanticKind;
 side:SemanticSide;confidence:number;durationMs:number;
 value:number;threshold:number;unit:string;evidence:string;
 source:MotionSemanticSource;
};
export type MotionSemanticStatus={
 actor:VideoActorId;kind:MotionSemanticKind;side:SemanticSide;
 active:boolean;sinceMs:number|null;value:number|null;threshold:number;unit:string;
};
type Metric={value:number;threshold:number;unit:string;confidence:number;
 evidence:string;active:boolean;released:boolean;minMs:number};
type Transition={active:boolean;startMs:number;streak:number;lastEmitMs:number};
type ActorCache={orientation:number|null;angleValues:Map<number,{angle:number;atMs:number}>};
export const SEMANTIC_KINDS:MotionSemanticKind[]=
 ['contact','swing','pivot','reach','bend','turn','hold'];
export const SEMANTIC_MAX_EVENTS=1600;
export const SEMANTIC_STALE_MS=450;
export const SEMANTIC_HOLD_MIN_MS=650;
export const SEMANTIC_CONFIRM_FRAMES=2;
const IDS:VideoActorId[]=['A','B'];
const MIN_EVENT_CONFIDENCE=.65;
const norm=(x:number,y:number)=>Math.hypot(x,y);
const finite=(v:number|null|undefined):v is number=>v!==null&&
 v!==undefined&&Number.isFinite(v);
const clamp=(x:number)=>Math.max(0,Math.min(1,x));
const degrees=(n:number)=>n*180/Math.PI;
const deltaAngle=(a:number,b:number)=>((a-b+540)%360)-180;
const get=(s:TemporalActorSample,i:number):TemporalJoint|undefined=>
 s.joints.find(j=>j.index===i);
const distance=(a:TemporalJoint,b:TemporalJoint)=>norm(
 a.smoothX-b.smoothX,a.smoothY-b.smoothY);
const confidence=(...joints:TemporalJoint[])=>clamp(
 Math.min(...joints.map(j=>j.visibility)));

function reach(s:TemporalActorSample,side:'left'|'right'):Metric|null{
 const left=side==='left',shoulder=get(s,left?11:12),
  hip=get(s,left?23:24),wrist=get(s,left?15:16);
 if(!shoulder||!hip||!wrist)return null;
 const torso=distance(shoulder,hip);
 if(torso<.035)return null;
 const extension=distance(wrist,shoulder)/torso;
 if(![shoulder.vx,shoulder.vy,wrist.vx,wrist.vy].every(finite))return null;
 const dx=wrist.smoothX-shoulder.smoothX,dy=wrist.smoothY-shoulder.smoothY;
 const length=norm(dx,dy);
 if(length<.0001)return null;
 const radial=((wrist.vx!-shoulder.vx!)*dx+(wrist.vy!-shoulder.vy!)*dy)/length;
 return {value:extension,threshold:1.35,unit:'rasio panjang torso',
  confidence:confidence(shoulder,hip,wrist),
  evidence:'Ekstensi tangan '+side+' '+extension.toFixed(2)+
   '×torso; gerak menjauh '+radial.toFixed(3)+' unit gambar/dtk',
  active:extension>=1.35&&radial>=.035,
  released:extension<=1.12||radial<-.06,minMs:95};
}
function bend(s:TemporalActorSample,joint:number,previous:Map<number,{angle:number;atMs:number}>,
 now:number):Metric|null{
 const angle=s.angles.find(a=>a.joint===joint)?.degrees;
 const old=previous.get(joint);
 if(!finite(angle))return null;
 const dt=old?(now-old.atMs)/1000:0;
 const bendRate=old&&dt>.005&&dt<=SEMANTIC_STALE_MS/1000?
  (old.angle-angle)/dt:null;
 previous.set(joint,{angle,atMs:now});
 if(bendRate===null)return null;
 const jointName=joint===13?'siku kiri':joint===14?'siku kanan':
  joint===25?'lutut kiri':'lutut kanan';
 const indices=joint===13?[11,13,15]:joint===14?[12,14,16]:
  joint===25?[23,25,27]:[24,26,28];
 const visible=s.joints.filter(j=>indices.includes(j.index));
 if(visible.length!==3)return null;
 return {value:180-angle,threshold:48,unit:'derajat fleksi 2D',
  confidence:confidence(...visible),
  evidence:jointName+' fleksi '+(180-angle).toFixed(1)+'°; perubahan '+
   bendRate.toFixed(1)+'°/dtk',
  active:180-angle>=48&&bendRate>=16,
  released:180-angle<32||bendRate< -18,minMs:80};
}
function turn(s:TemporalActorSample,cache:ActorCache,dt:number):Metric|null{
 const a=get(s,11),b=get(s,12);
 if(!a||!b)return null;
 const current=degrees(Math.atan2(
  b.smoothY-a.smoothY,b.smoothX-a.smoothX));
 const previous=cache.orientation;
 cache.orientation=current;
 if(!finite(previous)||dt<=.005||dt>SEMANTIC_STALE_MS/1000)return null;
 const rate=deltaAngle(current,previous)/dt;
 return {value:Math.abs(rate),threshold:35,unit:'derajat/dtk (sumbu bahu 2D)',
  confidence:confidence(a,b),
  evidence:'Orientasi sumbu bahu berubah '+rate.toFixed(1)+'°/dtk',
  active:Math.abs(rate)>=35,released:Math.abs(rate)<13,minMs:80};
}
function hold(s:TemporalActorSample):Metric|null{
 const anchors=[11,12,23,24].map(i=>get(s,i));
 if(anchors.some(j=>!j||!finite(j.speed)))return null;
 // Both shoulders and hips must remain near stationary. A hand moving
 // does not by itself invalidate a still torso; leg movement does.
 const legs=[27,28].map(i=>get(s,i)).filter((j):j is TemporalJoint=>
  !!j&&finite(j.speed));
 if(legs.length<1)return null;
 const present=[...(anchors as TemporalJoint[]),...legs];
 const speed=Math.max(...present.map(j=>j.speed!));
 return {value:speed,threshold:.035,unit:'unit gambar/dtk',
  confidence:confidence(...present),
  evidence:'Bahu, pinggul, dan kaki bertahan pada kecepatan ≤ '+
   speed.toFixed(3)+' unit gambar/dtk',
  active:speed<=.035,released:speed>.07,minMs:SEMANTIC_HOLD_MIN_MS};
}
const label=(kind:MotionSemanticKind,side:SemanticSide)=>
 kind+':'+side;
const threshold=(metric:Metric,person:ReplayOverlayPerson)=>
 ({...metric,confidence:clamp(Math.min(metric.confidence,person.confidence))});
export class MotionSemanticsEngine{
 private transitions=new Map<VideoActorId,Map<string,Transition>>();
 private caches=new Map<VideoActorId,ActorCache>();
 private events:MotionSemanticEvent[]=[];
 private states:MotionSemanticStatus[]=[];
 private lastMs=-1;
 reset(){this.transitions.clear();this.caches.clear();this.events=[];this.states=[];this.lastMs=-1;}
 get history(){return this.events.map(e=>({...e}));}
 get statuses(){return this.states.map(s=>({...s}));}
 get count(){return this.events.length;}
 observe(frame:TemporalFrame,approved:readonly ReplayOverlayPerson[],
  gaitEvents:readonly ReplayGaitEvent[],segment:number):MotionSemanticEvent[]{
  const now=frame.atMs;
  if(!Number.isFinite(now)||now<0||now<=this.lastMs)
   throw Error('Timestamp motion semantics harus terus maju.');
  if(this.lastMs>=0&&now-this.lastMs>SEMANTIC_STALE_MS){
   this.transitions.clear();this.caches.clear();
  }
  const dt=this.lastMs>=0?(now-this.lastMs)/1000:0;
  this.lastMs=now;
  const emitted:MotionSemanticEvent[]=[];
  this.states=[];
  for(const id of IDS){
   const person=approved.find(p=>p.id===id);
   const sample=frame.actors.find(s=>s.id===id);
   // Reset only the unapproved actor. This protects the other actor and
   // prevents events bridging an identity swap, occlusion, or seek.
   if(!person||!sample||sample.presence!=='visible'){
    this.transitions.delete(id);this.caches.delete(id);continue;
   }
   const cache=this.caches.get(id)??{orientation:null,angleValues:new Map()};
   this.caches.set(id,cache);
   const current=this.transitions.get(id)??new Map<string,Transition>();
   this.transitions.set(id,current);
   const examine=(kind:MotionSemanticKind,side:SemanticSide,
    measurement:Metric|null)=>{
    const key=label(kind,side);
    const old=current.get(key)??{active:false,startMs:-1,streak:0,lastEmitMs:-Infinity};
    if(!measurement){
     current.delete(key);return;
    }
    const m=threshold(measurement,person);
    // Both the observed joint and the A/B identity must pass. A low
    // identity confidence may never emit a semantic event.
    if(m.confidence<MIN_EVENT_CONFIDENCE){
     current.delete(key);return;
    }
    if(!m.active){
     if(m.released){old.active=false;old.startMs=-1;old.streak=0;}
     else if(!old.active){old.streak=0;old.startMs=-1;}
    }else{
     if(!old.active){
      if(old.streak===0)old.startMs=now;
      old.streak++;
      const durationMs=Math.max(0,now-old.startMs);
      if(old.streak>=SEMANTIC_CONFIRM_FRAMES&&
       durationMs>=m.minMs&&now-old.lastEmitMs>=450){
       old.active=true;old.lastEmitMs=now;
       emitted.push({id:['semantic',segment,id,kind,side,Math.round(now)].join(':'),
        segment,atMs:Math.round(now),actor:id,kind,side,
        confidence:clamp(m.confidence),durationMs:Math.round(durationMs),
        value:m.value,threshold:m.threshold,unit:m.unit,evidence:m.evidence,
        source:'joint-2d-estimate'});
      }
     }
    }
    current.set(key,old);
    this.states.push({actor:id,kind,side,active:old.active,
     sinceMs:old.active?old.startMs:null,value:m.value,
     threshold:m.threshold,unit:m.unit});
   };
   for(const side of ['left','right'] as const){
    examine('reach',side,reach(sample,side));
   }
   for(const [idx,side] of [[13,'left-arm'],[14,'right-arm'],
    [25,'left-leg'],[26,'right-leg']] as const){
    examine('bend',side,bend(sample,idx,cache.angleValues,now));
   }
   examine('turn','body',turn(sample,cache,dt));
   examine('hold','body',hold(sample));
  }
  // Contact, Swing, and Pivot reuse SOMA's actual gait phase transitions.
  // They cannot be generated from pose appearance alone.
  for(const gait of gaitEvents){
   if(gait.atMs>now+5||Math.abs(gait.atMs-now)>350)continue;
   if(gait.kind!=='contact'&&gait.kind!=='swing'&&gait.kind!=='pivot')continue;
   if(!approved.some(p=>p.id===gait.performer))continue;
   emitted.push({id:['semantic',segment,gait.performer,gait.kind,gait.foot,
    Math.round(gait.atMs)].join(':'),segment,atMs:gait.atMs,
    actor:gait.performer,kind:gait.kind,side:gait.foot,
    confidence:clamp(gait.confidence),durationMs:0,value:1,threshold:1,
    unit:'transisi fase gait',evidence:'Transisi '+gait.kind+
    ' kaki '+gait.foot+' pada koordinat 2D',
    source:'gait-2d-estimate'});
  }
  this.events.push(...emitted);
  if(this.events.length>SEMANTIC_MAX_EVENTS)
   this.events.splice(0,this.events.length-SEMANTIC_MAX_EVENTS);
  return emitted.map(e=>({...e}));
 }
}
export function semanticEventCounts(events:readonly MotionSemanticEvent[]){
 const result:Record<MotionSemanticKind,number>={
  contact:0,swing:0,pivot:0,reach:0,bend:0,turn:0,hold:0
 };
 for(const event of events)result[event.kind]++;
 return result;
}
export function motionSemanticsCsv(events:readonly MotionSemanticEvent[]):string{
 const cols=['video_ms','segment','actor','kind','side','confidence','duration_ms',
  'value','threshold','unit','evidence','source'];
 const safe=(value:unknown)=>{
  const text=String(value??'');
  return '"'+text.replaceAll('"','""')+'"';
 };
 return [cols.join(','),...events.map(e=>[
  e.atMs,e.segment,e.actor,e.kind,e.side,e.confidence,e.durationMs,
  e.value,e.threshold,e.unit,e.evidence,e.source
 ].map(safe).join(','))].join('\r\n')+'\r\n';
}
