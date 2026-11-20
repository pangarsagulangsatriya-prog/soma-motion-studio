/** CP-08: scene sources remain tied to canonical SOMA artistic recipes.
 * Each composed scene has an independent runtime/event history, not a copied
 * static catalogue SVG. This path is software-preview only.
 */
import {ARTISTIC_CATALOG,validateCatalogSceneId,type CatalogSceneId} from '../../footprints/scenes/artisticCatalog.ts';
import {ArtisticFootprintRuntime} from '../../footprints/scenes/ArtisticFootprintRuntime.ts';
import type {FootMotionEventV2} from '../../footprints/scenes/FootMotionEventV2.ts';
import type {TimelineEvent} from './composerEventTimelineModel.ts';

export const SCENE_SOURCE_PREFIX='@scene:' as const;
export type SceneAction='apply'|'replace'|'add';
export const sceneSourceId=(id:CatalogSceneId)=>SCENE_SOURCE_PREFIX+id;
export function sceneIdFromSource(id:string):CatalogSceneId|null{
 if(!id.startsWith(SCENE_SOURCE_PREFIX))return null;
 const value=id.slice(SCENE_SOURCE_PREFIX.length);
 return validateCatalogSceneId(value)?value:null;
}
export function sceneLayerDescriptor(id:CatalogSceneId){
 const recipe=ARTISTIC_CATALOG.find(r=>r.id===id);
 if(!recipe)throw Error('Scene tidak ditemukan.');
 return {mediaId:sceneSourceId(id),name:recipe.title,visible:true,opacity:75,
  blend:'screen' as const};
}
export function sceneActionPosition(action:Exclude<SceneAction,'apply'>,count:number,selected:number):number{
 if(action==='add')return Math.max(0,count);
 return Math.max(0,Math.min(Math.max(0,count-1),selected));
}
export function syntheticSceneEvents():FootMotionEventV2[]{
 return Array.from({length:5},(_,i)=>{
  const x=.18+i*.15,y=.75-i*.11,foot=i%2?'right' as const:'left' as const;
  return {schema:'soma.foot-motion-event',version:2,eventId:'cp08-demo-'+i,
   originEventId:'demo-'+i,sessionId:'cp08-thumbnail',generation:0,
   actorId:'A',foot,kind:'contact',source:'simulator',x,y,atMs:100+i*190,
   speed:.4,confidence:1,verified:true,verification:'simulated',coordinateBasis:'simulated'};
 });
}
/** Reuse the production artistic painter for preview cards, no fake SVG. */
export function paintSceneSample(canvas:HTMLCanvasElement,id:CatalogSceneId){
 const recipe=ARTISTIC_CATALOG.find(x=>x.id===id);
 if(!recipe)return false;
 const runtime=new ArtisticFootprintRuntime();
 runtime.ingest(syntheticSceneEvents(),0,200);
 runtime.paint(canvas,1200,{style:recipe.style,view:'both',
  treatment:'artistic',intensity:.9,persistence:recipe.persistence,catalog:recipe});
 return true;
}
export class ComposedSceneRuntime{
 private runtime=new ArtisticFootprintRuntime();
 private session:string|null=null;
 private generation=0;
 readonly scene:CatalogSceneId;
 constructor(scene:CatalogSceneId){this.scene=scene;}
 ingest(events:readonly FootMotionEventV2[],session:string,atMs:number,initialize=false){
  const generation=events.at(-1)?.generation??this.generation;
  if(this.session!==session||this.generation!==generation){
   this.session=session;this.generation=generation;
   // Scene added mid-session must not replay old steps.
   if(initialize)this.runtime.skipExisting(events,generation);
   else this.runtime.reset(generation);
  }
  this.runtime.ingest(events,generation,atMs);
 }
 skipExisting(events:readonly FootMotionEventV2[],session:string){
  this.session=session;
  this.generation=events.at(-1)?.generation??0;
  this.runtime.skipExisting(events,this.generation);
 }
 replay(events:readonly TimelineEvent[]){
  this.runtime.reset(0);
  for(const item of events){
   this.runtime.ingest([{...item.event,generation:0,eventId:item.id}],0,item.atMs);
  }
 }
  paint(canvas:HTMLCanvasElement,atMs:number){
  const recipe=ARTISTIC_CATALOG.find(x=>x.id===this.scene);
  if(!recipe)return;
  this.runtime.paint(canvas,atMs,{style:recipe.style,view:'both',
   treatment:'artistic',intensity:.85,persistence:recipe.persistence,catalog:recipe});
 }
 get contactCount(){return this.runtime.contactCount;}
}
