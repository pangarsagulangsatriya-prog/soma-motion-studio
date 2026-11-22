import {useEffect,useState} from 'react';

/** Supported mobile browsers keep the sender display awake while streaming.
 * Browsers may release it in the background: re-acquire only when visible.
 * This does NOT keep camera capture alive in an inactive or locked tab.
 */
type ScreenSentinel={release:()=>Promise<void>;released?:boolean};
type WakeNavigator=Navigator&{wakeLock?:{request:(kind:'screen')=>Promise<ScreenSentinel>}};
export function usePhoneWakeLock(active:boolean){
 const [awake,setAwake]=useState(false);
 const supported=typeof navigator!=='undefined'&&
  !!(navigator as WakeNavigator).wakeLock?.request;
 useEffect(()=>{
  let disposed=false,sentinel:ScreenSentinel|null=null,inFlight=false;
  const acquire=async()=>{
   if(disposed||!active||document.visibilityState!=='visible'||sentinel||inFlight)return;
   const provider=(navigator as WakeNavigator).wakeLock;
   if(!provider)return;
   inFlight=true;
   try{
    const lock=await provider.request('screen');
    if(disposed||!active||document.visibilityState!=='visible'){
     await lock.release().catch(()=>{});return;
    }
    sentinel=lock;setAwake(true);
   }catch{if(!disposed)setAwake(false);}
   finally{inFlight=false;}
  };
  const change=()=>{
   if(document.visibilityState!=='visible'){
    sentinel=null;setAwake(false);return;
   }
   void acquire();
  };
  void acquire();
  document.addEventListener('visibilitychange',change);
  return()=>{
   disposed=true;document.removeEventListener('visibilitychange',change);
   const current=sentinel;sentinel=null;
   void current?.release().catch(()=>{});
  };
 },[active]);
 return {supported,awake};
}
