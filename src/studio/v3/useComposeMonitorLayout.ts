import {useEffect,useRef,useState,type CSSProperties,type KeyboardEvent,type PointerEvent} from 'react';

export type ComposeLayoutPreset='balanced'|'floor'|'input'|'body';
export type ComposeLayoutSelection=ComposeLayoutPreset|'custom';
export type ComposeLayout={floor:number;input:number;preset:ComposeLayoutSelection};
const KEY='soma-compose-monitor-layout-v1';
export const COMPOSE_LAYOUT_PRESETS:Record<ComposeLayoutPreset,ComposeLayout>={
 balanced:{floor:60,input:50,preset:'balanced'},
 floor:{floor:72,input:50,preset:'floor'},
 input:{floor:42,input:68,preset:'input'},
 body:{floor:42,input:32,preset:'body'}
};
const clamp=(value:number,min:number,max:number)=>Math.max(min,Math.min(max,value));
export const normalizeComposeLayout=(raw:unknown):ComposeLayout=>{
 if(!raw||typeof raw!=='object')return {...COMPOSE_LAYOUT_PRESETS.balanced};
 const source=raw as Partial<ComposeLayout>;
 if(typeof source.floor!=='number'||typeof source.input!=='number'||!Number.isFinite(source.floor)||!Number.isFinite(source.input))return {...COMPOSE_LAYOUT_PRESETS.balanced};
 return {floor:clamp(source.floor!,30,75),input:clamp(source.input!,25,75),
  preset:source.preset==='floor'||source.preset==='input'||source.preset==='body'||source.preset==='custom' ?source.preset:'balanced'};
};
export function useComposeMonitorLayout(){
 const [layout,setLayout]=useState<ComposeLayout>(()=>{
  try{return normalizeComposeLayout(JSON.parse(localStorage.getItem(KEY)??'null'));}
  catch{return {...COMPOSE_LAYOUT_PRESETS.balanced};}
 });
 const overview=useRef<HTMLDivElement>(null);
 const drag=useRef<'vertical'|'horizontal'|null>(null);
 useEffect(()=>{try{localStorage.setItem(KEY,JSON.stringify(layout));}catch{/* Private storage can be disabled. */}},[layout]);
 const preset=(value:ComposeLayoutPreset)=>setLayout({...COMPOSE_LAYOUT_PRESETS[value]});
 const begin=(axis:'vertical'|'horizontal')=>(event:PointerEvent<HTMLButtonElement>)=>{
  if(event.button!==0)return;
  drag.current=axis;
  event.currentTarget.setPointerCapture(event.pointerId);
  event.preventDefault();
 };
 const move=(axis:'vertical'|'horizontal')=>(event:PointerEvent<HTMLButtonElement>)=>{
  if(drag.current!==axis)return;
  const root=overview.current;
  if(!root)return;
  const bounds=root.getBoundingClientRect();
  if(axis==='vertical'){
   const percent=(event.clientX-bounds.left)/bounds.width*100;
   setLayout(prev=>({...prev,floor:clamp(percent,30,75),preset:'custom'}));
  }else{
   const input=root.querySelector<HTMLElement>('.fp-stage-video');
   const body=root.querySelector<HTMLElement>('.fp-preview-body');
   if(!input||!body)return;
   const first=input.getBoundingClientRect(),second=body.getBoundingClientRect();
   const total=second.bottom-first.top;
   if(total<=0)return;
   const percent=(event.clientY-first.top)/total*100;
   setLayout(prev=>({...prev,input:clamp(percent,25,75),preset:'custom'}));
  }
 };
 const stop=(event:PointerEvent<HTMLButtonElement>)=>{
  drag.current=null;
  if(event.currentTarget.hasPointerCapture(event.pointerId))event.currentTarget.releasePointerCapture(event.pointerId);
 };
 const keyboard=(axis:'vertical'|'horizontal')=>(event:KeyboardEvent<HTMLButtonElement>)=>{
  const step=event.shiftKey?10:3;
  const delta=event.key==='ArrowLeft'||event.key==='ArrowUp'?-step:
   event.key==='ArrowRight'||event.key==='ArrowDown'?step:0;
  if(event.key==='Home'){event.preventDefault();setLayout(prev=>({...prev,[axis==='vertical'?'floor':'input']:axis==='vertical'?30:25,preset:'custom'}));return;}
  if(event.key==='End'){event.preventDefault();setLayout(prev=>({...prev,[axis==='vertical'?'floor':'input']:75,preset:'custom'}));return;}
  if(!delta)return;
  if(axis==='vertical'&&event.key!=='ArrowLeft'&&event.key!=='ArrowRight')return;
  if(axis==='horizontal'&&event.key!=='ArrowUp'&&event.key!=='ArrowDown')return;
  event.preventDefault();
  const key=axis==='vertical'?'floor':'input';
  setLayout(prev=>({...prev,[key]:clamp(prev[key]+delta,axis==='vertical'?30:25,75),preset:'custom'}));
 };
 return {layout,overview,preset,begin,move,stop,keyboard,
  style:{'--cp01-floor':layout.floor+'%','--cp01-input':layout.input+'%'} as CSSProperties};
}
