/** VIS-R2: four deterministic floor images driven exclusively by the UX-R2 event stream.
 * Never writes to hardware output. No independent RAF, camera, tracker, or random contact. */
import type {FootMotionEventV2} from './FootMotionEventV2.ts';
import type {CatalogRecipe} from './artisticCatalog.ts';

export type ArtisticFootprintStyle='trace'|'compression'|'negative-memory'|'wave-record';
export type ArtisticFootprintView='footprints'|'paths'|'both';
export type ArtisticFootprintTreatment='artistic'|'literal';
export const ARTISTIC_FOOTPRINT_STYLES:readonly {id:ArtisticFootprintStyle;name:string;description:string}[]=[
 {id:'trace',name:'Trace / Palimpsest',description:'Lapisan rute dan jejak yang saling menimpa'},
 {id:'compression',name:'Compression / White Noise',description:'Bidang tertekan dan titik noise hanya di sekitar kontak'},
 {id:'negative-memory',name:'Negative Memory',description:'Jejak sebagai bidang kosong di atas lapisan arsip'},
 {id:'wave-record',name:'Wave Record',description:'Riak tipis berlapis, bertumpu pada pijakan yang terkonfirmasi'}
];
export type ArtisticFootprintConfig={
 style:ArtisticFootprintStyle;view:ArtisticFootprintView;
 treatment:ArtisticFootprintTreatment;intensity:number;persistence:number;
 catalog?:CatalogRecipe;
};
export const ARTISTIC_FOOTPRINT_DEFAULTS:ArtisticFootprintConfig={
 style:'trace',view:'both',treatment:'artistic',intensity:.65,persistence:.72
};
const clamp=(v:number)=>Math.min(1,Math.max(0,Number.isFinite(v)?v:0));
export function normalizeArtisticFootprintConfig(raw:unknown):ArtisticFootprintConfig{
 const x=raw&&typeof raw==='object'?raw as Partial<ArtisticFootprintConfig>:{};
 return {
  style:ARTISTIC_FOOTPRINT_STYLES.some(s=>s.id===x.style)?x.style!:ARTISTIC_FOOTPRINT_DEFAULTS.style,
  view:x.view==='footprints'||x.view==='paths'||x.view==='both'?x.view:'both',
  treatment:x.treatment==='literal'||x.treatment==='artistic'?x.treatment:'artistic',
  intensity:typeof x.intensity==='number'?clamp(x.intensity):.65,
  persistence:typeof x.persistence==='number'?clamp(x.persistence):.72,
  catalog:x.catalog
 };
}
type Stamp={id:string;actorId:string;foot:'left'|'right';x:number;y:number;atMs:number;confidence:number;heading:number};
type Waypoint={actorId:string;x:number;y:number;atMs:number};
type Anchor={x:number;y:number;atMs:number};
export class ArtisticFootprintRuntime{
 private generation=-1;
 private seen=new Set<string>();
 private stamps:Stamp[]=[];
 private paths:Waypoint[]=[];
 private last=new Map<string,Anchor>();
 get contactCount(){return this.stamps.length;}
 get pathPointCount(){return this.paths.length;}
 get stampsSnapshot(){return this.stamps.map(s=>({...s}));}
 reset(generation:number){
  this.generation=generation;this.seen.clear();this.stamps=[];this.paths=[];this.last.clear();
 }
 /** Hide history when selecting another scene: only subsequent live events create marks. */
 skipExisting(events:readonly FootMotionEventV2[],generation:number){
  this.reset(generation);
  for(const event of events)this.seen.add(event.eventId);
 }
 ingest(events:readonly FootMotionEventV2[],generation:number,displayAtMs?:number){
  if(this.generation!==generation)this.reset(generation);
  for(const e of events){
   if(this.seen.has(e.eventId))continue;
   this.seen.add(e.eventId);
   if(e.actorId.startsWith('unassigned-')||!Number.isFinite(e.x)||!Number.isFinite(e.y))continue;
   if(e.kind==='contact'&&e.verified&&(e.foot==='left'||e.foot==='right')){
    const prev=this.last.get(e.actorId);
    const dx=prev?e.x-prev.x:0,dy=prev?e.y-prev.y:0;
    this.stamps.push({id:e.eventId,actorId:e.actorId,foot:e.foot,
     x:clamp(e.x),y:clamp(e.y),atMs:displayAtMs??e.atMs,confidence:clamp(e.confidence),
     heading:prev&&Math.hypot(dx,dy)>.004?Math.atan2(dy,dx)-Math.PI/2:0});
    this.last.set(e.actorId,{x:e.x,y:e.y,atMs:e.atMs});
   }
   if(e.kind==='movement'||e.kind==='contact'){
    const prev=this.paths.at(-1);
    if(!prev||prev.actorId!==e.actorId||Math.hypot(prev.x-e.x,prev.y-e.y)>.006){
     this.paths.push({actorId:e.actorId,x:clamp(e.x),y:clamp(e.y),atMs:displayAtMs??e.atMs});
    }
   }
  }
  // Keep dedupe IDs for the entire current generation; input history is bounded by FLOOR bus.
  if(this.stamps.length>240)this.stamps.splice(0,this.stamps.length-240);
  if(this.paths.length>640)this.paths.splice(0,this.paths.length-640);
 }
 paint(canvas:HTMLCanvasElement,nowMs:number,raw:ArtisticFootprintConfig){
  const cfg=normalizeArtisticFootprintConfig(raw),ctx=canvas.getContext('2d');
  if(!ctx)return;
  const w=canvas.width,h=canvas.height,scale=Math.min(w,h);
  const life=1400+cfg.persistence*27000;
  const alpha=(at:number)=>clamp(1-Math.max(0,nowMs-at)/life);
  ctx.save();ctx.setTransform(1,0,0,1,0,0);
  const recipe=cfg.catalog;
  ctx.fillStyle=recipe?.paper??'#040507';ctx.fillRect(0,0,w,h);
  const showPath=cfg.view!=='footprints',showStamp=cfg.view!=='paths';
  if(cfg.style==='negative-memory'){
   ctx.fillStyle=recipe?.ink??'#dad8cc';ctx.fillRect(0,0,w,h);
   // Thin archive ruling: makes the empty marks perceptible even while stationary.
   ctx.strokeStyle='#484b4a';ctx.globalAlpha=.12;ctx.lineWidth=1;
   for(let y=10;y<h;y+=11){ctx.beginPath();ctx.moveTo(0,y);ctx.lineTo(w,y);ctx.stroke();}
   ctx.globalAlpha=1;
  }
  if(showPath){
   const byActor=new Map<string,Waypoint[]>();
   for(const p of this.paths){if(alpha(p.atMs)<=0)continue;
    const list=byActor.get(p.actorId)??[];list.push(p);byActor.set(p.actorId,list);
   }
   for(const path of byActor.values()){
    if(path.length<2)continue;
    ctx.beginPath();ctx.moveTo(path[0].x*w,path[0].y*h);
    for(const p of path.slice(1))ctx.lineTo(p.x*w,p.y*h);
    ctx.lineWidth=(cfg.treatment==='literal'?1.5:cfg.style==='compression'?3:1.1)*(recipe?.pathWeight??1);
    ctx.globalAlpha=.42*cfg.intensity;
    ctx.strokeStyle=cfg.style==='negative-memory'?(recipe?.paper??'#131619'):(recipe?.accent??'#b9c4bb');ctx.stroke();
    if(cfg.style==='trace'&&cfg.treatment==='artistic'){
     for(let layer=1;layer<=3;layer++){
      ctx.save();ctx.translate(layer*1.7,-layer*1.1);
      ctx.globalAlpha=.18*cfg.intensity/layer;ctx.stroke();ctx.restore();
     }
    }
   }
   ctx.globalAlpha=1;
  }
  if(showStamp){
   for(const mark of this.stamps){
    const a=alpha(mark.atMs);if(a<=0)continue;
    const x=mark.x*w,y=mark.y*h,r=scale*(cfg.treatment==='literal'?.028:.036)*(recipe?.scale??1);
    ctx.save();ctx.translate(x,y);ctx.rotate(mark.heading);
    ctx.globalAlpha=a*cfg.intensity*Math.max(.3,mark.confidence);
    if(cfg.style==='trace'){
     const copies=cfg.treatment==='literal'?1:5;
     for(let i=0;i<copies;i++){
      ctx.beginPath();ctx.ellipse((i-2)*r*.17,(i-2)*r*.1,r*.44*(1+i*.035),r*(1.25+i*.015),-.18,0,Math.PI*2);
      ctx.lineWidth=cfg.treatment==='literal'?2:.9;ctx.strokeStyle=recipe?.ink??'#d5ddd4';ctx.stroke();
     }
    }else if(cfg.style==='compression'){
     ctx.fillStyle=recipe?.ink??'#c9ced0';
     const size=cfg.treatment==='literal'?3:2;
     for(let row=-12;row<=12;row++)for(let col=-6;col<=6;col++){
      const px=col*r*.16,py=row*r*.13;
      const inside=(px/(r*.56))**2+(py/(r*1.3))**2<=1;
      const hash=((row*43+col*97+Math.round(mark.x*1000)*11+Math.round(mark.y*1000)*19)>>>0)%13;
      if(inside&&hash<9)ctx.fillRect(px,py,size+hash%3,size+hash%3);
     }
     ctx.beginPath();ctx.ellipse(0,0,r*.6,r*1.35,0,0,Math.PI*2);
     ctx.lineWidth=.9;ctx.strokeStyle=recipe?.accent??'#ebeff2';ctx.stroke();
    }else if(cfg.style==='negative-memory'){
     ctx.fillStyle=recipe?.paper??'#040507';
     ctx.beginPath();ctx.ellipse(0,0,r*.55,r*1.28,0,0,Math.PI*2);ctx.fill();
     ctx.strokeStyle=recipe?.accent??'#666964';ctx.lineWidth=.9;ctx.stroke();
     if(cfg.treatment==='artistic'){
      for(let j=0;j<3;j++){ctx.strokeStyle='#181d1d';ctx.lineWidth=.5;
       ctx.beginPath();ctx.ellipse(0,0,r*(.63+j*.13),r*(1.32+j*.1),0,0,Math.PI*2);ctx.stroke();}
     }
    }else{
     const rings=cfg.treatment==='literal'?2:6;
     for(let j=0;j<rings;j++){
      ctx.beginPath();ctx.ellipse(0,0,r*(.5+j*.46),r*(.95+j*.4),0,0,Math.PI*2);
      ctx.lineWidth=j===0?2:1;
      ctx.strokeStyle=j%2===0?(recipe?.ink??'#c4d8d7'):(recipe?.accent??'#718d95');ctx.stroke();
     }
    }
    if(recipe&&cfg.treatment==='artistic'){
     // Scene-specific motifs are exclusively stamped by verified contacts.
     const aColor=recipe.accent;
     ctx.strokeStyle=aColor;ctx.lineWidth=.85;
     if(recipe.motif==='burst'||recipe.motif==='snow'||recipe.motif==='lantern'){
      const rays=recipe.motif==='lantern'?8:recipe.motif==='snow'?6:12;
      for(let k=0;k<rays;k++){const theta=k*Math.PI*2/rays;
       const inner=r*(recipe.motif==='lantern'?.75:.65),outer=r*(recipe.motif==='burst'?2.25:1.65);
       ctx.beginPath();ctx.moveTo(Math.cos(theta)*inner,Math.sin(theta)*inner);
       ctx.lineTo(Math.cos(theta)*outer,Math.sin(theta)*outer);ctx.stroke();}
     }else if(recipe.motif==='root'||recipe.motif==='stitch'||recipe.motif==='fracture'||recipe.motif==='shard'){
      for(let k=0;k<5;k++){
       const theta=k*2.4;
       ctx.beginPath();ctx.moveTo(0,r*.6);
       ctx.lineTo(Math.cos(theta)*r*(1.15+k*.18),Math.sin(theta)*r*(1.15+k*.2));
       if(recipe.motif==='root'||recipe.motif==='fracture')
        ctx.lineTo(Math.cos(theta+.5)*r*(1.5+k*.19),Math.sin(theta+.5)*r*(1.5+k*.2));
       ctx.stroke();}
     }else if(recipe.motif==='swarm'||recipe.motif==='glow'){
      for(let k=0;k<12;k++){
       const theta=(k*137.5)*Math.PI/180,distance=r*(.8+(k%4)*.45);
       ctx.beginPath();ctx.arc(Math.cos(theta)*distance,Math.sin(theta)*distance,recipe.motif==='glow'?1.6:1,0,Math.PI*2);
       ctx.stroke();}
     }else if(recipe.motif==='veil'||recipe.motif==='smoke'||recipe.motif==='current'||recipe.motif==='splash'){
      for(let k=0;k<4;k++){
       ctx.beginPath();ctx.ellipse(0,0,r*(.85+k*.35),r*(1.2+k*.23),k*.18,0,Math.PI*2);ctx.stroke();}
     }
    }
    ctx.restore();
   }
  }
  ctx.restore();
 }
}
