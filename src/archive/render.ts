import {clamp} from '../engine/motion.ts';
import type {ArchiveSource,RenderState,RuleEffect} from './types.ts';
export type Token={text:string;x:number;y:number;width:number;index:number;line:number};
export const textFor=(source:ArchiveSource,language:'nl'|'id')=>language==='id'&&source.language!=='id'&&source.workingTranslation?source.workingTranslation:language==='nl'&&source.language==='id'?'':source.originalText;
export function targetMatches(word:string,targets:string){const plain=(s:string)=>s.toLocaleLowerCase().replace(/[^\p{L}\p{N}]/gu,'');if(!targets.trim())return true;return targets.split(/[,\s]+/).some(t=>plain(t)&&plain(t)===plain(word));}
export function layoutText(text:string,width:number,font:number,measure:(text:string)=>number):Token[]{
 const tokens:Token[]=[];let x=0,line=0;const space=measure(' ');
 for(const part of text.split(/(\n|[^\S\n]+)/)){if(part==='\n'){line++;x=0;continue;}if(!part||/^\s+$/.test(part))continue;const w=measure(part);if(x&&x+w>width){line++;x=0;}tokens.push({text:part,x,y:line*font,width:w,index:tokens.length,line});x+=w+space;}
 return tokens;
}
export function transformToken(token:Token,effects:RuleEffect[],width:number,height:number,column=0){let x=token.x,y=token.y,alpha=1;for(const e of effects){if(e.amount<.001)continue;const a=clamp(e.amount),matches=targetMatches(token.text,e.targetWords);
 if(e.type==='compress'||e.type==='accumulate')y*=1-a*.5;
 if(!matches)continue;
 if(e.type==='scatter'){x+=Math.sin(token.index*2.399+1)*width*.3*a*e.direction;y+=Math.cos(token.index*1.618+2)*height*.24*a;}
 if(e.type==='displace'){x+=(column?1:-1)*(e.value-.5)*width*.25*a;y+=(e.y-.5)*height*.18*a;}
 if(e.type==='swarm'){x+=(e.x*width-x+Math.sin(token.index*2.399)*width*.12)*a;y+=(e.y*height-y+Math.cos(token.index*2.399)*height*.08)*a;}
 if(e.type==='reveal')alpha=1-a*(Math.hypot(x/width-e.x,y/height-e.y)>.28?1:0);
 if(e.type==='judgment')x+=(token.index-1)*width*.04*a;
 }return {...token,x:clamp(x,0,Math.max(0,width-token.width)),y:clamp(y,0,height),alpha};}
const EDGES=[[11,12],[11,13],[13,15],[12,14],[14,16],[11,23],[12,24],[23,24],[23,25],[25,27],[24,26],[26,28],[27,29],[29,31],[28,30],[30,32]];
export function drawArchive(ctx:CanvasRenderingContext2D,state:RenderState,width:number,height:number,media?:CanvasImageSource|null){
 const {output:o}=state;ctx.fillStyle='#080a09';ctx.fillRect(0,0,width,height);if(state.stage.blank)return;
 const ratio=o.ratio,w=Math.min(width,height*ratio),h=w/ratio,ox=(width-w)/2,oy=(height-h)/2;
 ctx.save();ctx.translate(ox,oy);ctx.beginPath();ctx.rect(0,0,w,h);ctx.clip();
 const pad=w*o.safeArea,innerW=w-pad*2,innerH=h-pad*1.6;const actors=state.snapshot.actors;
 if(media&&(state.layout==='media'||state.layout==='live-photo'||state.mediaAction==='overlay')){
  ctx.save();const m=media as HTMLVideoElement|HTMLImageElement;const mw=('videoWidth'in m?m.videoWidth:m.naturalWidth)||w,mh=('videoHeight'in m?m.videoHeight:m.naturalHeight)||h;
  const actor=actors.find(a=>a.visible);if(state.mediaAction==='reveal'){ctx.beginPath();if(actor){const radius=Math.max(40,h*.25);ctx.ellipse(actor.x*w,actor.y*h,radius*.65,radius,0,0,Math.PI*2);}ctx.clip();}
  const scale=Math.max(w/mw,h/mh)*(state.mediaAction==='pan'?1.25:1);const sx=state.mediaAction==='pan'&&actor?(w-mw*scale)*actor.x:(w-mw*scale)/2,sy=(h-mh*scale)/2;
  if(state.mediaAction==='original'){const fit=Math.min(w/mw,h/mh);ctx.drawImage(media,(w-mw*fit)/2,(h-mh*fit)/2,mw*fit,mh*fit);}else ctx.drawImage(media,sx,sy,mw*scale,mh*scale);ctx.restore();
 }
 if(state.source&&(state.layout==='text'||state.layout==='split'||state.mediaAction==='overlay')){
  const languages=state.language==='both'?(['nl','id'] as const):[state.language];
  const colW=languages.length===2?(innerW-w*.055)/2:innerW;
  languages.forEach((language,column)=>{
   const text=textFor(state.source!,language);if(!text)return;
   let size=h*o.fontSize*o.scale;let tokens:Token[]=[];
   for(let tries=0;tries<14;tries++){ctx.font=`${size}px Georgia, 'Times New Roman', serif`;tokens=layoutText(text,colW,size*o.lineHeight,t=>ctx.measureText(t).width);if((tokens.at(-1)?.y??0)+size<innerH*.8)break;size*=.89;}
   const x=pad+column*(colW+w*.055),baseY=pad+Math.max(size,innerH*.18);ctx.fillStyle=o.ink;ctx.textBaseline='alphabetic';
   for(const token of tokens){const q=transformToken(token,state.effects,colW,innerH*.72,column);ctx.globalAlpha=q.alpha*(column===1?.82:1);ctx.fillText(token.text,x+q.x,baseY+q.y);}
   for(const e of state.effects.filter(e=>e.type==='accumulate'&&e.amount>.03)){
    const chosen=tokens.find(t=>targetMatches(t.text,e.targetWords));if(!chosen)continue;
    const copies=Math.min(20,Math.floor(e.amount*(2+e.ageMs/1600)));const cw=Math.max(size*3,ctx.measureText(chosen.text).width+size),perRow=Math.max(1,Math.floor(colW/cw));
    for(let i=0;i<copies;i++){ctx.globalAlpha=e.amount*(.85-(i%4)*.1);ctx.fillText(chosen.text,x+(i%perRow)*cw,h-pad*1.2-Math.floor(i/perRow)*size*1.1);}
   }
  });ctx.globalAlpha=1;
  ctx.font=`${Math.max(9,h*.016)}px monospace`;ctx.fillStyle='#b5bda8';
  if(state.showCitation){const label=`${state.source.author} · ${state.source.year} · ${state.source.provenance==='primary-verified'?'sumber diperiksa':'transkripsi kerja'}`;ctx.fillText(label,pad,h-pad*.5,innerW);}
  const changed=state.effects.some(e=>e.amount>.03);if(o.showComposition&&changed){ctx.textAlign='right';ctx.fillText('KOMPOSISI PANGGUNG',w-pad,h-pad*.5);ctx.textAlign='left';}
 }
 if(state.skeleton==='detected'||state.skeleton==='cue'&&state.trackingOn){
  for(const actor of actors){const fade=actor.visible?1:clamp(1-(state.timestampMs-actor.lastSeen)/500);if(!fade||actor.uncertain)continue;ctx.globalAlpha=fade*.6;ctx.strokeStyle=actor.id==='A'?'#cedf9b':'#deded9';ctx.lineWidth=Math.max(1,w/1100);
   for(const [a,b]of EDGES){const p=actor.landmarks[a],q=actor.landmarks[b];if(!p||!q||(p.visibility??1)<.55||(q.visibility??1)<.55)continue;ctx.beginPath();ctx.moveTo(p.x*w,p.y*h);ctx.lineTo(q.x*w,q.y*h);ctx.stroke();}
  }
 }ctx.globalAlpha=1;ctx.restore();
}
