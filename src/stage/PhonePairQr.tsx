import {useMemo} from 'react';
import {qrcodegen} from './vendor/qrcodegen.ts';

/** Renders QR in the DOM. Session ticket never leaves the page for QR generation. */
export function PhonePairQr({value}:{value:string}){
 const data=useMemo(()=>{
  const code=qrcodegen.QrCode.encodeText(value,qrcodegen.QrCode.Ecc.MEDIUM);
  let path='';
  for(let y=0;y<code.size;y++)for(let x=0;x<code.size;x++)
   if(code.getModule(x,y))path+='M'+(x+4)+' '+(y+4)+'h1v1h-1z';
  return {path,size:code.size+8};
 },[value]);
 return <svg className="soma-phone-qr" viewBox={'0 0 '+data.size+' '+data.size}
  width="240" height="240" role="img" aria-label="QR untuk menghubungkan kamera HP ke laptop"
  shapeRendering="crispEdges">
  <rect width={data.size} height={data.size} fill="#fff"/>
  <path d={data.path} fill="#101a12"/>
 </svg>;
}
