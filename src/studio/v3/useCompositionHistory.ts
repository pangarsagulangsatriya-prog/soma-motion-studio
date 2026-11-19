import {useCallback,useRef,useState,type Dispatch,type SetStateAction} from 'react';

/** Undo history for immutable composition snapshots.
 * A drag/slider gesture is grouped into one undoable entry; no media blobs,
 * projector permission, or runtime camera state is captured.
 */
export function useCompositionHistory<T>(initializer:()=>T){
 const [value,setValue]=useState<T>(initializer);
 const initial=useRef(value);
 const current=useRef(value);
 const entries=useRef<T[]>([value]);
 const position=useRef(0);
 const grouping=useRef(false);
 const groupWritten=useRef(false);
 const [revision,setRevision]=useState(0);
 const bump=useCallback(()=>setRevision(v=>v+1),[]);
 const set:Dispatch<SetStateAction<T>>=useCallback(update=>{
  const previous=current.current;
  const next=typeof update==='function'?
   (update as (previous:T)=>T)(previous):update;
  if(Object.is(next,previous))return;
  const history=entries.current;
  if(grouping.current&&groupWritten.current){
   history[position.current]=next;
  }else{
   history.splice(position.current+1);
   history.push(next);
   if(history.length>60)history.shift();
   position.current=history.length-1;
   if(grouping.current)groupWritten.current=true;
  }
  current.current=next;
  setValue(next);
  bump();
 },[bump]);
 const beginGroup=useCallback(()=>{
  if(!grouping.current){grouping.current=true;groupWritten.current=false;}
 },[]);
 const endGroup=useCallback(()=>{grouping.current=false;groupWritten.current=false;},[]);
 const undo=useCallback(()=>{
  endGroup();
  if(position.current<=0)return false;
  position.current-=1;
  const next=entries.current[position.current];
  current.current=next;setValue(next);bump();
  return true;
 },[bump,endGroup]);
 const redo=useCallback(()=>{
  endGroup();
  if(position.current>=entries.current.length-1)return false;
  position.current+=1;
  const next=entries.current[position.current];
  current.current=next;setValue(next);bump();
  return true;
 },[bump,endGroup]);
 const restore=useCallback((next:T)=>{
  endGroup();
  current.current=next;
  entries.current=[next];
  position.current=0;
  setValue(next);bump();
 },[bump,endGroup]);
 return {value,set,undo,redo,restore,beginGroup,endGroup,
  canUndo:position.current>0,canRedo:position.current<entries.current.length-1,
  revision,initial:initial.current};
}
