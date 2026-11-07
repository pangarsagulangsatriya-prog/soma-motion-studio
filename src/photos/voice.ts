export type VoiceCommand='camera'|'cancel';
export type VoiceStatus='off'|'starting'|'listening'|'retrying'|'error'|'unsupported';
type Result={isFinal:boolean;length:number;[key:number]:{transcript:string}};
export interface Recognition {
 lang:string;continuous:boolean;interimResults:boolean;maxAlternatives:number;
 onstart:(()=>void)|null;onend:(()=>void)|null;
 onerror:((event:{error:string})=>void)|null;
 onresult:((event:{resultIndex:number;results:{length:number;[key:number]:Result}})=>void)|null;
 start:()=>void;abort:()=>void;
}
export type RecognitionConstructor=new()=>Recognition;
export function recognitionConstructor():RecognitionConstructor|null{
 if(typeof window==='undefined')return null;
 const w=window as unknown as {SpeechRecognition?:RecognitionConstructor;webkitSpeechRecognition?:RecognitionConstructor};
 return w.SpeechRecognition??w.webkitSpeechRecognition??null;
}
export function cameraCommand(transcript:string):VoiceCommand|null{
 const words=transcript.toLocaleLowerCase('id-ID').replace(/[^\p{L}\s]/gu,' ').replace(/\s+/g,' ').trim();
 if(/\b(batal|tutup)( kamera| camera)?\b/u.test(words))return 'cancel';
 return /\b(kamera|camera)\b/u.test(words)?'camera':null;
}
export const voiceLabels:Record<VoiceStatus,string>={off:'Mikrofon mati',starting:'Membuka mikrofon…',listening:'Mendengar “kamera”',retrying:'Menyambungkan suara…',error:'Perintah suara terhenti',unsupported:'Perintah suara belum didukung browser ini'};
/** Only the browser recognition service owns the mic. It never feeds the synth or recorder. */
export class CameraVoice {
 private current:Recognition|null=null;private wanted=false;private timer:ReturnType<typeof setTimeout>|null=null;
 private failures=0;private lastCommand=-Infinity;private lastKind:VoiceCommand|null=null;
 private ctor:RecognitionConstructor|null;private command:(command:VoiceCommand)=>void;private status:(status:VoiceStatus,message:string)=>void;
 constructor(ctor:RecognitionConstructor|null,command:(command:VoiceCommand)=>void,status:(status:VoiceStatus,message:string)=>void){this.ctor=ctor;this.command=command;this.status=status;}
 get enabled(){return this.wanted;}
 start(){if(this.wanted)return;if(!this.ctor){this.status('unsupported',voiceLabels.unsupported);return;}this.wanted=true;this.failures=0;this.connect();}
 private connect(){
  if(!this.wanted||!this.ctor)return;
  let r:Recognition;try{r=new this.ctor();}catch{this.fail('Perintah suara belum tersedia. Gunakan tombol Bingkai kamera.');return;}
  this.current=r;r.lang='id-ID';r.continuous=true;r.interimResults=true;r.maxAlternatives=1;
  const seen=new Set<string>();let started=Date.now();let error=false;
  r.onstart=()=>{if(this.current!==r)return;started=Date.now();this.status('listening',voiceLabels.listening);};
  r.onresult=e=>{
   if(this.current!==r||!this.wanted)return;this.failures=0;
   for(let i=e.resultIndex;i<e.results.length;i++){
    const c=cameraCommand(e.results[i][0]?.transcript??'');if(!c)continue;
    const key=`${i}:${c}`;if(seen.has(key))continue;seen.add(key);
    const now=Date.now();if(c===this.lastKind&&now-this.lastCommand<1400)continue;
    this.lastCommand=now;this.lastKind=c;this.command(c);
   }
  };
  r.onerror=e=>{
   if(this.current!==r||!this.wanted)return;error=true;
   const terminal:Record<string,string>={'not-allowed':'Izin mikrofon ditolak. Izinkan melalui pengaturan browser, lalu aktifkan kembali.','service-not-allowed':'Layanan pengenal suara tidak diizinkan. Gunakan tombol Bingkai kamera.','audio-capture':'Mikrofon belum tersedia. Periksa sambungan dan perangkat masukan.','language-not-supported':'Pengenal suara browser belum mendukung bahasa Indonesia.'};
   if(terminal[e.error]){this.fail(terminal[e.error]);return;}
   if(e.error==='no-speech')return;
   if(++this.failures>=3)this.fail('Suara terputus. Periksa internet, lalu aktifkan kembali atau gunakan tombol Bingkai kamera.');
   else this.status('retrying',e.error==='network'?'Jaringan pengenal suara terputus. Mencoba kembali…':voiceLabels.retrying);
  };
  r.onend=()=>{
   if(this.current!==r||!this.wanted)return;this.current=null;
   if(!error&&Date.now()-started<1000&&++this.failures>=3){this.fail('Pengenal suara berhenti berulang kali. Aktifkan kembali atau gunakan tombol Bingkai kamera.');return;}
   this.status('retrying',voiceLabels.retrying);this.timer=setTimeout(()=>{this.timer=null;this.connect();},700);
  };
  this.status('starting',voiceLabels.starting);try{r.start();}catch{this.fail('Mikrofon belum bisa dimulai. Klik Aktifkan suara sekali lagi.');}
 }
 private halt(){this.wanted=false;if(this.timer)clearTimeout(this.timer);this.timer=null;const r=this.current;this.current=null;if(r){r.onstart=r.onend=r.onerror=r.onresult=null;try{r.abort();}catch{}}}
 private fail(message:string){this.halt();this.status('error',message);}
 stop(){this.halt();this.status('off',voiceLabels.off);}
}
