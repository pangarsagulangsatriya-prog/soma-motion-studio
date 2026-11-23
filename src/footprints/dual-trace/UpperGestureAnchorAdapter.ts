import type {Landmark} from '../../engine/types.ts';
import type {DualActor,DualPoseFrame} from './DualTracePoseFrameBus.ts';

export type UpperChannel='head'|'shoulder';
export type UpperGestureAnchor={
 actorId:DualActor;channel:UpperChannel;pointPx:{x:number;y:number};
 sourceKey:string;clipStableId:string;epoch:number;timeMs:number;
 confidence:number;basis:'observed-2d'|'estimated-head';
};
const valid=(p:Landmark|undefined,min:number):p is Landmark=>
 !!p&&Number.isFinite(p.x)&&Number.isFinite(p.y)&&
 p.x>=0&&p.x<=1&&p.y>=0&&p.y<=1&&
 (p.visibility??1)>=min;
const mean=(a:Landmark,b:Landmark)=>({x:(a.x+b.x)/2,y:(a.y+b.y)/2});
const clip=(v:number,min:number,max:number)=>Math.max(min,Math.min(max,v));
/** Upper anchors stay in the same image-space basis as the accepted pose.
 * Never infer an unobserved shoulder or a camera-to-floor coordinate.
 */
export function upperGestureAnchors(frame:DualPoseFrame,gain=1.35,
 enabled:{head:boolean;shoulder:boolean}={head:true,shoulder:true}
):UpperGestureAnchor[]{
 const p=frame.landmarks,shoulders=valid(p[11],.60)&&valid(p[12],.60);
 if(!shoulders)return [];
 const c=mean(p[11],p[12]),out:UpperGestureAnchor[]=[];
 const base={actorId:frame.actorId,sourceKey:frame.sourceKey,
  clipStableId:frame.sourceKey.startsWith('video:')?
   frame.sourceKey.split(':').slice(0,-2).join(':'):frame.sourceKey,
  epoch:frame.epoch,timeMs:frame.timeMs,confidence:frame.identityConfidence};
 const emit=(channel:UpperChannel,pos:{x:number;y:number},
   basis:UpperGestureAnchor['basis'],quality:number)=>{
  if(!Number.isFinite(pos.x)||!Number.isFinite(pos.y)||
     pos.x<0||pos.x>1||pos.y<0||pos.y>1)return;
  out.push({...base,channel,pointPx:{x:pos.x*1600,y:pos.y*900},
   basis,confidence:quality});
 };
 const shoulderConfidence=Math.min(frame.identityConfidence,
  p[11].visibility??1,p[12].visibility??1);
 if(enabled.shoulder)emit('shoulder',c,'observed-2d',shoulderConfidence);
 if(!enabled.head)return out;
 let head:{x:number;y:number}|null=null;
 let basis:UpperGestureAnchor['basis']='observed-2d';
 let quality=shoulderConfidence;
 if(valid(p[7],.55)&&valid(p[8],.55)){
  head=mean(p[7],p[8]);quality=Math.min(quality,p[7].visibility??1,p[8].visibility??1);
 }else if(valid(p[0],.55)){
  head={x:p[0].x,y:p[0].y};basis='estimated-head';
  quality=Math.min(quality,p[0].visibility??1);
 }
 if(head){
  const g=clip(gain,1,2.5);
  emit('head',{x:c.x+(head.x-c.x)*g,y:c.y+(head.y-c.y)*g},
   basis,quality);
 }
 return out;
}
