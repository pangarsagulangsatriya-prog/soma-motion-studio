import type Hydra from 'hydra-synth';
import {
 HYDRA_MOTION_IDLE,normalizeHydraFootprintSettings,
 type HydraFootprintSettings,type HydraFootprintStyle,type HydraFootprintStatus,type HydraMotionUniforms,
 clamp01
} from './hydraFootprintModel.ts';
import type {FootMotionEventV2} from './FootMotionEventV2.ts';
import {ArtisticFootprintRuntime,normalizeArtisticFootprintConfig} from './ArtisticFootprintRuntime.ts';

/** One Hydra instance and one stable s0 canvas per Compose workspace.
 * This is a SOFTWARE visual post-processor. Physical routing stays on its existing QA gate. */
export class PersistentHydraFootprintRuntime {
 private engine:Hydra|null=null;
 private sourceCanvas:HTMLCanvasElement|null=null;
 private sourceContext:CanvasRenderingContext2D|null=null;
 private outputCanvas:HTMLCanvasElement|null=null;
 private style:HydraFootprintStyle|null=null;
 private lastAt=0;
 private seen=new Set<string>();
 private generation=-1;
 private motion:HydraMotionUniforms={...HYDRA_MOTION_IDLE};
 private settings:HydraFootprintSettings=normalizeHydraFootprintSettings(null);
 private readonly art=new ArtisticFootprintRuntime();
 private artCanvas:HTMLCanvasElement|null=null;
 private lastArtwork='off';
 private loading:Promise<void>|null=null;
 private destroyed=false;
 status:HydraFootprintStatus='off';
 reason='';
 private lastGoodStyle:HydraFootprintStyle|null=null;
 private onLost=(event:Event)=>{event.preventDefault();this.fail('WebGL context lost');};
 get activeStyle(){return this.style;}
 get isDestroyed(){return this.destroyed;}
 resetFeedback(){
  if(!this.engine||this.status!=='ready')return;
  try{this.engine.synth.hush?.();this.style=null;this.configure(this.settings);}
  catch(error){this.fail(error instanceof Error?error.message:'Hydra reset failed');}
 }
 get output(){return this.status==='ready'?this.outputCanvas:null;}
 get motionUniforms(){return {...this.motion};}
 /** A retained software buffer; never a projector destination. */
 async initialize(canvas:HTMLCanvasElement,settings:HydraFootprintSettings){
  if(this.destroyed||this.loading)return this.loading??Promise.resolve();
  if(this.engine)return;
  this.status='loading';this.settings=normalizeHydraFootprintSettings(settings);
  this.outputCanvas=canvas;
  canvas.addEventListener('webglcontextlost',this.onLost);
  const task=(async()=>{
   try{
    // Hydra is loaded only when the artist enables the GPU effect.
    const {default:HydraConstructor}=await import('hydra-synth');
    if(this.destroyed)return;
    const input=document.createElement('canvas');
    input.width=640;input.height=360;
    const ctx=input.getContext('2d',{alpha:false});
    if(!ctx)throw Error('2D input texture unavailable');
    this.sourceCanvas=input;this.sourceContext=ctx;
    this.artCanvas=document.createElement('canvas');this.artCanvas.width=640;this.artCanvas.height=360;
    // Never start Hydra's own RAF: this instance is ticked by the existing Stage loop.
    const engine=new HydraConstructor({
     canvas,width:640,height:360,autoLoop:false,makeGlobal:false,
     detectAudio:false,enableStreamCapture:false
    });
    if(this.destroyed){engine.regl?.destroy?.();return;}
    this.engine=engine;engine.synth.s0.init({src:input});
    this.configure(this.settings);
    if(this.status==='fallback')return;
    this.status='ready';this.reason='';
   }catch(error){
    this.fail(error instanceof Error?error.message:'Hydra could not initialize');
   }finally{this.loading=null;}
  })();
  this.loading=task;return task;
 }
 configure(raw:HydraFootprintSettings){
  this.settings=normalizeHydraFootprintSettings(raw);
  if(!this.engine||this.status==='fallback')return;
  const selected:HydraFootprintStyle=this.settings.artwork==='off'?this.settings.style:
   this.settings.artwork==='trace'?'echo':this.settings.artwork==='compression'?'grain':
   this.settings.artwork==='negative-memory'?'interference':'flow';
  if(this.style===selected)return;
  try{
   this.applyGraph(selected);
   this.style=selected;this.lastGoodStyle=this.style;
  }catch(error){
   // Attempt to recover last known-good shader and keep existing FLOOR raster.
   try{if(this.lastGoodStyle)this.applyGraph(this.lastGoodStyle);}catch{}
   this.fail(error instanceof Error?error.message:'Hydra shader compile failed');
  }
 }
 private applyGraph(style:HydraFootprintStyle){
  const h=this.engine!.synth;
  const source=()=>h.src(h.s0);
  const amount=()=>Math.min(.25,this.settings.distortion*(.2+this.motion.speed*this.settings.motion+.5*this.motion.energy));
  const feedback=()=>Math.min(.65,this.settings.feedback*(.25+.75*this.motion.energy));
  const mix=()=>clamp01(this.settings.mix);
  let graph;
  if(style==='grain'){
   graph=source().modulate(h.noise(3,.1),amount).blend(h.noise(20,.12),()=>mix()*.12);
  }else if(style==='echo'){
   graph=source().blend(h.src(h.o0).scale(1.008).rotate(.002),feedback);
  }else if(style==='interference'){
   graph=source().modulate(h.osc(24,.04),amount).blend(h.osc(3,.02),()=>mix()*.15);
  }else{
   graph=source().modulate(h.noise(4,.1),amount).blend(h.src(h.o0).scale(1.004),feedback);
  }
  graph.out(h.o0);
  h.render(h.o0);
 }
 tick(source:HTMLCanvasElement|null,events:readonly FootMotionEventV2[],
  generation:number,nowMs:number){
  if(this.destroyed||this.status!=='ready'||!this.engine||!this.sourceContext||!source)return;
  if(!Number.isFinite(nowMs))return;
  if(generation!==this.generation){
   this.generation=generation;this.seen.clear();this.art.reset(generation);
   this.motion={...HYDRA_MOTION_IDLE};
   try{this.engine.synth.hush?.();}catch{}
   // A new source must not inherit previous frame feedback.
   this.style=null;this.configure(this.settings);
  }
  try{
   const artwork=this.settings.artwork;
   if(artwork!==this.lastArtwork){
    this.lastArtwork=artwork;this.art.reset(generation);this.resetFeedback();
   }
   this.sourceContext.fillStyle='#000';
   this.sourceContext.fillRect(0,0,640,360);
   if(artwork!=='off'&&this.artCanvas){
    this.art.ingest(events,generation,nowMs);
    this.art.paint(this.artCanvas,nowMs,normalizeArtisticFootprintConfig({
     style:artwork,view:this.settings.artworkView,treatment:this.settings.artworkTreatment,
     intensity:this.settings.mix,persistence:.76
    }));
    this.sourceContext.drawImage(this.artCanvas,0,0,640,360);
   }else if(source.width&&source.height)this.sourceContext.drawImage(source,0,0,640,360);
   // Seen IDs survive bounded history changes and prohibit re-triggering a paused event.
   for(const e of events){
    if(this.seen.has(e.eventId))continue;
    this.seen.add(e.eventId);
    if(e.kind==='contact'&&e.verified){
     this.motion.energy=Math.min(1,this.motion.energy+.26);
     this.motion.contacts++;
     this.motion.x=clamp01(e.x);this.motion.y=clamp01(e.y);
    }else if(e.kind==='movement'||e.kind==='presence'){
     this.motion.x=clamp01(e.x);this.motion.y=clamp01(e.y);
     this.motion.speed=clamp01(e.speed);
    }
   }
   if(this.seen.size>1200){
    const recent=new Set(events.map(e=>e.eventId));
    this.seen=new Set([...this.seen].filter(id=>recent.has(id)));
   }
   const delta=this.lastAt?Math.min(50,Math.max(1,nowMs-this.lastAt)):16;
   this.lastAt=nowMs;
   this.motion.energy*=Math.exp(-delta/900);
   this.motion.speed*=Math.exp(-delta/420);
   this.engine.tick(delta);
  }catch(error){this.fail(error instanceof Error?error.message:'Hydra frame failed');}
 }
 private fail(message:string){this.status='fallback';this.reason=message;}
 dispose(){
  this.destroyed=true;this.status='off';
  this.outputCanvas?.removeEventListener('webglcontextlost',this.onLost);
  try{this.engine?.synth.hush?.();}catch{}
  try{this.engine?.regl?.destroy?.();}catch{}
  try{this.outputCanvas?.getContext('webgl2')?.getExtension('WEBGL_lose_context')?.loseContext();}catch{}
  this.engine=null;this.sourceCanvas=null;this.sourceContext=null;this.outputCanvas=null;
  this.artCanvas=null;this.art.reset(-1);
  this.seen.clear();this.loading=null;
 }
}
