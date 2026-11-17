import type {HandLimbFrame} from './videoHandLimbDetail.ts';
import {SKELETON_COLORS} from './fullBodySkeleton.ts';

/** 21-point MediaPipe hand connectivity. Draw observed joints only. */
export const HAND_CONNECTIONS=[
 [0,1],[1,2],[2,3],[3,4],
 [0,5],[5,6],[6,7],[7,8],
 [0,9],[9,10],[10,11],[11,12],
 [0,13],[13,14],[14,15],[15,16],
 [0,17],[17,18],[18,19],[19,20],
 [5,9],[9,13],[13,17]
] as const;
type Rect={x:number;y:number;width:number;height:number};
export function drawHandDetailOverlay(ctx:CanvasRenderingContext2D,
 frame:HandLimbFrame|null|undefined,rect:Rect,videoAtMs:number):number{
 if(!frame||!Number.isFinite(videoAtMs)||Math.abs(videoAtMs-frame.atMs)>270||
  !(rect.width>0&&rect.height>0))return 0;
 let count=0;
 ctx.save();
 try{
  for(const actor of frame.actors){
   const color=SKELETON_COLORS[actor.id==='A'?0:1];
   for(const hand of actor.hands){
    if(!['visible','recent'].includes(hand.presence)||hand.landmarks.length<21)continue;
    count++;
    ctx.save();
    ctx.strokeStyle=color;ctx.fillStyle=color;
    ctx.globalAlpha=hand.presence==='recent'?.38:.96;
    ctx.lineWidth=Math.max(1,Math.min(2.3,Math.min(rect.width,rect.height)/220));
    ctx.lineCap='round';ctx.lineJoin='round';
    ctx.setLineDash(hand.presence==='recent'?[2,3]:[]);
    for(const [a,b] of HAND_CONNECTIONS){
     const p=hand.landmarks[a],q=hand.landmarks[b];
     if(!p||!q||!Number.isFinite(p.x)||!Number.isFinite(p.y)||
      !Number.isFinite(q.x)||!Number.isFinite(q.y)||
      p.x<0||p.x>1||p.y<0||p.y>1||q.x<0||q.x>1||q.y<0||q.y>1)continue;
     ctx.beginPath();ctx.moveTo(rect.x+p.x*rect.width,rect.y+p.y*rect.height);
     ctx.lineTo(rect.x+q.x*rect.width,rect.y+q.y*rect.height);ctx.stroke();
    }
    ctx.setLineDash([]);
    for(const point of hand.landmarks){
     if(!Number.isFinite(point.x)||!Number.isFinite(point.y)||
      point.x<0||point.x>1||point.y<0||point.y>1)continue;
     ctx.beginPath();ctx.arc(rect.x+point.x*rect.width,rect.y+point.y*rect.height,
      1.6,0,Math.PI*2);ctx.fill();
    }
    const wrist=hand.landmarks[0];
    if(wrist&&Number.isFinite(wrist.x)&&Number.isFinite(wrist.y)){
     ctx.font='bold 10px system-ui,sans-serif';ctx.textBaseline='top';
     ctx.fillText(actor.id+' '+(hand.side==='left'?'L':'R'),
      rect.x+wrist.x*rect.width+5,rect.y+wrist.y*rect.height+5);
    }
    ctx.restore();
   }
  }
 }finally{ctx.restore();}
 return count;
}
