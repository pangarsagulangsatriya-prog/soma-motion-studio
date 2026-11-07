import {KineticText} from './KineticText';
import {hydraDefaults} from './hydraConfig';
import {bodyField} from './bodyField';
import {SilhouetteLayer} from './silhouette';
import {getAsset} from '../archive/store';
import {WordScene,materialDefaults,type Cursor} from './material';
import type {Settings,MotionFrame} from '../engine/types';
export class MaterialRenderer{
 private textReset=-1;kinetic=new KineticText();silhouette=new SilhouetteLayer();photoLayer=document.createElement('canvas');history:{time:number;frame:MotionFrame;anchors:{x:number;y:number}[];live:boolean}[]=[];lastHistory=-1;
 scene=new WordScene();image:ImageBitmap|null=null;asset='';generation=0;disposed=false;trails:{x:number;y:number;t:number}[]=[];key='';
 dispose(){this.disposed=true;this.generation++;this.image?.close();}
 load(id:string){if(id===this.asset)return;this.asset=id;const generation=++this.generation;this.image?.close();this.image=null;if(id)void getAsset(id).then(a=>a?createImageBitmap(a.blob):null).then(image=>{if(this.disposed||generation!==this.generation)image?.close();else this.image=image;}).catch(()=>{});}
 draw(ctx:CanvasRenderingContext2D,s:Settings,f:MotionFrame,anchors:{x:number;y:number}[],live:boolean,w:number,h:number,now:number,dt:number,cameraAspect=4/3){
 const m={...materialDefaults(),...s.material};this.load(m.assetId);const key=JSON.stringify([m.text,m.size,m.reset,m.effect,s.input]);ctx.save();
 const font=Math.min(h*m.size,w*.12,Math.sqrt(w*h*.42/Math.max(1,m.text.length*.6)));ctx.font=`500 ${font}px Georgia, serif`;if(key!==this.key){this.key=key;this.scene.layout(m.text,font/h,t=>ctx.measureText(t).width/w);this.trails=[];this.silhouette.reset();this.history=[];this.lastHistory=-1;if(m.effect==='catch')this.scene.words.forEach((word,i)=>{word.y=-.08-i*.09;});}
 if(now-this.lastHistory>=30){this.history.push({time:now,frame:f,anchors:anchors.map(a=>({x:a.x/w,y:a.y/h})),live});this.lastHistory=now;}while(this.history.length>190||this.history.length&&now-this.history[0].time>6000)this.history.shift();
 if(m.delay>0){const old=[...this.history].reverse().find(sample=>sample.time<=now-m.delay*1000);live=!!old?.live;if(old){f=old.frame;anchors=old.anchors.map(a=>({x:a.x*w,y:a.y*h}));}else anchors=[];}
 const field=live?bodyField(f,s.mirror,w/h,cameraAspect):undefined;
 this.silhouette.update(field,w/h,dt,m.linger,m.effect==='erosion');
 const point=anchors[1]??anchors[0];const cursor:Cursor|null=live&&point?{x:point.x/w,y:point.y/h,pinch:s.input==='body'?f.features.armRaise>.7:s.input==='face'?f.features.mouth>.5:f.features.pinch>.6}:null;
 this.scene.step(cursor,dt,m.effect,m.force,{weight:m.weight,adhesion:m.adhesion,returnTime:m.returnTime,height:font/h,field});
 if(cursor){const p=this.trails.at(-1);if(!p||Math.hypot(p.x-cursor.x,p.y-cursor.y)>.004)this.trails.push({...cursor,t:now});}this.trails=this.trails.filter(p=>now-p.t<s.visual.life*1000).slice(-350);
 if(s.output==='sound'||m.kind==='none'){ctx.restore();return;}
 const hc={...hydraDefaults(),...s.hydra};
 if(this.textReset!==hc.textReset){if(this.textReset>=0&&hc.typography==='classic'){for(const word of this.scene.words){word.x=word.ox;word.y=word.oy;word.vx=0;word.vy=0;}this.scene.owner=-1;}this.textReset=hc.textReset;}
 if(m.kind==='text'&&hc.enabled&&hc.typography!=='classic'){this.kinetic.draw(ctx,hc,f,this.scene.words,anchors,live,w,h,font,dt,key,this.image,m.text);}
 else if(m.kind==='text'){ctx.fillStyle=s.visual.color;ctx.textAlign='center';ctx.textBaseline='middle';const stretch=m.effect==='stretch'?1+f.features.spread*.8:1;for(const word of this.scene.words){ctx.save();ctx.translate(word.x*w,word.y*h);ctx.scale(stretch,1);const maxWidth=w*.85/stretch;ctx.fillText(word.text,0,0,maxWidth);ctx.restore();}}
 if(m.kind==='photo'&&this.image){const image=this.image;const scale=Math.min(w/image.width,h/image.height),iw=image.width*scale,ih=image.height*scale,x=(w-iw)/2,y=(h-ih)/2;
 if(m.effect==='silhouette'||m.effect==='erosion'){const layer=this.photoLayer;if(layer.width!==Math.round(w)||layer.height!==Math.round(h)){layer.width=Math.round(w);layer.height=Math.round(h);}const lc=layer.getContext('2d')!;lc.clearRect(0,0,w,h);lc.globalCompositeOperation='source-over';lc.drawImage(image,x,y,iw,ih);lc.globalCompositeOperation=m.effect==='erosion'?'destination-out':'destination-in';lc.drawImage(this.silhouette.canvas,0,0,w,h);lc.globalCompositeOperation='source-over';ctx.drawImage(layer,0,0,w,h);}
 else if(m.effect==='reveal'||m.effect==='brush'){ctx.beginPath();const pts=m.effect==='reveal'?(cursor?[cursor]:[]):this.trails;for(const p of pts){ctx.moveTo(p.x*w+h*.16,p.y*h);ctx.arc(p.x*w,p.y*h,h*.16,0,Math.PI*2);}ctx.clip();ctx.drawImage(image,x,y,iw,ih);}
 else if(m.effect==='warp'||m.effect==='shatter'){const cols=18,rows=12;for(let iy=0;iy<rows;iy++)for(let ix=0;ix<cols;ix++){const sw=image.width/cols,sh=image.height/rows,cx=x+(ix+.5)*iw/cols,cy=y+(iy+.5)*ih/rows,dx=cursor?cx-cursor.x*w:0,dy=cursor?cy-cursor.y*h:0,dist=Math.hypot(dx,dy),influence=cursor?Math.exp(-dist*dist/(h*h*.08))*m.force:0;ctx.save();ctx.translate(cx+dx*influence,cy+dy*influence);if(m.effect==='shatter')ctx.rotate(influence*(ix%2?.6:-.6));ctx.drawImage(image,ix*sw,iy*sh,sw,sh,-iw/cols/2,-ih/rows/2,iw/cols+1,ih/rows+1);ctx.restore();}}
 else ctx.drawImage(image,x,y,iw,ih);
 }else if(m.kind==='photo'&&!this.image){ctx.fillStyle='#a8b29c';ctx.textAlign='center';ctx.font='14px sans-serif';ctx.fillText(m.assetId?'Foto belum tersedia. Unggah kembali lewat panel Visual.':'Unggah foto lewat panel Visual.',w/2,h/2);}
 if(m.showContour&&field?.mask)this.silhouette.outline(ctx,field,w,h,s.visual.color);
 if(m.effect==='catch'&&f.source==='mouse'&&field){ctx.save();ctx.strokeStyle=s.visual.color;ctx.lineWidth=3;for(const line of field.surfaces){ctx.beginPath();ctx.moveTo(line.a.x*w,line.a.y*h);ctx.lineTo(line.b.x*w,line.b.y*h);ctx.stroke();}ctx.restore();}
 ctx.restore();
 }
}
