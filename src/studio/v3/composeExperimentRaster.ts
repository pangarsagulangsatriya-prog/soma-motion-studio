/** Track owns MP4/3D decoding and tracking. Compose may reuse its raster,
 * never infer live camera calibration or authorize physical projection.
 */
export type ComposeExperimentView='input'|'surface'|'split';
export type ComposeExperimentSource='video'|'simulator'|null;
export type ComposeExperimentSurface='BODY A'|'BODY B'|'FLOOR';
export function composeExperimentRaster(input:{
 source:ComposeExperimentSource;view:ComposeExperimentView;
 selected:ComposeExperimentSurface;physical:boolean;
}):'input'|'body'|'floor'|'none'{
 if(!input.source||input.physical)return 'none';
 if(input.view==='input')return 'input';
 return input.selected==='FLOOR'?'floor':'body';
}
export function composeExperimentStatus(source:ComposeExperimentSource,ready:boolean,
 selected:ComposeExperimentSurface):string{
 if(!source)return '';
 if(!ready)return source==='video'?'MP4 belum menghasilkan frame video. Buka Track untuk memutar video.':'Simulasi 3D belum siap.';
 return (source==='video'?'MP4':'3D')+' · '+selected+
  ' · preview software, kalibrasi proyektor belum berlaku';
}
export function composeExperimentAllowsPhysicalOutput(source:ComposeExperimentSource):boolean{
 return source===null;
}
