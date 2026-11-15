import {sole} from './pattern';
let cached:Path2D|null=null;
/** Same vector sole and toe pads used by PNG and SVG. */
export function drawFoot(ctx:CanvasRenderingContext2D,x:number,y:number,heading:number,side:number,size:number){
 cached??=new Path2D(sole);ctx.save();ctx.translate(x,y);ctx.rotate(heading+Math.PI/2);ctx.scale(side?-size:size,size);ctx.fill(cached);for(let i=0;i<5;i++){ctx.beginPath();ctx.ellipse(-.23+i*.14,-.75+(i/4)**2*.26,.08-i*.007,.11-i*.012,0,0,Math.PI*2);ctx.fill();}ctx.restore();
}
