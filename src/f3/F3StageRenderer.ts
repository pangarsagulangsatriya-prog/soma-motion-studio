import type {F3Photo,F3StageFrame,F3Rect} from './F3Types.ts';
export const F3_STAGE_WIDTH=1600,F3_STAGE_HEIGHT=800;
export const F3_LAYOUT={ratio:2 as const,gridFraction:.30,gapFraction:.02};
const fitCover=(srcWidth:number,srcHeight:number,dstX:number,dstY:number,dstW:number,dstH:number)=>{
 const scale=Math.max(dstW/srcWidth,dstH/srcHeight),sw=dstW/scale,sh=dstH/scale;
 return {sx:(srcWidth-sw)/2,sy:(srcHeight-sh)/2,sw,sh,dstX,dstY,dstW,dstH};
};
export function f3PhotoTileRects(width:number,height:number,gridFraction=F3_LAYOUT.gridFraction,
 gapFraction=F3_LAYOUT.gapFraction){
 const left=Math.round(width*gridFraction),gap=Math.round(width*gapFraction);
 const pad=Math.round(width*.009),tileGap=Math.round(width*.008);
 const tileW=(left-2*pad-tileGap)/2;
 // V3.1: near-square photo cards, visually centered as a 2×2 group.
 const tileH=Math.min(tileW*1.04,(height-2*pad-tileGap)/2);
 const firstY=(height-(tileH*2+tileGap))/2;
 return Array.from({length:4},(_,i)=>({
  x:pad+(i%2)*(tileW+tileGap),y:firstY+Math.floor(i/2)*(tileH+tileGap),
  width:tileW,height:tileH
 }));
}
const archiveCache=new Map<string,HTMLImageElement>();
function tilePhoto(ctx:CanvasRenderingContext2D,item:F3Photo,x:number,y:number,w:number,h:number){
 let img=archiveCache.get(item.url);
 if(!img){img=new Image();img.src=item.url;archiveCache.set(item.url,img);}
 if(!img.complete||!img.naturalWidth)return;
 const f=fitCover(img.naturalWidth,img.naturalHeight,x,y,w,h);
 const since=Date.now()-Date.parse(item.createdAt);
 const progress=Number.isFinite(since)?Math.min(1,Math.max(0,since/280)):1;
 const eased=1-Math.pow(1-progress,3);
 ctx.save();ctx.globalAlpha=eased;
 ctx.drawImage(img,f.sx,f.sy,f.sw,f.sh,x,y,w,h);
 ctx.restore();
}
/** Canonical painter for operator preview, inline/local fullscreen and gated projector canvas. */
export function drawF3Stage(ctx:CanvasRenderingContext2D,frame:F3StageFrame,videoA:HTMLVideoElement|null,videoB:HTMLVideoElement|null){
 const W=ctx.canvas.width,H=ctx.canvas.height,gap=Math.round(W*frame.layout.gapFraction);
 const left=Math.round(W*frame.layout.gridFraction),rightX=left+gap,rightW=W-rightX;
 ctx.save();ctx.fillStyle='#050807';ctx.fillRect(0,0,W,H);
 // Camera A forms the moving background of this single 2:1 canvas.
 // Neither the photo capture nor the B crop ever samples from A.
 const active=frame.state==='LIVE'||frame.state==='SIMULATION';
 const actorReady=active&&!!videoA&&videoA.readyState>=2&&videoA.videoWidth>0&&videoA.videoHeight>0;
 if(actorReady){
  const a=fitCover(videoA!.videoWidth,videoA!.videoHeight,0,0,W,H);
  try{ctx.drawImage(videoA!,a.sx,a.sy,a.sw,a.sh,0,0,W,H);}catch{/* Camera changed mid-frame. */}
  ctx.fillStyle='rgba(2,6,4,.43)';ctx.fillRect(0,0,W,H);
 }
 const tiles=f3PhotoTileRects(W,H,frame.layout.gridFraction,frame.layout.gapFraction);
 for(let i=0;i<4;i++){
  const {x,y,width:tileW,height:tileH}=tiles[i];
  ctx.fillStyle=actorReady?'rgba(9,18,13,.48)':'#0c1310';ctx.fillRect(x,y,tileW,tileH);
  const item=frame.photoSlots[i];if(item)tilePhoto(ctx,item,x,y,tileW,tileH);
  ctx.strokeStyle=item?'#718976':'#24392c';ctx.lineWidth=2;ctx.strokeRect(x+.5,y+.5,tileW-1,tileH-1);
  if(!item){ctx.fillStyle='#466151';ctx.font='500 24px system-ui';ctx.textAlign='center';ctx.fillText(String(i+1).padStart(2,'0'),x+tileW/2,y+tileH/2);}
 }
 ctx.fillStyle=actorReady?'rgba(2,7,5,.30)':'#050807';ctx.fillRect(rightX,0,rightW,H);
 const crop=frame.cameraB.crop;
 const canDraw=videoB?.readyState&&videoB.readyState>=2&&
  crop.width>0&&crop.height>0&&crop.x>=0&&crop.y>=0&&
  crop.x+crop.width<=videoB.videoWidth&&crop.y+crop.height<=videoB.videoHeight;
 if(canDraw&&frame.state!=='BLACKOUT'&&frame.state!=='FREEZE'){
  try{
   ctx.save();ctx.globalAlpha=actorReady?.94:1;
   if(frame.cameraB.mirror){
    ctx.translate(rightX+rightW,0);ctx.scale(-1,1);
    ctx.drawImage(videoB!,crop.x,crop.y,crop.width,crop.height,0,0,rightW,H);
   }else ctx.drawImage(videoB!,crop.x,crop.y,crop.width,crop.height,rightX,0,rightW,H);
   ctx.restore();
  }catch{ctx.restore();/* Invalidated source: next frame remains dark. */}
 }
 if(frame.state==='BLACKOUT'){ctx.fillStyle='#050807';ctx.fillRect(0,0,W,H);ctx.restore();return;}
 if(frame.overlay.corners){
  const inset=20,arm=32;ctx.strokeStyle='rgba(223,247,213,.65)';ctx.lineWidth=3;
  for(const x of [rightX+inset,rightX+rightW-inset])for(const y of [inset,H-inset]){
   const sx=x<rightX+rightW/2?1:-1,sy=y<H/2?1:-1;
   ctx.beginPath();ctx.moveTo(x,y+sy*arm);ctx.lineTo(x,y);ctx.lineTo(x+sx*arm,y);ctx.stroke();
  }
 }
 if(frame.overlay.liveIndicator&&canDraw&&frame.state!=='FREEZE'){
  ctx.fillStyle='rgba(5,8,7,.63)';ctx.fillRect(rightX+35,30,105,38);
  ctx.fillStyle='#c1e1bb';ctx.beginPath();ctx.arc(rightX+54,48,6,0,Math.PI*2);ctx.fill();
  ctx.font='600 18px system-ui';ctx.textAlign='left';ctx.fillText(frame.state==='SIMULATION'?'SIM':'LIVE',rightX+71,55);
 }
 if(frame.overlay.flashUntil&&performance.now()<frame.overlay.flashUntil){
  ctx.fillStyle='rgba(235,247,232,.10)';ctx.fillRect(rightX,0,rightW,H);
 }
 ctx.restore();
}
export function makeF3StageFrame(params:{sourceId:string;frameId:number;timestamp:number;crop:F3Rect;slots:F3StageFrame['photoSlots'];state:F3StageFrame['state'];flashUntil?:number}):F3StageFrame{
 return {layout:F3_LAYOUT,cameraB:{sourceId:params.sourceId,frameId:params.frameId,timestamp:params.timestamp,crop:params.crop,mirror:false},
  photoSlots:params.slots,overlay:{liveIndicator:true,corners:true,zoomIndicator:true,flashUntil:params.flashUntil},state:params.state};
}
