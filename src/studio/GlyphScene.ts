// Normalized positions keep the text continuous through Studio/Clean resizing.
export type Glyph={text:string;ox:number;oy:number;x:number;y:number;vx:number;vy:number;width:number;angle:number};
export type Touch={x:number;y:number};
export class GlyphScene{
 glyphs:Glyph[]=[];private previous:Touch|null=null;energy=0;settle=0;
 layout(words:{text:string;x:number;y:number;width:number}[],measure:(text:string)=>number){
  this.glyphs=[];for(const word of words){const chars=Array.from(word.text),widths=chars.map(measure),total=widths.reduce((a,b)=>a+b,0)||1;let left=word.x-word.width/2;
   chars.forEach((text,i)=>{const width=widths[i]/total*word.width,x=left+width/2;this.glyphs.push({text,ox:x,oy:word.y,x,y:word.y,vx:0,vy:0,width,angle:0});left+=width;});
  }this.previous=null;
 }
 recover(){this.settle=2;this.energy=0;for(const g of this.glyphs){g.vx=0;g.vy=0;}}
 step(points:Touch[],live:boolean,pinch:number,spread:number,speed:number,dt:number,mode:string,force:number){
  dt=Math.max(.001,Math.min(.05,dt));const cursor=live?points[1]??points[0]:undefined,prev=this.previous;
  const continuous=cursor&&prev&&Math.hypot(cursor.x-prev.x,cursor.y-prev.y)<.22;
  const vx=continuous?(cursor.x-prev.x)/dt:0,vy=continuous?(cursor.y-prev.y)/dt:0;
  this.previous=cursor?{...cursor}:null;this.settle=Math.max(0,this.settle-dt);
  const gain=this.settle>0?0:force;const target=live?Math.max(0,Math.min(1,speed))*gain:0;
  this.energy+=(target-this.energy)*(1-Math.exp(-dt*(target>this.energy?8:1.7)));
  for(const g of this.glyphs){
   const stretch=mode==='elastic'&&live?1+spread*.6*gain:1;
   const restX=.5+(g.ox-.5)*stretch;const spring=this.settle>0?85:mode==='flow'?9:24;
   g.vx+=(restX-g.x)*spring*dt;g.vy+=(g.oy-g.y)*spring*dt;
   if(cursor){const dx=g.x-cursor.x,dy=g.y-cursor.y,d=Math.hypot(dx,dy),a=Math.max(0,1-d/.25)*gain;
    if(mode==='elastic'&&pinch>.6&&d<.18){g.vx-=dx*95*a*dt;g.vy-=dy*95*a*dt;}
    g.vx+=vx*a*dt*9;g.vy+=vy*a*dt*9;
    if(mode==='flow'){g.vx+=(-dy*32+vx*2)*a*dt;g.vy+=(dx*32+vy*2)*a*dt;}
    if(mode==='fragments'){g.vx+=dx/(d+.03)*speed*a*dt*8;g.vy+=dy/(d+.03)*speed*a*dt*8;}
   }
   const drag=Math.exp(-dt*(this.settle>0?16:mode==='flow'?2.6:5));g.vx*=drag;g.vy*=drag;
   g.x=Math.max(-.15,Math.min(1.15,g.x+g.vx*dt));g.y=Math.max(-.15,Math.min(1.15,g.y+g.vy*dt));
   g.angle+=(Math.max(-.8,Math.min(.8,g.vx*1.2))-g.angle)*(1-Math.exp(-dt*8));
  }
 }
}
