/** F1 touch-to-floor projection: account for object-fit:contain.
 * Clicking letterboxed empty space never creates a synthetic contact. */
export type FloorPointerRect={left:number;top:number;width:number;height:number};
export function floorPointerCoordinates(clientX:number,clientY:number,
 rect:FloorPointerRect,rasterWidth=1280,rasterHeight=720):
 {x:number;y:number;inside:boolean}|null{
 if(![clientX,clientY,rect.left,rect.top,rect.width,rect.height,
  rasterWidth,rasterHeight].every(Number.isFinite)||rect.width<=0||rect.height<=0||
  rasterWidth<=0||rasterHeight<=0)return null;
 const scale=Math.min(rect.width/rasterWidth,rect.height/rasterHeight);
 const drawWidth=rasterWidth*scale,drawHeight=rasterHeight*scale;
 const left=rect.left+(rect.width-drawWidth)/2;
 const top=rect.top+(rect.height-drawHeight)/2;
 const u=(clientX-left)/drawWidth,v=(clientY-top)/drawHeight;
 const inside=u>=0&&u<=1&&v>=0&&v<=1;
 return {x:Math.min(1,Math.max(0,u)),y:Math.min(1,Math.max(0,v)),inside};
}
