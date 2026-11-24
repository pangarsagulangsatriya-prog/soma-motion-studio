export type Mode='floating'|'docked'|'closed';
export type Rect={x:number;y:number;width:number;height:number};
export type Prefs={version:1;rect:Rect;dock:boolean;monitor:number;minimap:boolean};
export const KEY='soma.adaptive-layout.v1';
const def:Prefs={version:1,rect:{x:9999,y:60,width:360,height:470},dock:false,monitor:320,minimap:true};
const cap=(v:number,min:number,max:number)=>Math.min(max,Math.max(min,v));
export function parsePrefs(raw:unknown):Prefs{
 const p=raw as Partial<Prefs>|null,r=p?.rect;
 if(!p||p.version!==1||!r||![r.x,r.y,r.width,r.height].every(Number.isFinite))return structuredClone(def);
 return {version:1,rect:{x:cap(r.x,0,9999),y:cap(r.y,0,9999),width:cap(r.width,300,480),height:cap(r.height,200,600)},dock:p.dock===true,monitor:Number.isFinite(p.monitor)?cap(p.monitor!,280,440):320,minimap:p.minimap!==false};
}
export function loadPrefs(){try{return parsePrefs(JSON.parse(localStorage.getItem(KEY)||'null'));}catch{return parsePrefs(null);}}
export function clampPanel(r:Rect,w:number,h:number):Rect{
 const m=Math.min(12,w/4,h/4),width=Math.min(w-2*m,cap(r.width,300,480)),height=Math.min(h-2*m,cap(r.height,200,600));
 return {x:cap(r.x,m,Math.max(m,w-m-width)),y:cap(r.y,m,Math.max(m,h-m-height)),width,height};
}
export function captureStep(s:{audience:boolean;gesture:boolean;distinct:boolean;consent:boolean;verified:boolean;running:boolean;armed:boolean;photos:number}){
 if(!s.audience)return 'audience';if(!s.gesture)return 'gesture';if(!s.distinct)return 'distinct';if(!s.consent)return 'consent';if(!s.verified)return 'verify';if(s.photos>=4)return 'complete';if(!s.running)return 'cue';if(!s.armed)return 'arm';return 'capture';
}
export function monitorLabel(s:{latched:boolean;fault:boolean;running:boolean;used:boolean;delivered:boolean}){
 return s.latched?(s.fault?'Fault':'Blackout'):!s.running?'Standby':!s.used?'Cue black':s.delivered?'Preview':'Waiting';
}
