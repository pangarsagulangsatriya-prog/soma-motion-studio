import {useEffect,useRef} from 'react';
import type {RenderState} from './types';
import {ArchiveCanvas} from './ArchiveCanvas';
export default function ProjectionScreen({sessionId}:{sessionId:string}){
 const state=useRef<RenderState|null>(null);
 useEffect(()=>{document.title='SOMA / Proyeksi';const channel=new BroadcastChannel(`soma-archive-${sessionId}`);let last=0;let previousSequence=-1;
  channel.onmessage=e=>{const m=e.data;if(m?.sessionId!==sessionId||m.type!=='state'||!m.state||m.state.sequence<previousSequence)return;previousSequence=m.state.sequence;last=Date.now();state.current=m.state;};
  const send=(type:string)=>channel.postMessage({type,sessionId,sentAt:Date.now()});send('hello');
  const timer=setInterval(()=>{send('heartbeat');if(last&&Date.now()-last>3500&&state.current)state.current={...state.current,stage:{...state.current.stage,phase:'hold',blank:true}};},750);
  const key=(e:KeyboardEvent)=>{if(e.code==='KeyF'){e.preventDefault();if(document.fullscreenElement)void document.exitFullscreen();else void document.documentElement.requestFullscreen().catch(()=>{});}};
  document.addEventListener('keydown',key);return()=>{send('closed');clearInterval(timer);channel.close();document.removeEventListener('keydown',key);};
 },[sessionId]);
 return <main className="archive-projection" aria-label="Layar proyeksi SOMA"><ArchiveCanvas stateRef={state}/></main>;
}
