import {useMemo} from 'react';
import type {ReactNode} from 'react';
import type {FootprintConfig} from '../../footprints/StudioFootprints.tsx';
import {footprintOpacity,type FootprintState,type FootprintTiming} from './footprintEventStore.ts';

export {makeDemoFootEvent,emptyFootprintState,applyFootprintEvent,pruneFootprints} from './footprintEventStore.ts';
export type {FootprintState} from './footprintEventStore.ts';

// Retain public V4 rehearsal helpers for existing integrations; the event store owns V3+ rehearsal state.
export type DemoStamp={id:number;foot:'left'|'right';x:number;y:number;heading:number};
export const seedMappingStamps:DemoStamp[]=[
 {id:1,foot:'left',x:30,y:76,heading:-12},
 {id:2,foot:'right',x:43,y:60,heading:13},
 {id:3,foot:'left',x:56,y:43,heading:-10},
 {id:4,foot:'right',x:69,y:28,heading:15}
];
export function nextMappingStamp(previous:readonly DemoStamp[],foot:'left'|'right'):DemoStamp{
 const id=(previous.at(-1)?.id??0)+1;
 return {id,foot,x:25+(id*13)%51,y:79-(id*16)%57,heading:foot==='left'?-12:12};
}

const solePath='M 14 100 C 3 89 7 70 11 51 C 13 36 13 24 25 24 C 38 24 46 41 46 57 C 47 72 47 95 35 103 C 27 110 19 106 14 100 Z';
export function SoleArt({foot='left',style='Tapak'}:{foot?:'left'|'right';style?:FootprintConfig['style']}){
 return <svg viewBox="0 0 55 112" className="msv4-sole-svg" aria-hidden="true" focusable="false">
  <g transform={foot==='right'?'translate(55 0) scale(-1 1)':undefined}
   fill={style==='Garis'?'none':'currentColor'} stroke={style==='Garis'?'currentColor':'none'} strokeWidth="2.5">
   <path d={solePath}/>
   {style!=='Titik'&&<><ellipse cx="8" cy="19" rx="5.5" ry="9"/><ellipse cx="19" cy="11" rx="6" ry="9"/><ellipse cx="31" cy="10" rx="6" ry="9"/><ellipse cx="42" cy="15" rx="5" ry="8"/><ellipse cx="50" cy="23" rx="3.5" ry="7"/></>}
  </g>
 </svg>;
}

export function FootprintDemo({state,config,nowMs,sceneName,children}:{
 state:FootprintState;config:FootprintConfig;nowMs:number;sceneName:string;children?:ReactNode;
}){
 const timing:FootprintTiming={holdMs:0,decayMs:Math.max(1000,config.life*1000)};
 const rendered=useMemo(()=>state.imprints.slice(-120),[state.imprints]);
 return <div className="msv4-demo msv4-floor-demo" aria-label="Simulasi jejak kaki; tidak dikirim ke proyektor">
  <div className="msv4-demo-top"><span>FLOOR / SIMULATION</span><span>5.00 × 5.00 m</span></div>
  <div className="msv4-demo-stage">
   {rendered.map(step=>{
    const alpha=footprintOpacity(step,nowMs,timing);
    return <div className="msv4-demo-stamp" key={step.eventId}
     style={{left:step.x*100+'%',top:step.y*100+'%',
      width:Math.max(18,Math.min(110,config.size*1.45))+'px',
      height:Math.max(40,Math.min(230,config.size*3))+'px',
      color:config.colors[step.foot],opacity:alpha,
      transform:'translate(-50%,-50%) rotate('+step.headingDeg+'deg)'}}>
      <SoleArt foot={step.foot} style={config.style}/>
    </div>;
   })}
   <div className="msv4-demo-crosshair" aria-hidden="true"/>
  </div>
  <div className="msv4-demo-bottom"><span>{sceneName} · {rendered.length} FOOTPRINTS</span><span>PREVIEW ONLY · NOT CALIBRATED</span></div>
  {children}
 </div>;
}
export function LegDemo({actor}:{actor:'A'|'B'}){
 return <div className="msv4-demo msv4-leg-demo" aria-label={'Ilustrasi mask performer '+actor+'; belum mengikuti tracking'}>
  <div className="msv4-demo-top"><span>LEG {actor} / MASK PREVIEW</span><span>UPPER THIGH → FOOT</span></div>
  <svg className="msv4-legs" viewBox="0 0 320 390" aria-hidden="true">
   <g stroke="currentColor" strokeWidth="2.3" fill="currentColor" fillOpacity=".08" strokeLinejoin="round">
    <path d="M87 29 Q91 110 100 149 L109 237 L101 317 L64 351 Q54 364 74 370 L136 370 Q153 366 136 356 L129 324 L148 231 L160 156 L169 28 Z"/>
    <path d="M177 28 L179 150 L189 237 L186 324 L166 356 Q158 372 184 371 L245 371 Q261 363 238 351 L217 321 L227 235 L232 153 L248 29 Z"/>
   </g>
   <g stroke="currentColor" opacity=".65" strokeWidth="1" strokeDasharray="4 6">
    <path d="M65 87H260"/><path d="M101 153L232 153"/><path d="M109 237L227 235"/>
   </g>
   <g fill="currentColor">{[[100,149],[160,156],[189,237],[227,235],[101,317],[217,321]].map(([x,y],i)=><circle key={i} cx={x} cy={y} r="4"/>)}</g>
   <text x="12" y="80" fontSize="9" fill="currentColor">THIGH CUTOFF</text>
  </svg>
  <div className="msv4-demo-bottom"><span>PERFORMER {actor}</span><span>ILLUSTRATION · CAMERA OFFLINE</span></div>
 </div>;
}
