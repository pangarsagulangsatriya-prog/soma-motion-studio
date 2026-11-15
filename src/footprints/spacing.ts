type Point={x:number;y:number;t:number};
/** Artistic distance sampling, independent of frame rate; not floor contact. */
export function nextImprint(last:Point|null,point:Point,size:number){
 if(!last)return true;
 const distance=Math.hypot((point.x-last.x)*1280,(point.y-last.y)*720);
 return point.t-last.t>=250&&distance>=size*1.8;
}
