import {GRAPH,viewId,type Bindings} from '../v51/SignalModel.ts';
import {compileCuePlan,type CueId} from '../v5/NodeGraphModel.ts';
export type Point={x:number;y:number};
export type View={x:number;y:number;z:number};
export type GroupId='sources'|'process'|'session'|'output';
export type GroupMeta={title:string;note:string;extraW:number;extraH:number};
export type GroupMap=Record<GroupId,GroupMeta>;
export type Geometry={id:string;x:number;y:number;w:number;h:number;kind:string};
export const GROUPS:GroupId[]=['sources','process','session','output'];
export const KEY='soma.graph-view.v1';
const defaults:GroupMap={sources:{title:'Sources',note:'',extraW:0,extraH:0},process:{title:'Process',note:'',extraW:0,extraH:0},session:{title:'Session',note:'',extraW:0,extraH:0},output:{title:'Output',note:'',extraW:0,extraH:0}};
const finite=(x:unknown):x is number=>typeof x==='number'&&Number.isFinite(x);
const clamp=(n:number,a:number,b:number)=>Math.max(a,Math.min(b,n));
export function groupOf(c:Pick<Geometry,'id'|'kind'>):GroupId{return c.id==='session'?'session':c.kind==='output'?'output':['camera','phone','media','add'].includes(c.kind)?'sources':'process';}
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
 for(const id of GROUPS){const v=meta?.[id];if(v&&typeof v==='object')groups[id]={title:typeof v.title==='string'&&v.title.trim()?v.title.trim().slice(0,60):defaults[id].title,note:typeof v.note==='string'?v.note.slice(0,240):'',extraW:finite(v.extraW)?clamp(v.extraW,0,500):0,extraH:finite(v.extraH)?clamp(v.extraH,0,500):0};}
 const v=valid?p.viewport as View|undefined:undefined;
 const viewport=v&&finite(v.x)&&finite(v.y)&&finite(v.z)?{x:clamp(v.x,-10000,10000),y:clamp(v.y,-10000,10000),z:clamp(v.z,.2,2)}:null;
 return {positions,groups,viewport};
}
export function loadDocument(){try{return parseDocument(JSON.parse(localStorage.getItem(KEY)||'null'),JSON.parse(localStorage.getItem('soma.signal-layout.v1')||'{}'));}catch{return parseDocument(null);}}
export function frameBounds(cards:Geometry[],id:GroupId,meta:GroupMeta){
 const members=cards.filter(c=>groupOf(c)===id);
 if(!members.length)return {x:12,y:0,w:180,h:100,members};
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
