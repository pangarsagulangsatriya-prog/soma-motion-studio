import {useEffect,useRef,type RefObject} from 'react';
type PreviewRef=RefObject<HTMLCanvasElement|null>;
function Surface({label,source,ready,caption}:{
 label:string;source:PreviewRef;ready:boolean;caption:string;
}){
 const canvas=useRef<HTMLCanvasElement>(null);
 useEffect(()=>{
  let raf=0,last=0;
  const draw=(now:number)=>{
   raf=requestAnimationFrame(draw);
   if(now-last<100)return;last=now;
   const dst=canvas.current,ctx=dst?.getContext('2d'),src=source.current;
   if(!dst||!ctx)return;
   ctx.fillStyle='#000';ctx.fillRect(0,0,dst.width,dst.height);
   if(ready&&src&&src.width>0&&src.height>0){
    try{
     const scale=Math.min(dst.width/src.width,dst.height/src.height);
     const w=src.width*scale,h=src.height*scale;
     ctx.drawImage(src,(dst.width-w)/2,(dst.height-h)/2,w,h);
    }catch{/* Video/canvas can be resized or detached on source transition. */}
   }
  };
  raf=requestAnimationFrame(draw);return()=>cancelAnimationFrame(raf);
 },[source,ready]);
 return <div className="soma-setup-surface">
  <div><strong>{label}</strong><small>{ready?'Preview lokal':'Menunggu data valid'}</small></div>
  <canvas ref={canvas} width={384} height={216} aria-label={'Preview '+label}/>
  <p>{caption}</p>
 </div>;
}
/** Copies the *existing* SOMA Stage canvases. Opens no new stream or tracker. */
export function StageSetupPreview({camera,body,floor,cameraReady,bodyReady,floorReady}:{
 camera:PreviewRef;body:PreviewRef;floor:PreviewRef;
 cameraReady:boolean;bodyReady:boolean;floorReady:boolean;
}){
 return <div className="soma-setup-previews" aria-label="Preview langsung BODY dan FLOOR">
  <Surface label="CAMERA" source={camera} ready={cameraReady}
   caption={cameraReady?'Kamera dari tracker utama SOMA':'Hubungkan kamera dan pastikan frame terbaru.'}/>
  <Surface label="BODY" source={body} ready={bodyReady}
   caption={bodyReady?'Mask kaki dan paha dari engine asli':'Mask BODY menunggu tubuh dan identitas stabil.'}/>
  <Surface label="FLOOR" source={floor} ready={floorReady}
   caption={floorReady?'FloorSession kalibrasi dan event kontak':'Konfirmasi lantai sebelum membaca pad.'}/>
 </div>;
}
