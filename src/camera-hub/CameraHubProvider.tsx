import {createContext,useContext,useEffect,useRef,useSyncExternalStore,
 type ReactNode} from 'react';
import {CameraHubRegistry} from './CameraHubRegistry.ts';
import {normalizeCameraDevices} from '../engine/universalCamera.ts';

const Context=createContext<CameraHubRegistry|null>(null);
/** Above Stage 1, Stage 2 and F3. A source stays owned by its original
 * adapter; this provider catalogs devices and observed leases, not media.
 */
export function CameraHubProvider({children}:{children:ReactNode}){
 const registry=useRef<CameraHubRegistry|null>(null);
 if(!registry.current)registry.current=new CameraHubRegistry();
 useEffect(()=>{
  const hub=registry.current!;
  let mounted=true;
  const media=navigator.mediaDevices;
  const refresh=async()=>{
   if(!media?.enumerateDevices)return;
   try{
    const list=normalizeCameraDevices(await media.enumerateDevices());
    if(mounted)hub.discover(list);
   }catch{/* Device labels may be hidden until permission is granted. */}
  };
  void refresh();
  media?.addEventListener?.('devicechange',refresh);
  return()=>{
   mounted=false;media?.removeEventListener?.('devicechange',refresh);
   hub.dispose();
  };
 },[]);
 return <Context.Provider value={registry.current}>{children}</Context.Provider>;
}
export function useCameraHub(){
 const registry=useContext(Context);
 if(!registry)throw Error('Camera Hub memerlukan CameraHubProvider.');
 return registry;
}
export function useCameraHubSnapshot(){
 const registry=useCameraHub();
 return useSyncExternalStore(registry.subscribe,registry.getSnapshot,registry.getSnapshot);
}
