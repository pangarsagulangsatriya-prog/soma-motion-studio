/** F6 Floor-specific amplitude analysis. The existing SOMA AudioEngine
 * analyser may be reused directly; microphone capture needs a user gesture.
 * Mic is never connected to speakers or network, and tracks are stopped. */
export type FloorAudioSource='off'|'soma'|'microphone';
const clamp=(v:number)=>Math.max(0,Math.min(1,v));
export class FloorAudioReactive{
 private stream:MediaStream|null=null;
 private ctx:AudioContext|null=null;
 private analyser:AnalyserNode|null=null;
 private data:Uint8Array<ArrayBuffer>|null=null;
 private smoothed=0;
 get microphoneActive(){return !!this.stream&&this.stream.getAudioTracks().some(t=>t.readyState==='live');}
 async enableMicrophone(){
  await this.disable();
  if(typeof navigator==='undefined'||!navigator.mediaDevices?.getUserMedia)
   throw Error('Browser tidak menyediakan input mikrofon.');
  let stream:MediaStream|null=null,ctx:AudioContext|null=null;
  try{
   stream=await navigator.mediaDevices.getUserMedia({audio:{
    echoCancellation:false,noiseSuppression:false,autoGainControl:false},video:false});
   if(!stream.getAudioTracks().length)throw Error('Tidak ada jalur audio.');
   ctx=new AudioContext({latencyHint:'interactive'});
   const input=ctx.createMediaStreamSource(stream);
   const analyser=ctx.createAnalyser();
   analyser.fftSize=1024;analyser.smoothingTimeConstant=.74;
   input.connect(analyser);
   await ctx.resume();
   this.stream=stream;this.ctx=ctx;this.analyser=analyser;
   this.data=new Uint8Array(analyser.frequencyBinCount);
   this.smoothed=0;
  }catch(error){
   stream?.getTracks().forEach(t=>t.stop());
   try{await ctx?.close();}catch{}
   throw error;
  }
 }
 sample(source:FloorAudioSource,external:AnalyserNode|null=null){
  if(source==='off'){this.smoothed=0;return 0;}
  const analyser=source==='soma'?external:this.analyser;
  if(!analyser){this.smoothed*=.8;return this.smoothed;}
  if(!this.data||this.data.length!==analyser.frequencyBinCount)
   this.data=new Uint8Array(analyser.frequencyBinCount);
  analyser.getByteFrequencyData(this.data);
  let sum=0;
  // Capture lower/middle frequencies that carry footsteps, voice and music.
  const count=Math.min(this.data.length,196);
  for(let i=2;i<count;i++)sum+=(this.data[i]/255)**2;
  const power=Math.sqrt(sum/Math.max(1,count-2));
  const level=clamp(Math.max(0,(power-.035)*2.7));
  this.smoothed+=(level-this.smoothed)*(level>this.smoothed?.35:.12);
  return this.smoothed;
 }
 async disable(){
  this.stream?.getTracks().forEach(track=>track.stop());
  this.stream=null;this.analyser=null;this.data=null;this.smoothed=0;
  const ctx=this.ctx;this.ctx=null;
  try{await ctx?.close();}catch{}
 }
}
