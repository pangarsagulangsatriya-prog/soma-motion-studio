import type {ReferenceEvent} from './rehearsalComparisonModel.ts';
export type TimelineMark={atPct:number;kind:string;foot:string};
export function RehearsalTimeline({marks,title}: {marks:TimelineMark[];title:string}){
 return <div className="rcl-timeline" role="img" aria-label={title}>
  {marks.slice(0,500).map((m,i)=><span key={i} className={'rcl-tick '+m.kind}
   title={m.kind+' · '+m.foot} style={{left:Math.min(99.5,Math.max(0,m.atPct))+'%'}}/>)}
 </div>;
}
export function RehearsalPath({points,title}: {points:{x:number;y:number}[];title:string}){
 const p=points.slice(0,350);
 return <div className="rcl-path">
  <svg viewBox="0 0 100 100" preserveAspectRatio="none" role="img" aria-label={title}>
   {Array.from({length:5},(_,i)=><g key={i}>
    <line x1={(i+1)*100/6} x2={(i+1)*100/6} y1="0" y2="100"/>
    <line x1="0" x2="100" y1={(i+1)*100/6} y2={(i+1)*100/6}/>
   </g>)}
   {p.length>1&&<polyline fill="none" stroke="#d2eab0" strokeWidth="1.5"
    vectorEffect="non-scaling-stroke"
    points={p.map(q=>[q.x*100,q.y*100].join(',')).join(' ')}/>}
   {p.map((q,i)=><circle key={i} cx={q.x*100} cy={q.y*100} r="1.5"
    fill={i?'#c9e7b4':'#ffc495'}/>)}
  </svg>
  <small>{p.length} pijakan · {title}</small>
 </div>;
}
export const referenceFootPath=(events:ReferenceEvent[],start:number,end:number,performer:'A'|'B')=>
 events.filter(e=>e.performer===performer&&e.kind==='contact'&&e.atMs>=start&&e.atMs<=end)
  .map(e=>({x:e.x,y:e.y}));
