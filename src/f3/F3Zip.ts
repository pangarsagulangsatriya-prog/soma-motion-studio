import type {F3Photo} from './F3Types.ts';
/** Small dependency-free STORE-only ZIP for four user-consented JPEGs. */
const u16=(n:number)=>[n&255,(n>>>8)&255];
const u32=(n:number)=>[n&255,(n>>>8)&255,(n>>>16)&255,(n>>>24)&255];
function crc32(bytes:Uint8Array){
 let crc=0xffffffff;
 for(const byte of bytes){crc^=byte;for(let j=0;j<8;j++)crc=(crc>>>1)^((crc&1)?0xedb88320:0);}
 return (crc^0xffffffff)>>>0;
}
export async function f3Zip(items:F3Photo[]){
 const encoder=new TextEncoder(),parts:Uint8Array[]=[];const central:Uint8Array[]=[];
 let offset=0;
 for(const item of items){
  const name=encoder.encode(`SOMA-F3-${item.slot+1}.jpg`),bytes=new Uint8Array(await item.blob.arrayBuffer());
  const crc=crc32(bytes);
  const local=new Uint8Array([80,75,3,4,...u16(20),...u16(0),...u16(0),...u16(0),...u16(0),
   ...u32(crc),...u32(bytes.length),...u32(bytes.length),...u16(name.length),...u16(0),...name]);
  parts.push(local,bytes);
  central.push(new Uint8Array([80,75,1,2,...u16(20),...u16(20),...u16(0),...u16(0),
   ...u16(0),...u16(0),...u32(crc),...u32(bytes.length),...u32(bytes.length),
   ...u16(name.length),...u16(0),...u16(0),...u16(0),...u16(0),...u32(0),...u32(offset),...name]));
  offset+=local.length+bytes.length;
 }
 const dirSize=central.reduce((a,b)=>a+b.length,0);
 const end=new Uint8Array([80,75,5,6,...u16(0),...u16(0),...u16(central.length),...u16(central.length),
 ...u32(dirSize),...u32(offset),...u16(0)]);
 const all=[...parts,...central,end];return new Blob(all.map(part=>part.slice().buffer as ArrayBuffer),{type:'application/zip'});
}
