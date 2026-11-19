import {useCallback,useEffect,useMemo,useRef,useState} from 'react';
import {MAX_COMPOSE_IMPORTS,importedAssetFromFile,sharedAssetKind,trackAssetFromClip,type SharedAsset} from './sharedAssetModel.ts';

/** Owned by Stage, shared by Track and Compose. It survives Compose navigation.
 * Track MP4 uses the Track-owned decoder/canvas. Local imports have one object
 * URL each and are decoded once per Composer session, regardless of layer count.
 */
export function useSharedAssetRegistry(trackClip:File|null){
 const [imports,setImports]=useState<SharedAsset[]>([]);
 const [notice,setNotice]=useState('');
 const ownedUrls=useRef(new Map<string,string>());
 const importsRef=useRef(imports);importsRef.current=imports;
 const trackAsset=useMemo(()=>trackAssetFromClip(trackClip),[trackClip]);
 const assets=useMemo(()=>trackAsset?[trackAsset,...imports]:imports,[trackAsset,imports]);
 const addFiles=useCallback((files:readonly File[])=>{
  const accepted:SharedAsset[]=[];
  let rejected=0;
  const slots=Math.max(0,MAX_COMPOSE_IMPORTS-importsRef.current.length);
  for(const file of files){
   if(accepted.length>=slots||!sharedAssetKind(file.type,file.name)||file.size<=0||file.size>512*1024*1024){
    rejected++;continue;
   }
   const id=crypto.randomUUID(),url=URL.createObjectURL(file);
   const asset=importedAssetFromFile(file,id,url);
   if(!asset){URL.revokeObjectURL(url);rejected++;continue;}
   ownedUrls.current.set(id,url);accepted.push(asset);
  }
  if(accepted.length){importsRef.current=[...importsRef.current,...accepted];setImports(importsRef.current);}
  setNotice(accepted.length?
   accepted.length+' aset ditambahkan'+(rejected?' · '+rejected+' ditolak':''):
   (rejected?'Aset tidak didukung, kosong, terlalu besar, atau batas '+MAX_COMPOSE_IMPORTS+' tercapai.':''));
  return accepted;
 },[]);
 const removeAsset=useCallback((id:string)=>{
  if(!importsRef.current.some(asset=>asset.id===id))return false;
  importsRef.current=importsRef.current.filter(asset=>asset.id!==id);
  setImports(importsRef.current);
  const url=ownedUrls.current.get(id);
  if(url){URL.revokeObjectURL(url);ownedUrls.current.delete(id);}
  setNotice('Aset impor dilepas. Layer yang merujuk aset tersebut perlu memilih sumber baru.');
  return true;
 },[]);
 useEffect(()=>()=>{for(const url of ownedUrls.current.values())URL.revokeObjectURL(url);ownedUrls.current.clear();},[]);
 return {assets,addFiles,removeAsset,notice};
}
