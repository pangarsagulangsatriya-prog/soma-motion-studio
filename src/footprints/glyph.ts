/** Synthetic sole; toes are graphic pads, not measured anatomy. */
export function drawFoot(ctx:CanvasRenderingContext2D,x:number,y:number,heading:number,side:number,size:number){
 ctx.save();ctx.translate(x,y);ctx.rotate(heading+Math.PI/2);ctx.scale(side?-size:size,size);ctx.beginPath();ctx.moveTo(-.2,.48);ctx.bezierCurveTo(-.48,.46,-.35,.1,-.3,-.05);ctx.bezierCurveTo(-.4,-.32,-.3,-.59,-.06,-.62);ctx.bezierCurveTo(.22,-.67,.4,-.42,.32,-.22);ctx.bezierCurveTo(.25,-.07,.07,.02,.13,.21);ctx.bezierCurveTo(.24,.45,.05,.59,-.2,.48);ctx.closePath();ctx.fill();ctx.lineWidth=.018;ctx.stroke();for(let i=0;i<5;i++){ctx.beginPath();ctx.ellipse(-.23+i*.14,-.75+Math.pow(i/4,2)*.26,.08-i*.007,.11-i*.012,-.2,0,Math.PI*2);ctx.fill();}ctx.restore();
}
