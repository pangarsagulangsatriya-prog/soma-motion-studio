/** Compose-only procedural material synthesis. No microphone or pressure input.
 * Pure seeded PCM, finite duration; original AudioEngine owns output and safety. */
export const TEXTURES={
 grit:{label:'GRIT',description:'Gesekan kering dan butiran kasar',drive:.76,texture:.65,space:.24,duration:.26,character:'raw'},
 crush:{label:'CRUSH',description:'Benturan pecah dan padat',drive:.90,texture:.40,space:.12,duration:.32,character:'metal'},
 fracture:{label:'FRACTURE',description:'Derau tersendat, bitcrush dan stutter',drive:.62,texture:.85,space:.20,duration:.34,character:'metal'},
 metalSkin:{label:'METAL SKIN',description:'Pelat bergetar, FM dan resonansi',drive:.55,texture:.72,space:.48,duration:.46,character:'metallic'},
 subPressure:{label:'SUB PRESSURE',description:'Getaran rendah tersaturasi',drive:.70,texture:.25,space:.18,duration:.38,character:'dark'},
 erosion:{label:'EROSION',description:'Butiran bertumpuk dan meluruh',drive:.48,texture:.80,space:.78,duration:.48,character:'raw'}
} as const;
export type TextureId=keyof typeof TEXTURES;
export type TextureControls={drive:number;texture:number;space:number};
export type TextureGesture='contact'|'movement'|'slide'|'pivot';
export const isTexture=(id:string):id is TextureId=>Object.prototype.hasOwnProperty.call(TEXTURES,id);
const clamp=(v:number,a=0,b=1)=>Number.isFinite(v)?Math.min(b,Math.max(a,v)):a;
export function textureControls(id:TextureId):TextureControls{const p=TEXTURES[id];return {drive:p.drive,texture:p.texture,space:p.space};}
function seedOf(value:string){let s=2166136261;for(let i=0;i<value.length;i++){s^=value.charCodeAt(i);s=Math.imul(s,16777619);}return s>>>0||1;}
export function texturePCM(id:TextureId,controls:TextureControls,event:{kind:TextureGesture;speed:number;x:number;y:number;headingRad?:number;eventId:string},sampleRate:number){
 const sr=Math.round(clamp(sampleRate,8000,96000)),p=TEXTURES[id],drive=clamp(controls.drive),texture=clamp(controls.texture),space=clamp(controls.space),speed=clamp(event.speed),contact=event.kind==='contact',slide=event.kind==='slide',pivot=event.kind==='pivot';
 const dur=contact?p.duration:(slide||pivot)? .18 : .12;
 const n=Math.max(1,Math.round(sr*dur)),out=new Float32Array(n);let state=seedOf(event.eventId),slow=0,prev=0,held=0,phase=0;
 const rand=()=>{state^=state<<13;state^=state>>>17;state^=state<<5;return (state>>>0)/2147483648-1;};
 const base=42+40*(1-clamp(event.y))+speed*24,spin=pivot?1+Math.abs(Math.sin(event.headingRad??0))*1.4:1;
 const hold=Math.max(2,Math.round(sr/(1700+texture*3800))),bits=Math.round(3+5*(1-texture)),quant=2**bits;
 const lag=Math.max(1,Math.floor(sr*(.022+space*.035))),tau=2*Math.PI;
 const grain=.024+(.035*(1-texture)),grainRate=1/grain,grainCount=Math.ceil(dur*grainRate*2)+3;
 const offsets=Array.from({length:grainCount},()=>rand()*Math.PI),rates=Array.from({length:grainCount},()=>.7+rand()*.28);
 for(let i=0;i<n;i++){
  const t=i/sr,u=i/n,w=rand();slow+=.08*(w-slow);const grit=w-slow*.8,edge=grit-prev;prev=grit;
  phase+=tau*base*(1+.15*speed)/sr;
  let v=0;
  switch(id){
   case 'grit':v=(.72*grit+.18*slow+.10*Math.sin(phase))*(.55+.45*Math.sin(tau*(22+speed*48+texture*40)*t)**2);break;
   case 'crush':v=Math.tanh((Math.sin(phase*(1.15-.2*u))*.78+edge*.36*Math.exp(-u*5)+slow*.28)*(2+drive*12));break;
   case 'fracture':{const stutter=1/(14+speed*26+texture*20),cycle=t%stutter;const on=cycle<stutter*(.32+speed*.30)?Math.min(1,cycle/.002)*Math.min(1,(stutter*(.32+speed*.30)-cycle)/.002):0;if(i%hold===0)held=Math.round((.55*grit+.45*Math.sin(phase*3.7))*quant)/quant;v=held*on;break;}
   case 'metalSkin':v=.48*Math.sin(tau*base*4.1*t*spin+Math.sin(tau*base*2.73*t)*(1+texture*6))+.27*Math.sin(tau*base*7.17*t*spin)+.12*Math.sin(tau*base*11.41*t)+.13*grit*Math.exp(-u*9);break;
   case 'subPressure':v=Math.tanh((Math.sin(phase*.84)+.25*Math.sin(phase*1.68)+.17*slow)*(1.5+drive*6))*.88;break;
   case 'erosion':{const k=Math.floor(t*grainRate*2);for(let j=Math.max(0,k-2);j<=k;j++){const g=(t-j*grain/2)/grain;if(g>=0&&g<=1){const win=Math.sin(Math.PI*g)**2;v+=win*(.38*Math.sin(tau*base*3.2*rates[j]*t+offsets[j])+.34*grit+.24*slow)*.5;}}if(i>=lag)v+=out[i-lag]*Math.min(.38,space*.48);break;}
  }
  const attack=Math.min(1,t/(contact?.004:.012)),release=Math.min(1,(dur-t)/.025),decay=contact?Math.exp(-u*(id==='metalSkin'||id==='erosion'?2.2:4.1)):1;
  const gain=(contact?.52:.20+speed*.24)*(slide?1.1:1),shaped=Math.tanh(v*(1+drive*5));
  out[i]=clamp(shaped*attack*release*decay*gain,-.75,.75);
 }
 return out;
}
/** Motion texture density changes with speed, never confidence-as-pressure. */
export function textureInterval(speed:number,texture:number){return Math.round(150-65*clamp(speed)-35*clamp(texture));}
