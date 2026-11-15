import {projectionMatrix,type ProjectionConfig} from './model.ts';
/** CSS projective transform for a full-frame color artwork, using the calibrated SOMA matrix. */
export function artworkMatrix(config:ProjectionConfig,width:number,height:number):number[]{
 const m=projectionMatrix(config,{mask:{width:1,height:1,data:new Uint8Array(1)},aspect:16/9,time:0});
 const w=Math.max(1,width),h=Math.max(1,height);
 return [
  m[0],m[3]*h/w,0,m[6]/w,
  m[1]*w/h,m[4],0,m[7]/h,
  0,0,1,0,
  m[2]*w,m[5]*h,0,m[8]
 ];
}
export const artworkTransform=(c:ProjectionConfig,width:number,height:number)=>'matrix3d('+artworkMatrix(c,width,height).join(',')+')';
