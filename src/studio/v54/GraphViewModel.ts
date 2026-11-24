import {GRAPH,viewId,type Bindings} from '../v51/SignalModel.ts';
import {compileCuePlan,type CueId} from '../v5/NodeGraphModel.ts';
export type Point={x:number;y:number};
export type View={x:number;y:number;z:number};
export type GroupId=string;
export type Membership=Record<string,GroupId>;
export type GroupMeta={title:string;note:string;extraW:number;extraH:number;collapsed?:boolean;anchor?:Point};
export type GroupMap=Record<GroupId,GroupMeta>;
export type FreeNote={id:string;x:number;y:number;text:string};
export type Geometry={id:string;x:number;y:number;w:number;h:number;kind:string};
export const GROUPS:GroupId[]=['sources','process','session','output'];
export const KEY='soma.graph-view.v1';
const defaults:GroupMap={sources:{title:'Sources',note:'',extraW:0,extraH:0},process:{title:'Process',note:'',extraW:0,extraH:0},session:{title:'Session',note:'',extraW:0,extraH:0},output:{title:'Output',note:'',extraW:0,extraH:0}};
const finite=(x:unknown):x is number=>typeof x==='number'&&Number.isFinite(x);
const clamp=(n:number,a:number,b:number)=>Math.max(a,Math.min(b,n));
export function groupOf(c:Pick<Geometry,'id'|'kind'>,membership:Membership={}):GroupId{if(c.kind!=='add'&&membership[c.id])return membership[c.id];return c.id==='session'?'session':c.kind==='output'?'output':['camera','phone','media','add'].includes(c.kind)?'sources':'process';}
export function parseDocument(raw:unknown,legacy:unknown={}){
 const p=raw&&typeof raw==='object'?raw as Record<string,unknown>:{};
 const valid=p.version===1&&p.schema==='soma.graph-view';
 const positions:Record<string,Point>={};
 const source=valid?p.positions:legacy;
 if(source&&typeof source==='object')for(const [id,value] of Object.entries(source).slice(0,500)){
  if(!/^(?:[a-zA-Z0-9_-]+|source:[a-zA-Z0-9_-]+)$/.test(id)||id.length>180)continue;
  const v=value as Point|null;if(v&&finite(v.x)&&finite(v.y))positions[id]={x:clamp(v.x,12,2200),y:clamp(v.y,38,2400)};
 }
 const groups=structuredClone(defaults);const meta=valid?p.groups as Partial<GroupMap>|undefined:undefined;
 for(const id of [...GROUPS,...Object.keys(meta??{}).filter(k=>/^group-[a-zA-Z0-9-]{1,80}$/.test(k)).slice(0,12)]){const v=meta?.[id];if(v&&typeof v==='object')groups[id]={title:typeof v.title==='string'&&v.title.trim()?v.title.trim().slice(0,60):(defaults[id]?.title??'Frame'),note:typeof v.note==='string'?v.note.slice(0,240):'',extraW:finite(v.extraW)?clamp(v.extraW,0,500):0,extraH:finite(v.extraH)?clamp(v.extraH,0,500):0,collapsed:v.collapsed===true,anchor:v.anchor&&finite(v.anchor.x)&&finite(v.anchor.y)?{x:clamp(v.anchor.x,0,2200),y:clamp(v.anchor.y,0,2400)}:undefined};}
 const v=valid?p.viewport as View|undefined:undefined;
 const viewport=v&&finite(v.x)&&finite(v.y)&&finite(v.z)?{x:clamp(v.x,-10000,10000),y:clamp(v.y,-10000,10000),z:clamp(v.z,.2,2)}:null;
 const notes:FreeNote[]=[];const seen=new Set<string>();if(valid&&Array.isArray(p.notes))for(const n of p.notes.slice(0,100)){if(!n||typeof n.id!=='string'||!/^note-[a-zA-Z0-9-]+$/.test(n.id)||seen.has(n.id)||!finite(n.x)||!finite(n.y)||typeof n.text!=='string')continue;seen.add(n.id);notes.push({id:n.id,x:clamp(n.x,12,2200),y:clamp(n.y,38,2400),text:n.text.slice(0,500)});}
 const membership:Membership={};if(valid&&p.membership&&typeof p.membership==='object')for(const [id,g] of Object.entries(p.membership).slice(0,500)){if(id!=='add'&&/^(?:[a-zA-Z0-9_-]+|source:[a-zA-Z0-9_-]+)$/.test(id)&&typeof g==='string'&&Object.hasOwn(groups,g))membership[id]=g;}return {positions,groups,viewport,notes,membership,snap:valid&&p.snap===true};
}
export function loadDocument(){try{return parseDocument(JSON.parse(localStorage.getItem(KEY)||'null'),JSON.parse(localStorage.getItem('soma.signal-layout.v1')||'{}'));}catch{return parseDocument(null);}}
export function frameBounds(cards:Geometry[],id:GroupId,meta:GroupMeta,membership:Membership={}){
 const members=cards.filter(c=>groupOf(c,membership)===id);
 if(!members.length)return {x:meta.anchor?.x??Math.max(0,GROUPS.indexOf(id))*240+6,y:meta.anchor?.y??0,w:180+meta.extraW,h:100+meta.extraH,members};
 const x=Math.max(0,Math.min(...members.map(c=>c.x))-12),y=Math.max(0,Math.min(...members.map(c=>c.y))-38);
 const w=Math.max(...members.map(c=>c.x+c.w))+12-x+meta.extraW,h=Math.max(...members.map(c=>c.y+c.h))+16-y+(meta.note?44:0)+meta.extraH;
 return {x,y,w,h,members};
}
export function groupMove(cards:Geometry[],dx:number,dy:number){
 if(!cards.length)return {};
 const x=clamp(dx,12-Math.min(...cards.map(c=>c.x)),2200-Math.max(...cards.map(c=>c.x)));
 const y=clamp(dy,38-Math.min(...cards.map(c=>c.y)),2400-Math.max(...cards.map(c=>c.y)));
 return Object.fromEntries(cards.map(c=>[c.id,{x:c.x+x,y:c.y+y}]));
}
export function cueVisual(next:CueId,running:CueId|null,bindings:Bindings){
 const n=compileCuePlan(GRAPH,next),r=running?compileCuePlan(GRAPH,running):null;
 return {nextNodes:new Set(n.nodes.map(x=>viewId(x.id,bindings))),runNodes:new Set(r?.nodes.map(x=>viewId(x.id,bindings))??[]),nextEdges:new Set(n.edges.map(x=>x.id)),runEdges:new Set(r?.edges.map(x=>x.id)??[])};
}
export function edgeVisual(planned:boolean,running:boolean,fresh:boolean,failed:boolean,focused:boolean){
 const eligible=planned||running;
 return {eligible,delivered:running&&fresh&&!failed,focused:eligible&&focused,muted:!eligible};
}

/** Proxy identity stays tied to the original visible card + logical handle. */
export type ProxyEndpoint={card:string;key:string;direction:'in'|'out';type:string;label:string};
export function proxyEndpoints(group:GroupId,cards:Geometry[],edges:{a:string;b:string;ak:string;bk:string;type:string}[],membership:Membership={}):ProxyEndpoint[]{
 const members=new Set(cards.filter(c=>groupOf(c,membership)===group).map(c=>c.id));const found=new Map<string,ProxyEndpoint>();
 for(const e of edges){const a=members.has(e.a),b=members.has(e.b);if(a===b)continue;const card=a?e.a:e.b,key=a?e.ak:e.bk,direction=a?'out':'in';const id=direction+':'+card+':'+key;found.set(id,{card,key,direction,type:e.type,label:card+' · '+key});}return [...found.values()];
}
export function snapDelta(origin:Point,dx:number,dy:number,snap:boolean,step=12):Point{return snap?{x:Math.round((origin.x+dx)/step)*step-origin.x,y:Math.round((origin.y+dy)/step)*step-origin.y}:{x:dx,y:dy};}
export function marqueeMembers(cards:Geometry[],a:Point,b:Point){const l=Math.min(a.x,b.x),r=Math.max(a.x,b.x),t=Math.min(a.y,b.y),d=Math.max(a.y,b.y);return cards.filter(c=>c.x+c.w>=l&&c.x<=r&&c.y+c.h>=t&&c.y<=d).map(c=>c.id);}

export function moveMembership(old:Membership,ids:string[],target:GroupId|null,groups:GroupMap):Membership{
 const result={...old};if(target&&!Object.hasOwn(groups,target))return result;
 for(const id of ids){if(id==='add')continue;if(target)result[id]=target;else delete result[id];}return result;
}
export function arrangeCards(cards:Geometry[],groups:GroupMap,membership:Membership){
 const positions:Record<string,Point>={},nextGroups={...groups};let x=18,y=38,rowH=0;
 for(const id of Object.keys(groups)){
  const members=cards.filter(c=>groupOf(c,membership)===id),cols=id==='process'?2:1;
  const width=Math.max(180,cols*220-40)+groups[id].extraW;
  const heights:number[]=[];members.forEach((c,i)=>{const r=Math.floor(i/cols);heights[r]=Math.max(heights[r]??0,c.h);});
  const height=Math.max(100,heights.reduce((a,b)=>a+b+34,0)+44+(groups[id].note?44:0)+groups[id].extraH);
  if(x+width>2150){x=18;y+=rowH+80;rowH=0;}
  if(y+height>2370)return null;
  nextGroups[id]={...groups[id],anchor:{x:x-12,y:y-38}};
  members.forEach((c,i)=>{positions[c.id]={x:x+(i%cols)*220,y:y+heights.slice(0,Math.floor(i/cols)).reduce((a,b)=>a+b+34,0)};});
  x+=width+76;rowH=Math.max(rowH,height);
 }
 return {positions,groups:nextGroups};
}
export function alignDelta(moving:Geometry[],others:Geometry[],dx:number,dy:number,tolerance:number){
 let bestX=tolerance+1,bestY=tolerance+1,gx:number|null=null,gy:number|null=null,ax=0,ay=0;
 for(const a of moving)for(const b of others){
  for(const x of [a.x,a.x+a.w/2,a.x+a.w])for(const bx of [b.x,b.x+b.w/2,b.x+b.w]){const d=bx-(x+dx);if(Math.abs(d)<bestX&&Math.abs(d)<=tolerance){bestX=Math.abs(d);ax=d;gx=bx;}}
  for(const y of [a.y,a.y+a.h/2,a.y+a.h])for(const by of [b.y,b.y+b.h/2,b.y+b.h]){const d=by-(y+dy);if(Math.abs(d)<bestY&&Math.abs(d)<=tolerance){bestY=Math.abs(d);ay=d;gy=by;}}
 }return {x:dx+ax,y:dy+ay,gx,gy};
}
type Obstacle={x:number;y:number;w:number;h:number};
export function wirePath(a:Point,b:Point,obstacles:Obstacle[]){
 const dx=Math.max(38,Math.abs(b.x-a.x)*.45),fallback='M'+a.x+' '+a.y+' C'+(a.x+dx)+' '+a.y+' '+(b.x-dx)+' '+b.y+' '+b.x+' '+b.y;
 const left={x:a.x+20,y:a.y},right={x:b.x-20,y:b.y};
 const block=(p:Point,q:Point)=>obstacles.some(r=>{const l=r.x-8,t=r.y-8,h=r.y+r.h+8,w=r.x+r.w+8;return p.x===q.x?p.x>l&&p.x<w&&Math.max(p.y,q.y)>t&&Math.min(p.y,q.y)<h:p.y===q.y&&p.y>t&&p.y<h&&Math.max(p.x,q.x)>l&&Math.min(p.x,q.x)<w;});
 const candidates:Point[][]=[];
 const xs=[(left.x+right.x)/2,...obstacles.flatMap(r=>[r.x-12,r.x+r.w+12])].slice(0,100);
 const ys=[Math.min(a.y,b.y)-36,Math.max(a.y,b.y)+36,...obstacles.flatMap(r=>[r.y-12,r.y+r.h+12])].slice(0,100);
 for(const x of xs)candidates.push([a,left,{x,y:a.y},{x,y:b.y},right,b]);
 for(const y of ys)candidates.push([a,left,{x:left.x,y},{x:right.x,y},right,b]);
 let best:Point[]|null=null,cost=Infinity;
 for(const points of candidates){if(points.some((p,i)=>i>0&&block(points[i-1],p)))continue;const n=points.reduce((sum,p,i)=>i?sum+Math.abs(p.x-points[i-1].x)+Math.abs(p.y-points[i-1].y):sum,0);if(n<cost){cost=n;best=points;}}
 return best?'M'+best.map(p=>p.x+' '+p.y).join(' L'):fallback;
}
