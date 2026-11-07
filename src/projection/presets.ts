import {homography,correspondence} from './geometry.ts';
import {validateProjection,type ProjectionConfig} from './model.ts';
export type DeviceSnapshot={camera:{id:string;label:string;width:number;height:number};output:{width:number;height:number;viewportWidth:number;viewportHeight:number;dpr:number}};
export type ProjectionPreset={version:2;name:string;config:ProjectionConfig;devices:DeviceSnapshot;order:['TL','TR','BR','BL'];matrices:{screen:number[];cameraToProjector:number[]|null}};
export function makePreset(name:string,config:ProjectionConfig,devices:DeviceSnapshot):ProjectionPreset{return {version:2,name:name.slice(0,60),config:structuredClone(config),devices:structuredClone(devices),order:['TL','TR','BR','BL'],matrices:{screen:homography(config.quad),cameraToProjector:config.registration.enabled?correspondence(config.registration.source,config.registration.destination):null}};}
export function readPreset(value:unknown):{name:string;config:ProjectionConfig;devices:DeviceSnapshot|null;legacy:boolean}{
 const raw=value as ProjectionPreset;const config=validateProjection(raw);if(!raw||typeof raw.name!=='string'||!raw.name.trim()||raw.name.length>60)throw Error('Nama preset belum valid.');
 if((raw.version as number)===1)return {name:raw.name,config,devices:null,legacy:true};
 const d=raw.devices;if(!d?.camera||!d?.output||typeof d.camera.id!=='string'||typeof d.camera.label!=='string'||d.camera.id.length>512||d.camera.label.length>256)throw Error('Informasi perangkat belum valid.');
 for(const n of [d.camera.width,d.camera.height,d.output.width,d.output.height,d.output.viewportWidth,d.output.viewportHeight])if(!Number.isInteger(n)||n<0||n>16384)throw Error('Ukuran perangkat di luar jangkauan.');
 if(d.output.width<1||d.output.height<1||!Number.isFinite(d.output.dpr)||d.output.dpr<=0||d.output.dpr>8)throw Error('Resolusi output belum valid.');
 if(JSON.stringify(raw.order)!==JSON.stringify(['TL','TR','BR','BL']))throw Error('Urutan titik perlu TL, TR, BR, BL.');
 const expected=makePreset(raw.name,config,d).matrices;for(const k of ['screen','cameraToProjector'] as const){const a=raw.matrices?.[k],b=expected[k];if(b===null){if(a!==null)throw Error('Matriks registrasi tidak cocok.');}else if(!Array.isArray(a)||a.length!==9||a.some((v,i)=>!Number.isFinite(v)||Math.abs(v-b[i])>1e-6))throw Error('Matriks tidak cocok dengan titik kalibrasi.');}
 return {name:raw.name,config,devices:structuredClone(d),legacy:false};
}
export function deviceWarnings(saved:DeviceSnapshot|null,current:DeviceSnapshot):string[]{
 if(!saved)return ['Preset Sprint 1: perangkat belum tercatat. Periksa kamera dan ukuran output.'];const warnings:string[]=[];
 if(saved.camera.id&&saved.camera.id!==current.camera.id)warnings.push('Kamera berbeda atau belum aktif. Pilih kamera yang sesuai lalu periksa titik sumber.');
 if(saved.camera.width!==current.camera.width||saved.camera.height!==current.camera.height)warnings.push('Resolusi kamera berubah. Periksa framing dan registrasi.');
 if(saved.output.width!==current.output.width||saved.output.height!==current.output.height)warnings.push('Resolusi raster output berbeda dari simpanan. Periksa posisi titik dalam piksel.');
 if(saved.output.viewportWidth!==current.output.viewportWidth||saved.output.viewportHeight!==current.output.viewportHeight||saved.output.dpr!==current.output.dpr)warnings.push('Ukuran jendela atau skala layar berubah. Periksa fullscreen dan bidang fisik.');return warnings;
}
