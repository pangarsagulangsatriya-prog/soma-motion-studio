import {defaultFloorSpace,validateFloorSpace,type FloorSpace} from '../spatial/coordinates.ts';

export type Point3={xM:number;yM:number;zM:number};
export type StageZone={xM:number;yM:number;widthM:number;depthM:number};
export type StageOpticsLayout='two-projector'|'three-projector';
export type StageOpticsPlan={
 schema:'soma.footprints.stage-optics';version:1;
 floor:FloorSpace;layout:StageOpticsLayout;
 zones:{A:StageZone;B:StageZone;crossing:StageZone};
 body:{visibleTopM:number;edgeFeatherM:number};
 devices:{camera:Point3;body:Point3;floorProjector:Point3;bodyB:Point3};
 equipment:{bodyThrowRatioMin:number|null;bodyThrowRatioMax:number|null;
  floorThrowRatioMin:number|null;floorThrowRatioMax:number|null;
  cameraHorizontalFovDeg:number|null};
 notes:string;
};
export type StageOpticsEstimate={
 body:{distanceM:number;imageWidthM:number;throwRatioEstimate:number};
 floor:{distanceM:number;imageWidthM:number;throwRatioEstimate:number};
 bodyB:null|{distanceM:number;imageWidthM:number;throwRatioEstimate:number};
 minimumCameraHorizontalFovDeg:number;
 assumptions:string[];
 warnings:string[];
 status:'design-only';
};
const finite=(x:number)=>Number.isFinite(x);
const round=(n:number)=>Math.round(n*100)/100;
const copy=<T>(value:T):T=>JSON.parse(JSON.stringify(value)) as T;
const mid=(z:StageZone)=>({x:z.xM+z.widthM/2,y:z.yM+z.depthM/2});
const dist=(d:Point3,p:{x:number;y:number;z:number})=>
 Math.hypot(d.xM-p.x,d.yM-p.y,d.zM-p.z);
const stageZone=(zone:StageZone,floor:FloorSpace)=>{
 if(!zone||![zone.xM,zone.yM,zone.widthM,zone.depthM].every(finite)||
  zone.widthM<.25||zone.depthM<.25||zone.xM<0||zone.yM<0||
  zone.xM+zone.widthM>floor.widthM+1e-9||zone.yM+zone.depthM>floor.depthM+1e-9)
  throw Error('Zona gerak harus berada dalam batas lantai dengan ukuran positif.');
};
function point(p:Point3,label:string){
 if(!p||![p.xM,p.yM,p.zM].every(finite)||Math.abs(p.xM)>100||Math.abs(p.yM)>100||
  p.zM<=.5||p.zM>30)throw Error(label+' memerlukan koordinat XYZ meter yang valid.');
}
function ratioRange(min:number|null,max:number|null,label:string){
 if(min===null&&max===null)return;
 if(min===null||max===null||!finite(min)||!finite(max)||min<=0||max>10||min>max)
  throw Error('Rasio lensa '+label+' perlu batas minimum–maksimum yang sesuai perangkat.');
}
export function defaultStageOpticsPlan(floor:FloorSpace=defaultFloorSpace(8,6)):StageOpticsPlan{
 const f=validateFloorSpace(floor),w=f.widthM,d=f.depthM;
 const marginX=Math.min(.65,w*.08),marginY=Math.min(.65,d*.11),gap=Math.min(.8,w*.12);
 const laneWidth=(w-2*marginX-gap)/2;
 return {schema:'soma.footprints.stage-optics',version:1,floor:f,layout:'two-projector',
  zones:{
   A:{xM:marginX,yM:marginY,widthM:laneWidth,depthM:d-2*marginY},
   B:{xM:marginX+laneWidth+gap,yM:marginY,widthM:laneWidth,depthM:d-2*marginY},
   crossing:{xM:w/2-Math.min(.7,w*.1),yM:d*.34,
    widthM:Math.min(1.4,w*.2),depthM:d*.32}
  },
  body:{visibleTopM:1.27,edgeFeatherM:.07},
  devices:{
   camera:{xM:w/2,yM:-4,zM:2.8},
   body:{xM:w/2,yM:-3.7,zM:4.3},
   floorProjector:{xM:w/2,yM:d/2,zM:5.4},
   bodyB:{xM:w*.77,yM:-3.7,zM:4.3}
  },
  equipment:{bodyThrowRatioMin:null,bodyThrowRatioMax:null,
   floorThrowRatioMin:null,floorThrowRatioMax:null,cameraHorizontalFovDeg:null},
  notes:'Acuan gambar panggung: tubuh dari sekitar pinggang sampai kaki, wajah gelap; pad jejak terpisah.'
 };
}
export function validateStageOpticsPlan(input:StageOpticsPlan):StageOpticsPlan{
 if(input?.schema!=='soma.footprints.stage-optics'||input.version!==1||
  !['two-projector','three-projector'].includes(input.layout))
  throw Error('Format desain Stage Optics tidak didukung.');
 const floor=validateFloorSpace(input.floor);
 stageZone(input.zones?.A,floor);stageZone(input.zones?.B,floor);
 stageZone(input.zones?.crossing,floor);
 if(!input.body||!finite(input.body.visibleTopM)||input.body.visibleTopM<.6||
  input.body.visibleTopM>2||!finite(input.body.edgeFeatherM)||
  input.body.edgeFeatherM<0||input.body.edgeFeatherM>.25)
  throw Error('Batas cahaya tubuh/feather harus dalam meter yang valid.');
 point(input.devices?.camera,'Kamera');
 point(input.devices?.body,'Proyektor tubuh');
 point(input.devices?.floorProjector,'Proyektor lantai');
 point(input.devices?.bodyB,'Proyektor tubuh B');
 const e=input.equipment;
 if(!e)throw Error('Spesifikasi perangkat belum diisi.');
 ratioRange(e.bodyThrowRatioMin,e.bodyThrowRatioMax,'tubuh');
 ratioRange(e.floorThrowRatioMin,e.floorThrowRatioMax,'lantai');
 if(e.cameraHorizontalFovDeg!==null&&(!finite(e.cameraHorizontalFovDeg)||
  e.cameraHorizontalFovDeg<5||e.cameraHorizontalFovDeg>179))
  throw Error('FOV kamera harus berada di 5–179 derajat.');
 if(typeof input.notes!=='string'||input.notes.length>2000)throw Error('Catatan terlalu panjang.');
 return copy(input);
}
function requiredCameraFov(cam:Point3,floor:FloorSpace){
 // Horizontal bearings only, referenced to a fixed camera looking toward upstage.
 // Excludes obstruction, vertical field-of-view, lens distortion and pose reliability.
 const corners=[{x:0,y:0},{x:floor.widthM,y:0},
  {x:floor.widthM,y:floor.depthM},{x:0,y:floor.depthM}];
 const bearings=corners.map(p=>Math.atan2(p.x-cam.xM,p.y-cam.yM)*180/Math.PI);
 const sorted=bearings.map(v=>(v+360)%360).sort((a,b)=>a-b);
 const gaps=sorted.map((v,i)=>(i===sorted.length-1?sorted[0]+360:sorted[i+1])-v);
 return round(360-Math.max(...gaps));
}
function requiredThrow(device:Point3,z:StageZone,targetHeightM:number,widthM:number){
 const center=mid(z),distance=dist(device,{...center,z:targetHeightM});
 return {distanceM:round(distance),imageWidthM:round(widthM),
  throwRatioEstimate:round(distance/widthM)};
}
export function assessStageOpticsPlan(raw:StageOpticsPlan):StageOpticsEstimate{
 const p=validateStageOpticsPlan(raw),f=p.floor,warnings:string[]=[];
 const overallX=Math.min(p.zones.A.xM,p.zones.B.xM);
 const overallMaxX=Math.max(p.zones.A.xM+p.zones.A.widthM,p.zones.B.xM+p.zones.B.widthM);
 const overall={xM:overallX,yM:Math.min(p.zones.A.yM,p.zones.B.yM),
  widthM:overallMaxX-overallX,
  depthM:Math.max(p.zones.A.yM+p.zones.A.depthM,p.zones.B.yM+p.zones.B.depthM)-
   Math.min(p.zones.A.yM,p.zones.B.yM)};
 const body=requiredThrow(p.devices.body,p.layout==='two-projector'?overall:p.zones.A,
  p.body.visibleTopM/2,p.layout==='two-projector'?overall.widthM:p.zones.A.widthM);
 const floor=requiredThrow(p.devices.floorProjector,
  {xM:0,yM:0,widthM:f.widthM,depthM:f.depthM},0,f.widthM);
 const bodyB=p.layout==='three-projector'?requiredThrow(p.devices.bodyB,p.zones.B,
  p.body.visibleTopM/2,p.zones.B.widthM):null;
 const fov=requiredCameraFov(p.devices.camera,f);
 const {bodyThrowRatioMin:bodyMin,bodyThrowRatioMax:bodyMax,
  floorThrowRatioMin:floorMin,floorThrowRatioMax:floorMax,cameraHorizontalFovDeg:cameraFov}=p.equipment;
 if(bodyMin===null||bodyMax===null)warnings.push('Lensa proyektor tubuh belum dicatat: cek throw ratio perangkat.');
 else if(body.throwRatioEstimate<bodyMin||body.throwRatioEstimate>bodyMax)
  warnings.push('Perkiraan kebutuhan lensa proyektor tubuh di luar rentang yang diisi.');
 if(floorMin===null||floorMax===null)warnings.push('Lensa proyektor lantai belum dicatat: cek throw ratio perangkat.');
 else if(floor.throwRatioEstimate<floorMin||floor.throwRatioEstimate>floorMax)
  warnings.push('Perkiraan kebutuhan lensa proyektor lantai di luar rentang yang diisi.');
 if(bodyB&&bodyMin!==null&&bodyMax!==null&&
  (bodyB.throwRatioEstimate<bodyMin||bodyB.throwRatioEstimate>bodyMax))
  warnings.push('Perkiraan lensa proyektor tubuh B di luar rentang yang diisi.');
 if(cameraFov===null)warnings.push('Field of view kamera belum diukur; uji keterbacaan seluruh telapak.');
 else if(cameraFov+1e-8<fov)warnings.push('FOV kamera lebih sempit daripada perkiraan lebar cakupan lantai.');
 if(p.zones.A.xM+p.zones.A.widthM>p.zones.B.xM)
  warnings.push('Zona A dan B bertumpang tindih; pastikan crossing tidak mengganggu pembacaan identitas.');
 if(p.body.visibleTopM>1.45)warnings.push('Batas atas tubuh relatif tinggi; periksa risiko cahaya menyentuh dada/wajah.');
 if(p.layout==='two-projector')
  warnings.push('Satu proyektor tubuh untuk A/B: risiko occlusion dan kekurangan resolusi saat crossing.');
 warnings.push('Sudut elevasi, bayangan, tepi cahaya, keamanan rigging dan intensitas RGB wajib diperiksa secara fisik.');
 return {body,floor,bodyB,minimumCameraHorizontalFovDeg:fov,
  warnings,status:'design-only',
  assumptions:[
   'Throw ratio dihitung secara kasar dari jarak tiga dimensi / lebar bidang; hasil bukan kalkulator lensa.',
   'Asumsi tubuh pada tinggi rata-rata setengah zona yang disinari, lantai datar, kamera mengarah upstage.',
   'Estimasi FOV hanya sudut horizontal ke empat sudut lantai; tidak memeriksa sudut vertikal atau oklusi.',
   'Seluruh koordinat adalah titik awal tata panggung, bukan ukuran hasil survei perangkat.'
  ]};
}
export function stageOpticsPlanExport(raw:StageOpticsPlan){
 const plan=validateStageOpticsPlan(raw);
 return {plan,estimate:assessStageOpticsPlan(plan),savedAt:new Date().toISOString(),
  purpose:'rehearsal design only; no live output or calibrated hardware approval'};
}
