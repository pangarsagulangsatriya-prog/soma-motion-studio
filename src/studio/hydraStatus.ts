let status='Hydra menunggu kanvas';const listeners=new Set<()=>void>();
export const hydraStatus={get:()=>status,subscribe:(fn:()=>void)=>{listeners.add(fn);return()=>{listeners.delete(fn);};},set:(value:string)=>{if(status!==value){status=value;listeners.forEach(fn=>fn());}}};
