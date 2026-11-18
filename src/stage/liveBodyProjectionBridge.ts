/**
 * S0.6.5 — Live BODY projection continuity bridge for the primary MP4 stage.
 *
 * This is the single safety boundary between persisted A/B masks and the
 * clean BODY software raster. A raw pose, predicted position or optical flow
 * cannot grant A/B identity. No contact/floor events or hardware approval.
 */
import type {BodyMaskActor,BodyMaskPresentation} from './persistentBodyMaskEngine.ts';
import type {PersistentActorState} from './persistentActorRegistry.ts';
import type {VideoActorState,VideoActorId} from './videoAutoActorTracker.ts';

export type BodyOutputActorStatus='live'|'continuity'|'held'|'blocked'|'missing';
export type BodyOutputActorGate={
 id:VideoActorId;status:BodyOutputActorStatus;reason:string;
 sourceAtMs:number|null;alpha:number;
};
export type BodyProjectionFrame={
 atMs:number;segment:number|null;actors:BodyMaskActor[];
 gates:BodyOutputActorGate[];
 source:'software-video';physicalOutputAllowed:false;
};
export type BodyProjectionInput={
 atMs:number;segment:number;
 masks:BodyMaskPresentation;
 actorStates:readonly VideoActorState[];
 persistentActors:readonly PersistentActorState[];
};

/** Short visual continuity for already measured A/B; never reidentify here. */
const HELD_LIMIT_MS=260;
const FLOW_LIMIT_MS=850;
const FADE_HELD_START_MS=90;
const clamp=(n:number)=>Math.max(0,Math.min(1,n));
const IDS=['A','B'] as const;

export class LiveBodyProjectionBridge{
 private segment:number|null=null;
 private lastTime=-1;
 reset(){this.segment=null;this.lastTime=-1;}
 present(input:BodyProjectionInput):BodyProjectionFrame{
  const {atMs,segment,masks,actorStates,persistentActors}=input;
  if(!Number.isFinite(atMs)||atMs<0||
   !Number.isFinite(segment)||masks.source!=='software-video'||
   masks.physicalOutputAllowed!==false||
   !Number.isFinite(masks.atMs)||Math.abs(masks.atMs-atMs)>35){
   return this.blank(atMs,segment,'Frame BODY tidak sinkron.');
  }
  if(this.segment!==null&&segment!==this.segment)this.reset();
  if(this.lastTime>=0&&atMs<this.lastTime-35){
   this.reset();
   return this.blank(atMs,segment,'Seek video: tunggu tracking baru.');
  }
  this.segment=segment;
  this.lastTime=Math.max(this.lastTime,atMs);
  const actors:BodyMaskActor[]=[];
  const gates:BodyOutputActorGate[]=[];
  const usedAnchors=new Set<string>();
  for(const id of IDS){
   const status=actorStates.find(a=>a.id===id);
   const registered=persistentActors.find(a=>a.id===id);
   const candidates=masks.actors.filter(a=>a.id===id);
   const mask=candidates.length===1?candidates[0]:null;
   const anchor=registered?.lastObservedAtMs??null;
   const age=anchor===null?Infinity:atMs-anchor;
   let reason='Aktor belum memiliki pengukuran.';
   let mode:BodyOutputActorStatus='missing';
   let alpha=0;
   if(!status||!registered?.registered||anchor===null||!registered.lastPose||
    !mask||!Number.isFinite(age)||age< -35){
    reason='Mask atau identitas terukur belum tersedia.';
   }else if(status.presence==='uncertain'||status.presence==='reacquiring'||
    status.presence==='lost'||status.presence==='not-detected'){
    mode='blocked';reason='Identitas A/B belum aman.';
   }else if(!['visible','occluded'].includes(status.presence)){
    mode='blocked';reason='Status aktor tidak dikenal.';
   }else if(mask.sourceAtMs!==anchor||mask.atMs!==masks.atMs||
    mask.sourceAtMs>atMs+35||mask.alpha<=0||
    !Number.isFinite(mask.alpha)||!Number.isFinite(mask.confidence)||
    mask.confidence<.46||mask.polygons.length===0){
    mode='blocked';reason='Mask tidak cocok dengan pengukuran A/B.';
   }else if(mask.mode==='measured'&&status.presence==='visible'&&
    registered.observed&&age<=180&&!mask.tentative){
    mode='live';reason='Pengukuran tubuh A/B terverifikasi.';
    alpha=mask.alpha;
   }else if(mask.mode==='propagated'&&status.presence==='visible'&&
    age<=FLOW_LIMIT_MS){
    mode='continuity';reason='Mask mengikuti optical flow aktor yang sama.';
    alpha=mask.alpha;
   }else if((status.presence==='visible'||status.presence==='occluded')&&
    mask.mode==='held'&&age<=HELD_LIMIT_MS){
    // 12 FPS inference may leave ~80ms between observations. A still-visible
    // verified actor must not black-flash between measured and flow frames.
    // This bounded visual hold grants no new identity or physical output.
    mode='held';reason='Mask terukur terakhir ditahan singkat sampai frame berikutnya.';
    alpha=mask.alpha*clamp((HELD_LIMIT_MS-age)/
     (HELD_LIMIT_MS-FADE_HELD_START_MS));
   }else{
    mode='blocked';reason='Mask melampaui batas kontinuitas.';
   }
   if(alpha>0&&mask){
    const key=id+':'+mask.sourceAtMs;
    if(!usedAnchors.has(key)){
     usedAnchors.add(key);
     actors.push({...mask,alpha:clamp(alpha),
      // Optical flow backed by this actor's own anchor remains identity-colored.
      // Only held/occluded silhouettes use the neutral uncertainty palette.
      tentative:mode==='held'&&status.presence!=='visible'});
    }else{
     mode='blocked';reason='Mask duplikat ditahan.';alpha=0;
    }
   }
   gates.push({id,status:mode,reason,sourceAtMs:anchor,alpha:clamp(alpha)});
  }
  // Two overlapping body masks cannot both be assigned to independent
  // projector pixels. Block the weaker/tentative actor rather than blend IDs.
  if(actors.length===2){
   const [a,b]=actors;
   const overlapX=Math.max(0,Math.min(a.bounds.maxX,b.bounds.maxX)-
    Math.max(a.bounds.minX,b.bounds.minX));
   const overlapY=Math.max(0,Math.min(a.bounds.maxY,b.bounds.maxY)-
    Math.max(a.bounds.minY,b.bounds.minY));
   const areaA=(a.bounds.maxX-a.bounds.minX)*(a.bounds.maxY-a.bounds.minY);
   const areaB=(b.bounds.maxX-b.bounds.minX)*(b.bounds.maxY-b.bounds.minY);
   if(areaA>0&&areaB>0&&overlapX*overlapY/Math.min(areaA,areaB)>.32){
    // Even two fresh masks are held when the image cannot separate the bodies.
    actors.splice(0,actors.length);
    for(const gate of gates){
     gate.status='blocked';gate.reason='Mask A/B saling tumpang tindih.';
     gate.alpha=0;
    }
   }
  }
  return {atMs,segment,actors,gates,
   source:'software-video',physicalOutputAllowed:false};
 }
 private blank(atMs:number,segment:number|null,reason:string):BodyProjectionFrame{
  return {atMs,segment,actors:[],source:'software-video',
   physicalOutputAllowed:false,gates:IDS.map(id=>({
    id,status:'blocked',reason,sourceAtMs:null,alpha:0
   }))};
 }
}
