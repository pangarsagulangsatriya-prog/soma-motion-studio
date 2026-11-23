import type {PathRibbonMesh,RibbonStyle} from './SumiRibbonMeshBuilder.ts';
export type InkAccentMode='off'|'subtle'|'expressive';
export type InkRenderStyle=RibbonStyle&{color:string;seed:number;accents:InkAccentMode};
const noise=(seed:number,index:number)=>{
 let n=Math.imul(seed^(index*0x9e3779b9),2246822519)>>>0;
 n=Math.imul(n^(n>>>13),3266489917)>>>0;
 return ((n^(n>>>16))>>>0)/4294967296;
};
/** Each path segment paints opaque pigment into an isolated actor layer.
 * A live frame never composites semi-transparent polygon patches into the atlas. */
export function paintDirectionalRibbon(ctx:CanvasRenderingContext2D,
 mesh:PathRibbonMesh,style:InkRenderStyle,terminal=false){
 const points=mesh.centerline;
 ctx.save();
 ctx.strokeStyle=style.color;
 ctx.fillStyle=style.color;
 ctx.lineJoin='round';ctx.lineCap='round';
 ctx.globalAlpha=1;
 // Variable-width round joins make seams visually continuous, even where a
 // short stable segment meets the editable tail.
 for(let i=1;i<points.length;i++){
  const a=points[i-1],b=points[i];
  const width=(mesh.widths[i-1]+mesh.widths[i])/2;
  if(width<.12)continue;
  ctx.lineWidth=width;
  ctx.beginPath();ctx.moveTo(a.x,a.y);ctx.lineTo(b.x,b.y);ctx.stroke();
 }
 // A limited amount of bristle fiber follows tangent on this actual segment.
 // Scratch-canvas clipping prevents erasing already committed neighboring paths.
 if(style.material!=='pigment-mass'){
  ctx.save();
  ctx.beginPath();
  for(let i=1;i<points.length;i++){
   const a=points[i-1],b=points[i],w=(mesh.widths[i-1]+mesh.widths[i])*.46;
   if(w<5)continue;
   ctx.moveTo(a.x-a.ty*w*.45,a.y+a.tx*w*.45);
   ctx.lineTo(b.x-b.ty*w*.45,b.y+b.tx*w*.45);
  }
  ctx.lineWidth=style.material==='dry-ink'?1.25:.65;
  ctx.strokeStyle='#000';
  ctx.globalCompositeOperation='destination-out';
  ctx.globalAlpha=style.material==='dry-ink'?.55:.19;
  ctx.stroke();
  ctx.restore();
 }
 // A small deterministic end flake never becomes an independent splash cloud.
 if(terminal&&style.accents!=='off'&&points.length){
  const p=points[points.length-1];
  const count=style.accents==='subtle'?1:3;
  for(let i=0;i<count;i++){
   const q=noise(style.seed,i*3),v=noise(style.seed,i*3+1);
   const radius=.7+noise(style.seed,i*3+2)*1.4;
   ctx.beginPath();ctx.arc(p.x+p.tx*(4+q*8)-p.ty*(v-.5)*8,
    p.y+p.ty*(4+q*8)+p.tx*(v-.5)*8,radius,0,Math.PI*2);ctx.fill();
  }
 }
 ctx.restore();
}
