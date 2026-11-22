import {paintAuthenticFootprint} from '../../scenes/authenticFootGeometry.ts';
import {resolveActorColor,actorChannel} from './ActorPaletteResolver.ts';
import {lifetimeOpacity} from './PainterlyImpressionEngine.ts';
import type {V3Settings} from './TrajectoryRenderer.ts';
import type {PainterlySettings} from './PainterlyCanvasRenderer.ts';
import type {BrushDab} from './FootBrushGeometryBuilder.ts';

export type StoredBrushDab=BrushDab&{eventId:string;layer:'imprint'|'trail'};
export class FootBrushDepositStore {
 private marks:StoredBrushDab[]=[];
 readonly maxDabs=10000;
 append(dabs:readonly BrushDab[],eventId:string){
  if(this.marks.some(d=>d.eventId===eventId))return;
  const incoming=dabs.map(d=>({...d,eventId,
   layer:d.kind==='imprint'?'imprint' as const:'trail' as const}));
  this.marks.push(...incoming);
  if(this.marks.length>this.maxDabs)this.marks.splice(0,this.marks.length-this.maxDabs);
 }
 reset(){this.marks=[];}
 get size(){return this.marks.length;}
 get entries():readonly StoredBrushDab[]{return this.marks;}
}
function noise(seed:number,index:number){
 let x=Math.imul((seed+index*2654435761)>>>0,2246822519)>>>0;
 x=Math.imul(x^(x>>>13),3266489917)>>>0;
 return ((x^(x>>>16))>>>0)/4294967296;
}
/** Renders only previously generated dabs; no new event is emitted by repaint. */
export function paintFootBrushDeposits(ctx:CanvasRenderingContext2D,
 dabs:readonly StoredBrushDab[],settings:V3Settings,
 painterly:PainterlySettings,nowMs:number){
 const w=ctx.canvas.width,h=ctx.canvas.height;
 const size=Math.max(30,Math.min(150,painterly.sizePx*1.25))*(w/1600);
 const width=size*.365;
 for(const d of dabs){
  if(d.layer==='imprint'&&!painterly.showSoles||
   d.layer==='trail'&&!painterly.showTrails)continue;
  const actor=actorChannel(d.actorId);
  if(!settings.actors[actor]||!settings.footVisible[actor][d.side])continue;
  const keep=d.layer==='imprint'?painterly.footprintKeep:painterly.trailKeep;
  const life=d.layer==='imprint'?painterly.footprintLifeMs:painterly.trailLifeMs;
  const alpha=lifetimeOpacity(d.sourceMs,nowMs,life,keep)*d.alpha;
  if(alpha<=0)continue;
  const color=resolveActorColor(d.actorId,d.side,settings.actorColors,
   settings.footOverrides,'#F5F5F2');
  const mat=painterly.material;
  const weight=mat==='pigment'?.7:mat==='charcoal'?.62:.55;
  const texture=.83+.17*noise(d.seed,1);
  paintAuthenticFootprint(ctx,{
   x:d.center.x*w,y:d.center.y*h,side:d.side,headingRad:d.headingRad,
   widthPx:width,lengthPx:size,alpha:alpha*weight*texture,color,
   phase:'contact'
  });
  // Texture is deterministic and placed only near the sole's interior.
  // Use material-specific local dry flecks, not unrelated off-foot splatter.
  if(mat!=='ink'){
   ctx.save();ctx.translate(d.center.x*w,d.center.y*h);
   ctx.rotate(d.headingRad);
   ctx.fillStyle='#F5F5F2';ctx.globalAlpha=alpha*(mat==='charcoal'?.18:.07);
   const count=mat==='charcoal'?9:4;
   for(let i=0;i<count;i++){
    const nx=(noise(d.seed,i*2+2)-.5)*width*.65;
    const ny=(noise(d.seed,i*2+3)-.5)*size*.65;
    ctx.beginPath();ctx.ellipse(nx,ny,Math.max(1,width*.025),
     Math.max(1,size*.01),0,0,Math.PI*2);ctx.fill();
   }
   ctx.restore();
  }
 }
}
