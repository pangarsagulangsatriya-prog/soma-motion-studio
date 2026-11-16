import {sole} from '../pattern.ts';
import {floorToUV} from '../spatial/coordinates.ts';
import {validateFloorSession,type FloorSession,type FootstepEvent} from '../spatial/events.ts';

export type FloorArtworkOptions={
 width?:number;height?:number;transparent?:boolean;showGrid?:boolean;
 showTrail?:boolean;showGhosts?:boolean;maxTimeMs?:number;
};
const palette=(e:FootstepEvent)=>e.performerId==='B'
 ?(e.foot==='left'?'#A5D4D1':'#7FB0CB')
 :(e.foot==='left'?'#E6EBD9':'#D2DD8E');
const toes=Array.from({length:5},(_,i)=>
 '<ellipse cx="'+(-.23+i*.14)+'" cy="'+(-.75+(i/4)**2*.26)+
 '" rx="'+(.08-i*.007)+'" ry="'+(.11-i*.012)+'"/>').join('');
export const visibleFootsteps=(session:FloorSession,maxTimeMs=Infinity)=>
 session.events.filter(e=>e.timestampMs<=maxTimeMs&&e.kind==='contact');
export function floorArtworkSVG(session:FloorSession,opts:FloorArtworkOptions={}):string{
 const s=validateFloorSession(session),width=opts.width??960,height=opts.height??720;
 if(!Number.isFinite(width)||!Number.isFinite(height)||width<100||height<100||
    width>8192||height>8192)throw Error('Ukuran output SVG tidak valid.');
 const scale=Math.min(width/s.floor.widthM,height/s.floor.depthM)*.30;
 const seen=new Map<string,{x:number;y:number}>();
 const shapes:string[]=[];
 const maxTime=opts.maxTimeMs??Infinity;
 const grid=opts.showGrid===false?'':Array.from({length:Math.floor(s.floor.widthM)+1},(_,i)=>{
  const x=i/s.floor.widthM*width;return '<path d="M'+x+' 0V'+height+'" stroke="#27332D" stroke-width=".8"/>';
 }).join('')+Array.from({length:Math.floor(s.floor.depthM)+1},(_,i)=>{
  const y=i/s.floor.depthM*height;return '<path d="M0 '+y+'H'+width+'" stroke="#27332D" stroke-width=".8"/>';
 }).join('');
 for(const e of s.events){
  if(e.timestampMs>maxTime)break;
  const uv=floorToUV(s.floor,e.positionM),x=uv.x*width,y=uv.y*height;
  const col=palette(e),k=e.performerId+':'+e.foot;
  const was=seen.get(k);
  if(e.kind==='contact'||e.kind==='move'){
   if(e.kind==='move'&&opts.showTrail!==false&&was&&e.joinPrevious!==false)
    shapes.push('<path d="M'+was.x+' '+was.y+'L'+x+' '+y+'" fill="none" stroke="'+col+'" stroke-width="2.5" stroke-linecap="round" opacity=".65"/>');
   seen.set(k,{x,y});
  }
  if(e.kind!=='contact'&&!(e.kind==='prediction'&&opts.showGhosts!==false))continue;
  const angle=90-e.headingRad*180/Math.PI,ghost=e.kind==='prediction';
  if(ghost){
   shapes.push('<g transform="translate('+x+' '+y+') rotate('+angle+') scale('+scale+')">'+
    '<ellipse cx="0" cy="-0.1" rx=".23" ry=".53" fill="none" stroke="'+col+
    '" stroke-width=".045" stroke-dasharray=".13 .12" opacity=".85"/>'+
    '<circle cx="0" cy="-0.1" r=".12" fill="none" stroke="'+col+'" stroke-width=".035"/>'+
    '</g>');
   continue;
  }
  shapes.push('<g fill="'+col+'" opacity=".94'+
   '" transform="translate('+x+' '+y+') rotate('+angle+') scale('+scale+')">'+
   '<path d="'+sole+'"/>'+toes+'</g>');
 }
 return '<svg xmlns="http://www.w3.org/2000/svg" width="'+width+'" height="'+height+
  '" viewBox="0 0 '+width+' '+height+'" role="img" aria-label="Jejak virtual pada lantai SOMA">'+
  (opts.transparent?'':'<rect width="'+width+'" height="'+height+'" fill="#0C1110"/>')+
  grid+shapes.join('')+'</svg>';
}
export function floorArtworkSummary(session:FloorSession){
 const s=validateFloorSession(session);
 return {
  contacts:s.events.filter(e=>e.kind==='contact').length,
  releases:s.events.filter(e=>e.kind==='release').length,
  moves:s.events.filter(e=>e.kind==='move').length,
  performers:new Set(s.events.map(e=>e.performerId)).size,
  durationMs:s.events.at(-1)?.timestampMs??0
 };
}
