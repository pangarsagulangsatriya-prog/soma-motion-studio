import type {PathRibbonMesh,RibbonStyle} from './SumiRibbonMeshBuilder.ts';
export type InkAccentMode='off'|'subtle'|'expressive';
export type InkRenderStyle=RibbonStyle&{color:string;seed:number;accents:InkAccentMode};
const noise=(seed:number,index:number)=>{
 let n=Math.imul(seed^(index*0x9e3779b9),2246822519)>>>0;
 n=Math.imul(n^(n>>>13),3266489917)>>>0;
 return ((n^(n>>>16))>>>0)/4294967296;
};
/** Fill the real joined left/right ribbon mesh, rather than painting one wide
 * ctx.stroke per segment. Each call renders into the isolated scratch canvas.
 * Small directional fibers stay clipped to the same ribbon shape.
 */
export function paintDirectionalRibbon(ctx:CanvasRenderingContext2D,
 mesh:PathRibbonMesh,style:InkRenderStyle,accent=false){
 const points=mesh.centerline;
 if(points.length<2||mesh.left.length!==points.length||
  mesh.right.length!==points.length)return;
 ctx.save();
 ctx.fillStyle=style.color;ctx.strokeStyle=style.color;
 ctx.lineJoin='round';ctx.lineCap='round';
 ctx.beginPath();
 ctx.moveTo(mesh.left[0].x,mesh.left[0].y);
 for(let i=1;i<mesh.left.length;i++)
  ctx.lineTo(mesh.left[i].x,mesh.left[i].y);
 for(let i=mesh.right.length-1;i>=0;i--)
  ctx.lineTo(mesh.right[i].x,mesh.right[i].y);
 ctx.closePath();
 // A tiny edge bleed is inside the temporary stroke-local canvas; main ink is
 // fully opaque, so neighbouring committed segments never alpha-darken.
 if(style.material!=='pigment-mass'){
  ctx.save();ctx.globalAlpha=style.material==='dry-ink'?.12:.10;
  ctx.lineWidth=Math.max(.6,style.weightPx*.045);ctx.stroke();ctx.restore();
 }
 ctx.fill();
 // Seam-safe round join between two separate arc-length spans. This never
 // widens the path beyond the local nib radius.
 for(const i of [0,points.length-1]){
  if(mesh.widths[i]<1)continue;
  ctx.beginPath();ctx.arc(points[i].x,points[i].y,mesh.widths[i]/2,0,Math.PI*2);
  ctx.fill();
 }
 if(style.material!=='pigment-mass'){
  ctx.save();ctx.beginPath();
  ctx.moveTo(mesh.left[0].x,mesh.left[0].y);
  for(let i=1;i<mesh.left.length;i++)
   ctx.lineTo(mesh.left[i].x,mesh.left[i].y);
  for(let i=mesh.right.length-1;i>=0;i--)
   ctx.lineTo(mesh.right[i].x,mesh.right[i].y);
  ctx.closePath();ctx.clip();
  ctx.globalCompositeOperation='destination-out';
  ctx.strokeStyle='#000';
  let lastBin=-1;
  for(let i=1;i<points.length-1;i++){
   const p=points[i],width=mesh.widths[i],bin=Math.floor(p.s/8);
   if(bin===lastBin||width<6)continue;
   lastBin=bin;
   const seed=(style.seed^(bin*103471))>>>0;
   const rough=style.material==='rough-sumi'?
    Math.max(.30,Math.min(1,style.roughness??.74)):0;
   for(let k=0;k<(style.material==='dry-ink'?4:rough>0?3+Math.ceil(rough*4):2);k++){
    // Rough bristles favour the outer 30–45% of each half-nib. Keep the
    // centre at least 60% solid, even at full dry-fibre intensity.
    const side=k%2===0?1:-1;
    const offset=rough>0?side*(.31+noise(seed,k*5)*.13)*width:
     (noise(seed,k*5)-.5)*.70*width;
    const start=(noise(seed,k*5+1)-.5)*3;
    const run=2+noise(seed,k*5+2)*(style.material==='dry-ink'?12:rough>0?16:7);
    const x=p.x-p.ty*offset+p.tx*start,y=p.y+p.tx*offset+p.ty*start;
    ctx.globalAlpha=style.material==='dry-ink'?.50:rough>0?.30+.28*rough:.28;
    ctx.lineWidth=.55+noise(seed,k*5+3)*(style.material==='dry-ink'?1.35:rough>0?2.0:.8);
    ctx.beginPath();ctx.moveTo(x,y);
    ctx.lineTo(x+p.tx*run,y+p.ty*run);ctx.stroke();
   }
  }
  ctx.restore();
 }
 // Do not invent impacts or splatter from 2D estimated turns. The actual
 // contact event is still 'none' until a verified stance/pivot source is wired.
 if(accent&&style.accents!=='off'){
  const p=points[points.length-1];
  ctx.globalAlpha=.7;ctx.fillStyle=style.color;
  for(let i=0;i<(style.accents==='subtle'?1:3);i++){
   const s=(style.seed^Math.floor(p.s))>>>0;
   const q=noise(s,i*3),v=noise(s,i*3+1);
   const radius=.6+noise(s,i*3+2)*1.2;
   ctx.beginPath();ctx.arc(p.x+p.tx*(3+q*7)-p.ty*(v-.5)*7,
    p.y+p.ty*(3+q*7)+p.tx*(v-.5)*7,radius,0,Math.PI*2);ctx.fill();
  }
 }
 ctx.restore();
}
