import {paintAuthenticFootprint,footprintOutline,footprintToes} from '../../scenes/authenticFootGeometry.ts';
import {resolveActorColor,actorChannel} from './ActorPaletteResolver.ts';
import type {DualFootTrajectoryEngine} from './DualFootTrajectoryEngine.ts';
import {paintTrajectory,type V3Settings} from './TrajectoryRenderer.ts';
import {PainterlyImpressionEngine,lifetimeOpacity} from './PainterlyImpressionEngine.ts';
import {paintFootBrushDeposits,type FootBrushDepositStore} from './FootBrushStrokeRenderer.ts';
import type {PersistentInkStore} from './PersistentInkStore.ts';
import type {PersistentPathStore} from './PersistentPathStore.ts';
import type {InkAccentMode} from './DirectionalInkPainter.ts';
import type {RibbonStyle} from './SumiRibbonMeshBuilder.ts';
import type {SumiMaterial} from './SumiMaterialRenderer.ts';
import type {PainterlyViewTransform} from './PainterlyPreviewTransform.ts';
import type {DualTraceV2Palette,DualTraceV2Mode,DualTraceV2Order} from '../../dual-trace/DualTraceV2Renderer.ts';

export type PainterlyMaterial='ink'|'charcoal'|'pigment';
export type PainterlySettings={
 enabled:boolean;
 painterlyEngine?:'legacy-v32'|'foot-brush-v33'|'sumi-v34'|'path-first-v35'|'dual-trace-v1'|'dual-trace-v2';
 dualV2Display?:DualTraceV2Mode;
 dualV2Order?:DualTraceV2Order;
 dualV2Palette?:DualTraceV2Palette;
 dualV2Material?:'path-sumi'|'dry-ink'|'pigment-mass';
 dualV2Expressive?:boolean;
 /** Toggle rollback: false restores original V2.1 foot-only routing. */
 trajectoryV22Enabled?:boolean;
 dualV2PathOpacity?:number;
 dualV2FootOpacity?:number;
 dualV2UpperOpacity?:number;
 dualHeadEnabled?:boolean;dualShoulderEnabled?:boolean;
 dualHeadWidth?:number;dualShoulderWidth?:number;
 dualHeadOpacity?:number;dualShoulderOpacity?:number;
 dualGain?:number;dualSmoothing?:number;
 pathWeightPx?:number;
 pathMaterial?:RibbonStyle['material'];
 pathAccents?:InkAccentMode;
 pathDiagnostics?:boolean;
 sumiMaterial?:SumiMaterial;
 sumiWeightPx?:number;
 sumiExpression?:'natural'|'bold';
 previewFit?:boolean;
 material:PainterlyMaterial;
 showSoles:boolean;showTrails:boolean;
 footprintLifeMs:number;trailLifeMs:number;
 footprintKeep:boolean;trailKeep:boolean;
 sizePx:number;
};
export const DEFAULT_PAINTERLY_SETTINGS:PainterlySettings={
 enabled:true,painterlyEngine:'path-first-v35',
 pathWeightPx:26,pathMaterial:'path-sumi',pathAccents:'subtle',
 pathDiagnostics:false,sumiMaterial:'sumi',
 sumiWeightPx:56,sumiExpression:'bold',previewFit:false,
 material:'ink',showSoles:true,showTrails:true,
 footprintLifeMs:6000,trailLifeMs:4000,
 footprintKeep:false,trailKeep:true,sizePx:70
};
const limit=(n:number,min:number,max:number)=>Math.min(max,Math.max(min,n));
function unitRandom(seed:number,i:number){
 let x=(seed+i*0x9E3779B9)>>>0;
 x=Math.imul(x^(x>>>16),0x85ebca6b);
 x=Math.imul(x^(x>>>13),0xc2b2ae35);
 return ((x^(x>>>16))>>>0)/4294967296;
}
function grainWithinSole(ctx:CanvasRenderingContext2D,side:'left'|'right',
 seed:number,material:PainterlyMaterial,amount:number){
 if(material==='ink')return;
 const outline=footprintOutline(side),toes=footprintToes(side);
 ctx.save();ctx.beginPath();
 ctx.moveTo(outline[0][0],outline[0][1]);
 for(const [x,y] of outline.slice(1))ctx.lineTo(x,y);
 ctx.closePath();
 for(const toe of toes){
  ctx.moveTo(toe.x+toe.rx,toe.y);
  ctx.ellipse(toe.x,toe.y,toe.rx,toe.ry,toe.angle,0,Math.PI*2);
 }
 ctx.clip();
 ctx.fillStyle=material==='charcoal'?'#F5F5F2':'#FFFDF8';
 ctx.globalAlpha*=material==='charcoal'?.24:.13;
 const count=material==='charcoal'?48:24;
 for(let i=0;i<count;i++){
  const x=(unitRandom(seed,i*3)-.5)*1.03;
  const y=(unitRandom(seed,i*3+1)-.5)*2.15;
  const r=(.008+unitRandom(seed,i*3+2)*.024)*amount;
  ctx.beginPath();ctx.ellipse(x,y,r,r*.65,0,0,Math.PI*2);ctx.fill();
 }
 ctx.restore();
}
export function paintPainterlyCanvas(
 ctx:CanvasRenderingContext2D,trajectory:DualFootTrajectoryEngine,
 impressions:PainterlyImpressionEngine,settings:V3Settings,
 painterly:PainterlySettings,presentationMs:number,blackout=false,fullscreen=false,
 brushStore?:FootBrushDepositStore,sumiStore?:PersistentInkStore,
 preview?:PainterlyViewTransform,pathStore?:PersistentPathStore
){
 if(!painterly.enabled){
  paintTrajectory(ctx,trajectory,settings,presentationMs,blackout,fullscreen);
  return;
 }
 const w=ctx.canvas.width,h=ctx.canvas.height;
 const white='#F5F5F2';
 if(blackout){
  ctx.save();ctx.setTransform(1,0,0,1,0,0);
  ctx.clearRect(0,0,w,h);ctx.fillStyle='#000000';ctx.fillRect(0,0,w,h);
  ctx.restore();return;
 }
 // V3.3 is opt-in until the P0 QA gate. Legacy remains pixel-identical.
 if(painterly.painterlyEngine==='foot-brush-v33'&&brushStore){
  ctx.save();ctx.setTransform(1,0,0,1,0,0);
  ctx.clearRect(0,0,w,h);ctx.fillStyle=white;ctx.fillRect(0,0,w,h);
  ctx.restore();
  paintFootBrushDeposits(ctx,brushStore.entries,settings,painterly,presentationMs);
  return;
 }
 // V3.4 is composited from cached ink; stamping a new image is prohibited in paint().
 // Footprints remain a separate transient layer below.
 const pathCanvasMode=painterly.painterlyEngine==='path-first-v35'&&!!pathStore;
 const sumiCanvasMode=painterly.painterlyEngine==='sumi-v34'&&!!sumiStore;
 if(pathCanvasMode&&pathStore){
  ctx.save();ctx.setTransform(1,0,0,1,0,0);
  ctx.clearRect(0,0,w,h);ctx.fillStyle=white;ctx.fillRect(0,0,w,h);
  ctx.restore();ctx.save();
  if(preview)ctx.setTransform(preview.scale,0,0,preview.scale,
   preview.tx*w/1600,preview.ty*h/900);
  const ink=pathStore.getCanvas();
  if(ink&&painterly.showTrails){
   ctx.save();ctx.globalAlpha=.85;ctx.drawImage(ink,0,0,w,h);ctx.restore();
  }
 }else if(sumiCanvasMode&&sumiStore){
  ctx.save();ctx.setTransform(1,0,0,1,0,0);
  ctx.clearRect(0,0,w,h);ctx.fillStyle=white;ctx.fillRect(0,0,w,h);
  ctx.restore();
  // Transform only the Stage Monitor preview, never the physical mapping basis.
  ctx.save();
  if(preview)ctx.setTransform(preview.scale,0,0,preview.scale,preview.tx*w/1600,preview.ty*h/900);
  const ink=sumiStore.getCanvas();
  if(ink&&painterly.showTrails)ctx.drawImage(ink,0,0,w,h);
 }else if(painterly.showTrails){
  paintTrajectory(ctx,trajectory,{
   ...settings,background:white,materialTreatment:painterly.material,
   decay:painterly.trailKeep?'keep':'fade',lifeMs:Math.max(1000,painterly.trailLifeMs),
   debug:settings.debug&&!fullscreen
  },presentationMs,false,fullscreen);
 }else{
  ctx.save();ctx.setTransform(1,0,0,1,0,0);
  ctx.clearRect(0,0,w,h);ctx.fillStyle=white;ctx.fillRect(0,0,w,h);ctx.restore();
 }
 if(!painterly.showSoles){if(sumiCanvasMode||pathCanvasMode)ctx.restore();return;}
 const scale=w/1600;
 const len=limit(painterly.sizePx,30,110)*scale;
 const width=len*.365;
 const draw=(stamp:{actorId:string;foot:'left'|'right';x:number;y:number;
  headingRad?:number},alpha:number,seed:number,head=false)=>{
  const actor=actorChannel(stamp.actorId);
  if(!settings.actors[actor]||!settings.footVisible[actor][stamp.foot]||alpha<=0)return;
  const color=resolveActorColor(stamp.actorId,stamp.foot,
   settings.actorColors,settings.footOverrides,white);
  const opacity=alpha*(painterly.material==='pigment'?.65:painterly.material==='charcoal'?.75:.80);
  paintAuthenticFootprint(ctx,{
   x:stamp.x*w,y:stamp.y*h,side:stamp.foot,
   ...(stamp.headingRad===undefined?{}:{headingRad:stamp.headingRad}),
   widthPx:width,lengthPx:len,alpha:opacity,
   color,phase:head?'prediction':'contact'
  });
  if(head||painterly.material==='ink')return;
  // Deterministic texture is clipped inside the anatomical outline/toes.
  ctx.save();ctx.translate(stamp.x*w,stamp.y*h);
  ctx.rotate(stamp.headingRad??0);ctx.scale(width,len/2);
  ctx.globalAlpha=opacity;
  grainWithinSole(ctx,stamp.foot,seed,painterly.material,1);
  ctx.restore();
 };
 for(const stamp of impressions.visible(presentationMs,painterly.footprintLifeMs,painterly.footprintKeep)){
  const alpha=lifetimeOpacity(stamp.atSourceMs,presentationMs,
   painterly.footprintLifeMs,painterly.footprintKeep);
  draw(stamp,alpha,stamp.materialSeed);
 }
 for(const head of impressions.liveHeads(presentationMs)){
  draw(head,head.alpha,0,true);
 }
 if(sumiCanvasMode||pathCanvasMode)ctx.restore();
}
