import type {ProjectionImage} from '../model.ts';
import type {Landmark} from '../../engine/types.ts';
import type {BodyMask} from '../../studio/bodyField.ts';
export type OrganicFrame=ProjectionImage&{pose:Landmark[];velocity:{x:number;y:number};drive:number};
export function reduceMask(mask:BodyMask,size=128):BodyMask{
 const data=new Uint8Array(size*size);for(let y=0;y<size;y++)for(let x=0;x<size;x++)data[y*size+x]=mask.data[Math.min(mask.height-1,Math.floor((y+.5)*mask.height/size))*mask.width+Math.min(mask.width-1,Math.floor((x+.5)*mask.width/size))];return {width:size,height:size,data};
}
export function copyFrame(frame:OrganicFrame):OrganicFrame{return {...frame,mask:reduceMask(frame.mask),pose:frame.pose.map(p=>({...p})),velocity:{...frame.velocity},rawBounds:frame.rawBounds&&{...frame.rawBounds},bounds:frame.bounds&&{...frame.bounds}};}
/** Fixed-capacity ring. Sampling uses timestamps, never a frame-rate assumption. */
export class TemporalHistory{
 readonly capacity=300;readonly maxAgeMs=12000;private slots:(OrganicFrame|undefined)[]=new Array(300);private start=0;private count=0;
 get length(){return this.count;}
 get bytes(){let n=0;for(let i=0;i<this.count;i++)n+=this.at(i)!.mask.data.byteLength;return n;}
 private at(i:number){return this.slots[(this.start+i)%this.capacity];}
 clear(){this.slots.fill(undefined);this.start=0;this.count=0;}
 push(frame:OrganicFrame){const last=this.at(this.count-1);if(last&&frame.time<last.time){this.clear();}else if(last&&frame.time-last.time<1000/24)return;
  while(this.count&&frame.time-this.at(0)!.time>this.maxAgeMs){this.slots[this.start]=undefined;this.start=(this.start+1)%this.capacity;this.count--;}
  if(this.count===this.capacity){this.slots[this.start]=undefined;this.start=(this.start+1)%this.capacity;this.count--;}
  this.slots[(this.start+this.count)%this.capacity]=copyFrame(frame);this.count++;
 }
 sample(time:number):OrganicFrame|null{if(!Number.isFinite(time))return null;for(let i=this.count-1;i>=0;i--){const f=this.at(i)!;if(f.time<=time)return f;}return null;}
 get spanMs(){return this.count>1?this.at(this.count-1)!.time-this.at(0)!.time:0;}
}
