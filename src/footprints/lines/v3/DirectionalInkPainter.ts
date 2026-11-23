import type {PathRibbonMesh,RibbonStyle} from './SumiRibbonMeshBuilder.ts';
export type InkAccentMode='off'|'subtle'|'expressive';
export type InkRenderStyle=RibbonStyle&{color:string;seed:number;accents:InkAccentMode};
const noise=(seed:number,index:number)=>{
 let n=Math.imul(seed^(index*0x9e3779b9),2246822519)>>>0;
 n=Math.imul(n^(n>>>13),3266489917)>>>0;
 return ((n^(n>>>16))>>>0)/4294967296;
};
/** Directional wet/dry nib, painted only into local scratch pixels.
 * An opaque actor atlas absorbs adjacent segments as one path. */
export function paintDirectionalRibbon(ctx:CanvasRenderingContext2D,
 mesh:PathRibbonMesh,style:InkRenderStyle,accent=false){
 const points=mesh.centerline;
 ctx.save();
 ctx.strokeStyle=style.color;
 ctx.fillStyle=style.color;
 ctx.lineJoin='round';ctx.lineCap='round';
 for(let i=1;i<points.length;i++){
  const a=points[i-1],b=points[i];
  const width=(mesh.widths[i-1]+mesh.widths[i])/2;
  if(width<.12)continue;
  // Wet-ink edge extends only a fraction of local nib width.
  if(style.material!=='pigment-mass'){
   ctx.globalAlpha=style.material==='dry-ink'?.09:.15;
   ctx.lineWidth=width+Math.max(1,style.weightPx*.065);
   ctx.beginPath();ctx.moveTo(a.x,a.y);ctx.lineTo(b.x,b.y);ctx.stroke();
  }
  ctx.globalAlpha=1;
  ctx.lineWidth=width;
  ctx.beginPath();ctx.moveTo(a.x,a.y);ctx.lineTo(b.x,b.y);ctx.stroke();
 }
 // Scratch-scoped cutout follows the path tangent. Never alter committed
 // pigment with destination-out, and never scratch across the entire ribbon.
 if(style.material!=='pigment-mass'){
  ctx.save();ctx.globalCompositeOperation='destination-out';ctx.strokeStyle='#000';
  let lastBin=-1;
  for(let i=1;i<points.length-1;i++){
   const p=points[i],width=mesh.widths[i];
   const bin=Math.floor(p.s/8);
   if(bin===lastBin||width<6)continue;
   lastBin=bin;
   const seed=(style.seed^(bin*103471))>>>0;
   // Two to four small longitudinal dry fibers, seeded in global arc-length
   // coordinates, stay coherent when tail geometry is rebuilt.
   const count=style.material==='dry-ink'?4:2;
   for(let k=0;k<count;k++){
    const lateral=(noise(seed,k*5)-.5)*.70*width;
    const start=(noise(seed,k*5+1)-.5)*3;
    const run=2+noise(seed,k*5+2)*(style.material==='dry-ink'?12:7);
    const x=p.x-p.ty*lateral+p.tx*start;
    const y=p.y+p.tx*lateral+p.ty*start;
    ctx.globalAlpha=style.material==='dry-ink'?.5:.29;
    ctx.lineWidth=.55+noise(seed,k*5+3)*(style.material==='dry-ink'?1.35:.80);
    ctx.beginPath();ctx.moveTo(x,y);
    ctx.lineTo(x+p.tx*run,y+p.ty*run);ctx.stroke();
   }
   // Ragged dry edge: nib shears a small local notch rather than stamping
   // detached dots. No random marks appear away from the actual path.
   if(bin%3===0){
    const side=noise(seed,91)>.5?1:-1;
    const n=width*(.47-.04*noise(seed,92));
    const x=p.x-p.ty*n*side,y=p.y+p.tx*n*side;
    ctx.globalAlpha=style.material==='dry-ink'?.72:.42;
    ctx.lineWidth=.9+noise(seed,93)*1.7;
    ctx.beginPath();ctx.moveTo(x,y);
    ctx.lineTo(x-p.ty*side*2.8+p.tx*2.5,
     y+p.tx*side*2.8+p.ty*2.5);ctx.stroke();
   }
  }
  ctx.restore();
 }
 // Only TURN/pivot gated upstream may request a small, directional accent.
 if(accent&&style.accents!=='off'&&points.length){
  const p=points[points.length-1];
  const count=style.accents==='subtle'?1:3;
  ctx.globalAlpha=style.material==='dry-ink'?.65:.85;
  for(let i=0;i<count;i++){
   const q=noise(style.seed,i*3),v=noise(style.seed,i*3+1);
   const radius=.7+noise(style.seed,i*3+2)*1.5;
   ctx.beginPath();ctx.arc(p.x+p.tx*(4+q*8)-p.ty*(v-.5)*8,
    p.y+p.ty*(4+q*8)+p.tx*(v-.5)*8,radius,0,Math.PI*2);ctx.fill();
  }
 }
 ctx.restore();
}
