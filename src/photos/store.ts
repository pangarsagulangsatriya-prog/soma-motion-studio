import type {CameraCrop} from './framing';
export type PhotoRecord={slot:number;blob:Blob;createdAt:string;width:number;height:number;mirrored:boolean;crop?:CameraCrop};
let database:Promise<IDBDatabase>|null=null;
function db(){return database??=new Promise((resolve,reject)=>{const r=indexedDB.open('soma-photo-wall',1);r.onupgradeneeded=()=>r.result.createObjectStore('photos',{keyPath:'slot'});r.onsuccess=()=>{r.result.onversionchange=()=>{r.result.close();database=null;};resolve(r.result);};r.onerror=()=>{database=null;reject(Error('Penyimpanan foto belum tersedia.'));};r.onblocked=()=>{database=null;reject(Error('Tutup tab SOMA lain lalu coba lagi.'));};});}
async function transaction<T>(mode:IDBTransactionMode,action:(store:IDBObjectStore)=>IDBRequest<T>):Promise<T>{const d=await db();return new Promise((resolve,reject)=>{const tx=d.transaction('photos',mode);const request=action(tx.objectStore('photos'));let result:T;request.onsuccess=()=>result=request.result;tx.oncomplete=()=>resolve(result);tx.onerror=tx.onabort=()=>reject(Error('Foto belum tersimpan. Periksa ruang penyimpanan browser.'));});}
export async function readPhotos(){const items=await transaction<PhotoRecord[]>('readonly',s=>s.getAll());return items.filter(p=>Number.isInteger(p.slot)&&p.slot>=0&&p.slot<4&&p.blob instanceof Blob&&p.blob.size>0);}
export const savePhoto=(photo:PhotoRecord)=>transaction('readwrite',s=>s.put(photo));
export const removePhoto=(slot:number)=>transaction('readwrite',s=>s.delete(slot));
export function cameraAvailable(video:HTMLVideoElement|null){const stream=video?.srcObject;return !!video&&video.readyState>=2&&video.videoWidth>0&&video.videoHeight>0&&!video.paused&&stream instanceof MediaStream&&stream.getVideoTracks().some(t=>t.readyState==='live');}
export function capturePhoto(video:HTMLVideoElement,slot:number,mirrored:boolean,crop?:CameraCrop):Promise<PhotoRecord>{
 if(!cameraAvailable(video))return Promise.reject(Error('Kamera belum siap. Nyalakan kamera terlebih dahulu.'));
 const area=crop??{x:0,y:0,width:video.videoWidth,height:video.videoHeight};
 if(!Object.values(area).every(Number.isFinite)||area.width<1||area.height<1||area.x<0||area.y<0||area.x+area.width>video.videoWidth||area.y+area.height>video.videoHeight)return Promise.reject(Error('Bingkai kamera tidak valid. Buka bingkai kembali.'));
 const c=document.createElement('canvas'),scale=Math.min(1,1920/Math.max(area.width,area.height));c.width=Math.round(area.width*scale);c.height=Math.round(area.height*scale);
 const x=c.getContext('2d')!;if(mirrored){x.translate(c.width,0);x.scale(-1,1);}x.drawImage(video,area.x,area.y,area.width,area.height,0,0,c.width,c.height);
 const createdAt=new Date().toISOString();return new Promise((resolve,reject)=>c.toBlob(blob=>{if(!blob?.size){reject(Error('Gambar belum berhasil diambil. Coba lagi.'));return;}resolve({slot,blob,createdAt,width:c.width,height:c.height,mirrored,...(crop?{crop}: {})});},'image/jpeg',.92));
}
