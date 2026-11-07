export class FrameMetrics{
 private intervals:number[]=[];private previous:number|null=null;private count=0;
 add(now:number){if(this.previous!==null&&now>this.previous){this.intervals.push(now-this.previous);if(this.intervals.length>600)this.intervals.shift();}this.previous=now;this.count++;}
 reset(){this.intervals=[];this.previous=null;this.count=0;}
 snapshot(){const a=this.intervals;if(!a.length)return {fps:0,p95Ms:0,frames:this.count,samples:0};const sorted=[...a].sort((x,y)=>x-y);return {fps:1000/(a.reduce((x,y)=>x+y,0)/a.length),p95Ms:sorted[Math.ceil(sorted.length*.95)-1],frames:this.count,samples:a.length};}
}
