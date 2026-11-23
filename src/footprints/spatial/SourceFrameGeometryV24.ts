export type SourceRotation=0|90|180|270;
export type SourceFrameGeometryV24={
 rawWidth:number;rawHeight:number;orientation:SourceRotation;mirrored:boolean;
 contentRect:{x:number;y:number;width:number;height:number};
 version:string;
};
export type NormalizedPoint={x:number;y:number};
const finite=(n:number)=>Number.isFinite(n);
const unit=(p:NormalizedPoint)=>finite(p.x)&&finite(p.y)&&p.x>=0&&p.x<=1&&p.y>=0&&p.y<=1;
export function makeSourceFrameGeometryV24(rawWidth:number,rawHeight:number,
 orientation:SourceRotation=0,mirrored=false):SourceFrameGeometryV24{
 if(!finite(rawWidth)||!finite(rawHeight)||rawWidth<1||rawHeight<1||
  ![0,90,180,270].includes(orientation))throw Error('Invalid camera image geometry');
 const aspect=orientation===90||orientation===270?rawHeight/rawWidth:rawWidth/rawHeight;
 const width=Math.min(1,aspect/(16/9)),height=Math.min(1,(16/9)/aspect);
 const contentRect={x:(1-width)/2,y:(1-height)/2,width,height};
 return {rawWidth,rawHeight,orientation,mirrored,contentRect,
  version:[rawWidth,rawHeight,orientation,mirrored?'m':'u',
   width.toFixed(8),height.toFixed(8)].join(':')};
}
/** Camera calibration uses UNMIRRORED raw image coordinates. Orientation and
 * mirror are applied exactly once and are always reversible in tests.
 */
export function sourceUVToStageUV(raw:NormalizedPoint,g:SourceFrameGeometryV24):
 NormalizedPoint|null{
 if(!unit(raw))return null;
 let p=raw;
 if(g.orientation===90)p={x:1-raw.y,y:raw.x};
 else if(g.orientation===180)p={x:1-raw.x,y:1-raw.y};
 else if(g.orientation===270)p={x:raw.y,y:1-raw.x};
 if(g.mirrored)p={x:1-p.x,y:p.y};
 return {x:g.contentRect.x+p.x*g.contentRect.width,
  y:g.contentRect.y+p.y*g.contentRect.height};
}
export function stageUVToSourceUV(stage:NormalizedPoint,g:SourceFrameGeometryV24):
 NormalizedPoint|null{
 if(!unit(stage)||g.contentRect.width<=0||g.contentRect.height<=0)return null;
 let p={x:(stage.x-g.contentRect.x)/g.contentRect.width,
  y:(stage.y-g.contentRect.y)/g.contentRect.height};
 if(!unit(p))return null;
 if(g.mirrored)p={x:1-p.x,y:p.y};
 if(g.orientation===90)p={x:p.y,y:1-p.x};
 else if(g.orientation===180)p={x:1-p.x,y:1-p.y};
 else if(g.orientation===270)p={x:1-p.y,y:p.x};
 return unit(p)?p:null;
}
