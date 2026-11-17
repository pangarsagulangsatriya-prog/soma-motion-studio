import {floorToUV,type FloorSpace} from '../spatial/coordinates.ts';
import type {ArchiveResidue,ArchiveDrag,BridgeSnapshot} from './ContactArchiveBridge.ts';

export type PadPreviewPoint={x:number;y:number};
export function padPreviewPoint(floor:FloorSpace,point:ArchiveResidue['positionM'],
 width:number,height:number):PadPreviewPoint{
 if(!Number.isFinite(width)||!Number.isFinite(height)||width<1||height<1)
  throw Error('Ukuran canvas pad tidak valid.');
 const uv=floorToUV(floor,point);
 return {x:uv.x*width,y:uv.y*height};
}
/**
 * Paint archival residues into a SEPARATE local preview canvas only.
 * The normal FloorCanvas / FloorSession V3 projector renderer is unaffected.
 * A frozen thumbnail comes from the actual source video at touchdown.
 */
export function paintContactArchivePad(canvas:HTMLCanvasElement,floor:FloorSpace,
 state:BridgeSnapshot,visible:boolean,thumbnailCache:Map<string,HTMLCanvasElement>,
 gains:{A:number;B:number}={A:1,B:1}){
 const ctx=canvas.getContext('2d');
 if(!ctx)throw Error('Canvas pratinjau pad tidak tersedia.');
 const w=canvas.width,h=canvas.height;
 ctx.setTransform(1,0,0,1,0,0);
 ctx.fillStyle='#000000';ctx.fillRect(0,0,w,h);
 if(!visible||state.status==='blocked')return;
 const pxPerMeter=Math.min(w/floor.widthM,h/floor.depthM);
 ctx.lineWidth=Math.max(1,pxPerMeter*.026);
 ctx.lineCap='round';
 for(const drag of state.drags){
  const from=padPreviewPoint(floor,drag.fromM,w,h),to=padPreviewPoint(floor,drag.toM,w,h);
  ctx.strokeStyle=drag.slot==='A'?'#c4c4c4':'#999999';
  ctx.globalAlpha=.47*Math.max(0,Math.min(1,gains[drag.slot]));
  ctx.beginPath();ctx.moveTo(from.x,from.y);ctx.lineTo(to.x,to.y);ctx.stroke();
 }
 ctx.globalAlpha=1;
 for(const mark of state.residues){
  let tile=thumbnailCache.get(mark.eventId);
  if(!tile){
   tile=document.createElement('canvas');
   tile.width=mark.texture.width;tile.height=mark.texture.height;
   const layer=tile.getContext('2d');
   if(!layer)continue;
   const image=layer.createImageData(tile.width,tile.height);
   for(let i=0;i<mark.texture.gray.length;i++){
    const shade=mark.texture.gray[i],p=i*4;
    image.data[p]=shade;image.data[p+1]=shade;image.data[p+2]=shade;image.data[p+3]=255;
   }
   layer.putImageData(image,0,0);
   thumbnailCache.set(mark.eventId,tile);
  }
  const p=padPreviewPoint(floor,mark.positionM,w,h);
  const footLength=pxPerMeter*.38,footWidth=pxPerMeter*.17;
  ctx.save();ctx.translate(p.x,p.y);ctx.rotate(Math.PI/2-mark.headingRad);
  ctx.beginPath();ctx.ellipse(0,0,footWidth/2,footLength/2,-.06,0,2*Math.PI);ctx.clip();
  ctx.globalAlpha=.93*Math.max(0,Math.min(1,gains[mark.slot]));
  ctx.drawImage(tile,-footWidth/2,-footLength/2,footWidth,footLength);
  ctx.restore();
 }
 // Evict old thumbnail textures when capped fragments are discarded.
 const active=new Set(state.residues.map(item=>item.eventId));
 for(const key of thumbnailCache.keys())if(!active.has(key))thumbnailCache.delete(key);
}
