import type {FootprintConfig,FootprintStyle} from '../../footprints/StudioFootprints.tsx';

type Props={value:FootprintConfig;onChange:(patch:Partial<FootprintConfig>)=>void};
export function MappingStudioFootprintControls({value,onChange}:Props){
 const numeric=(label:string,key:'size'|'life'|'delay',min:number,max:number,step:number,unit:string)=>
  <label className="msv4-parameter" key={key}><span>{label}<output>{value[key]} {unit}</output></span>
   <input type="range" value={value[key]} min={min} max={max} step={step}
    onChange={event=>onChange({[key]:Number(event.currentTarget.value)})}/>
  </label>;
 return <section className="msv4-footprint-editor" aria-label="Footprint geometry dan timing">
  <div className="msv4-inspector-group-title">FOOTPRINT GEOMETRY</div>
  <label className="msv4-select">Visual shape<select value={value.style}
   onChange={event=>onChange({style:event.target.value as FootprintStyle})}>
   {(['Campuran','Tapak','Garis','Titik'] as const).map(shape=><option key={shape} value={shape}>{shape}</option>)}
  </select></label>
  {numeric('Footprint size','size',12,90,1,'px')}
  {numeric('Hold / lifetime','life',1,60,1,'s')}
  {numeric('Response delay','delay',0,2,.1,'s')}
  <div className="msv4-inspector-group-title">MATERIAL & COLOR</div>
  <div className="msv4-color-fields">
   {([['left','Left foot'],['right','Right foot'],['background','Background']] as const).map(([side,name])=>
    <label key={side}>{name}<input type="color" value={value.colors[side]} aria-label={name+' color'}
     onChange={event=>onChange({colors:{...value.colors,[side]:event.currentTarget.value}})}/></label>)}
  </div>
  <label className="msv4-inline-check"><input type="checkbox" checked={value.showTrail}
   onChange={event=>onChange({showTrail:event.currentTarget.checked})}/> Draw movement trails</label>
  <label className="msv4-inline-check"><input type="checkbox" checked={value.showLive}
   onChange={event=>onChange({showLive:event.currentTarget.checked})}/> Show live feet</label>
  <p className="msv4-editor-hint">Ukuran saat ini memakai piksel pada renderer Footprints yang tersedia.
   Kalibrasi panjang telapak dalam meter mengikuti pekerjaan FLOOR Map pada PRD.</p>
 </section>;
}
