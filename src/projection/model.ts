import type {MotionFrame} from '../engine/types.ts';
import type {BodyMask} from '../studio/bodyField.ts';
import {identityQuad,validQuad,homography,correspondence,compose,scaling,translation,type Quad} from './geometry.ts';
import {BodySmoother,maskBounds,type Bounds,type Smoothing} from './motion.ts';
export {identityQuad,validQuad,homography,inverse3,transform} from './geometry.ts';
export type {Point,Quad} from './geometry.ts';
export type Transport='live'|'hold'|'blackout';
export type ProjectionConfig={mode:'screen'|'body';quad:Quad;mirror:boolean;brightness:number;threshold:number;softness:number;recovery:'hold'|'fade'|'blackout';resolution:'720p'|'1080p';registration:{enabled:boolean;source:Quad;destination:Quad};placement:{x:number;y:number;scale:number;rotation:number;crop:{left:number;top:number;right:number;bottom:number}};motion:'follow'|'fixed';appearance:'silhouette'|'outline';smoothing:Smoothing};
export const placementDefaults=():ProjectionConfig['placement']=>({x:0,y:0,scale:1,rotation:0,crop:{left:0,top:0,right:1,bottom:1}});
export const projectionDefaults=():ProjectionConfig=>({mode:'screen',quad:identityQuad(),mirror:true,brightness:1,threshold:.5,softness:.08,recovery:'blackout',resolution:'720p',registration:{enabled:false,source:[{x:.1,y:.1},{x:.9,y:.1},{x:.9,y:.9},{x:.1,y:.9}],destination:[{x:.15,y:.15},{x:.85,y:.15},{x:.85,y:.85},{x:.15,y:.85}]},placement:placementDefaults(),motion:'follow',appearance:'silhouette',smoothing:{strength:.35,responsiveness:.7,confidence:.35,fadeMs:700}});
const range=(value:unknown,min:number,max:number,label:string):number=>{if(typeof value!=='number'||!Number.isFinite(value)||value<min||value>max)throw Error(`Nilai ${label} di luar jangkauan.`);return value;};
export function validateProjection(value:unknown):ProjectionConfig{
 const raw=value as {version?:number;config?:Partial<ProjectionConfig>};if(![1,2].includes(raw?.version??0)||!raw.config)throw Error('Gunakan preset SOMA Projection versi 1 atau 2.');
 const c=raw.version===1?{...projectionDefaults(),...raw.config}:raw.config;
 if(!validQuad(c.quad)||!['screen','body'].includes(c.mode??'')||!['hold','fade','blackout'].includes(c.recovery??'')||!['720p','1080p'].includes(c.resolution??'')||typeof c.mirror!=='boolean')throw Error('Isi preset proyeksi tidak valid.');
 range(c.brightness,0,1,'terang');range(c.threshold,.1,.9,'ambang');range(c.softness,.01,.25,'tepi');
 const r=c.registration,p=c.placement,s=c.smoothing;
 if(!r||typeof r.enabled!=='boolean'||!validQuad(r.source)||!validQuad(r.destination))throw Error('Pasangan titik sumber–tujuan tidak valid.');correspondence(r.source,r.destination);
 if(!p||!p.crop||!s)throw Error('Konfigurasi gerak belum lengkap.');range(p.x,-1,1,'offset X');range(p.y,-1,1,'offset Y');range(p.scale,.25,3,'skala');range(p.rotation,-180,180,'rotasi');
 for(const key of ['left','top','right','bottom'] as const)range(p.crop[key],0,1,'crop');if(p.crop.right-p.crop.left<.05||p.crop.bottom-p.crop.top<.05)throw Error('Crop perlu menyisakan bidang minimal 5%.');
 range(s.strength,0,1,'smoothing');range(s.responsiveness,0,1,'responsiveness');range(s.confidence,.1,.95,'confidence');range(s.fadeMs,100,3000,'durasi fade');
 if(!['follow','fixed'].includes(c.motion??'')||!['silhouette','outline'].includes(c.appearance??''))throw Error('Mode gerak atau bentuk tidak valid.');
 return structuredClone(c) as ProjectionConfig;
}
export type ProjectionImage={mask:BodyMask;aspect:number;time:number;rawBounds?:Bounds;bounds?:Bounds;processed?:boolean};
export type ProjectionState={config:ProjectionConfig;transport:Transport;pattern:boolean;blank:boolean;tracking:boolean;reason:string;quality:number;sampleAge:number;opacity:number;image:ProjectionImage|null};
export function projectionMatrix(config:ProjectionConfig,image:ProjectionImage|null):number[]{
 const raw=image?.rawBounds,b=image?.bounds;let correction=scaling(1,1);
 if(raw&&b){const cx=config.motion==='fixed'?.5:b.cx,cy=config.motion==='fixed'?.5:b.cy;correction=compose(translation(cx,cy),scaling(b.width/raw.width,b.height/raw.height),translation(-raw.cx,-raw.cy));}
 const aspect=image?.aspect??4/3,fit=scaling(Math.min(1,aspect/(16/9)),Math.min(1,(16/9)/aspect));
 const mirror=config.mirror?compose(translation(1,0),scaling(-1,1)):scaling(1,1);
 const p=config.placement,angle=p.rotation*Math.PI/180,cs=Math.cos(angle),sn=Math.sin(angle);
 const artistic=compose(translation(.5+p.x,.5+p.y),[cs*p.scale,-sn*p.scale/(16/9),0,sn*p.scale*(16/9),cs*p.scale,0,0,0,1],translation(-.5,-.5));
 // Registration points use final projector raster coordinates. Do not apply screen homography twice.
 return config.registration.enabled?compose(artistic,correspondence(config.registration.source,config.registration.destination),mirror,correction):compose(homography(config.quad),artistic,translation(.5,.5),fit,translation(-.5,-.5),mirror,correction);
}
export class ProjectionModel{
 config=projectionDefaults();transport:Transport='blackout';pattern=false;private latest:ProjectionImage|null=null;private held:ProjectionImage|null=null;private smoother=new BodySmoother();private lossAt:number|null=null;private filterKey='';
 get liveImage(){return this.latest;}
 setTransport(value:Transport){if(value==='hold'&&this.transport!=='hold')this.held=this.latest;this.transport=value;}
 reset(){this.latest=null;this.held=null;this.pattern=false;this.transport='blackout';this.smoother.reset();this.lossAt=null;}
 sample(frame:MotionFrame,input:string,aspect:number,now:number):ProjectionState{
  const mask=frame.projectionMask,age=Math.max(0,now-frame.time);let tracked=input==='body'&&frame.source==='camera'&&frame.tracked&&frame.pose.length>=33&&frame.quality>=this.config.smoothing.confidence&&age<450&&frame.time<=now&&!!mask&&mask.width>0&&mask.height>0&&mask.width<=512&&mask.height<=512&&mask.data.length===mask.width*mask.height;
  const key=JSON.stringify([this.config.smoothing,this.config.threshold]);
  if(tracked&&(this.latest?.time!==frame.time||key!==this.filterKey)){
   const raw=maskBounds(mask!,this.config.threshold);if(!raw)tracked=false;else{if(this.lossAt!==null)this.smoother.reset();const bounds=this.smoother.step(raw,frame.time,this.config.smoothing);this.latest={mask:mask!,aspect:Math.max(.2,Math.min(5,aspect||4/3)),time:frame.time,rawBounds:raw,bounds};this.filterKey=key;}
  }
  if(tracked)this.lossAt=null;else this.lossAt??=now;
  const image=this.transport==='hold'?this.held:this.latest;
  const opacity=this.transport==='live'&&!tracked&&this.config.recovery==='fade'?Math.max(0,1-(now-this.lossAt!)/this.config.smoothing.fadeMs):1;
  const reason=input!=='body'?'Pilih Body untuk membaca siluet':tracked?'Tubuh terdeteksi':frame.time===0?'Menunggu kamera dan tubuh':'Tracking hilang / masker belum tersedia';
  const blank=this.transport==='blackout'||(!this.pattern&&(!image||opacity===0||(this.transport==='live'&&!tracked&&this.config.recovery==='blackout')));
  return {config:this.config,transport:this.transport,pattern:this.pattern,blank,tracking:tracked,reason,quality:tracked?frame.quality:0,sampleAge:frame.time?age:0,opacity,image};
 }
}
