import {identityQuad,validQuad,correspondence,type Quad} from '../../projection/geometry.ts';
import {projectionDefaults,type ProjectionConfig,type ProjectionState} from '../../projection/model.ts';

export type StageSurface='body'|'floor';
export type StageSurfacePlan={
 schema:'soma.footprints.stage-surface';version:1;surface:StageSurface;
 sourceQuad:Quad;projectorQuad:Quad;brightness:number;resolution:'720p'|'1080p';
};
export type StageSurfaceTarget={id:string;label:string;uv:{x:number;y:number}};
export const SURFACE_TARGETS:Record<StageSurface,StageSurfaceTarget[]>={
 body:[
  {id:'B1',label:'A diam',uv:{x:.25,y:.3}},
  {id:'B2',label:'B diam',uv:{x:.75,y:.3}},
  {id:'B3',label:'A berjalan',uv:{x:.25,y:.65}},
  {id:'B4',label:'B berjalan',uv:{x:.75,y:.65}},
  {id:'B5',label:'Crossing aman',uv:{x:.5,y:.5}}
 ],
 floor:[
  {id:'F1',label:'Kiri belakang',uv:{x:.2,y:.2}},
  {id:'F2',label:'Kanan belakang',uv:{x:.8,y:.2}},
  {id:'F3',label:'Tengah',uv:{x:.5,y:.5}},
  {id:'F4',label:'Kiri depan',uv:{x:.2,y:.8}},
  {id:'F5',label:'Kanan depan',uv:{x:.8,y:.8}}
 ]
};
export type SurfaceSample={
 id:string;dxCm:number;dyCm:number;method:'physical-markers-and-observed-image';
};
export type StageSurfaceChecklist={
 fixedOptics:boolean;blackoutObserved:boolean;noUnsafeSpill:boolean;
};
export type SurfaceProof={
 signature:string;surface:StageSurface;reviewer:string;
 notes:string;checklist:StageSurfaceChecklist;samples:SurfaceSample[];
 completedAt:string|null;
};
export type SurfaceAssessment={
 status:'incomplete'|'needs-adjustment'|'within-provisional-target';
 rmseCm:number|null;p95Cm:number|null;maximumCm:number|null;
 count:number;required:number;missing:string[];
};
export type StageOutputContext={
 cameraBinding:string|null;floorContext:string|null;windowSession:string;
 viewport:{width:number;height:number;dpr:number}|null;
};
const finite=(v:number)=>typeof v==='number'&&Number.isFinite(v);
const round=(n:number)=>Math.round(n*100)/100;
const percentile=(values:number[],fraction:number):number|null=>{
 if(!values.length)return null;
 const sorted=[...values].sort((a,b)=>a-b),q=(sorted.length-1)*fraction;
 return round(sorted[Math.floor(q)]+(sorted[Math.ceil(q)]-sorted[Math.floor(q)])*
  (q-Math.floor(q)));
};
export function defaultStageSurfacePlan(surface:StageSurface):StageSurfacePlan{
 return {schema:'soma.footprints.stage-surface',version:1,surface,
  sourceQuad:identityQuad(),projectorQuad:identityQuad(),
  resolution:'720p',brightness:surface==='body'?.32:.38};
}
export function validateStageSurfacePlan(value:StageSurfacePlan):StageSurfacePlan{
 if(!value||value.schema!=='soma.footprints.stage-surface'||value.version!==1||
  !['body','floor'].includes(value.surface)||!validQuad(value.sourceQuad)||
  !validQuad(value.projectorQuad)||!['720p','1080p'].includes(value.resolution)||
  !finite(value.brightness)||value.brightness<0||value.brightness>.6)
  throw Error('Bidang proyeksi, quad atau batas kecerahan tidak valid.');
 correspondence(value.sourceQuad,value.projectorQuad);
 return {...value,sourceQuad:value.sourceQuad.map(p=>({...p})) as Quad,
  projectorQuad:value.projectorQuad.map(p=>({...p})) as Quad};
}
export function stageSurfaceSignature(plan:StageSurfacePlan,context:StageOutputContext){
 const p=validateStageSurfacePlan(plan),v=context?.viewport;
 if(!context?.cameraBinding||!context.floorContext||!context.windowSession||!v||
  !finite(v.width)||!finite(v.height)||!finite(v.dpr)||
  v.width<320||v.height<180||v.dpr<=0)
  return null;
 return JSON.stringify([p,context.cameraBinding,context.floorContext,
  context.windowSession,Math.round(v.width),Math.round(v.height),round(v.dpr)]);
}
export function emptySurfaceProof(plan:StageSurfacePlan,signature:string):SurfaceProof{
 if(!signature)throw Error('Output harus terhubung untuk membuat identitas kalibrasi.');
 return {signature,surface:plan.surface,reviewer:'',notes:'',
  checklist:{fixedOptics:false,blackoutObserved:false,noUnsafeSpill:false},
  samples:[],completedAt:null};
}
export function recordSurfaceSample(proof:SurfaceProof,id:string,dxCm:number,dyCm:number):SurfaceProof{
 if(!SURFACE_TARGETS[proof.surface].some(t=>t.id===id)||
  !finite(dxCm)||!finite(dyCm)||Math.abs(dxCm)>100||Math.abs(dyCm)>100)
  throw Error('Ukur selisih posisi cahaya dari target fisik dalam sentimeter.');
 return {...proof,completedAt:null,samples:[
  ...proof.samples.filter(s=>s.id!==id),
  {id,dxCm,dyCm,method:'physical-markers-and-observed-image'}
 ]};
}
export function assessSurfaceProof(plan:StageSurfacePlan,signature:string|null,
 proof:SurfaceProof|null):SurfaceAssessment{
 const missing:string[]=[];
 if(!signature)missing.push('Kamera, lantai atau jendela proyektor belum terhubung.');
 if(!proof||proof.signature!==signature||proof.surface!==plan.surface)
  missing.push('Uji fisik sebelumnya tidak cocok dengan output/perangkat/kalibrasi aktif.');
 const valid=proof&&proof.signature===signature&&proof.surface===plan.surface?
  proof.samples.filter(s=>SURFACE_TARGETS[plan.surface].some(t=>t.id===s.id)&&
   finite(s.dxCm)&&finite(s.dyCm)):[];
 const byId=new Map(valid.map(s=>[s.id,s]));
 const errors=[...byId.values()].map(s=>Math.hypot(s.dxCm,s.dyCm));
 const count=byId.size,required=SURFACE_TARGETS[plan.surface].length;
 const rmse=count?round(Math.sqrt(errors.reduce((a,b)=>a+b*b,0)/count)):null;
 const p95=percentile(errors,.95),maximum=count?round(Math.max(...errors)):null;
 if(count<required)missing.push('Lima pengukuran fisik independen belum lengkap.');
 if(!proof?.reviewer.trim()||!proof.completedAt)
  missing.push('Pemeriksa belum menutup dan menandatangani uji fisik.');
 if(!proof||!Object.values(proof.checklist).every(Boolean))
  missing.push('Optik tetap, Blackout fisik dan kebocoran cahaya belum semuanya diperiksa.');
 const status=missing.length?'incomplete':
  (rmse! <= (plan.surface==='body'?12:8)&&p95! <= (plan.surface==='body'?20:15))?
   'within-provisional-target':'needs-adjustment';
 return {status,rmseCm:rmse,p95Cm:p95,maximumCm:maximum,count,required,missing};
}
export function stageSurfaceState(plan:StageSurfacePlan,mode:'blackout'|'test'|'live',
 safe:boolean):ProjectionState{
 const p=validateStageSurfacePlan(plan);
 const config:ProjectionConfig={
  ...projectionDefaults(),mode:'screen',mirror:false,brightness:p.brightness,
  resolution:p.resolution,quad:p.projectorQuad,
  registration:{enabled:true,source:p.sourceQuad,destination:p.projectorQuad}
 };
 // Test and video are delivered as ARTWORK canvases only. No stage-wide
 // pattern flag, which would illuminate the entire body projector field.
 const live=safe&&(mode==='test'||mode==='live');
 return {config,transport:live?'live':'blackout',pattern:false,
  blank:!live,tracking:live,quality:live?1:0,sampleAge:0,
  reason:live?(mode==='test'?'Optical target (manual)': 'Stage output (manual armed)'):
   'Stage surface locked in blackout',opacity:1,image:null};
}
/** Normalized 16:9 artwork for Resolume / OBS capture.
 * Keeps physical projector warp and brightness out of the clean signal. */
export function cleanFeedSurfaceState(plan:StageSurfacePlan):ProjectionState{
 const p=validateStageSurfacePlan(plan),defaults=projectionDefaults();
 return {
  ...stageSurfaceState(p,'live',true),
  config:{...defaults,mode:'screen',mirror:false,brightness:1,
   resolution:p.resolution,quad:identityQuad(),
   registration:{...defaults.registration,enabled:false}
  },
  reason:'Clean Feed software capture · physical mapping handled downstream'
 };
}
export function outputSurfaceDecision(args:{
 plan:StageSurfacePlan;signature:string|null;proof:SurfaceProof|null;
 requested:'blackout'|'test'|'live';connected:boolean;cameraSafe:boolean;
 bridgeSafe:boolean;operatorArmed:boolean;sourceFresh:boolean;
}):{mode:'blackout'|'test'|'live';reason:string;assessment:SurfaceAssessment}{
 const assessment=assessSurfaceProof(args.plan,args.signature,args.proof);
 if(!args.connected)return {mode:'blackout',reason:'Output belum tersambung.',assessment};
 if(args.requested==='test'){
  if(!args.cameraSafe||!args.sourceFresh)
   return {mode:'blackout',reason:'Mask/kalibrasi belum aman untuk test terbatas.',assessment};
  return {mode:'test',reason:'Target mask terbatas; operator wajib mengawasi lampu.',assessment};
 }
 if(args.requested!=='live')return {mode:'blackout',reason:'Blackout manual.',assessment};
 if(!args.cameraSafe||!args.sourceFresh||!args.bridgeSafe)
  return {mode:'blackout',reason:'Tracking/identitas/Footprints tidak siap.',assessment};
 if(!args.operatorArmed||assessment.status!=='within-provisional-target')
  return {mode:'blackout',reason:'Uji fisik atau izin operator belum lengkap.',assessment};
 return {mode:'live',reason:'Live bersyarat: visual perlu diperiksa di panggung.',assessment};
}
export function stageSurfaceReport(plan:StageSurfacePlan,proof:SurfaceProof|null,
 context:StageOutputContext){
 const signature=stageSurfaceSignature(plan,context);
 return {schema:'soma.footprints.dual-surface-qa',version:1,
  exportedAt:new Date().toISOString(),plan:validateStageSurfacePlan(plan),
  context,proof,assessment:assessSurfaceProof(plan,signature,proof),
  caveat:'Seluruh galat dimasukkan operator dari pengukuran nyata; jendela browser belum mengukur posisi cahaya atau permukaan tubuh 3D. Tidak menyatakan penerimaan Production.'};
}
