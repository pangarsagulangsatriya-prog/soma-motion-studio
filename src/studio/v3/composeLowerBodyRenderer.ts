/** Pure Canvas2D orthographic renderer for Compose Lower-Body views:
 *  LEG A, LEG B, SPLIT, FOOT, and SKELETON ONLY.
 *  Styled to match SOMA's calm dark orthographic aesthetic (inspired by user's stage monitor reference). */
import {paintAuthenticFootprint} from '../../footprints/scenes/authenticFootGeometry.ts';
import {
 resolveMaskGeometry,
 type ComposeMonitorView,
 type LegChain,
 type LowerBodyComposerState,
 type LowerBodyFrameSnapshot,
 type LowerBodyTextureKind,
 type PerformerLowerBodyPose,
 type PerformerLowerBodyStyle
} from './composeLowerBodyModel.ts';

const patternCache=new Map<string,CanvasPattern|null>();

function hexToRgba(hex:string,alpha:number):string{
 const clean=hex.replace('#','').trim();
 const full=clean.length===3?clean.split('').map(c=>c+c).join(''):clean;
 const n=Number.parseInt(full,16);
 if(!Number.isFinite(n)||full.length!==6)return `rgba(220,235,222,${alpha})`;
 const r=(n>>16)&255,g=(n>>8)&255,b=n&255;
 return `rgba(${r},${g},${b},${alpha})`;
}

function getTexturePattern(
 ctx:CanvasRenderingContext2D,
 kind:LowerBodyTextureKind,
 color:string,
 secondary:string,
 scale:number
):CanvasPattern|null{
 const bucket=Math.round(scale*10);
 const key=`${kind}:${color}:${secondary}:${bucket}`;
 if(patternCache.has(key))return patternCache.get(key)??null;
 if(typeof document==='undefined')return null;
 const tile=document.createElement('canvas');
 const sz=Math.max(24,Math.round(48*scale));
 tile.width=sz;tile.height=sz;
 const g=tile.getContext('2d');
 if(!g)return null;
 g.fillStyle=hexToRgba(color,0.22);
 g.fillRect(0,0,sz,sz);

 if(kind==='linen'){
  g.strokeStyle=hexToRgba(color,0.68);
  g.lineWidth=1.2;
  const step=Math.max(4,Math.round(sz/8));
  for(let i=0;i<sz;i+=step){
   g.beginPath();g.moveTo(i,0);g.lineTo(i,sz);g.stroke();
   g.strokeStyle=hexToRgba(secondary,0.45);
   g.beginPath();g.moveTo(0,i);g.lineTo(sz,i);g.stroke();
   g.strokeStyle=hexToRgba(color,0.68);
  }
 }else if(kind==='grain'){
  for(let i=0;i<180;i++){
   const x=((i*73)%1000)/1000*sz;
   const y=((i*197)%1000)/1000*sz;
   const r=(i%3)+0.8;
   g.fillStyle=i%2===0?hexToRgba(color,0.72):hexToRgba(secondary,0.52);
   g.fillRect(x,y,r,r);
  }
 }else if(kind==='noise'){
  const cell=Math.max(3,Math.round(sz/12));
  for(let y=0;y<sz;y+=cell){
   for(let x=0;x<sz;x+=cell){
    const v=Math.abs(Math.sin(x*12.9898+y*78.233)*43758.5453)%1;
    g.fillStyle=hexToRgba(v>0.5?color:secondary,0.25+v*0.6);
    g.fillRect(x,y,cell-0.5,cell-0.5);
   }
  }
 }else{
  // organic contours
  g.strokeStyle=hexToRgba(color,0.72);
  g.lineWidth=1.5;
  for(let row=0;row<4;row++){
   const y=(row+0.5)*(sz/4);
   g.beginPath();
   for(let x=0;x<=sz;x+=4){
    const dy=Math.sin((x/sz)*Math.PI*2+row)*4.5;
    if(x===0)g.moveTo(x,y+dy);else g.lineTo(x,y+dy);
   }
   g.stroke();
  }
 }

 const pat=ctx.createPattern(tile,'repeat');
 if(patternCache.size>48)patternCache.clear();
 patternCache.set(key,pat);
 return pat;
}

function drawOrthographicGrid(ctx:CanvasRenderingContext2D,w:number,h:number,title:string,badgeRight:string){
 ctx.fillStyle='#060a08';
 ctx.fillRect(0,0,w,h);

 const cols=12,rows=7;
 ctx.strokeStyle='rgba(88,124,96,0.13)';
 ctx.lineWidth=1;
 for(let c=1;c<cols;c++){
  const x=(c/cols)*w;
  ctx.beginPath();ctx.moveTo(x,0);ctx.lineTo(x,h);ctx.stroke();
 }
 for(let r=1;r<rows;r++){
  const y=(r/rows)*h;
  ctx.beginPath();ctx.moveTo(0,y);ctx.lineTo(w,y);ctx.stroke();
 }

 // Inner orthographic safe projection frame
 const padX=w*0.11,padY=h*0.1;
 ctx.strokeStyle='rgba(116,154,124,0.26)';
 ctx.strokeRect(padX,padY,w-padX*2,h-padY*2);

 // Top-left technical view label
 ctx.fillStyle='#90a694';
 ctx.font='600 11px ui-monospace, SFMono-Regular, monospace';
 ctx.fillText(title,18,24);

 // Top-right A/B indicator
 if(badgeRight){
  ctx.textAlign='right';
  ctx.fillStyle='#a8c5ad';
  ctx.fillText(badgeRight,w-18,24);
  ctx.textAlign='left';
 }
}

/** Traces one anatomically tapered leg polygon (hip -> thigh -> knee -> calf -> ankle -> foot sole). */
function traceLegPath(
 ctx:CanvasRenderingContext2D,
 leg:LegChain,
 w:number,
 h:number,
 spread:number,
 cutoffYNorm:number,
 offsetX:number,
 offsetY:number
){
 const sx=(p:{x:number;y:number})=>(p.x+offsetX)*w;
 const sy=(p:{x:number;y:number})=>(p.y+offsetY)*h;

 const hipX=sx(leg.hip),hipY=sy(leg.hip);
 const kneeX=sx(leg.knee),kneeY=sy(leg.knee);
 const ankleX=sx(leg.ankle),ankleY=sy(leg.ankle);
 const heelX=sx(leg.heel),heelY=sy(leg.heel);
 const toeX=sx(leg.toe),toeY=sy(leg.toe);
 const cutY=Math.max(hipY,cutoffYNorm*h);

 const thighHalf=23*spread;
 const kneeHalf=16*spread;
 const calfHalf=15*spread;
 const ankleHalf=10*spread;
 const calfY=kneeY+(ankleY-kneeY)*0.36;
 const calfX=kneeX+(ankleX-kneeX)*0.36;

 // Interpolate top x at cutoffY
 const tTop=Math.min(1,Math.max(0,(cutY-hipY)/Math.max(1,kneeY-hipY)));
 const topX=hipX+(kneeX-hipX)*tTop;
 const topHalf=thighHalf+(kneeHalf-thighHalf)*tTop;

 ctx.beginPath();
 ctx.moveTo(topX-topHalf,cutY);
 if(cutY<kneeY){
  ctx.lineTo(kneeX-kneeHalf,kneeY);
 }
 ctx.lineTo(calfX-calfHalf,calfY);
 ctx.lineTo(ankleX-ankleHalf,ankleY);
 // Foot silhouette (direction-aware so left-pointing and right-pointing feet never twist)
 const soleY=Math.max(heelY,toeY)+8;
 if(toeX<ankleX){
  // Left foot pointing left: outer left goes forward over instep to toe, flat sole to heel, heel up to inner ankle
  ctx.quadraticCurveTo(toeX-4,ankleY+10,toeX-10,soleY-4);
  ctx.quadraticCurveTo(toeX-12,soleY+2,toeX,soleY+2);
  ctx.lineTo(ankleX+ankleHalf+8,soleY+2);
  ctx.quadraticCurveTo(ankleX+ankleHalf+14,soleY,ankleX+ankleHalf+4,ankleY+8);
 }else{
  // Right foot pointing right: outer left goes down around heel, flat sole to toe, instep up to right ankle
  ctx.quadraticCurveTo(ankleX-ankleHalf-12,soleY,ankleX-ankleHalf-6,soleY+2);
  ctx.lineTo(toeX+6,soleY+2);
  ctx.quadraticCurveTo(toeX+16,soleY+2,toeX+12,soleY-5);
  ctx.quadraticCurveTo(toeX+4,ankleY+10,ankleX+ankleHalf,ankleY);
 }
 ctx.lineTo(ankleX+ankleHalf,ankleY);
 ctx.lineTo(calfX+calfHalf,calfY);
 if(cutY<kneeY){
  ctx.lineTo(kneeX+kneeHalf,kneeY);
 }
 ctx.lineTo(topX+topHalf,cutY);
 ctx.closePath();
}

function paintMaskedLegFill(
 ctx:CanvasRenderingContext2D,
 leg:LegChain,
 style:PerformerLowerBodyStyle,
 look:LowerBodyComposerState['look'],
 feather:number,
 spread:number,
 cutoffYNorm:number,
 w:number,
 h:number,
 mediaSource?:HTMLImageElement|HTMLVideoElement|null
){
 ctx.save();
 traceLegPath(ctx,leg,w,h,spread,cutoffYNorm,style.offsetX,style.offsetY);
 ctx.clip();

 if(feather>0){
  ctx.shadowColor=hexToRgba(style.color,0.55);
  ctx.shadowBlur=feather*1.4;
 }
 ctx.globalAlpha=Math.min(1,Math.max(0.1,style.opacity));
 ctx.filter=`brightness(${style.brightness.toFixed(2)})`;

 if(look==='solid'){
  ctx.fillStyle=hexToRgba(style.color,0.92);
  ctx.fillRect(0,0,w,h);
 }else if(look==='wash'){
  const gx=(leg.knee.x+style.offsetX)*w;
  const gy=(leg.knee.y+style.offsetY)*h;
  const grad=ctx.createRadialGradient(gx,gy-30,14,gx,gy+40,h*0.44);
  grad.addColorStop(0,hexToRgba(style.secondaryColor,0.95));
  grad.addColorStop(0.55,hexToRgba(style.color,0.78*style.blendStrength+0.18));
  grad.addColorStop(1,hexToRgba(style.color,0.16));
  ctx.fillStyle=grad;
  ctx.fillRect(0,0,w,h);
 }else if(look==='texture'){
  const pat=getTexturePattern(ctx,style.texture,style.color,style.secondaryColor,style.textureScale);
  ctx.fillStyle=pat??hexToRgba(style.color,0.8);
  ctx.fillRect(0,0,w,h);
 }else if(look==='image'){
  if(mediaSource){
   ctx.drawImage(mediaSource,0,0,w,h);
   ctx.globalCompositeOperation='multiply';
   ctx.fillStyle=hexToRgba(style.color,0.35+style.blendStrength*0.45);
   ctx.fillRect(0,0,w,h);
  }else{
   // High-contrast monochrome archival halftone / film look when no custom image is imported yet
   const grad=ctx.createLinearGradient(0,cutoffYNorm*h,0,h*0.92);
   grad.addColorStop(0,hexToRgba(style.secondaryColor,0.85));
   grad.addColorStop(0.5,hexToRgba(style.color,0.94));
   grad.addColorStop(1,'#141916');
   ctx.fillStyle=grad;
   ctx.fillRect(0,0,w,h);
   const pat=getTexturePattern(ctx,'grain','#f2f6f2','#2c332e',style.textureScale);
   if(pat){
    ctx.globalAlpha=0.45;
    ctx.fillStyle=pat;
    ctx.fillRect(0,0,w,h);
   }
  }
 }
 ctx.restore();

 // Crisp rim stroke around masked lower-body silhouette
 ctx.save();
 traceLegPath(ctx,leg,w,h,spread,cutoffYNorm,style.offsetX,style.offsetY);
 ctx.strokeStyle=hexToRgba(style.secondaryColor,0.85);
 ctx.lineWidth=1.75;
 ctx.stroke();
 ctx.restore();
}

function drawUpperUnmaskedWireframe(ctx:CanvasRenderingContext2D,leg:LegChain,w:number,h:number,cutoffYNorm:number,stroke:string){
 const hipY=leg.hip.y*h;
 const cutY=cutoffYNorm*h;
 if(cutY<=hipY+2)return;
 const hipX=leg.hip.x*w;
 const kneeX=leg.knee.x*w,kneeY=leg.knee.y*h;
 const tTop=Math.min(1,Math.max(0,(cutY-hipY)/Math.max(1,kneeY-hipY)));
 const topX=hipX+(kneeX-hipX)*tTop;

 ctx.save();
 ctx.strokeStyle=stroke;
 ctx.lineWidth=1.2;
 ctx.setLineDash([4,4]);
 ctx.beginPath();
 ctx.moveTo(hipX-22,hipY-26);
 ctx.lineTo(topX-20,cutY);
 ctx.moveTo(hipX+22,hipY-26);
 ctx.lineTo(topX+20,cutY);
 ctx.stroke();
 ctx.restore();
}

function drawCutoffGuide(ctx:CanvasRenderingContext2D,w:number,h:number,cutoffYNorm:number,label:string){
 const y=cutoffYNorm*h;
 ctx.save();
 ctx.strokeStyle='#9f95e8';
 ctx.lineWidth=1.7;
 ctx.beginPath();
 ctx.moveTo(w*0.18,y);
 ctx.lineTo(w*0.82,y);
 ctx.stroke();

 ctx.fillStyle='#aba2f0';
 ctx.font='600 10.5px ui-monospace, SFMono-Regular, monospace';
 ctx.fillText(label,w*0.19,y-8);
 ctx.restore();
}

function drawSkeletonPerformer(
 ctx:CanvasRenderingContext2D,
 perf:PerformerLowerBodyPose,
 w:number,
 h:number,
 accent:string,
 cutoffYNorm:number,
 fullBody:boolean
){
 const px=(p:{x:number;y:number})=>p.x*w;
 const py=(p:{x:number;y:number})=>p.y*h;
 const cutY=cutoffYNorm*h;

 ctx.save();
 // Full torso lines only if fullBody is toggled
 if(fullBody&&perf.torso){
  const t=perf.torso;
  ctx.strokeStyle=hexToRgba(accent,0.58);
  ctx.lineWidth=1.6;
  ctx.beginPath();
  ctx.moveTo(px(t.shoulderL),py(t.shoulderL));
  ctx.lineTo(px(t.shoulderR),py(t.shoulderR));
  ctx.lineTo(px(perf.right.hip),py(perf.right.hip));
  ctx.lineTo(px(perf.left.hip),py(perf.left.hip));
  ctx.closePath();
  ctx.stroke();

  const neckX=(px(t.shoulderL)+px(t.shoulderR))*0.5;
  const neckY=(py(t.shoulderL)+py(t.shoulderR))*0.5;
  ctx.beginPath();
  ctx.moveTo(neckX,neckY);
  ctx.lineTo(px(t.head),py(t.head)+12);
  ctx.stroke();
  ctx.beginPath();
  ctx.arc(px(t.head),py(t.head)+6,10,0,Math.PI*2);
  ctx.stroke();
 }

 // Dotted bilateral guides (hip, thigh, knee, ankle) like reference image
 const pairs:[{x:number;y:number},{x:number;y:number}][]=[
  [perf.left.hip,perf.right.hip],
  [perf.left.thighMid,perf.right.thighMid],
  [perf.left.knee,perf.right.knee],
  [perf.left.ankle,perf.right.ankle]
 ];
 ctx.strokeStyle='rgba(204,218,236,0.42)';
 ctx.lineWidth=1.1;
 ctx.setLineDash([3,4]);
 for(const [l,r] of pairs){
  ctx.beginPath();ctx.moveTo(px(l),py(l));ctx.lineTo(px(r),py(r));ctx.stroke();
 }
 ctx.setLineDash([]);

 // Draw each leg chain as crisp orthographic wireframe + anatomical outline
 for(const leg of [perf.left,perf.right]){
  // Silhouette contour
  traceLegPath(ctx,leg,w,h,0.92,fullBody?leg.hip.y:cutoffYNorm,0,0);
  ctx.strokeStyle=hexToRgba(accent,0.92);
  ctx.lineWidth=2.1;
  ctx.stroke();

  // Bone spine
  ctx.strokeStyle=hexToRgba(accent,0.55);
  ctx.lineWidth=1.4;
  ctx.beginPath();
  ctx.moveTo(px(leg.hip),Math.max(fullBody?0:cutY,py(leg.hip)));
  ctx.lineTo(px(leg.knee),py(leg.knee));
  ctx.lineTo(px(leg.ankle),py(leg.ankle));
  ctx.lineTo(px(leg.toe),py(leg.toe));
  ctx.stroke();

  // Joint nodes
  const joints=[leg.thighMid,leg.knee,leg.ankle];
  ctx.fillStyle=accent;
  for(const j of joints){
   if(!fullBody&&py(j)<cutY-4)continue;
   ctx.beginPath();
   ctx.arc(px(j),py(j),4.2,0,Math.PI*2);
   ctx.fill();
  }
 }
 ctx.restore();
}

function drawFootFocusView(
 ctx:CanvasRenderingContext2D,
 frame:LowerBodyFrameSnapshot,
 state:LowerBodyComposerState,
 w:number,
 h:number
){
 drawOrthographicGrid(ctx,w,h,'FOOT / SOLE CONTACT VIEW','A · B');

 const activePerformers=frame.performers;
 const slotW=activePerformers.length===2?w*0.44:w*0.64;

 activePerformers.forEach((perf,idx)=>{
  const style=perf.id==='A'?state.styleA:state.styleB;
  const cx=activePerformers.length===2?(idx===0?w*0.29:w*0.71):w*0.5;
  const cy=h*0.52;

  // Orthographic foot zone frame
  ctx.save();
  ctx.strokeStyle='rgba(128,168,136,0.28)';
  ctx.strokeRect(cx-slotW*0.42,h*0.18,slotW*0.84,h*0.64);

  ctx.fillStyle='#cbe9a7';
  ctx.font='700 11px ui-monospace, SFMono-Regular, monospace';
  ctx.fillText(`FOOT ${perf.id} · ${Math.round(perf.confidence*100)}% CONFIDENCE`,cx-slotW*0.42+10,h*0.18+18);

  // Left & Right soles rendered cleanly using canonical authenticFootGeometry
  const feet:[{leg:LegChain;side:'left'|'right';dx:number}][]=[
   [{leg:perf.left,side:'left',dx:-slotW*0.17}],
   [{leg:perf.right,side:'right',dx:slotW*0.17}]
  ];
  for(const [{leg,side,dx}] of feet){
   const fx=cx+dx+(leg.ankle.x-(perf.left.ankle.x+perf.right.ankle.x)*0.5)*180;
   const fy=cy+(leg.planted?12:-24);

   // Contact halo when planted
   if(leg.planted){
    const glow=ctx.createRadialGradient(fx,fy,12,fx,fy,82);
    glow.addColorStop(0,hexToRgba(style.color,0.42*style.opacity));
    glow.addColorStop(1,hexToRgba(style.color,0));
    ctx.fillStyle=glow;
    ctx.fillRect(fx-84,fy-84,168,168);
   }

   paintAuthenticFootprint(ctx,{
    x:fx,
    y:fy,
    side,
    headingRad:leg.headingRad,
    widthPx:56,
    lengthPx:132,
    alpha:leg.planted?0.94:0.42,
    color:style.color
   });

   // Heel & toe vector pins
   ctx.strokeStyle=hexToRgba(style.secondaryColor,0.85);
   ctx.lineWidth=1.4;
   ctx.beginPath();
   ctx.moveTo(fx,fy-62);
   ctx.lineTo(fx+Math.sin(leg.headingRad)*28,fy-86);
   ctx.stroke();

   ctx.fillStyle=leg.planted?'#d7f5bc':'#8ea593';
   ctx.font='600 10px ui-monospace, SFMono-Regular, monospace';
   ctx.textAlign='center';
   ctx.fillText(side==='left'?'L · '+(leg.planted?'CONTACT':'AIR'):'R · '+(leg.planted?'CONTACT':'AIR'),fx,fy+84);
   ctx.textAlign='left';
  }
  ctx.restore();
 });

 ctx.fillStyle='#8ba591';
 ctx.font='600 10px ui-monospace, SFMono-Regular, monospace';
 ctx.textAlign='right';
 ctx.fillText(frame.actionLabel,w-24,h-18);
 ctx.textAlign='left';
}

export interface RenderLowerBodyOptions{
 view:Exclude<ComposeMonitorView,'FLOOR'>;
 state:LowerBodyComposerState;
 frame:LowerBodyFrameSnapshot;
 mediaA?:HTMLImageElement|HTMLVideoElement|null;
 mediaB?:HTMLImageElement|HTMLVideoElement|null;
 blackout?:boolean;
}

export function renderLowerBodyStageMonitor(
 ctx:CanvasRenderingContext2D,
 w:number,
 h:number,
 opts:RenderLowerBodyOptions
){
 ctx.setTransform(1,0,0,1,0,0);
 if(opts.blackout){
  ctx.fillStyle='#020403';
  ctx.fillRect(0,0,w,h);
  return;
 }

 const {view,state,frame}=opts;
 const {cutoff,spread}=resolveMaskGeometry(state);
 const cutoffYNorm=0.25+cutoff*0.52;

 if(view==='FOOT'){
  drawFootFocusView(ctx,frame,state,w,h);
  return;
 }

 const title=view==='SKELETON'
  ?'SKELETON ONLY / ORTHOGRAPHIC'
  :view==='SPLIT'
   ?'SPLIT · LEG A & LEG B'
   :`${view} / PROJECTOR VIEW`;

 const rightTag=frame.performers.length===2?'A   B':'A';
 drawOrthographicGrid(ctx,w,h,title,rightTag);

 const visiblePerformers=view==='LEG A'
  ?frame.performers.filter(p=>p.id==='A')
  :view==='LEG B'
   ?frame.performers.filter(p=>p.id==='B')
   :frame.performers;

 // Center single performer cleanly when LEG A or LEG B is isolated
 const centeredList=visiblePerformers.map(p=>{
  if(view!=='LEG A'&&view!=='LEG B')return p;
  const cx=(p.left.hip.x+p.right.hip.x)*0.5;
  const shift=0.5-cx;
  const move=(pt:{x:number;y:number})=>({x:pt.x+shift,y:pt.y});
  const moveChain=(c:LegChain):LegChain=>({
   ...c,
   hip:move(c.hip),thighMid:move(c.thighMid),knee:move(c.knee),
   ankle:move(c.ankle),heel:move(c.heel),toe:move(c.toe)
  });
  return {
   ...p,
   left:moveChain(p.left),
   right:moveChain(p.right),
   torso:p.torso?{
    shoulderL:move(p.torso.shoulderL),
    shoulderR:move(p.torso.shoulderR),
    head:move(p.torso.head)
   }:undefined
  };
 });

 if(view==='SKELETON'){
  for(const perf of centeredList){
   const accent=perf.id==='A'?'#a89ff0':'#3da5ff';
   drawSkeletonPerformer(ctx,perf,w,h,accent,cutoffYNorm,state.skeletonScope==='full');
  }
  if(state.showCutoffLine){
   drawCutoffGuide(ctx,w,h,cutoffYNorm,'UPPER THIGH CUTOFF');
  }
 }else{
  // SPLIT divider when comparing A and B
  if(view==='SPLIT'&&centeredList.length===2){
   ctx.save();
   ctx.strokeStyle='rgba(128,166,136,0.22)';
   ctx.setLineDash([5,5]);
   ctx.beginPath();ctx.moveTo(w*0.5,h*0.1);ctx.lineTo(w*0.5,h*0.9);ctx.stroke();
   ctx.restore();
  }

  for(const perf of centeredList){
   const style=perf.id==='A'?state.styleA:state.styleB;
   const media=perf.id==='A'?opts.mediaA:opts.mediaB;
   // Draw subtle unmasked upper thigh wireframe above cutoff
   drawUpperUnmaskedWireframe(ctx,perf.left,w,h,cutoffYNorm,'rgba(162,156,224,0.34)');
   drawUpperUnmaskedWireframe(ctx,perf.right,w,h,cutoffYNorm,'rgba(162,156,224,0.34)');
   // Draw masked lower-body visual fills
   paintMaskedLegFill(ctx,perf.left,style,state.look,state.feather,spread,cutoffYNorm,w,h,media);
   paintMaskedLegFill(ctx,perf.right,style,state.look,state.feather,spread,cutoffYNorm,w,h,media);
  }

  if(state.showCutoffLine){
   const maskMeta=state.maskPreset==='tight'
    ?'KNEE / CALF CUTOFF'
    :state.maskPreset==='wide'
     ?'WIDE THIGH CUTOFF'
     :'UPPER THIGH CUTOFF';
   drawCutoffGuide(ctx,w,h,cutoffYNorm,maskMeta);
  }
 }

 // Bottom confidence & live simulation/tracking badges matching reference image (clear of foot soles)
 if(state.showConfidence){
  ctx.font='600 11px ui-monospace, SFMono-Regular, monospace';
  const perfA=centeredList.find(p=>p.id==='A');
  const perfB=centeredList.find(p=>p.id==='B');
  if(perfA){
   ctx.fillStyle='#8fd6b4';
   ctx.fillText(`A / ${Math.round(perfA.confidence*100)}% CONFIDENCE`,w*0.13,h*0.885);
  }
  if(perfB){
   ctx.fillStyle='#9fa8f2';
   ctx.textAlign='right';
   ctx.fillText(`B / ${Math.round(perfB.confidence*100)}% CONFIDENCE`,w*0.87,h*0.885);
   ctx.textAlign='left';
  }
 }

 // Crossing / ambiguity notice kept clean and non-intrusive
 if(frame.ambiguous){
  ctx.save();
  ctx.fillStyle='rgba(44,32,20,0.86)';
  ctx.strokeStyle='#b89056';
  ctx.lineWidth=1;
  ctx.fillRect(w*0.5-145,h*0.11,290,26);
  ctx.strokeRect(w*0.5-145,h*0.11,290,26);
  ctx.fillStyle='#f5ddb5';
  ctx.font='600 10.5px ui-monospace, SFMono-Regular, monospace';
  ctx.textAlign='center';
  ctx.fillText('CROSSING · IDENTITAS A/B DIJAGA',w*0.5,h*0.11+16);
  ctx.restore();
 }

 // Bottom-right status label
 ctx.fillStyle='#869e8c';
 ctx.font='600 10px ui-monospace, SFMono-Regular, monospace';
 ctx.textAlign='right';
 ctx.fillText(frame.actionLabel,w-24,h-18);
 ctx.textAlign='left';
}
