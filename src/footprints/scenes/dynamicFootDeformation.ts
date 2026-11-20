/** GEO-01B: deterministic visual deformation from existing gait/contact events.
 * No pressure sensor, inferred force, additional tracker, or projector access.
 * Callers must supply evidence for slide, pivot and release; time alone only
 * settles the initial heel contact into a resting silhouette.
 */
export type FootDeformationMode='heel-strike'|'stance'|'toe-off'|'slide'|'pivot';
export type FootDeformation={
 mode:FootDeformationMode;
 amount:number;
 travelX?:number;
 travelY?:number;
 pivotRad?:number;
};
export type FootVisualMotion={
 kind:'slide'|'pivot'|'release';
 atMs:number;
 x:number;y:number;
 headingRad?:number;
};
export type FootVisualAnchor={
 atMs:number;x:number;y:number;headingRad?:number;
};
const clamp=(n:number,min:number,max:number)=>Math.min(max,Math.max(min,n));
const safe=(n:unknown,fallback=0)=>typeof n==='number'&&Number.isFinite(n)?n:fallback;
export function shortestAngle(rad:number):number{
 return Math.atan2(Math.sin(rad),Math.cos(rad));
}
/** One motion updates the current contact footprint; never creates a new one. */
export function deformationAt(anchor:FootVisualAnchor,renderMs:number,
 motion?:FootVisualMotion|null):FootDeformation{
 const age=Math.max(0,safe(renderMs)-safe(anchor.atMs));
 const neutral:FootDeformation={mode:'stance',amount:0};
 if(motion&&motion.atMs>=anchor.atMs&&motion.atMs<=renderMs){
  const elapsed=renderMs-motion.atMs;
  const duration=motion.kind==='release'?390:750;
  const weight=clamp(1-elapsed/duration,0,1);
  if(weight>0){
   if(motion.kind==='release')return {mode:'toe-off',amount:weight};
   if(motion.kind==='slide'){
    // Both offsets are normalized by a nominal sole width / length on the
    // preview surface. The raster uses its own calibrated dimensions.
    const dx=clamp((safe(motion.x)-safe(anchor.x))*18,-1,1);
    const dy=clamp((safe(motion.y)-safe(anchor.y))*11,-1,1);
    const distance=Math.hypot(dx,dy);
    if(distance>.015)return {mode:'slide',amount:weight*clamp(distance,.25,1),
     travelX:dx,travelY:dy};
   }
   if(motion.kind==='pivot'&&motion.headingRad!==undefined){
    const rad=shortestAngle(safe(motion.headingRad)-safe(anchor.headingRad));
    if(Math.abs(rad)>.025)return {mode:'pivot',amount:weight,pivotRad:clamp(rad,-.9,.9)};
   }
  }
 }
 const heel=clamp(1-age/190,0,1);
 return heel>0?{mode:'heel-strike',amount:heel}:neutral;
}
export function warpFootPoint(x:number,y:number,deform?:FootDeformation):readonly [number,number]{
 if(!deform)return [x,y];
 const a=clamp(safe(deform.amount),0,1);
 const heel=clamp((y+.10)/1.1,0,1);
 const fore=clamp((.26-y)/.98,0,1);
 switch(deform.mode){
  case 'heel-strike':
   return [x*(1-.43*a*fore+.07*a*heel),y+.10*a*fore];
  case 'toe-off':
   return [x*(1-.46*a*heel+.09*a*fore),y-.07*a*heel];
  case 'slide':
   return [x+(safe(deform.travelX)*.27*a*(.45+y)),
    y+(safe(deform.travelY)*.17*a*(.45+y))];
  case 'pivot':{
   // Heel twists around the more stable forefoot (near y=-.45).
   const theta=clamp(safe(deform.pivotRad),-.9,.9)*a*(.48+y)*.86;
   const pivotY=-.45;
   const dy=y-pivotY;
   return [x*Math.cos(theta)-dy*Math.sin(theta),
    pivotY+x*Math.sin(theta)+dy*Math.cos(theta)];
  }
  default:return [x,y];
 }
}
export function warpedToeRadius(rx:number,ry:number,y:number,deform?:FootDeformation){
 const a=clamp(safe(deform?.amount),0,1);
 if(deform?.mode==='heel-strike')return {rx:rx*(1-.44*a),ry:ry*(1-.34*a)};
 if(deform?.mode==='toe-off')return {rx:rx*(1+.08*a),ry:ry*(1+.12*a)};
 return {rx,ry};
}
