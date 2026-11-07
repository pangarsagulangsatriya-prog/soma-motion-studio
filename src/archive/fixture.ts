import type {ArchiveProject,ArchiveSource,ArchiveRule,Cue} from './types.ts';

const citation='H. F. Tillema (1919), Kampongwee!, Groningen, hlm. 2; dikutip dalam Arjan Veering (2014), Breaking the Boundaries: The Uniekampong and Modernization of Dock Labour in Tanjung Priok, Batavia (1917–1949), hlm. 225–226, catatan kaki 20.';
const notes='Transkripsi dari gambar yang diberikan pengguna. Buku primer dan halaman Veering belum dibandingkan ulang. Hubungan orang yang tidur dengan kerja pelabuhan dipakai sebagai konteks pertunjukan, tidak dinyatakan langsung oleh fragmen.';
const fragments=[
 ['01','Tablet kina','een paar kinine-tabletten ingenomen','Telah meminum beberapa tablet kina.'],
 ['02','Orang-orang yang tidur','slapende menschen, liggend op de steenkool, blootgesteld aan de steken der beruchte muskieten van Tandjong Priok','Orang-orang yang sedang tidur, berbaring di atas batu bara, terkena gigitan nyamuk Tanjung Priok yang terkenal ganas.'],
 ['03','Komentar pengunjung','Je reinste zelfmoord','Benar-benar bunuh diri.']
];
export const rule=(patch:Partial<ArchiveRule>):ArchiveRule=>({id:'rule-new',name:'Aturan baru',enabled:true,actor:'A',feature:'manual',threshold:.5,hysteresis:.12,dwellMs:120,cooldownMs:700,smoothingMs:100,durationMs:1100,returnMs:1200,intensity:.75,invert:false,resetOnRelease:true,targetWords:'',textAction:'displace',audioAction:'none',segmentIds:[],lowHeight:.3,horizontal:.7,stillMs:1500,lost:'hold-then-fade',...patch});
const cue=(patch:Partial<Cue>):Cue=>({id:'cue',label:'Cue',sourceId:'TIL-1919-NL-02',ruleIds:[],language:'id',layout:'text',durationMs:0,autoNext:false,onGo:'none',resetOnEnter:true,skeleton:'off',mediaAction:'original',mediaStartMs:0,showCitation:false,...patch});
export function tillemaProject():ArchiveProject{
 const sources:ArchiveSource[]=fragments.flatMap(([n,title,nl,id])=>[
  {id:`TIL-1919-NL-${n}`,kind:'text',title:`${title} · Belanda`,author:'H. F. Tillema',year:'1919',citation,language:'nl',originalText:nl,workingTranslation:id,provenance:'transcribed-from-user-image',rights:'Periksa hak edisi dan reproduksi yang dipakai.',notes,createdAt:'1919'},
  {id:`TIL-1919-ID-${n}`,kind:'text',title:`${title} · Indonesia`,author:'Transkripsi terjemahan dari gambar pengguna',year:'1919',citation,language:'id',originalText:id,workingTranslation:'',provenance:'working-transcription-secondary',rights:'Status terjemahan belum diverifikasi.',notes,createdAt:'1919'}
 ]);
 sources.push({id:'TIL-1919-ID-CONTEXT',kind:'text',title:'Konteks perjalanan · transkripsi kerja',author:'Transkripsi terjemahan dari gambar pengguna',year:'1919',citation,language:'id',originalText:'Perjalanan itu terasa menyeramkan. Sebelum berangkat, sebagian besar anggota rombongan yang memahami persoalan tersebut telah meminum beberapa tablet kina. Mereka melakukannya agar tidak terserang malaria selama kunjungan.\n\n[...]\n\nGundukan-gundukan kecil yang baru terlihat setelah diamati dengan saksama ternyata orang-orang yang sedang tidur. Mereka berbaring di atas batu bara, terkena gigitan nyamuk Tanjung Priok yang terkenal ganas.\n\n“Benar-benar bunuh diri,” kata salah seorang anggota rombongan.\n\nSeorang lainnya berkomentar, “Sekarang kita bisa melihat betapa kurangnya pemahaman tentang kesehatan dan kebersihan di kalangan penguasa setempat.”\n\n[...]\n\nKami pulang dengan kesan yang mendalam.',workingTranslation:'',provenance:'working-transcription-secondary',rights:'Status terjemahan belum diverifikasi.',notes:'Teks Indonesia dari layar terjemahan pengguna. Tanda [...] menunjukkan bagian terpotong; bagian itu tidak direkonstruksi.',createdAt:'1919'});
 return {archiveProjectVersion:1,id:'soma-archive-tillema-1919',title:'UNPACKING / Orang-Orang yang Menunggu Kapal',sources,tracks:[],segments:[],
 rules:[
  rule({id:'sleep',name:'TIDUR / Kata bertambah',feature:'low-still',textAction:'accumulate',audioAction:'loop',targetWords:'tidur,berbaring,batu bara,slapende',dwellMs:600,cooldownMs:1200}),
  rule({id:'mosquito',name:'NYAMUK / Sapuan',feature:'swipe',textAction:'scatter',audioAction:'scrub',targetWords:'nyamuk,gigitan,muskieten,steken',dwellMs:0,smoothingMs:45,threshold:.35,cooldownMs:350,resetOnRelease:false}),
  rule({id:'judgment',name:'PENILAIAN / Suara menetap',feature:'still',textAction:'judgment',audioAction:'once',targetWords:'Je,reinste,zelfmoord',dwellMs:800,stillMs:2000,durationMs:5000,resetOnRelease:false}),
  rule({id:'distance',name:'DUA TUBUH / Jarak',feature:'distance',actor:'both',textAction:'displace',audioAction:'crossfade',threshold:0,dwellMs:0,intensity:.8})
 ],
 cues:[
  cue({id:'q0',label:'00 / Baca',language:'both',layout:'split',onGo:'read',showCitation:true}),
  cue({id:'q1',label:'01 / Turun',ruleIds:['sleep'],skeleton:'cue'}),
  cue({id:'q2',label:'02 / Tepis',ruleIds:['mosquito'],skeleton:'cue'}),
  cue({id:'q3',label:'03 / Dua suara',ruleIds:['distance'],language:'both',layout:'split',onGo:'read'}),
  cue({id:'q4',label:'04 / Penilaian',sourceId:'TIL-1919-NL-03',ruleIds:['judgment'],language:'both',layout:'split',onGo:'judgment'}),
  cue({id:'q5',label:'05 / Foto hidup',layout:'live-photo',onGo:'capture',skeleton:'cue'}),
  cue({id:'q6',label:'06 / Kembali',language:'both',layout:'split',onGo:'restore',showCitation:true})
 ],
 calibration:{floorY:.92,standingHipY:.5,left:.04,right:.96,top:.02,bottom:.98,stillSpeed:.04,confidence:.55,lostHoldMs:300},
 output:{ratio:16/9,safeArea:.08,fontSize:.041,lineHeight:1.5,scale:1,ink:'#edf0e5',showComposition:true},
 shortcuts:{go:'Enter',next:'BracketRight',back:'BracketLeft',hold:'KeyH',restore:'KeyR',freeze:'KeyZ',blank:'KeyB',mute:'Space'}
 };
}
