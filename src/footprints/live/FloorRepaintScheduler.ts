/**
 * Coalesces multiple foot/ghost events into the NEXT browser animation frame.
 * Injected frame functions allow deterministic tests without a DOM.
 * Uses a nullable request ID (requestAnimationFrame may legitimately return 0).
 */
export class FloorRepaintScheduler{
 private scheduled:number|null=null;
 private disposed=false;
 private readonly request:(callback:()=>void)=>number;
 private readonly cancel:(id:number)=>void;
 private readonly paint:()=>void;
 constructor(request:(callback:()=>void)=>number,cancel:(id:number)=>void,paint:()=>void){
  this.request=request;this.cancel=cancel;this.paint=paint;
 }
 invalidate(){
  if(this.disposed||this.scheduled!==null)return;
  this.scheduled=this.request(()=>{
   this.scheduled=null;
   if(!this.disposed)this.paint();
  });
 }
 get pending(){return this.scheduled!==null;}
 dispose(){
  this.disposed=true;
  if(this.scheduled!==null)this.cancel(this.scheduled);
  this.scheduled=null;
 }
}
