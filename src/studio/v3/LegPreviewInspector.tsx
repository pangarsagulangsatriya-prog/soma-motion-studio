export type LegPreviewTuning={
 thighStartRatio:number;includePelvis:boolean;featherPx:number;minimumVisibility:number;
};
export const LEG_PREVIEW_TUNING_DEFAULT:LegPreviewTuning={
 thighStartRatio:.12,includePelvis:false,featherPx:2,minimumVisibility:.58
};
export function validateLegPreviewTuning(value:unknown):LegPreviewTuning{
 const v=value as Partial<LegPreviewTuning>|null;
 if(!v||typeof v!=='object'||typeof v.includePelvis!=='boolean'||
  typeof v.thighStartRatio!=='number'||!Number.isFinite(v.thighStartRatio)||v.thighStartRatio<0||v.thighStartRatio>.4||
  typeof v.featherPx!=='number'||!Number.isInteger(v.featherPx)||v.featherPx<0||v.featherPx>8||
  typeof v.minimumVisibility!=='number'||!Number.isFinite(v.minimumVisibility)||
  v.minimumVisibility<.4||v.minimumVisibility>.95)
  throw Error('Pengaturan mask di luar batas aman.');
 return {...v} as LegPreviewTuning;
}
export function LegPreviewInspector({value,onChange,trackingReady}:{value:LegPreviewTuning;
 onChange:(patch:Partial<LegPreviewTuning>)=>void;trackingReady:boolean}){
 const range=(key:'thighStartRatio'|'featherPx'|'minimumVisibility',label:string,min:number,max:number,step:number,unit:string,multiplier=1)=>
  <label className="msv4-parameter"><span>{label}<output>{(value[key]*multiplier).toFixed(multiplier===100?0:1)} {unit}</output></span>
   <input type="range" min={min} max={max} step={step} value={value[key]}
    onChange={e=>onChange({[key]:Number(e.currentTarget.value)})}/></label>;
 return <section className="msv4-leg-editor" aria-label="Lower body mask preview controls">
  <div className="msv4-inspector-group-title">LEG · LIVE MASK PREVIEW</div>
  <p className="msv4-editor-hint" role="status">{trackingReady?
   'Tracking tersedia; editor mask mengikuti landmark kamera saat pose aman.':
   'Kamera tidak aktif; contoh siluet hanya ilustrasi.'}</p>
  {range('thighStartRatio','Upper thigh cutoff',0,.4,.01,'%',100)}
  {range('featherPx','Inward feather',0,8,1,'px')}
  {range('minimumVisibility','Landmark threshold',.4,.95,.01,'%',100)}
  <label className="msv4-inline-check"><input type="checkbox" checked={value.includePelvis}
   onChange={e=>onChange({includePelvis:e.currentTarget.checked})}/> Include pelvis in software preview</label>
  <p className="msv4-editor-hint">Eksperimen software-only. Mapping projector LEG tetap memakai mask dasar yang diuji secara terpisah. Jika dua aktor beririsan atau identitas tidak pasti, mask mati.</p>
 </section>;
}
