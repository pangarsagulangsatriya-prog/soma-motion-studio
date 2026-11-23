import {PersistentPathStore} from '../lines/v3/PersistentPathStore.ts';
import type {UpperGestureEvent} from './UpperGestureStrokeTracker.ts';
import type {UpperChannel} from './UpperGestureAnchorAdapter.ts';
import type {DualActor} from './DualTracePoseFrameBus.ts';

export type UpperBrushSettings={
 headEnabled:boolean;shoulderEnabled:boolean;
 headWidth:number;shoulderWidth:number;
 headOpacity:number;shoulderOpacity:number;
 colors:Record<DualActor,string>;
};
export const DEFAULT_UPPER_BRUSH:Omit<UpperBrushSettings,'colors'>={
 headEnabled:true,shoulderEnabled:true,
 headWidth:8,shoulderWidth:16,headOpacity:.75,shoulderOpacity:.9
};
const clamp=(v:number,a:number,b:number)=>Math.max(a,Math.min(b,v));
/** Two independent channel atlases. Each atlas already handles A/B actor
 * identity and retained ink. No second video/AI inference is involved. */
export class UpperGestureInkRenderer{
 private head=new PersistentPathStore();
 private shoulder=new PersistentPathStore();
 private output:HTMLCanvasElement|null=null;
 private observed=false;
 get hasPose(){return this.observed;}
 get activeCount(){return this.head.activeCount+this.shoulder.activeCount;}
 get committedCount(){return this.head.depositCount+this.shoulder.depositCount;}
 markPose(){this.observed=true;}
 ingest(event:UpperGestureEvent,settings:UpperBrushSettings){
  const store=event.channel==='head'?this.head:this.shoulder;
  if(event.kind==='START')this.observed=true;
  store.ingest(event,{color:settings.colors[event.actorId],
   weightPx:event.channel==='head'?clamp(settings.headWidth,8,64):
    clamp(settings.shoulderWidth,8,64),
   material:'path-sumi',accents:'off'});
 }
 clear(){
  this.head.clearPainting();this.shoulder.clearPainting();this.observed=false;
 }
 paint(ctx:CanvasRenderingContext2D,settings:UpperBrushSettings,
  blackout=false){
  const w=ctx.canvas.width,h=ctx.canvas.height;
  ctx.save();ctx.setTransform(1,0,0,1,0,0);ctx.clearRect(0,0,w,h);
  ctx.fillStyle=blackout?'#000000':'#F7F6F2';ctx.fillRect(0,0,w,h);
  if(!blackout){
   const head=this.head.getCanvas(),shoulder=this.shoulder.getCanvas();
   if(settings.shoulderEnabled&&shoulder){
    ctx.globalAlpha=clamp(settings.shoulderOpacity,0,1);
    ctx.drawImage(shoulder,0,0,w,h);
   }
   if(settings.headEnabled&&head){
    ctx.globalAlpha=clamp(settings.headOpacity,0,1);
    ctx.drawImage(head,0,0,w,h);
   }
  }
  ctx.restore();
 }
 exportPNG():string|null{
  this.output??=document.createElement('canvas');
  this.output.width=1600;this.output.height=900;
  const ctx=this.output.getContext('2d');if(!ctx)return null;
  this.paint(ctx,{...DEFAULT_UPPER_BRUSH,colors:{A:'#E84B32',B:'#202226'}});
  return this.output.toDataURL('image/png');
 }
}
