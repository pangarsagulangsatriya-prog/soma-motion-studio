import type {MotionFrame} from '../../engine/types.ts';

/** Pure Camera Hub state helpers, shared by the browser registry and unit tests. */
export function hubDisplayName(label:string):string{
 return label.trim().slice(0,64)||'Kamera baru';
}
export function hubSourceAvailable(deviceId:string,records:readonly Pick<{deviceId:string},'deviceId'>[]):boolean{
 return Boolean(deviceId)&&!records.some(x=>x.deviceId===deviceId);
}
export function hubFrameIsFresh(frameAt:number,now:number,limitMs=650):boolean{
 return Number.isFinite(frameAt)&&frameAt>0&&now>=frameAt&&now-frameAt<limitMs;
}
export function hubBodyCount(frame:MotionFrame|null):number{
 if(!frame||!frame.tracked)return 0;
 const poses=frame.poses?.filter(p=>p.length>=33)??[];
 return Math.min(2,poses.length||(frame.pose?.length>=33?1:0));
}
