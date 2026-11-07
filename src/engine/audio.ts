import {clamp} from './motion.ts';
import type {AudioParams,Settings,Character} from './types.ts';
type Hit={source:AudioScheduledSourceNode;gain:GainNode;end:number};
export class AudioEngine {
 context:AudioContext|null=null;analyser:AnalyserNode|null=null;recordDestination:MediaStreamAudioDestinationNode|null=null;archiveInput:GainNode|null=null;synthEnabled=true;
 private master!:GainNode;private safety!:GainNode;private bus!:GainNode;private env!:GainNode;private filter!:BiquadFilterNode;private pan!:StereoPannerNode;private wet!:GainNode;private delayFeedback!:GainNode;private delayWet!:GainNode;private oscillators:OscillatorNode[]=[];private levels:GainNode[]=[];private noiseLevels:GainNode[]=[];private mod!:OscillatorNode;private modDepth!:GainNode;private hits:Hit[]=[];private banks:Partial<Record<Character,{osc:OscillatorNode[];levels:GainNode[];gain:GainNode}>>={};private rawNoise!:GainNode;private dry!:GainNode;private drive!:GainNode;private distorted!:GainNode;private bass!:BiquadFilterNode;private gated=false;private envelopeStart=0;private waveform='sine';enabled=false;muted=false;params:AudioParams={frequency:220,amplitude:0,filter:6000,reverb:.18,pan:0,modulation:0,delay:0,resonance:1.2,attack:.07,release:.32,modRate:2.01,roughness:0,weight:.3,brightness:.72};activeVoices=0;
 async init(){
  if(!this.context){
   const ctx=new AudioContext({latencyHint:'interactive'});this.context=ctx;
   this.bus=ctx.createGain();this.env=ctx.createGain();this.env.gain.value=0;this.env.connect(this.bus);
   this.filter=ctx.createBiquadFilter();this.filter.type='lowpass';this.filter.frequency.value=6000;this.pan=ctx.createStereoPanner();
   this.bass=ctx.createBiquadFilter();this.bass.type='lowshelf';this.bass.frequency.value=160;
   this.dry=ctx.createGain();this.drive=ctx.createGain();this.distorted=ctx.createGain();this.distorted.gain.value=0;
   const distortion=ctx.createWaveShaper(),driveCurve=new Float32Array(4096);for(let i=0;i<driveCurve.length;i++)driveCurve[i]=Math.tanh((i*2/(driveCurve.length-1)-1)*2.5);distortion.curve=driveCurve;distortion.oversample='2x';
   this.bus.connect(this.dry).connect(this.bass);this.bus.connect(this.drive).connect(distortion).connect(this.distorted).connect(this.bass);this.bass.connect(this.filter).connect(this.pan);
   this.safety=ctx.createGain();this.safety.gain.value=0;this.pan.connect(this.safety);
   const conv=ctx.createConvolver();const impulse=ctx.createBuffer(2,ctx.sampleRate*2.2,ctx.sampleRate);
   for(let c=0;c<2;c++){const a=impulse.getChannelData(c);for(let i=0;i<a.length;i++)a[i]=(Math.random()*2-1)*Math.pow(1-i/a.length,2.8)*.35;}
   conv.buffer=impulse;this.wet=ctx.createGain();this.wet.gain.value=.18;this.pan.connect(conv).connect(this.wet).connect(this.safety);
   const delay=ctx.createDelay(1);delay.delayTime.value=.32;this.delayFeedback=ctx.createGain();this.delayFeedback.gain.value=0;this.delayWet=ctx.createGain();this.delayWet.gain.value=0;
   this.pan.connect(delay).connect(this.delayWet).connect(this.safety);delay.connect(this.delayFeedback).connect(delay);
   const comp=ctx.createDynamicsCompressor();comp.threshold.value=-10;comp.knee.value=4;comp.ratio.value=20;comp.attack.value=.003;comp.release.value=.18;
   this.archiveInput=ctx.createGain();this.archiveInput.gain.value=.7;this.archiveInput.connect(comp);
   const ceiling=ctx.createWaveShaper();const curve=new Float32Array(2048);for(let i=0;i<curve.length;i++)curve[i]=Math.tanh((i*2/(curve.length-1)-1)*1.2)*.78;ceiling.curve=curve;
   this.master=ctx.createGain();this.master.gain.value=.45;this.analyser=ctx.createAnalyser();this.analyser.fftSize=2048;this.analyser.smoothingTimeConstant=.8;
   this.safety.connect(comp).connect(ceiling).connect(this.master).connect(this.analyser).connect(ctx.destination);this.recordDestination=ctx.createMediaStreamDestination();this.master.connect(this.recordDestination);
   for(const character of ['clean','raw','metal','metallic','dark'] as Character[]){
    const gain=ctx.createGain();gain.gain.value=character==='clean'?1:0;gain.connect(this.env);
    const bank={osc:[] as OscillatorNode[],levels:[] as GainNode[],gain};
    for(let i=0;i<3;i++){const osc=ctx.createOscillator(),g=ctx.createGain();osc.type=character==='metal'?'sawtooth':character==='raw'||character==='dark'?'triangle':'sine';g.gain.value=i===0?.65:0;osc.connect(g).connect(gain);osc.start();bank.osc.push(osc);bank.levels.push(g);}
    this.banks[character]=bank;
   }
   this.oscillators=this.banks.clean!.osc;this.levels=this.banks.clean!.levels;
   this.rawNoise=ctx.createGain();this.rawNoise.gain.value=0;this.rawNoise.connect(this.banks.raw!.gain);
   this.mod=ctx.createOscillator();this.modDepth=ctx.createGain();this.modDepth.gain.value=0;this.mod.connect(this.modDepth).connect(this.oscillators[0].frequency);this.mod.start();
   for(let n=0;n<2;n++){
    const b=ctx.createBuffer(1,ctx.sampleRate*2,ctx.sampleRate),a=b.getChannelData(0);let b0=0,b1=0,b2=0,b3=0,b4=0,b5=0,b6=0;
    for(let i=0;i<a.length;i++){const w=Math.random()*2-1;if(n===0)a[i]=w;else{b0=.99886*b0+w*.0555179;b1=.99332*b1+w*.0750759;b2=.969*b2+w*.153852;b3=.8665*b3+w*.3104856;b4=.55*b4+w*.5329522;b5=-.7616*b5-w*.016898;a[i]=(b0+b1+b2+b3+b4+b5+b6+w*.5362)*.11;b6=w*.115926;}}
    const src=ctx.createBufferSource(),g=ctx.createGain();src.buffer=b;src.loop=true;g.gain.value=0;src.connect(g).connect(this.banks.clean!.gain);if(n===1)src.connect(this.rawNoise);src.start();this.noiseLevels.push(g);
   }
  }
  await this.context.resume();this.enabled=true;this.muted=false;
 }
 private smooth(p:AudioParam,v:number,t:number,tau=.035){p.setTargetAtTime(v,t,tau);}
 update(p:AudioParams,s:Settings,gate:boolean,tracked:boolean,arms=0){
  this.params=p;if(!this.context||!this.enabled)return;const c=this.context,t=c.currentTime;
  const live=tracked&&!this.muted&&this.synthEnabled&&s.output!=='visual';
  this.safety.gain.cancelScheduledValues(t);this.safety.gain.setTargetAtTime(live?1:0,t,live?.015:.08);
  // An audio-clock watchdog releases even when the UI thread stalls.
  if(live)this.safety.gain.setTargetAtTime(0,t+.45,.08);
  this.smooth(this.master.gain,this.muted?0:s.master,t);
  const rough=clamp(p.roughness),weight=clamp(p.weight),brightness=clamp(p.brightness);
  const mix=s.character==='metal'?.65+rough*.35:s.character==='raw'?.2+rough*.65:s.character==='metallic'?rough*.4:s.character==='dark'?rough*.25:rough*.15;
  this.smooth(this.dry.gain,1-mix,t,.04);this.smooth(this.drive.gain,1+rough*22,t,.04);this.smooth(this.distorted.gain,mix/(1+rough*3),t,.04);this.smooth(this.bass.gain,weight*7,t,.04);
  this.smooth(this.filter.frequency,clamp(p.filter*(.25+brightness*1.05),80,12000),t);this.smooth(this.filter.Q,p.resonance,t);
  this.smooth(this.pan.pan,p.pan,t);this.smooth(this.wet.gain,p.reverb,t);this.smooth(this.delayFeedback.gain,clamp(p.delay,0,.65),t);this.smooth(this.delayWet.gain,p.delay*.7,t);
  const noise=s.instrument==='white'||s.instrument==='pink';const wave:OscillatorType=s.instrument==='white'||s.instrument==='pink'||s.instrument==='fm'?'sine':s.instrument;
  if(wave!==this.waveform){for(const o of this.oscillators)o.type=wave;this.waveform=wave;}
  for(const [key,bank] of Object.entries(this.banks)){
   this.smooth(bank!.gain.gain,key===s.character?1:0,t,.035);
   const ratios=key==='metal'?[.5,1.003,1.5]:key==='metallic'?[1,1.4142,2.718]:key==='dark'?[.5,.5015,.75]:[1,.5,1.502];
   bank!.osc.forEach((o,i)=>this.smooth(o.frequency,clamp(p.frequency*ratios[i],25,5500),t,.025));
   bank!.levels.forEach((g,i)=>{let v=i===0?.65:i===1?.23:.12;if(key==='clean'){v=noise?0:i===0?.7:s.mode==='drone'?(i===1?.3:arms>.65?.2:0):0;}if(key==='raw')v=i===0?.16:0;if(i>=s.maxVoices)v=0;this.smooth(g.gain,v,t);});
  }
  this.smooth(this.rawNoise.gain,.18+rough*.28,t);
  this.smooth(this.mod.frequency,p.frequency*p.modRate,t);this.smooth(this.modDepth.gain,s.instrument==='fm'?p.modulation:0,t);
  this.noiseLevels.forEach((g,i)=>this.smooth(g.gain,(s.instrument===(i===0?'white':'pink'))?.45:0,t));
  const active=gate&&live&&s.mode!=='percussion';
  if(active&&!this.gated){this.env.gain.cancelScheduledValues(t);this.env.gain.setTargetAtTime(p.amplitude*.42,t,Math.max(.003,p.attack/3));this.envelopeStart=t;}
  else if(active){const age=t-this.envelopeStart;this.smooth(this.env.gain,p.amplitude*.42*(age<p.attack?1:s.sustain),t,age<p.attack?Math.max(.003,p.attack/3):Math.max(.015,s.decay/3));}
  else if(this.gated){this.env.gain.cancelScheduledValues(t);this.env.gain.setTargetAtTime(0,t,Math.max(.01,p.release/3));}
  this.gated=active;this.hits=this.hits.filter(h=>h.end>t);
  this.activeVoices=(active?(s.character!=='clean'?Math.min(s.maxVoices,3):s.mode==='drone'?Math.min(s.maxVoices,arms>.65?3:2):1):0)+this.hits.length;
 }
 percussion(kind:'kick'|'snare'|'clap',velocity:number,maxVoices:number){
  if(!this.context||!this.enabled||this.muted||!this.synthEnabled)return;const c=this.context,t=c.currentTime;
  this.hits=this.hits.filter(h=>h.end>t);const cap=Math.max(1,maxVoices-(this.gated?1:0));while(this.hits.length>=cap){const old=this.hits.shift()!;old.gain.gain.setTargetAtTime(0,t,.005);try{old.source.stop(t+.02);}catch{}}
  const g=c.createGain();g.gain.value=0;g.connect(this.bus);let src:AudioScheduledSourceNode;const duration=kind==='kick'?.48:kind==='clap'?.25:.19;const level=clamp(velocity,.12,1)*.5;
  if(kind==='kick'){const o=c.createOscillator();o.frequency.setValueAtTime(145,t);o.frequency.exponentialRampToValueAtTime(42,t+.17);o.connect(g);src=o;g.gain.setValueAtTime(level,t);g.gain.exponentialRampToValueAtTime(.0001,t+duration);}
  else{const b=c.createBuffer(1,c.sampleRate*duration,c.sampleRate),a=b.getChannelData(0);for(let i=0;i<a.length;i++)a[i]=Math.random()*2-1;const n=c.createBufferSource(),f=c.createBiquadFilter();n.buffer=b;f.type='highpass';f.frequency.value=kind==='clap'?1100:1900;n.connect(f).connect(g);src=n;
   if(kind==='clap'){for(let i=0;i<3;i++){g.gain.setValueAtTime(level,t+i*.025);g.gain.exponentialRampToValueAtTime(.0001,t+i*.025+.02);}g.gain.setValueAtTime(level*.7,t+.08);g.gain.exponentialRampToValueAtTime(.0001,t+duration);}else{g.gain.setValueAtTime(level,t);g.gain.exponentialRampToValueAtTime(.0001,t+duration);}src.onended=()=>{f.disconnect();g.disconnect();src.disconnect();};
  }
  if(kind==='kick')src.onended=()=>{g.disconnect();src.disconnect();};src.start(t);src.stop(t+duration+.02);this.hits.push({source:src,gain:g,end:t+duration});
 }
 setMaster(value:number){if(this.context)this.master.gain.setTargetAtTime(this.muted?0:clamp(value),this.context.currentTime,.025);}
 setSynthEnabled(value:boolean){this.synthEnabled=value;if(!value&&this.context){const t=this.context.currentTime;this.env.gain.cancelScheduledValues(t);this.env.gain.setTargetAtTime(0,t,.02);this.safety.gain.cancelScheduledValues(t);this.safety.gain.setTargetAtTime(0,t,.02);this.gated=false;}}
 mute(){this.muted=true;this.gated=false;this.activeVoices=0;if(this.context){const t=this.context.currentTime;this.master.gain.cancelScheduledValues(t);this.master.gain.setTargetAtTime(0,t,.008);this.env.gain.cancelScheduledValues(t);this.env.gain.setTargetAtTime(0,t,.008);this.safety.gain.cancelScheduledValues(t);this.safety.gain.setTargetAtTime(0,t,.008);}}
 async disable(){this.mute();this.enabled=false;if(this.context)await this.context.suspend();}
 async dispose(){this.enabled=false;await this.context?.close();this.context=null;}
}
